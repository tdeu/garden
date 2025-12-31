# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2025_12_31_110635) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "dropbox_photos", force: :cascade do |t|
    t.bigint "property_id", null: false
    t.integer "status", default: 0, null: false
    t.decimal "latitude", precision: 10, scale: 6
    t.decimal "longitude", precision: 10, scale: 6
    t.datetime "taken_at"
    t.string "camera_model"
    t.string "assignable_type"
    t.bigint "assignable_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["assignable_type", "assignable_id"], name: "index_dropbox_photos_on_assignable"
    t.index ["property_id"], name: "index_dropbox_photos_on_property_id"
    t.index ["status"], name: "index_dropbox_photos_on_status"
  end

  create_table "garden_plans", force: :cascade do |t|
    t.bigint "property_id", null: false
    t.jsonb "plants", default: [], null: false
    t.jsonb "zones", default: [], null: false
    t.jsonb "structures", default: [], null: false
    t.string "status", default: "draft"
    t.integer "version", default: 1
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "name", default: "Untitled Plan"
    t.index ["name"], name: "index_garden_plans_on_name"
    t.index ["plants"], name: "index_garden_plans_on_plants", using: :gin
    t.index ["property_id", "status"], name: "index_garden_plans_on_property_id_and_status"
    t.index ["property_id", "version"], name: "index_garden_plans_on_property_id_and_version"
    t.index ["property_id"], name: "index_garden_plans_on_property_id"
    t.index ["structures"], name: "index_garden_plans_on_structures", using: :gin
    t.index ["zones"], name: "index_garden_plans_on_zones", using: :gin
  end

  create_table "plants", force: :cascade do |t|
    t.bigint "garden_plan_id", null: false
    t.string "species", null: false
    t.string "common_name"
    t.string "category", null: false
    t.decimal "latitude", precision: 10, scale: 7, null: false
    t.decimal "longitude", precision: 10, scale: 7, null: false
    t.date "planted_date"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "health_status", default: "unknown"
    t.string "identification_confidence", default: "unknown"
    t.integer "estimated_age_years"
    t.string "acquired_from"
    t.text "notes"
    t.datetime "last_observed_at"
    t.integer "lifecycle_status", default: 0, null: false
    t.datetime "planted_at"
    t.bigint "planted_photo_id"
    t.index ["garden_plan_id", "category"], name: "index_plants_on_garden_plan_id_and_category"
    t.index ["garden_plan_id"], name: "index_plants_on_garden_plan_id"
    t.index ["health_status"], name: "index_plants_on_health_status"
    t.index ["identification_confidence"], name: "index_plants_on_identification_confidence"
    t.index ["latitude", "longitude"], name: "index_plants_on_latitude_and_longitude"
    t.index ["lifecycle_status"], name: "index_plants_on_lifecycle_status"
    t.index ["planted_photo_id"], name: "index_plants_on_planted_photo_id"
  end

  create_table "properties", force: :cascade do |t|
    t.bigint "user_id"
    t.string "name", null: false
    t.jsonb "location", default: {}, null: false
    t.jsonb "bbox"
    t.decimal "area_sqm", precision: 10, scale: 2
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["location"], name: "index_properties_on_location", using: :gin
    t.index ["user_id"], name: "index_properties_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.integer "sign_in_count", default: 0, null: false
    t.datetime "current_sign_in_at"
    t.datetime "last_sign_in_at"
    t.string "current_sign_in_ip"
    t.string "last_sign_in_ip"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  create_table "viewpoint_photos", force: :cascade do |t|
    t.bigint "property_id", null: false
    t.string "name", null: false
    t.text "description"
    t.date "capture_date"
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "camera_position", default: {}
    t.float "camera_direction"
    t.float "field_of_view", default: 60.0
    t.jsonb "coverage_area", default: {}
    t.index ["coverage_area"], name: "index_viewpoint_photos_on_coverage_area", using: :gin
    t.index ["property_id", "name"], name: "index_viewpoint_photos_on_property_id_and_name"
    t.index ["property_id"], name: "index_viewpoint_photos_on_property_id"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "dropbox_photos", "properties"
  add_foreign_key "garden_plans", "properties"
  add_foreign_key "plants", "dropbox_photos", column: "planted_photo_id"
  add_foreign_key "plants", "garden_plans"
  add_foreign_key "viewpoint_photos", "properties"
end
