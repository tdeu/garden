class CreateDropboxPhotos < ActiveRecord::Migration[7.2]
  def change
    create_table :dropbox_photos do |t|
      t.references :property, null: false, foreign_key: true
      t.integer :status, default: 0, null: false
      t.decimal :latitude, precision: 10, scale: 6
      t.decimal :longitude, precision: 10, scale: 6
      t.datetime :taken_at
      t.string :camera_model
      t.references :assignable, polymorphic: true, null: true

      t.timestamps
    end

    add_index :dropbox_photos, :status
  end
end
