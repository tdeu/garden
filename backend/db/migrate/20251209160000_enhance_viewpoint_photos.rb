class EnhanceViewpointPhotos < ActiveRecord::Migration[7.2]
  def change
    # Rename viewpoint to name (more flexible)
    rename_column :viewpoint_photos, :viewpoint, :name

    # Add camera positioning info
    add_column :viewpoint_photos, :camera_position, :jsonb, default: {}
    add_column :viewpoint_photos, :camera_direction, :float  # degrees 0-360
    add_column :viewpoint_photos, :field_of_view, :float, default: 60  # degrees

    # Add coverage area (what part of the garden this photo shows)
    add_column :viewpoint_photos, :coverage_area, :jsonb, default: {}

    # Add spatial index for coverage area queries
    add_index :viewpoint_photos, :coverage_area, using: :gin

    # Remove old index and add new one
    remove_index :viewpoint_photos, [:property_id, :name], if_exists: true
    add_index :viewpoint_photos, [:property_id, :name]
  end
end
