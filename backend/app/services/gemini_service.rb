# app/services/gemini_service.rb
# Service for interacting with Google Gemini AI API
#
# SETUP GUIDE:
# 1. Go to https://aistudio.google.com/apikey
# 2. Create an API key (free tier available)
# 3. Set GEMINI_API_KEY in your .env file
#
# FREE TIER LIMITS:
# - 15 requests per minute
# - 1 million tokens per day
# - Image generation requires Gemini 2.0 Flash (experimental)
#
# FOR IMAGEN 3 (better quality images):
# - Requires Google Cloud Platform with Vertex AI
# - Set GOOGLE_CLOUD_PROJECT and use service account auth
# - More setup but higher quality results

class GeminiService
  API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'.freeze

  # Text/Vision models - use stable versions with high rate limits
  TEXT_MODEL = 'gemini-2.0-flash'  # 2K RPM, unlimited RPD
  VISION_MODEL = 'gemini-2.0-flash'  # 2K RPM, unlimited RPD

  # Image generation - use the preview-image model for generating images
  IMAGE_GEN_MODEL = 'gemini-2.5-flash-preview-image'  # 500 RPM, 2K RPD

  class GeminiError < StandardError; end

  def initialize
    @api_key = ENV.fetch('GOOGLE_GEMINI_API_KEY', nil) || ENV.fetch('GEMINI_API_KEY', nil)
  end

  # Generate content from text prompt
  def generate_content(prompt, model: TEXT_MODEL)
    return fallback_response(prompt) if @api_key.blank?

    # Try different model names in case of API changes
    # Use stable models with high rate limits (2K RPM, unlimited RPD)
    models_to_try = [model, 'gemini-2.0-flash', 'gemini-2.5-flash']
    last_error = nil

    models_to_try.uniq.each do |m|
      url = "#{API_URL}/#{m}:generateContent?key=#{@api_key}"

      begin
        response = HTTParty.post(
          url,
          headers: { 'Content-Type' => 'application/json' },
          body: {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096
            }
          }.to_json,
          timeout: 60
        )

        if response.success?
          Rails.logger.info("Successfully used model: #{m}")
          return extract_text_from_response(response.parsed_response)
        elsif response.code == 429
          # Rate limit - don't try other models, wait is needed
          Rails.logger.error("Rate limit hit on #{m}. Free tier: 15 req/min. Wait 60 seconds.")
          raise GeminiError, "Limite atteinte (15 req/min). Attendez 1 minute et réessayez."
        elsif response.code == 400
          # Bad request - might be invalid model or config
          error_body = response.body rescue ''
          Rails.logger.warn("Model #{m} bad request: #{error_body}")
          last_error = "#{m}: 400 Bad Request"
        else
          last_error = "#{m}: #{response.code}"
          Rails.logger.warn("Model #{m} failed: #{response.code}")
        end
      rescue => e
        last_error = "#{m}: #{e.message}"
        Rails.logger.warn("Model #{m} error: #{e.message}")
      end
    end

    Rails.logger.error("All Gemini models failed. Last error: #{last_error}")
    raise GeminiError, "Gemini API error: #{last_error}"
  rescue HTTParty::Error, Timeout::Error, Net::OpenTimeout, Net::ReadTimeout => e
    Rails.logger.error("Gemini connection error: #{e.message}")
    raise GeminiError, "Connection error: #{e.message}"
  end

  # Generate content from image + text (multimodal)
  def generate_with_image(prompt, image_url: nil, image_base64: nil, mime_type: 'image/jpeg')
    return fallback_response(prompt) if @api_key.blank?

    parts = [{ text: prompt }]

    # Add image if provided
    if image_base64.present?
      parts.unshift({
        inline_data: {
          mime_type: mime_type,
          data: image_base64
        }
      })
    elsif image_url.present?
      # Fetch image and convert to base64
      begin
        image_response = HTTParty.get(image_url, timeout: 30)
        if image_response.success?
          base64_data = Base64.strict_encode64(image_response.body)
          content_type = image_response.headers['content-type'] || 'image/jpeg'
          parts.unshift({
            inline_data: {
              mime_type: content_type,
              data: base64_data
            }
          })
        end
      rescue => e
        Rails.logger.warn("Could not fetch image: #{e.message}")
      end
    end

    # Try different model names in case of API changes
    # Use stable models with high rate limits
    models_to_try = [VISION_MODEL, 'gemini-2.0-flash', 'gemini-2.5-flash']
    last_error = nil

    models_to_try.each do |model|
      url = "#{API_URL}/#{model}:generateContent?key=#{@api_key}"

      begin
        response = HTTParty.post(
          url,
          headers: { 'Content-Type' => 'application/json' },
          body: {
            contents: [{ parts: parts }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 4096
            }
          }.to_json,
          timeout: 90
        )

        if response.success?
          Rails.logger.info("Successfully used model: #{model}")
          return extract_text_from_response(response.parsed_response)
        elsif response.code == 429
          # Rate limit - don't try other models, wait is needed
          Rails.logger.error("Rate limit hit on #{model}. Free tier: 15 req/min. Wait 60 seconds.")
          raise GeminiError, "Limite atteinte (15 req/min). Attendez 1 minute et réessayez."
        elsif response.code == 400
          # Bad request - might be invalid model or config
          error_body = response.body rescue ''
          Rails.logger.warn("Model #{model} bad request: #{error_body.truncate(200)}")
          last_error = "#{model}: 400 Bad Request"
        else
          last_error = "#{model}: #{response.code}"
          Rails.logger.warn("Model #{model} failed: #{response.code}")
        end
      rescue GeminiError
        raise # Re-raise rate limit errors
      rescue => e
        last_error = "#{model}: #{e.message}"
        Rails.logger.warn("Model #{model} error: #{e.message}")
      end
    end

    Rails.logger.error("All Gemini models failed. Last error: #{last_error}")
    raise GeminiError, "Gemini Vision API error: #{last_error}"
  rescue HTTParty::Error, Timeout::Error, Net::OpenTimeout, Net::ReadTimeout => e
    Rails.logger.error("Gemini connection error: #{e.message}")
    raise GeminiError, "Connection error: #{e.message}"
  end

  # Edit an image using Gemini - add plants/trees to the viewpoint photo
  # This sends the SOURCE IMAGE and asks Gemini to modify it
  def edit_image(source_image_base64:, source_mime_type:, prompt:)
    return nil if @api_key.blank?

    # Use gemini-2.0-flash-exp for image editing (it can take image input and output edited image)
    # This model has lower rate limits (10 RPM) but can edit images
    edit_model = 'gemini-2.0-flash-exp'
    url = "#{API_URL}/#{edit_model}:generateContent?key=#{@api_key}"

    Rails.logger.info("Editing image with #{edit_model}, prompt: #{prompt.truncate(100)}")

    response = HTTParty.post(
      url,
      headers: { 'Content-Type' => 'application/json' },
      body: {
        contents: [{
          parts: [
            # First, include the source image
            {
              inline_data: {
                mime_type: source_mime_type,
                data: source_image_base64
              }
            },
            # Then the editing instructions
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0.8,
          responseModalities: ['IMAGE', 'TEXT']  # Request image output
        }
      }.to_json,
      timeout: 180  # 3 minutes for image editing
    )

    if response.success?
      result = parse_gemini_image_response(response.parsed_response)
      if result
        Rails.logger.info("Image editing successful, got #{result[:base64]&.length || 0} bytes")
      else
        Rails.logger.warn("Image editing returned no image in response")
      end
      result
    elsif response.code == 429
      Rails.logger.error("Rate limit hit on image editing. Wait and try again.")
      raise GeminiError, "Limite atteinte. Attendez 1 minute et réessayez."
    else
      Rails.logger.error("Gemini image edit API error: #{response.code} - #{response.body}")
      nil
    end
  rescue HTTParty::Error, Timeout::Error, Net::OpenTimeout, Net::ReadTimeout => e
    Rails.logger.error("Image editing connection error: #{e.message}")
    nil
  end

  # Alternative: Generate image using Vertex AI Imagen 3 (better quality, requires GCP setup)
  def generate_image_vertex(prompt:, aspect_ratio: '4:3')
    # This requires GOOGLE_CLOUD_PROJECT and service account authentication
    # Endpoint: https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/us-central1/publishers/google/models/imagen-3.0-generate-002:predict

    project_id = ENV.fetch('GOOGLE_CLOUD_PROJECT', nil)
    return nil if project_id.blank?

    Rails.logger.info("Generating image with Vertex AI Imagen 3")

    # TODO: Implement Vertex AI authentication and API call
    # This is more complex and requires OAuth2 or service account
    nil
  end

  # Main method for viewpoint transformation
  def generate_viewpoint_transformation(viewpoint_photo:, plants:, target_years:, season:)
    target_year = Time.current.year + target_years

    # Calculate growth for each plant
    plants_with_growth = plants.map do |plant|
      growth = GrowthCalculatorService.calculate_growth(plant, target_years)
      {
        **plant.symbolize_keys,
        **growth
      }
    end

    # Load the source image first (we'll use it for both text description and image editing)
    image_base64 = nil
    mime_type = 'image/jpeg'
    if viewpoint_photo.photo.attached?
      begin
        image_data = viewpoint_photo.photo.download
        image_base64 = Base64.strict_encode64(image_data)
        mime_type = viewpoint_photo.photo.content_type || 'image/jpeg'
        Rails.logger.info("Loaded image from Active Storage: #{image_data.length} bytes, type: #{mime_type}")
      rescue => e
        Rails.logger.warn("Could not load image from Active Storage: #{e.message}")
      end
    end

    # Build the text description prompt
    prompt = build_viewpoint_prompt(
      photo_name: viewpoint_photo.name,
      photo_description: viewpoint_photo.description,
      plants: plants_with_growth,
      target_years: target_years,
      target_year: target_year,
      season: season
    )

    # Generate text description using vision API
    response_text = if image_base64
      begin
        generate_with_image(prompt, image_base64: image_base64, mime_type: mime_type)
      rescue => e
        Rails.logger.warn("Vision API failed: #{e.message}, falling back to text-only")
        generate_content(prompt)
      end
    else
      generate_content(prompt)
    end

    # Parse the text response
    text_result = parse_viewpoint_response(response_text, plants_with_growth, prompt)

    # Build image EDITING prompt - this describes how to modify the source photo
    # Include camera position/direction for precise plant placement
    image_edit_prompt = build_image_edit_prompt(
      plants: plants_with_growth,
      target_years: target_years,
      target_year: target_year,
      season: season,
      camera_position: viewpoint_photo.camera_position,
      camera_direction: viewpoint_photo.camera_direction
    )

    Rails.logger.info("Image edit prompt: #{image_edit_prompt}")

    # Edit the source image to show the future garden
    generated_image = nil
    if image_base64
      begin
        Rails.logger.info("Attempting to edit source image with plants...")
        generated_image = edit_image(
          source_image_base64: image_base64,
          source_mime_type: mime_type,
          prompt: image_edit_prompt
        )
      rescue GeminiError => e
        Rails.logger.warn("Image editing failed (will return text only): #{e.message}")
      end
    end

    # Combine text and image results
    {
      **text_result,
      image_base64: generated_image&.dig(:base64),
      image_prompt: image_edit_prompt
    }
  rescue GeminiError => e
    Rails.logger.error("Viewpoint transformation error: #{e.message}")
    fallback_viewpoint_response(plants_with_growth, target_years, season)
  end

  # Original method for garden predictions
  def generate_garden_prediction(plants:, zones:, structures:, target_years:, season: 'summer')
    prompt = build_prediction_prompt(
      plants: plants,
      zones: zones,
      structures: structures,
      target_years: target_years,
      season: season
    )

    response_text = generate_content(prompt)
    parse_prediction_response(response_text, plants, target_years)
  rescue GeminiError => e
    Rails.logger.error("Garden prediction error: #{e.message}")
    fallback_prediction(plants, target_years)
  end

  private

  def extract_text_from_response(response)
    candidates = response.dig('candidates')
    return '' if candidates.blank?

    content = candidates.first.dig('content', 'parts')
    return '' if content.blank?

    content.map { |part| part['text'] }.compact.join("\n")
  end

  def parse_imagen_response(response)
    # Imagen 3 returns images in the 'images' array
    images = response.dig('images') || response.dig('generatedImages') || []
    return nil if images.empty?

    first_image = images.first
    base64_data = first_image['bytesBase64Encoded'] || first_image['image']&.dig('bytesBase64Encoded')

    return nil if base64_data.blank?

    {
      base64: base64_data,
      mime_type: 'image/png'
    }
  end

  # Parse response from Gemini 2.0 Flash with image generation
  def parse_gemini_image_response(response)
    candidates = response.dig('candidates')
    return nil if candidates.blank?

    content = candidates.first.dig('content', 'parts')
    return nil if content.blank?

    # Look for inline_data (image) in the response parts
    content.each do |part|
      if part['inlineData'].present?
        inline_data = part['inlineData']
        return {
          base64: inline_data['data'],
          mime_type: inline_data['mimeType'] || 'image/png'
        }
      end
    end

    # No image found in response
    Rails.logger.warn("Gemini response did not contain an image")
    nil
  end

  def build_viewpoint_prompt(photo_name:, photo_description:, plants:, target_years:, target_year:, season:)
    season_details = case season
    when 'spring' then 'early spring with fresh new growth, budding leaves, and spring flowers'
    when 'summer' then 'full summer with lush green foliage, flowers in bloom, and vibrant colors'
    when 'fall', 'autumn' then 'autumn with changing leaves, warm colors (reds, oranges, yellows), and harvest atmosphere'
    when 'winter' then 'winter with bare deciduous trees, evergreen presence, possible frost or snow'
    else 'summer conditions'
    end

    plant_descriptions = plants.map do |plant|
      name = plant[:common_name] || plant['common_name'] || 'Unknown plant'
      height_m = ((plant[:predicted_height_cm] || 100) / 100.0).round(1)
      canopy_m = ((plant[:predicted_canopy_cm] || 80) / 100.0).round(1)
      stage = plant[:growth_stage] || 'Established'

      "- #{name}: #{height_m}m tall, #{canopy_m}m canopy spread, #{stage} stage"
    end.join("\n")

    <<~PROMPT
      You are an expert garden designer and landscape visualizer. I'm showing you a photo of my garden viewpoint called "#{photo_name}".
      #{photo_description.present? ? "Description: #{photo_description}" : ''}

      ## Your Task

      Describe in vivid, evocative detail how this exact view will look in #{target_years} years (by #{target_year}), during #{season_details}.

      ## Plants That Will Be Visible (with predicted growth):

      #{plant_descriptions.presence || 'No specific plants in this view yet - describe a natural garden progression.'}

      ## Instructions

      1. Analyze the current photo and identify key features (lawn areas, existing plants, structures, sky, etc.)
      2. Imagine how each planted plant will have grown and integrated into the scene
      3. Describe the transformed view as if you're standing there, including:
         - How the plants fill the space and create structure
         - The interplay of heights, textures, and colors
         - Seasonal effects (#{season}: #{season_details})
         - The atmosphere and feeling of the space
         - Any wildlife or sensory details (sounds, scents)

      ## Response Format

      Provide your response in this JSON format:
      {
        "sceneDescription": "A 3-4 paragraph vivid description of the transformed view. Write as if describing what you see when you look at this view in #{target_year}. Be specific about where plants are, their visual impact, and the overall atmosphere.",
        "plantsShown": [
          {
            "name": "plant name",
            "visualAppearance": "1-2 sentences describing how this specific plant looks in the scene"
          }
        ],
        "atmosphereNotes": "A short paragraph about the feeling of being in this space - the sounds, scents, and emotional quality"
      }

      Be poetic but grounded in botanical reality. The description should help the user visualize their garden's future.
    PROMPT
  end

  def build_imagen_prompt(plants:, target_years:, target_year:, season:)
    season_desc = case season
    when 'spring' then 'early spring with fresh buds, new green leaves, and spring flowers blooming'
    when 'summer' then 'lush summer with full green foliage, flowers in bloom, and vibrant colors'
    when 'fall', 'autumn' then 'autumn with colorful changing leaves in red, orange, and yellow'
    when 'winter' then 'winter with bare deciduous trees, snow-covered ground, and evergreen presence'
    else 'summer with lush greenery'
    end

    # Build concise plant descriptions
    plant_list = plants.map do |p|
      name = p[:common_name] || p['common_name'] || 'plant'
      height_m = ((p[:predicted_height_cm] || 100) / 100.0).round(1)
      "#{name} (#{height_m}m tall)"
    end

    plant_text = if plant_list.any?
      "featuring #{plant_list.take(5).join(', ')}"
    else
      "with mature trees and shrubs"
    end

    <<~PROMPT.strip
      A photorealistic garden photograph showing a beautiful Belgian garden in #{target_year} during #{season_desc}. The garden #{plant_text}. The plants are well-established, mature, and integrated into the landscape. Natural daylight, soft shadows, high detail. Style: landscape photography, garden design visualization, photorealistic.
    PROMPT
  end

  # Build prompt for IMAGE EDITING - tells Gemini how to modify the source photo
  # Includes precise positioning based on camera viewpoint and plant locations
  def build_image_edit_prompt(plants:, target_years:, target_year:, season:, camera_position: nil, camera_direction: nil)
    season_desc = case season
    when 'spring' then 'spring with fresh green leaves and some flowers'
    when 'summer' then 'summer with full lush green foliage'
    when 'fall', 'autumn' then 'autumn with some leaves turning orange and yellow'
    when 'winter' then 'winter with bare branches'
    else 'summer'
    end

    # Build plant descriptions with POSITIONS based on camera viewpoint
    plant_instructions = plants.map do |p|
      name = p[:common_name] || p['common_name'] || 'tree'
      species = p[:species] || p['species'] || ''
      height_m = ((p[:predicted_height_cm] || 100) / 100.0).round(1)
      canopy_m = ((p[:predicted_canopy_cm] || 80) / 100.0).round(1)
      age = target_years + (p[:current_age_years] || 1)

      # Calculate position in frame if we have camera info
      position_desc = calculate_position_in_frame(p, camera_position, camera_direction)

      {
        description: "a #{age}-year-old #{name} (#{species}), approximately #{height_m}m tall",
        position: position_desc,
        distance: calculate_distance(p, camera_position)
      }
    end

    # Sort by distance (closest = larger in frame, further = smaller)
    plant_instructions.sort_by! { |p| p[:distance] || 999 }

    if plant_instructions.any?
      # Build detailed placement instructions
      placement_text = plant_instructions.take(4).map.with_index do |p, i|
        size_hint = case p[:distance]
        when 0..20 then "large/close in frame"
        when 20..50 then "medium size in frame"
        else "smaller/further in frame"
        end
        "#{i + 1}. #{p[:description]} - place it #{p[:position]} (#{size_hint})"
      end.join("\n")

      <<~PROMPT.strip
        Edit this photo to show how this garden will look in #{target_year} (#{target_years} years from now) during #{season_desc}.

        Add these trees to the photo at the specified positions:
        #{placement_text}

        IMPORTANT positioning rules:
        - "far left" = leftmost 20% of the image
        - "left" = 20-40% from left
        - "center-left" = 40-50% from left
        - "center" = middle of the image
        - "center-right" = 50-60% from left
        - "right" = 60-80% from left
        - "far right" = rightmost 20% of the image
        - Trees further away should appear smaller
        - Trees closer should appear larger

        Additional instructions:
        - Keep the same background, sky, and horizon line
        - Add realistic shadows matching the lighting
        - Show #{season_desc} foliage conditions
        - Maintain photorealistic quality matching the original photo
      PROMPT
    else
      <<~PROMPT.strip
        Edit this photo to show how this garden will look in #{target_year} during #{season_desc}.
        Add a few young trees (2-3 meters tall) naturally placed in the grass area.
        Keep the same viewpoint, sky, and background. Maintain photorealistic quality.
      PROMPT
    end
  end

  # Calculate where a plant appears in the camera frame (left, center, right)
  # Handles coordinate conversion between lat/lng and map percentages
  def calculate_position_in_frame(plant, camera_position, camera_direction)
    return "in the center of the grass area" unless camera_position && camera_direction

    # Get camera position (in 0-100 map coordinates)
    cam_x = (camera_position[:x] || camera_position['x'] || 50).to_f
    cam_y = (camera_position[:y] || camera_position['y'] || 50).to_f
    cam_dir = camera_direction.to_f

    # Get plant position - could be x/y (map %) or lat/lng
    plant_x = plant[:x] || plant['x']
    plant_y = plant[:y] || plant['y']

    # If no x/y, try to use lat/lng and normalize to map coordinates
    # This is approximate - assumes plants are spread across the visible area
    unless plant_x && plant_y
      lat = plant.dig(:location, :lat) || plant.dig('location', 'lat')
      lng = plant.dig(:location, :lng) || plant.dig('location', 'lng')

      if lat && lng
        # Normalize lat/lng to 0-100 based on typical garden bounds
        # Assuming garden is roughly 100m x 100m
        # This creates relative positioning within the garden
        plant_x = ((lng.to_f - 5.551) * 10000) % 100  # Normalize lng to 0-100
        plant_y = ((lat.to_f - 49.638) * 10000) % 100  # Normalize lat to 0-100
      else
        return "in the grass area"
      end
    end

    # Calculate angle from camera to plant
    dx = plant_x.to_f - cam_x
    dy = plant_y.to_f - cam_y

    # Angle from camera to plant (0 = up/north, 90 = right/east)
    angle_to_plant = Math.atan2(dx, -dy) * (180 / Math::PI)
    angle_to_plant += 360 if angle_to_plant < 0

    # Relative angle (how far left/right of center view)
    relative_angle = angle_to_plant - cam_dir
    relative_angle -= 360 if relative_angle > 180
    relative_angle += 360 if relative_angle < -180

    Rails.logger.debug("Plant position calc: plant(#{plant_x.round(1)}, #{plant_y.round(1)}) cam(#{cam_x.round(1)}, #{cam_y.round(1)}) dir=#{cam_dir} -> relative_angle=#{relative_angle.round(1)}")

    # Convert to position description
    # FOV is ~60 degrees, so -30 to +30 is visible
    case relative_angle
    when -60..-30 then "on the far left edge"
    when -30..-15 then "on the left side"
    when -15..-5 then "in the center-left"
    when -5..5 then "in the center"
    when 5..15 then "in the center-right"
    when 15..30 then "on the right side"
    when 30..60 then "on the far right edge"
    else "outside the main view (barely visible at the edge)"
    end
  end

  # Calculate distance from camera to plant (in normalized coordinates)
  def calculate_distance(plant, camera_position)
    return 50 unless camera_position

    cam_x = (camera_position[:x] || camera_position['x'] || 50).to_f
    cam_y = (camera_position[:y] || camera_position['y'] || 50).to_f

    plant_x = plant[:x] || plant['x']
    plant_y = plant[:y] || plant['y']

    unless plant_x && plant_y
      lat = plant.dig(:location, :lat) || plant.dig('location', 'lat')
      lng = plant.dig(:location, :lng) || plant.dig('location', 'lng')
      if lat && lng
        plant_x = ((lng.to_f - 5.551) * 10000) % 100
        plant_y = ((lat.to_f - 49.638) * 10000) % 100
      else
        return 50
      end
    end

    Math.sqrt((plant_x.to_f - cam_x)**2 + (plant_y.to_f - cam_y)**2)
  end

  def parse_viewpoint_response(response_text, plants, prompt)
    # Try to extract JSON from the response
    json_match = response_text.match(/\{[\s\S]*\}/m)

    if json_match
      parsed = JSON.parse(json_match[0])

      {
        scene_description: parsed['sceneDescription'] || parsed['scene_description'] || 'Your garden will transform beautifully.',
        plants_shown: (parsed['plantsShown'] || parsed['plants_shown'] || []).map do |p|
          {
            name: p['name'],
            visual_appearance: p['visualAppearance'] || p['visual_appearance']
          }
        end,
        atmosphere_notes: parsed['atmosphereNotes'] || parsed['atmosphere_notes'] || '',
        image_url: nil, # Image generation not yet implemented
        prompt: prompt
      }
    else
      # If no JSON found, use the raw text as description
      {
        scene_description: response_text.strip,
        plants_shown: plants.map { |p| { name: p[:common_name] || p['common_name'], visual_appearance: '' } },
        atmosphere_notes: '',
        image_url: nil,
        prompt: prompt
      }
    end
  rescue JSON::ParserError => e
    Rails.logger.error("Failed to parse viewpoint response: #{e.message}")
    fallback_viewpoint_response(plants, 5, 'summer')
  end

  def fallback_viewpoint_response(plants, target_years, season)
    plant_list = plants.map { |p| p[:common_name] || p['common_name'] }.compact.join(', ')

    {
      scene_description: if plants.any?
        "In #{target_years} years, this view will be transformed. Your #{plant_list} will have grown and matured, creating a beautiful layered garden landscape. Configure your Gemini API key to get detailed AI-generated descriptions."
      else
        "This viewpoint will evolve naturally over time. Add plants to your garden plan and configure your Gemini API key to see detailed future visualizations."
      end,
      plants_shown: plants.map do |p|
        { name: p[:common_name] || p['common_name'], visual_appearance: 'Growth prediction available with Gemini API key' }
      end,
      atmosphere_notes: 'Configure your Google Gemini API key for detailed atmosphere descriptions.',
      image_url: nil,
      prompt: ''
    }
  end

  def build_prediction_prompt(plants:, zones:, structures:, target_years:, season:)
    target_year = Time.current.year + target_years

    plant_descriptions = plants.map do |plant|
      "- #{plant['common_name']} (#{plant['species'].to_s.tr('_', ' ')}): planted #{plant['planted_date']}"
    end.join("\n")

    zone_descriptions = zones.map do |zone|
      "- #{zone['name']}: #{zone['type'].to_s.tr('_', ' ')}"
    end.join("\n")

    structure_descriptions = structures.map do |structure|
      "- #{structure['name'] || structure['type']}: #{structure['type'].to_s.tr('_', ' ')}"
    end.join("\n")

    <<~PROMPT
      You are an expert garden designer and horticulturist analyzing a garden in Wallonia, Belgium.

      Based on the following garden plan, provide a vivid and detailed description of how this garden will look in #{target_years} years (by #{target_year}), during #{season}.

      ## Current Garden State

      ### Plants (#{plants.length} total):
      #{plant_descriptions.presence || 'No plants yet'}

      ### Garden Zones (#{zones.length} total):
      #{zone_descriptions.presence || 'No zones defined'}

      ### Structures (#{structures.length} total):
      #{structure_descriptions.presence || 'No structures'}

      ## Your Task

      Please provide a response in the following JSON format:
      {
        "description": "A 2-3 paragraph vivid description of how the garden will look and feel in #{target_years} years during #{season}. Include sensory details - colors, sounds, smells, and the overall atmosphere.",
        "plantPredictions": [
          {
            "plantId": "the plant's id",
            "visualDescription": "A short (1-2 sentence) description of how this specific plant will look"
          }
        ],
        "atmosphereNotes": "A short paragraph about the overall mood, wildlife activity, and experience of being in this garden"
      }

      Focus on creating an evocative, inspiring vision of the garden's future while staying grounded in the botanical reality of the plants' growth patterns.
    PROMPT
  end

  def parse_prediction_response(response_text, plants, target_years)
    # Try to extract JSON from the response
    json_match = response_text.match(/\{[\s\S]*\}/m)

    if json_match
      parsed = JSON.parse(json_match[0])

      # Calculate growth predictions
      plant_predictions = plants.map do |plant|
        growth = GrowthCalculatorService.calculate_growth(plant, target_years)

        ai_prediction = parsed['plantPredictions']&.find { |p| p['plantId'] == plant['id'] }

        {
          plant_id: plant['id'],
          plant_name: plant['common_name'],
          predicted_height_cm: growth[:predicted_height_cm],
          predicted_canopy_cm: growth[:predicted_canopy_cm],
          predicted_carbon_kg: growth[:predicted_carbon_kg],
          growth_stage: growth[:growth_stage],
          visual_description: ai_prediction&.dig('visualDescription') || ''
        }
      end

      total_carbon = plant_predictions.sum { |p| p[:predicted_carbon_kg] }

      {
        description: parsed['description'] || 'Your garden will evolve beautifully over time.',
        plant_predictions: plant_predictions,
        atmosphere_notes: parsed['atmosphereNotes'] || '',
        total_carbon_kg: total_carbon.round(1)
      }
    else
      fallback_prediction(plants, target_years)
    end
  rescue JSON::ParserError => e
    Rails.logger.error("Failed to parse Gemini response: #{e.message}")
    fallback_prediction(plants, target_years)
  end

  def fallback_response(_prompt)
    'AI description unavailable. Please configure your Google Gemini API key.'
  end

  def fallback_prediction(plants, target_years)
    plant_predictions = plants.map do |plant|
      growth = GrowthCalculatorService.calculate_growth(plant, target_years)

      {
        plant_id: plant['id'],
        plant_name: plant['common_name'],
        predicted_height_cm: growth[:predicted_height_cm],
        predicted_canopy_cm: growth[:predicted_canopy_cm],
        predicted_carbon_kg: growth[:predicted_carbon_kg],
        growth_stage: growth[:growth_stage],
        visual_description: ''
      }
    end

    total_carbon = plant_predictions.sum { |p| p[:predicted_carbon_kg] }

    description = if plants.any?
                    "In #{target_years} years, your garden will have matured significantly. " \
                    "Your #{plants.length} plant#{plants.length > 1 ? 's' : ''} will have grown and established themselves."
                  else
                    "Your garden awaits! Add some plants to see growth predictions."
                  end

    {
      description: description,
      plant_predictions: plant_predictions,
      atmosphere_notes: 'Configure your Google Gemini API key to get detailed AI-generated predictions.',
      total_carbon_kg: total_carbon.round(1)
    }
  end
end
