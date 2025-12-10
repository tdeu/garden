module Api
  module V1
    class ViewpointPhotosController < BaseController
      before_action :set_viewpoint_photo, only: [:show, :update, :destroy, :upload_photo]

      def index
        photos = default_property.viewpoint_photos.with_attached_photo
        render json: photos.map(&:as_json)
      end

      def show
        render json: @viewpoint_photo.as_json
      end

      def create
        photo = default_property.viewpoint_photos.build(viewpoint_photo_params)

        if photo.save
          render json: photo.as_json, status: :created
        else
          render_error('Failed to create viewpoint photo', details: photo.errors)
        end
      end

      def update
        if @viewpoint_photo.update(viewpoint_photo_params)
          render json: @viewpoint_photo.as_json
        else
          render_error('Failed to update viewpoint photo', details: @viewpoint_photo.errors)
        end
      end

      def destroy
        @viewpoint_photo.destroy
        head :no_content
      end

      def upload_photo
        if params[:photo].present? && @viewpoint_photo.photo.attach(params[:photo])
          render json: @viewpoint_photo.as_json
        else
          render_error('Failed to upload photo')
        end
      end

      # GET /api/v1/property/viewpoint_photos/by_location?x=123&y=456
      # Find the best photo that captures a specific location in the garden
      def by_location
        x = params[:x].to_f
        y = params[:y].to_f

        if x.zero? && y.zero?
          return render_error('x and y coordinates are required', status: :bad_request)
        end

        photo = default_property.viewpoint_photos.find_best_match_for_location(x, y)

        if photo
          render json: {
            photo: photo.as_json,
            match_quality: calculate_match_quality(photo, x, y)
          }
        else
          render json: {
            photo: nil,
            message: 'No photo covers this location',
            suggestion: 'Add a viewpoint photo that includes this area'
          }, status: :not_found
        end
      end

      private

      def default_property
        @property ||= Property.default_property
      end

      def set_viewpoint_photo
        @viewpoint_photo = default_property.viewpoint_photos.find(params[:id])
      end

      def viewpoint_photo_params
        params.require(:viewpoint_photo).permit(
          :name, :description, :capture_date, :camera_direction, :field_of_view, :photo,
          camera_position: [:x, :y],
          coverage_area: [:xmin, :xmax, :ymin, :ymax]
        )
      end

      def calculate_match_quality(photo, x, y)
        distance = photo.distance_from_center(x, y)
        # Normalize to 0-100 score (closer to center = higher score)
        max_distance = 100  # Assume max reasonable distance
        score = [(1 - (distance / max_distance)) * 100, 0].max.round

        case score
        when 80..100 then { score: score, label: 'excellent' }
        when 50..79 then { score: score, label: 'good' }
        when 20..49 then { score: score, label: 'fair' }
        else { score: score, label: 'poor' }
        end
      end
    end
  end
end
