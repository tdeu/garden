class CreatePlants < ActiveRecord::Migration[7.2]
  def change
    create_table :plants do |t|
      t.references :garden_plan, null: false, foreign_key: true
      t.string :species, null: false
      t.string :common_name
      t.string :category, null: false
      t.decimal :latitude, precision: 10, scale: 7, null: false
      t.decimal :longitude, precision: 10, scale: 7, null: false
      t.date :planted_date
      t.jsonb :metadata, default: {}
      t.timestamps
    end

    add_index :plants, [:garden_plan_id, :category]
    add_index :plants, [:latitude, :longitude]
  end
end
