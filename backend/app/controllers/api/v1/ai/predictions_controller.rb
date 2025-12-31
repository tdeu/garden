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

          # Filter plants to those visible in camera's 60° field of view
          visible_plants = filter_plants_in_fov(plants, viewpoint_photo.camera_position, viewpoint_photo.camera_direction)
          Rails.logger.info("FOV Filter result: #{visible_plants.length} of #{plants.length} plants visible")

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
            plants_count: result[:plants_count] || visible_plants.length
          })
        rescue => e
          Rails.logger.error("Transform viewpoint error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
          render_error("Failed to generate transformation: #{e.message}")
        end

        # POST /api/v1/ai/identify_plant
        # Identify a plant from an uploaded photo using AI vision
        def identify_plant
          # Accept either base64 image data or file upload
          image_base64 = nil
          mime_type = 'image/jpeg'

          if params[:image].present?
            # File upload
            uploaded_file = params[:image]
            image_base64 = Base64.strict_encode64(uploaded_file.read)
            mime_type = uploaded_file.content_type || 'image/jpeg'
          elsif params[:image_base64].present?
            # Direct base64 data
            image_base64 = params[:image_base64]
            mime_type = params[:mime_type] || 'image/jpeg'
          else
            return render_error('No image provided. Send image as file upload or base64 data.', status: :bad_request)
          end

          # Optional context from user (e.g., "I think this might be an oak tree")
          context = params[:context]

          gemini = GeminiService.new
          result = gemini.identify_plant(
            image_base64: image_base64,
            mime_type: mime_type,
            context: context
          )

          if result[:error] && !result[:success]
            render_error(result[:error])
          else
            render_success(result)
          end
        rescue => e
          Rails.logger.error("Identify plant error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
          render_error("Failed to identify plant: #{e.message}")
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

        # Filter plants to only those within the camera's field of view
        # Using 80° FOV (±40°) to be slightly more permissive than the visual 60° cone
        # This ensures plants near the edges are included
        def filter_plants_in_fov(plants, camera_position, camera_direction)
          return [] if camera_position.blank? || camera_direction.blank?

          # Property bounds (matching frontend CanvasGarden.tsx)
          bounds = { north: 49.6409, south: 49.6365, east: 5.5584, west: 5.5460 }
          fov_half_angle = 40.0  # 80° total FOV (slightly wider than visual 60° to include edge cases)

          # Convert camera position (0-100 normalized) to lat/lng
          cam_x = (camera_position[:x] || camera_position['x']).to_f
          cam_y = (camera_position[:y] || camera_position['y']).to_f
          cam_lng = bounds[:west] + (cam_x / 100.0) * (bounds[:east] - bounds[:west])
          cam_lat = bounds[:north] - (cam_y / 100.0) * (bounds[:north] - bounds[:south])
          cam_dir = camera_direction.to_f

          Rails.logger.info("FOV Filter: camera at (#{cam_lat.round(6)}, #{cam_lng.round(6)}) direction #{cam_dir}°")

          plants.select do |plant|
            # Get plant lat/lng
            lat = plant['latitude'] || plant.dig('location', 'lat')
            lng = plant['longitude'] || plant.dig('location', 'lng')
            next false unless lat && lng

            lat = lat.to_f
            lng = lng.to_f

            # Calculate angle from camera to plant
            # Match frontend's angle convention: atan2(dx, -dy) where 0° = north
            dx = lng - cam_lng
            dy = cam_lat - lat
            # Use -dy to match screen coordinate convention (Y increases downward in screen, but lat increases upward)
            angle_to_plant = Math.atan2(dx, -dy) * (180.0 / Math::PI)
            angle_to_plant += 360 if angle_to_plant < 0

            # Calculate relative angle from camera direction
            relative_angle = angle_to_plant - cam_dir
            relative_angle -= 360 if relative_angle > 180
            relative_angle += 360 if relative_angle < -180

            in_fov = relative_angle.abs <= fov_half_angle
            Rails.logger.debug("Plant at (#{lat.round(6)}, #{lng.round(6)}): angle=#{angle_to_plant.round(1)}° relative=#{relative_angle.round(1)}° in_fov=#{in_fov}")

            in_fov
          end
        end
      end
    end
  end
end
