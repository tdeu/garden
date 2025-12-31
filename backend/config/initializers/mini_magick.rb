# Configure MiniMagick to find ImageMagick on Windows
if Gem.win_platform?
  # Common ImageMagick installation paths on Windows
  imagemagick_paths = Dir.glob('C:/Program Files/ImageMagick*')

  if imagemagick_paths.any?
    imagemagick_path = imagemagick_paths.first.gsub('/', '\\')

    # Add ImageMagick to PATH for the current process
    ENV['PATH'] = "#{imagemagick_path};#{ENV['PATH']}"

    puts "MiniMagick: Added ImageMagick to PATH: #{imagemagick_path}"
  else
    puts "WARNING: ImageMagick not found in Program Files. Please install it from https://imagemagick.org"
  end
end
