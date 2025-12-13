class GardenPlan < ApplicationRecord
  belongs_to :property
  has_many :plants, dependent: :destroy

  validates :name, presence: true
  validates :status, inclusion: { in: %w[draft active archived] }

  scope :active, -> { where(status: 'active') }

  def activate!
    transaction do
      property.garden_plans.active.update_all(status: 'archived')
      update!(status: 'active')
    end
  end

  def total_plants
    plants.count
  end

  def total_zones
    zones.is_a?(Array) ? zones.size : 0
  end

  # Get all plants at a specific location (for AI visualization)
  def plants_at_location(lat, lng, radius_meters: 5)
    # Convert radius from meters to approximate degrees (rough approximation)
    radius_deg = radius_meters / 111_000.0

    plants.where(
      "latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?",
      lat - radius_deg, lat + radius_deg,
      lng - radius_deg, lng + radius_deg
    )
  end

  # Get plants visible from a viewpoint photo's coverage area
  def plants_in_coverage_area(coverage_area)
    return plants.none unless coverage_area.present?

    area = coverage_area.with_indifferent_access
    return plants.none unless area[:ymin] && area[:ymax] && area[:xmin] && area[:xmax]

    plants.where(
      "latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?",
      area[:ymin], area[:ymax],
      area[:xmin], area[:xmax]
    )
  end
end
