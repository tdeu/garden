# Dropbox photos are uploaded photos waiting to be assigned
# to plants or viewpoint photos in the system.
class DropboxPhoto < ApplicationRecord
  belongs_to :property
  belongs_to :assignable, polymorphic: true, optional: true

  has_one_attached :photo

  enum :status, { pending: 0, assigned: 1, archived: 2 }

  validates :status, presence: true
  validates :photo, content_type: ['image/jpeg', 'image/png', 'image/heic', 'image/heif'],
                    size: { less_than: 20.megabytes }

  scope :unassigned, -> { where(status: :pending) }
  scope :recent, -> { order(created_at: :desc) }

  # Extract EXIF metadata from attached photo
  def extract_exif!
    return unless photo.attached?

    begin
      photo.open do |file|
        exif = EXIFR::JPEG.new(file.path) rescue nil
        return unless exif

        # Extract GPS coordinates
        if exif.gps
          self.latitude = exif.gps.latitude
          self.longitude = exif.gps.longitude
        end

        # Extract timestamp
        self.taken_at = exif.date_time_original || exif.date_time

        # Extract camera model
        self.camera_model = [exif.make, exif.model].compact.join(' ').presence

        save!
      end
    rescue => e
      Rails.logger.warn("EXIF extraction failed: #{e.message}")
    end
  end

  # Assign to a plant or viewpoint photo
  def assign_to!(target)
    update!(
      assignable: target,
      status: :assigned
    )
  end

  def photo_url
    return nil unless photo.attached?
    Rails.application.routes.url_helpers.rails_blob_url(photo, only_path: true)
  end

  def as_json(options = {})
    super(options.merge(
      methods: [:photo_url],
      except: [:assignable_type, :assignable_id]
    )).merge(
      'assignable_type' => assignable_type,
      'assignable_id' => assignable_id
    )
  end
end
