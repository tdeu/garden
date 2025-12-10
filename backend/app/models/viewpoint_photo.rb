class ViewpointPhoto < ApplicationRecord
  belongs_to :property
  has_one_attached :photo

  validates :name, presence: true
  validate :validate_photo_content_type, if: -> { photo.attached? }

  # Coverage area defines what portion of the garden this photo shows
  # Stored as GeoJSON polygon or bounding box
  # Example: { "type": "Polygon", "coordinates": [[[x1,y1], [x2,y2], ...]] }

  # Camera position and direction for matching
  # position: { x: float, y: float } - where camera is located on property map
  # direction: float (0-360 degrees) - which way camera is pointing
  # field_of_view: float (degrees) - how wide the photo captures

  scope :with_photos, -> { joins(:photo_attachment) }
  scope :covering_point, ->(x, y) {
    # Find photos whose coverage area includes this point
    where("coverage_area IS NOT NULL AND coverage_area @> ?", { x: x, y: y }.to_json)
  }

  def self.find_best_match_for_location(x, y)
    # Find the photo that best captures this location
    # Priority: 1) Photo where location is in center of frame
    #           2) Photo where location is visible but not centered

    all.select do |photo|
      photo.covers_point?(x, y)
    end.min_by do |photo|
      photo.distance_from_center(x, y)
    end
  end

  def covers_point?(x, y)
    return false unless coverage_area.present?

    # Simple bounding box check for now
    area = coverage_area.with_indifferent_access
    return false unless area[:xmin] && area[:xmax] && area[:ymin] && area[:ymax]

    x >= area[:xmin] && x <= area[:xmax] && y >= area[:ymin] && y <= area[:ymax]
  end

  def distance_from_center(x, y)
    return Float::INFINITY unless coverage_area.present?

    area = coverage_area.with_indifferent_access
    center_x = (area[:xmin] + area[:xmax]) / 2.0
    center_y = (area[:ymin] + area[:ymax]) / 2.0

    Math.sqrt((x - center_x)**2 + (y - center_y)**2)
  end

  def photo_url
    return nil unless photo.attached?

    Rails.application.routes.url_helpers.rails_blob_url(
      photo,
      host: ENV.fetch('API_HOST', 'http://localhost:3000')
    )
  end

  def as_json(options = {})
    {
      id: id,
      name: name,
      description: description,
      capture_date: capture_date,
      camera_position: camera_position,
      camera_direction: camera_direction,
      coverage_area: coverage_area,
      photo_url: photo_url,
      created_at: created_at,
      updated_at: updated_at
    }
  end

  private

  def validate_photo_content_type
    unless photo.content_type.in?(%w[image/jpeg image/png image/jpg image/webp])
      errors.add(:photo, 'must be a JPEG, PNG, or WebP image')
    end
  end
end
