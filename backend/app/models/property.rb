class Property < ApplicationRecord
  # Single-user mode: user is optional
  belongs_to :user, optional: true
  has_many :garden_plans, dependent: :destroy
  has_many :viewpoint_photos, dependent: :destroy
  has_one :active_garden_plan, -> { where(status: 'active') }, class_name: 'GardenPlan'

  validates :name, presence: true
  validates :location, presence: true

  # Auto-create default property for single-user mode
  def self.default_property
    first || create!(
      name: 'My Garden',
      location: { lat: 49.6387, lng: 5.5522 }, # Huombois, Belgium
      bbox: { xmin: 5.5500, ymin: 49.6370, xmax: 5.5550, ymax: 49.6400 }
    )
  end
end
