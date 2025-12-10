class CreateProperties < ActiveRecord::Migration[7.2]
  def change
    create_table :properties do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.jsonb :location, null: false, default: {}
      t.jsonb :bbox
      t.decimal :area_sqm, precision: 10, scale: 2

      t.timestamps
    end

    add_index :properties, :location, using: :gin
  end
end
