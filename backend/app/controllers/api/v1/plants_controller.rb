module Api
  module V1
    class PlantsController < BaseController
      before_action :set_garden_plan
      before_action :set_plant, only: [:show, :update, :destroy]

      def index
        render json: @garden_plan.plants.map { |p| plant_json(p) }
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
              metadata: plant_data[:metadata] || {}
            )
          end
        end

        render json: @garden_plan.plants.map { |p| plant_json(p) }
      rescue ActiveRecord::RecordInvalid => e
        render_error('Failed to save plants', details: e.record.errors)
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
        params.require(:plant).permit(:species, :common_name, :category, :latitude, :longitude, :planted_date, metadata: {})
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
          metadata: plant.metadata || {},
          created_at: plant.created_at,
          updated_at: plant.updated_at
        }
      end
    end
  end
end
