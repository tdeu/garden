class MakeUserOptionalOnProperties < ActiveRecord::Migration[7.2]
  def change
    # Remove NOT NULL constraint on user_id for single-user mode
    change_column_null :properties, :user_id, true

    # Remove foreign key constraint (optional, keeps it more flexible)
    remove_foreign_key :properties, :users, if_exists: true
  end
end
