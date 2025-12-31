# Photo dropbox for uploading and managing photos
# before assigning them to plants or viewpoint photos
class Api::V1::DropboxController < Api::V1::BaseController
  before_action :set_property
  before_action :set_dropbox_photo, only: [:show, :destroy, :assign]

  # GET /api/v1/property/dropbox
  # List all dropbox photos (pending by default)
  def index
    @photos = @property.dropbox_photos

    # Filter by status if provided
    if params[:status].present?
      @photos = @photos.where(status: params[:status])
    else
      @photos = @photos.pending
    end

    @photos = @photos.recent.includes(photo_attachment: :blob)

    render json: @photos.map(&:as_json)
  end

  # GET /api/v1/property/dropbox/:id
  def show
    render json: @photo.as_json
  end

  # POST /api/v1/property/dropbox
  # Upload one or more photos
  def create
    uploaded_photos = []
    errors = []

    # Handle multiple file uploads
    files = params[:photos] || [params[:photo]].compact
    files = [files] unless files.is_a?(Array)

    files.each do |file|
      next unless file.is_a?(ActionDispatch::Http::UploadedFile)

      photo = @property.dropbox_photos.build(status: :pending)
      photo.photo.attach(file)

      if photo.save
        # Extract EXIF data in background (or inline for now)
        photo.extract_exif!
        uploaded_photos << photo
      else
        errors << { filename: file.original_filename, errors: photo.errors.full_messages }
      end
    end

    if errors.any?
      render json: {
        success: uploaded_photos.any?,
        uploaded: uploaded_photos.map(&:as_json),
        errors: errors
      }, status: uploaded_photos.any? ? :created : :unprocessable_entity
    else
      render json: uploaded_photos.map(&:as_json), status: :created
    end
  end

  # POST /api/v1/property/dropbox/:id/assign
  # Assign a photo to a plant or viewpoint
  def assign
    target_type = params[:target_type]
    target_id = params[:target_id]

    unless %w[Plant ViewpointPhoto].include?(target_type)
      return render json: { error: 'Invalid target_type. Must be Plant or ViewpointPhoto' },
                    status: :unprocessable_entity
    end

    target = case target_type
             when 'Plant'
               Plant.find_by(id: target_id)
             when 'ViewpointPhoto'
               ViewpointPhoto.find_by(id: target_id)
             end

    unless target
      return render json: { error: "#{target_type} not found" }, status: :not_found
    end

    @photo.assign_to!(target)
    render json: @photo.as_json
  end

  # DELETE /api/v1/property/dropbox/:id
  def destroy
    @photo.destroy
    head :no_content
  end

  private

  def set_property
    @property = Property.default_property
  end

  def set_dropbox_photo
    @photo = @property.dropbox_photos.find(params[:id])
  end
end
