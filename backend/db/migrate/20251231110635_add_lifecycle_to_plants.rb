class AddLifecycleToPlants < ActiveRecord::Migration[7.2]
  def change
    add_column :plants, :lifecycle_status, :integer, default: 0, null: false
    add_column :plants, :planted_at, :datetime
    add_reference :plants, :planted_photo, null: true, foreign_key: { to_table: :dropbox_photos }

    add_index :plants, :lifecycle_status
  end
end
