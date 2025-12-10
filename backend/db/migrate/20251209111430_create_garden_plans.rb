class CreateGardenPlans < ActiveRecord::Migration[7.2]
  def change
    create_table :garden_plans do |t|
      t.references :property, null: false, foreign_key: true
      t.jsonb :plants, default: [], null: false
      t.jsonb :zones, default: [], null: false
      t.jsonb :structures, default: [], null: false
      t.string :status, default: 'draft'
      t.integer :version, default: 1

      t.timestamps
    end

    add_index :garden_plans, :plants, using: :gin
    add_index :garden_plans, :zones, using: :gin
    add_index :garden_plans, :structures, using: :gin
    add_index :garden_plans, [:property_id, :version]
    add_index :garden_plans, [:property_id, :status]
  end
end
