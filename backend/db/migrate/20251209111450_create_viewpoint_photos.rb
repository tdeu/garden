class CreateViewpointPhotos < ActiveRecord::Migration[7.2]
  def change
    create_table :viewpoint_photos do |t|
      t.references :property, null: false, foreign_key: true
      t.string :viewpoint, null: false
      t.text :description
      t.date :capture_date
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :viewpoint_photos, [:property_id, :viewpoint]
  end
end
