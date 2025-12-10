# ActiveStorage configuration
Rails.application.config.active_storage.variant_processor = :mini_magick

# Set default URL options for ActiveStorage
Rails.application.config.after_initialize do
  ActiveStorage::Current.url_options = {
    host: ENV.fetch('API_HOST', 'http://localhost:3000')
  }
end
