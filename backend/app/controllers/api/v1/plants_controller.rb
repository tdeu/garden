module Api
  module V1
    class PlantsController < BaseController
      before_action :set_garden_plan
      before_action :set_plant, only: [:show, :update, :destroy, :upload_photos, :observe, :mark_planted]

      def index
        plants = @garden_plan.plants.includes(:photos_attachments)

        # Filter by health status
        plants = plants.by_health(params[:health_status]) if params[:health_status].present?

        # Filter for plants needing attention
        plants = plants.needs_attention if params[:needs_attention] == 'true'

        # Filter for unidentified plants
        plants = plants.unidentified if params[:unidentified] == 'true'

        # Filter for plants not recently observed
        plants = plants.not_observed_recently if params[:not_observed] == 'true'

        render json: plants.map { |p| plant_json(p) }
      end

      def show
        render json: plant_json(@plant)
      end

      def create
        plant = @garden_plan.plants.build(plant_params)

        if plant.save
          render json: plant_json(plant), status: :created
        else
          render_error('Failed to create plant', details: plant.errors)
        end
      end

      def update
        if @plant.update(plant_params)
          render json: plant_json(@plant)
        else
          render_error('Failed to update plant', details: @plant.errors)
        end
      end

      def destroy
        @plant.destroy
        head :no_content
      end

      # POST /plants/:id/upload_photos
      def upload_photos
        if params[:photos].present?
          params[:photos].each do |photo|
            @plant.photos.attach(photo)
          end
          render json: plant_json(@plant.reload)
        else
          render_error('No photos provided', status: :unprocessable_entity)
        end
      end

      # POST /plants/:id/observe
      def observe
        notes_text = params[:notes]
        health_status = params[:health_status]

        @plant.health_status = health_status if health_status.present?
        @plant.observe!(notes_text)

        render json: plant_json(@plant)
      rescue => e
        render_error('Failed to record observation', details: e.message)
      end

      # POST /plants/:id/mark_planted
      # Mark a planned plant as planted with optional photo
      def mark_planted
        planted_at = params[:planted_at] ? Time.parse(params[:planted_at]) : Time.current
        dropbox_photo = nil

        if params[:dropbox_photo_id].present?
          property = Property.default_property
          dropbox_photo = property.dropbox_photos.find_by(id: params[:dropbox_photo_id])
        end

        @plant.mark_planted!(planted_at_time: planted_at, photo: dropbox_photo)
        render json: plant_json(@plant)
      rescue => e
        render_error('Failed to mark plant as planted', details: e.message)
      end

      def bulk
        plants_data = params[:plants] || []

        Plant.transaction do
          # Delete existing plants for this garden plan
          @garden_plan.plants.destroy_all

          # Create new plants
          plants_data.each do |plant_data|
            @garden_plan.plants.create!(
              species: plant_data[:species],
              common_name: plant_data[:common_name],
              category: plant_data[:category],
              latitude: plant_data.dig(:location, :lat) || plant_data[:latitude],
              longitude: plant_data.dig(:location, :lng) || plant_data[:longitude],
              planted_date: plant_data[:planted_date],
              health_status: plant_data[:health_status] || 'unknown',
              identification_confidence: plant_data[:identification_confidence] || 'unknown',
              estimated_age_years: plant_data[:estimated_age_years],
              acquired_from: plant_data[:acquired_from],
              notes: plant_data[:notes],
              metadata: plant_data[:metadata] || {}
            )
          end
        end

        render json: @garden_plan.plants.map { |p| plant_json(p) }
      rescue ActiveRecord::RecordInvalid => e
        render_error('Failed to save plants', details: e.record.errors)
      end

      # GET /plants/stats
      def stats
        plants = @garden_plan.plants

        render json: {
          total: plants.count,
          by_category: plants.group(:category).count,
          by_health_status: plants.group(:health_status).count,
          by_identification: plants.group(:identification_confidence).count,
          needs_attention: plants.needs_attention.count,
          not_observed_recently: plants.not_observed_recently.count
        }
      end

      private

      def set_garden_plan
        property = Property.default_property
        @garden_plan = property.garden_plans.find(params[:garden_plan_id])
      end

      def set_plant
        @plant = @garden_plan.plants.find(params[:id])
      end

      def plant_params
        params.require(:plant).permit(
          :species, :common_name, :category, :latitude, :longitude, :planted_date,
          :health_status, :identification_confidence, :estimated_age_years,
          :acquired_from, :notes, :last_observed_at,
          metadata: {}
        )
      end

      def plant_json(plant)
        {
          id: plant.id,
          species: plant.species,
          common_name: plant.common_name,
          category: plant.category,
          location: {
            lat: plant.latitude.to_f,
            lng: plant.longitude.to_f
          },
          planted_date: plant.planted_date,
          # Lifecycle fields
          lifecycle_status: plant.lifecycle_status,
          planted_at: plant.planted_at,
          planted_photo_id: plant.planted_photo_id,
          planted_photo_url: plant.planted_photo_url,
          # Inventory fields
          health_status: plant.health_status,
          identification_confidence: plant.identification_confidence,
          estimated_age_years: plant.estimated_age_years,
          age_years: plant.age_years,
          acquired_from: plant.acquired_from,
          notes: plant.notes,
          last_observed_at: plant.last_observed_at,
          # Photos
          photo_urls: plant.photo_urls,
          photos_count: plant.photos.count,
          # Metadata
          metadata: plant.metadata || {},
          created_at: plant.created_at,
          updated_at: plant.updated_at
        }
      end
    end
  end
end
