class AddNameToGardenPlans < ActiveRecord::Migration[7.2]
  def change
    add_column :garden_plans, :name, :string, default: 'Untitled Plan'
    add_index :garden_plans, :name
  end
end
