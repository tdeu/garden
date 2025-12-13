class Plant < ApplicationRecord
  belongs_to :garden_plan

  CATEGORIES = %w[tree fruit_tree shrub perennial hedge annual vegetable herb berry].freeze

  validates :species, presence: true
  validates :category, presence: true, inclusion: { in: CATEGORIES }
  validates :latitude, presence: true, numericality: { greater_than: -90, less_than: 90 }
  validates :longitude, presence: true, numericality: { greater_than: -180, less_than: 180 }
end
