module Api
  module V1
    module Ai
      class PredictionsController < BaseController
        # POST /api/v1/ai/transform_viewpoint
        # Takes a viewpoint photo + garden plan + years → generates future visualization with AI image
        def transform_viewpoint
          # Get the viewpoint photo
          viewpoint_photo = ViewpointPhoto.find_by(id: params[:viewpoint_photo_id])
          unless viewpoint_photo
            return render_error('Viewpoint photo not found', status: :not_found)
          end

          # Update camera position and direction if provided
          if params[:camera_position].present? || params[:camera_direction].present?
            update_attrs = {}
            update_attrs[:camera_position] = params[:camera_position] if params[:camera_position].present?
            update_attrs[:camera_direction] = params[:camera_direction].to_f if params[:camera_direction].present?
            viewpoint_photo.update(update_attrs)
          end

          # Get the garden plan (or use plants directly from params)
          plants = params[:plants] || []
          if params[:garden_plan_id].present?
            garden_plan = GardenPlan.find_by(id: params[:garden_plan_id])
            if garden_plan
              # Convert ActiveRecord plants to hashes for filtering
              plants = garden_plan.plants.map do |p|
                {
                  'id' => p.id,
                  'species' => p.species,
                  'common_name' => p.common_name,
                  'category' => p.category,
                  'latitude' => p.latitude.to_f,
                  'longitude' => p.longitude.to_f,
                  'planted_date' => p.planted_date&.to_s,
                  'x' => p.metadata&.dig('x'),
                  'y' => p.metadata&.dig('y')
                }
              end
            end
          end

          target_years = (params[:target_years] || params[:targetYears] || params[:target_year])&.to_i || 5
          season = params[:season] || 'summer'

          # Filter plants to those visible in this photo's coverage area
          visible_plants = filter_plants_in_coverage(plants, viewpoint_photo.coverage_area)

          # Generate the scene description and AI image
          gemini = GeminiService.new
          result = gemini.generate_viewpoint_transformation(
            viewpoint_photo: viewpoint_photo,
            plants: visible_plants,
            target_years: target_years,
            season: season
          )

          render_success({
            success: true,
            generated_image_base64: result[:image_base64],
            generated_image_url: result[:image_url],
            scene_description: result[:scene_description],
            prompt_used: result[:prompt],
            image_prompt_used: result[:image_prompt],
            plants_shown: result[:plants_shown]
          })
        rescue => e
          Rails.logger.error("Transform viewpoint error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
          render_error("Failed to generate transformation: #{e.message}")
        end

        # POST /api/v1/ai/generate_prediction
        # Text-only prediction for garden growth
        def generate_prediction
          target_years = (params[:target_years] || params[:targetYears])&.to_i
          unless target_years && target_years.between?(1, 50)
            return render_error('target_years must be between 1 and 50', status: :bad_request)
          end

          plants = params[:plants] || []
          zones = params[:zones] || []
          structures = params[:structures] || []
          season = params[:season] || 'summer'

          gemini = GeminiService.new
          prediction = gemini.generate_garden_prediction(
            plants: plants,
            zones: zones,
            structures: structures,
            target_years: target_years,
            season: season
          )

          render_success({
            description: prediction[:description],
            plantPredictions: prediction[:plant_predictions],
            atmosphereNotes: prediction[:atmosphere_notes],
            totalCarbonKg: prediction[:total_carbon_kg]
          })
        rescue => e
          Rails.logger.error("Generate prediction error: #{e.message}")
          render_error("Failed to generate prediction: #{e.message}")
        end

        private

        def filter_plants_in_coverage(plants, coverage_area)
          return plants if coverage_area.blank?

          area = coverage_area.with_indifferent_access
          return plants unless area[:xmin] && area[:xmax] && area[:ymin] && area[:ymax]

          plants.select do |plant|
            # Check both direct x/y and nested position
            px = plant['x'] || plant.dig('position', 'x')
            py = plant['y'] || plant.dig('position', 'y')

            # If no x/y coordinates, include the plant anyway (might be using lat/lng)
            next true unless px && py

            px >= area[:xmin] && px <= area[:xmax] && py >= area[:ymin] && py <= area[:ymax]
          end
        end
      end
    end
  end
end
