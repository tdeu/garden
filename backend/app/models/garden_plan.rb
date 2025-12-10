class GardenPlan < ApplicationRecord
  belongs_to :property

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
    plants.is_a?(Array) ? plants.size : plants.keys.size
  end

  def total_zones
    zones.is_a?(Array) ? zones.size : zones.keys.size
  end

  # Get all plants at a specific location (for AI visualization)
  def plants_at_location(x, y, radius: 5)
    return [] unless plants.is_a?(Array)

    plants.select do |plant|
      px = plant['x'] || plant['position']&.dig('x')
      py = plant['y'] || plant['position']&.dig('y')
      next false unless px && py

      Math.sqrt((px - x)**2 + (py - y)**2) <= radius
    end
  end

  # Get plants visible from a viewpoint photo's coverage area
  def plants_in_coverage_area(coverage_area)
    return [] unless plants.is_a?(Array) && coverage_area.present?

    area = coverage_area.with_indifferent_access
    return [] unless area[:xmin] && area[:xmax] && area[:ymin] && area[:ymax]

    plants.select do |plant|
      px = plant['x'] || plant['position']&.dig('x')
      py = plant['y'] || plant['position']&.dig('y')
      next false unless px && py

      px >= area[:xmin] && px <= area[:xmax] && py >= area[:ymin] && py <= area[:ymax]
    end
  end
end
