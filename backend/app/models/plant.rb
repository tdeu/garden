class Plant < ApplicationRecord
  belongs_to :garden_plan
  belongs_to :planted_photo, class_name: 'DropboxPhoto', optional: true
  has_many_attached :photos

  CATEGORIES = %w[tree fruit_tree shrub perennial hedge annual vegetable herb berry wall_plant bulb].freeze
  HEALTH_STATUSES = %w[thriving healthy fair struggling declining dead unknown].freeze
  IDENTIFICATION_CONFIDENCES = %w[confirmed likely uncertain unknown].freeze
  LIFECYCLE_STATUSES = %w[planned planted established removed].freeze

  enum :lifecycle_status, { planned: 0, planted: 1, established: 2, removed: 3 }, default: :planned

  validates :species, presence: true
  validates :category, presence: true, inclusion: { in: CATEGORIES }
  validates :latitude, presence: true, numericality: { greater_than: -90, less_than: 90 }
  validates :longitude, presence: true, numericality: { greater_than: -180, less_than: 180 }
  validates :health_status, inclusion: { in: HEALTH_STATUSES }, allow_nil: true
  validates :identification_confidence, inclusion: { in: IDENTIFICATION_CONFIDENCES }, allow_nil: true
  validates :estimated_age_years, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  scope :by_health, ->(status) { where(health_status: status) }
  scope :needs_attention, -> { where(health_status: %w[struggling declining]) }
  scope :unidentified, -> { where(identification_confidence: %w[uncertain unknown]) }
  scope :recently_observed, -> { where('last_observed_at > ?', 30.days.ago) }
  scope :not_observed_recently, -> { where('last_observed_at < ? OR last_observed_at IS NULL', 30.days.ago) }
  scope :by_lifecycle, ->(status) { where(lifecycle_status: status) }

  # Calculate age from planted_date or use estimated_age
  def age_years
    if planted_date.present?
      ((Date.current - planted_date) / 365.25).floor
    else
      estimated_age_years
    end
  end

  # Mark as observed now
  def observe!(notes_text = nil)
    update!(
      last_observed_at: Time.current,
      notes: notes_text.present? ? "#{notes}\n\n[#{Date.current}] #{notes_text}".strip : notes
    )
  end

  # Mark plant as planted (transition from planned to planted)
  def mark_planted!(planted_at_time: nil, photo: nil)
    attrs = {
      lifecycle_status: :planted,
      planted_at: planted_at_time || Time.current
    }

    if photo.is_a?(DropboxPhoto)
      photo.assign_to!(self)
      attrs[:planted_photo] = photo
    end

    update!(attrs)
  end

  # Get planted photo URL
  def planted_photo_url
    return nil unless planted_photo&.photo&.attached?
    planted_photo.photo_url
  end

  # Photo URLs for API response
  def photo_urls
    photos.map do |photo|
      Rails.application.routes.url_helpers.rails_blob_url(photo, only_path: true)
    end
  end

  # JSON serialization with inventory fields
  def as_inventory_json
    {
      id: id,
      species: species,
      common_name: common_name,
      category: category,
      location: { lat: latitude, lng: longitude },
      planted_date: planted_date,
      # Lifecycle fields
      lifecycle_status: lifecycle_status,
      planted_at: planted_at,
      planted_photo_id: planted_photo_id,
      planted_photo_url: planted_photo_url,
      # Inventory fields
      health_status: health_status,
      identification_confidence: identification_confidence,
      estimated_age_years: estimated_age_years,
      age_years: age_years,
      acquired_from: acquired_from,
      notes: notes,
      last_observed_at: last_observed_at,
      photo_urls: photo_urls,
      photos_count: photos.count,
      metadata: metadata,
      created_at: created_at,
      updated_at: updated_at
    }
  end
end
