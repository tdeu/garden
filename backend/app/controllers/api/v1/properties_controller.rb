module Api
  module V1
    class PropertiesController < BaseController
      # Single property mode - always use the default property

      def show
        render json: property_json(default_property)
      end

      def update
        if default_property.update(property_params)
          render json: property_json(default_property)
        else
          render_error('Failed to update property', details: default_property.errors)
        end
      end

      private

      def default_property
        @property ||= Property.default_property
      end

      def property_params
        params.require(:property).permit(:name, :area_sqm, location: {}, bbox: {})
      end

      def property_json(property)
        {
          id: property.id,
          name: property.name,
          location: property.location,
          bbox: property.bbox,
          area_sqm: property.area_sqm,
          garden_plans_count: property.garden_plans.count,
          viewpoint_photos_count: property.viewpoint_photos.count,
          active_plan: property.active_garden_plan&.slice(:id, :name, :status)
        }
      end
    end
  end
end
