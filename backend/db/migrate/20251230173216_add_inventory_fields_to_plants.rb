class AddInventoryFieldsToPlants < ActiveRecord::Migration[7.2]
  def change
    add_column :plants, :health_status, :string, default: 'unknown'
    add_column :plants, :identification_confidence, :string, default: 'unknown'
    add_column :plants, :estimated_age_years, :integer
    add_column :plants, :acquired_from, :string
    add_column :plants, :notes, :text
    add_column :plants, :last_observed_at, :datetime

    add_index :plants, :health_status
    add_index :plants, :identification_confidence
  end
end
