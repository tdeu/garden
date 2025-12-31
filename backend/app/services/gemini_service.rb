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

  # Property bounds (matching frontend CanvasGarden.tsx)
  PROPERTY_BOUNDS = {
    north: 49.6409,
    south: 49.6365,
    east: 5.5584,
    west: 5.5460
  }.freeze

  # Meters per degree at this latitude (~49.64°)
  # 1° latitude ≈ 111,000m, 1° longitude ≈ 111,000 * cos(49.64°) ≈ 71,800m
  METERS_PER_DEG_LAT = 111_000.0
  METERS_PER_DEG_LNG = 71_800.0

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

  # Generate an image from text prompt (no source image)
  # Used for generating isolated tree images for compositing
  def generate_image_with_gemini(prompt)
    return nil if @api_key.blank?

    # Use gemini-2.0-flash-exp for image generation
    gen_model = 'gemini-2.0-flash-exp'
    url = "#{API_URL}/#{gen_model}:generateContent?key=#{@api_key}"

    Rails.logger.info("Generating image with #{gen_model}, prompt: #{prompt.truncate(100)}")

    response = HTTParty.post(
      url,
      headers: { 'Content-Type' => 'application/json' },
      body: {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.9,
          responseModalities: ['IMAGE', 'TEXT']
        }
      }.to_json,
      timeout: 180
    )

    if response.success?
      result = parse_gemini_image_response(response.parsed_response)
      if result
        Rails.logger.info("Image generation successful, got #{result[:base64]&.length || 0} bytes")
      else
        Rails.logger.warn("Image generation returned no image")
      end
      result
    elsif response.code == 429
      Rails.logger.error("Rate limit hit on image generation")
      raise GeminiError, "Limite atteinte. Attendez 1 minute et réessayez."
    else
      Rails.logger.error("Gemini image gen API error: #{response.code} - #{response.body}")
      nil
    end
  rescue HTTParty::Error, Timeout::Error => e
    Rails.logger.error("Image generation connection error: #{e.message}")
    nil
  end

  # Main method for viewpoint transformation - AI EDITING APPROACH
  # Sends photo to AI and asks it to add trees naturally
  def generate_viewpoint_transformation(viewpoint_photo:, plants:, target_years:, season:)
    # Calculate growth for each plant
    plants_with_growth = plants.map do |plant|
      growth = GrowthCalculatorService.calculate_growth(plant, target_years)
      {
        **plant.symbolize_keys,
        **growth
      }
    end

    # Load the source image
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

    # If no plants are visible in FOV, return original image unchanged
    if plants.empty?
      Rails.logger.info("No plants in camera FOV - returning original image unchanged")
      return {
        image_base64: image_base64,
        image_prompt: "No plants in FOV - original image returned",
        plants_count: 0
      }
    end

    # Calculate positions for each plant
    plants_with_positions = plants_with_growth.map do |plant|
      distance_m = calculate_distance_meters(plant, viewpoint_photo.camera_position)
      position_info = calculate_position_in_frame(plant, viewpoint_photo.camera_position, viewpoint_photo.camera_direction)
      plant.merge(distance_m: distance_m, position_info: position_info)
    end

    # Build the editing prompt
    prompt = build_tree_editing_prompt(
      plants: plants_with_positions,
      target_years: target_years,
      season: season
    )

    Rails.logger.info("AI Edit prompt: #{prompt}")

    # Edit the image with AI
    generated_image = nil
    if image_base64
      begin
        generated_image = edit_image(
          source_image_base64: image_base64,
          source_mime_type: mime_type,
          prompt: prompt
        )
      rescue GeminiError => e
        Rails.logger.warn("Image editing failed: #{e.message}")
      end
    end

    {
      image_base64: generated_image&.dig(:base64),
      image_prompt: prompt,
      plants_count: plants_with_positions.length
    }
  rescue => e
    Rails.logger.error("Viewpoint transformation error: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
    { image_base64: nil, image_prompt: nil, plants_count: 0, error: e.message }
  end

  # Build a clear, simple prompt for AI tree editing
  def build_tree_editing_prompt(plants:, target_years:, season:)
    season_desc = case season
    when 'spring' then 'in spring (fresh green leaves)'
    when 'summer' then 'in summer (full green foliage)'
    when 'fall', 'autumn' then 'in autumn (orange/yellow leaves)'
    when 'winter' then 'in winter (bare branches)'
    else 'in summer'
    end

    # Sort by distance
    sorted_plants = plants.sort_by { |p| p[:distance_m] || 999 }

    # Build tree list
    tree_list = sorted_plants.take(4).map.with_index do |plant, i|
      name = plant[:common_name] || plant['common_name'] || 'tree'
      height_m = ((plant[:predicted_height_cm] || 200) / 100.0).round(1)
      distance_m = (plant[:distance_m] || 30).round(0)
      pos = plant[:position_info] || {}

      horizontal = case (pos[:horizontal_pct] || 50)
      when 0..25 then "on the LEFT"
      when 26..45 then "LEFT of center"
      when 46..55 then "in the CENTER"
      when 56..75 then "RIGHT of center"
      else "on the RIGHT"
      end

      "#{i + 1}. #{name} - #{height_m}m tall, #{distance_m}m away, #{horizontal}"
    end.join("\n")

    <<~PROMPT.strip
      Add these trees to the grass area in this photo #{season_desc}:

      #{tree_list}

      Instructions:
      - Add ONLY these trees, nothing else
      - Keep ALL existing elements exactly as they are (buildings, existing trees, sky, etc.)
      - Trees farther away should appear smaller
      - Make trees look natural and photorealistic
      - Match the lighting and shadows of the scene
    PROMPT
  end

  # PHASE 1: Analyze the scene to identify existing objects and their distances
  # This creates a reference map that we use to place new trees accurately
  def analyze_scene(image_base64, mime_type)
    return {} if @api_key.blank? || image_base64.blank?

    prompt = <<~PROMPT
      Analyze this photo and identify all major objects. For each object, estimate its distance from the camera in meters.

      Return ONLY a JSON object with this exact structure:
      {
        "objects": [
          {
            "type": "building/tree/fence/path/vehicle/other",
            "description": "brief description (e.g., 'white house with red roof', 'tall oak tree')",
            "distance_m": estimated distance in meters (number),
            "position": "left/center-left/center/center-right/right",
            "height_m": estimated height in meters if applicable (number or null),
            "width_m": estimated width in meters if applicable (number or null)
          }
        ],
        "ground_type": "grass/gravel/concrete/mixed",
        "horizon_description": "where the horizon appears in the image",
        "depth_markers": "describe what helps judge distance (e.g., 'fence posts receding', 'path leading away')"
      }

      Be precise with distance estimates. Use visual cues like:
      - Object size (a person is ~1.7m tall, a car is ~4.5m long, a house door is ~2m tall)
      - Perspective convergence
      - Atmospheric haze for distant objects
      - Relative sizes of known objects

      Important: Estimate distances as accurately as possible. This data will be used to place new trees at specific distances.
    PROMPT

    begin
      response_text = generate_with_image(prompt, image_base64: image_base64, mime_type: mime_type)

      # Extract JSON from response
      json_match = response_text.match(/\{[\s\S]*\}/m)
      if json_match
        parsed = JSON.parse(json_match[0])
        Rails.logger.info("Scene analysis found #{parsed['objects']&.length || 0} objects")
        parsed
      else
        Rails.logger.warn("Could not parse scene analysis response: #{response_text.truncate(200)}")
        {}
      end
    rescue JSON::ParserError => e
      Rails.logger.error("Failed to parse scene analysis JSON: #{e.message}")
      {}
    rescue => e
      Rails.logger.error("Scene analysis failed: #{e.message}")
      {}
    end
  end

  # PHASE 2: Build placement prompt using scene analysis for relative positioning
  def build_relative_placement_prompt(plants:, scene_analysis:, target_years:, season:)
    season_desc = case season
    when 'spring' then 'spring with fresh green leaves'
    when 'summer' then 'summer with full lush foliage'
    when 'fall', 'autumn' then 'autumn with some leaves turning colors'
    when 'winter' then 'winter with bare branches'
    else 'summer'
    end

    # Build scene context from analysis
    scene_objects = scene_analysis['objects'] || []
    scene_context = if scene_objects.any?
      objects_desc = scene_objects.map do |obj|
        "- #{obj['description']} at #{obj['distance_m']}m (#{obj['position']})"
      end.join("\n")

      <<~CONTEXT
        SCENE REFERENCE (use these to judge distances):
        #{objects_desc}
        Ground: #{scene_analysis['ground_type'] || 'grass'}
      CONTEXT
    else
      "SCENE: Open area with grass"
    end

    # Sort plants by distance (closest first)
    sorted_plants = plants.sort_by { |p| p[:distance_m] || 999 }

    # Build tree placement instructions with RELATIVE positioning
    tree_instructions = sorted_plants.take(4).map.with_index do |plant, i|
      name = plant[:common_name] || plant['common_name'] || 'tree'
      height_m = ((plant[:predicted_height_cm] || 100) / 100.0).round(1)
      distance_m = (plant[:distance_m] || 30).round(1)
      age = target_years + (plant[:current_age_years] || 1)
      pos = plant[:position_info] || {}
      horizontal_pct = pos[:horizontal_pct] || 50

      # Find nearby scene objects for relative positioning
      nearby_objects = scene_objects.select { |obj| (obj['distance_m'].to_f - distance_m).abs < 15 }
      closer_objects = scene_objects.select { |obj| obj['distance_m'].to_f < distance_m }
      farther_objects = scene_objects.select { |obj| obj['distance_m'].to_f > distance_m }

      # Build relative description
      relative_desc = []

      if closer_objects.any?
        closest = closer_objects.max_by { |o| o['distance_m'].to_f }
        diff = distance_m - closest['distance_m'].to_f
        relative_desc << "#{diff.round(0)}m BEHIND the #{closest['description']}"
      end

      if farther_objects.any?
        farthest_closer = farther_objects.min_by { |o| o['distance_m'].to_f }
        diff = farthest_closer['distance_m'].to_f - distance_m
        relative_desc << "#{diff.round(0)}m IN FRONT of the #{farthest_closer['description']}"
      end

      relative_text = relative_desc.any? ? relative_desc.join(" and ") : "in the open area"

      # Horizontal position description
      horiz_desc = case horizontal_pct
      when 0..20 then "on the LEFT side"
      when 21..40 then "LEFT of CENTER"
      when 41..60 then "in the CENTER"
      when 61..80 then "RIGHT of CENTER"
      when 81..100 then "on the RIGHT side"
      else "in the CENTER"
      end

      <<~TREE.strip
        TREE #{i + 1}: #{name} (#{age} years old)
        • Height: #{height_m}m tall
        • Distance from camera: #{distance_m}m
        • Position: #{horiz_desc} of the frame
        • Relative placement: #{relative_text}
        • This tree should appear #{distance_m < 10 ? 'LARGE (very close)' : distance_m < 25 ? 'MEDIUM sized' : 'SMALLER (farther away)'} in the image
      TREE
    end.join("\n\n")

    <<~PROMPT.strip
      Edit this photo by ADDING trees at specific positions. KEEP everything else unchanged.

      #{scene_context}

      TREES TO ADD:
      #{tree_instructions}

      CRITICAL RULES:
      1. DO NOT remove or modify ANY existing objects (trees, buildings, etc.)
      2. Place each tree at EXACTLY the distance specified - use the scene reference objects to judge scale
      3. A tree at 5m should appear MUCH larger than a tree at 30m
      4. Trees closer than existing objects should appear IN FRONT of them
      5. Trees farther than existing objects should appear BEHIND them
      6. Match the lighting and shadow direction of the existing scene

      Season: #{season_desc}

      Output the same photo with ONLY the new trees added, blending naturally with the scene.
    PROMPT
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

  # Identify a plant from a photo using AI vision
  # Returns structured identification suggestions with confidence levels
  def identify_plant(image_base64:, mime_type: 'image/jpeg', context: nil)
    return fallback_identification if @api_key.blank?

    context_text = context.present? ? "\n\nAdditional context from the user: #{context}" : ""

    prompt = <<~PROMPT
      You are an expert botanist and horticulturist specializing in plants found in Belgian gardens (Wallonia region, hardiness zone 7b-8a).

      Analyze this photo and identify the plant shown. Consider:
      - Leaf shape, arrangement, and color
      - Bark texture and color (if visible)
      - Flowers or fruit (if present)
      - Overall growth habit and form
      - Season-appropriate characteristics
      #{context_text}

      Provide your response as JSON with this exact structure:
      {
        "primary_suggestion": {
          "species": "botanical_name_in_snake_case",
          "common_name": "Common Name",
          "common_name_fr": "Nom français",
          "confidence": "high|medium|low",
          "confidence_percentage": 85,
          "reasoning": "Brief explanation of why you identified this plant"
        },
        "alternative_suggestions": [
          {
            "species": "alternative_species",
            "common_name": "Alternative Name",
            "common_name_fr": "Nom alternatif",
            "confidence_percentage": 60,
            "reasoning": "Why this could also be a match"
          }
        ],
        "category": "tree|fruit_tree|shrub|perennial|hedge|annual|vegetable|herb|berry|wall_plant|bulb",
        "characteristics_observed": ["list", "of", "visible", "features"],
        "health_assessment": {
          "status": "thriving|healthy|fair|struggling|declining|unknown",
          "observations": "Brief notes on plant health if visible"
        },
        "care_tips": "Brief care recommendations for this plant in Belgian climate",
        "identification_notes": "Any uncertainties or suggestions for better photos"
      }

      If you cannot identify the plant with any confidence, set confidence to "low" and explain what additional information would help.
      Always provide at least one suggestion, even if uncertain.
    PROMPT

    begin
      response_text = generate_with_image(prompt, image_base64: image_base64, mime_type: mime_type)
      parse_identification_response(response_text)
    rescue GeminiError => e
      Rails.logger.error("Plant identification failed: #{e.message}")
      { error: e.message }
    end
  end

  private

  def extract_text_from_response(response)
    candidates = response.dig('candidates')
    return '' if candidates.blank?

    content = candidates.first.dig('content', 'parts')
    return '' if content.blank?

    content.map { |part| part['text'] }.compact.join("\n")
  end

  def parse_identification_response(response_text)
    # Try to extract JSON from the response
    json_match = response_text.match(/\{[\s\S]*\}/m)

    if json_match
      parsed = JSON.parse(json_match[0])

      {
        success: true,
        primary_suggestion: {
          species: parsed.dig('primary_suggestion', 'species'),
          common_name: parsed.dig('primary_suggestion', 'common_name'),
          common_name_fr: parsed.dig('primary_suggestion', 'common_name_fr'),
          confidence: parsed.dig('primary_suggestion', 'confidence') || 'medium',
          confidence_percentage: parsed.dig('primary_suggestion', 'confidence_percentage') || 50,
          reasoning: parsed.dig('primary_suggestion', 'reasoning')
        },
        alternative_suggestions: (parsed['alternative_suggestions'] || []).map do |alt|
          {
            species: alt['species'],
            common_name: alt['common_name'],
            common_name_fr: alt['common_name_fr'],
            confidence_percentage: alt['confidence_percentage'] || 30,
            reasoning: alt['reasoning']
          }
        end,
        category: parsed['category'] || 'unknown',
        characteristics_observed: parsed['characteristics_observed'] || [],
        health_assessment: {
          status: parsed.dig('health_assessment', 'status') || 'unknown',
          observations: parsed.dig('health_assessment', 'observations')
        },
        care_tips: parsed['care_tips'],
        identification_notes: parsed['identification_notes']
      }
    else
      # If no JSON found, return raw text as notes
      {
        success: false,
        error: 'Could not parse identification response',
        raw_response: response_text.strip
      }
    end
  rescue JSON::ParserError => e
    Rails.logger.error("Failed to parse identification response: #{e.message}")
    {
      success: false,
      error: 'Failed to parse AI response',
      raw_response: response_text&.strip
    }
  end

  def fallback_identification
    {
      success: false,
      error: 'Gemini API key not configured',
      primary_suggestion: {
        species: 'unknown',
        common_name: 'Unknown Plant',
        common_name_fr: 'Plante inconnue',
        confidence: 'low',
        confidence_percentage: 0,
        reasoning: 'API key required for plant identification'
      },
      alternative_suggestions: [],
      category: 'unknown',
      characteristics_observed: [],
      health_assessment: { status: 'unknown', observations: nil },
      care_tips: 'Configure your Gemini API key to enable AI plant identification.',
      identification_notes: 'Visit https://aistudio.google.com/apikey to get a free API key.'
    }
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

  # Calculate real distance in meters from camera to plant
  def calculate_distance_meters(plant, camera_position)
    return 30.0 unless camera_position # Default 30m if no camera position

    # Get camera position in lat/lng
    cam_x = (camera_position[:x] || camera_position['x'] || 50).to_f
    cam_y = (camera_position[:y] || camera_position['y'] || 50).to_f
    cam_lng = PROPERTY_BOUNDS[:west] + (cam_x / 100.0) * (PROPERTY_BOUNDS[:east] - PROPERTY_BOUNDS[:west])
    cam_lat = PROPERTY_BOUNDS[:north] - (cam_y / 100.0) * (PROPERTY_BOUNDS[:north] - PROPERTY_BOUNDS[:south])

    # Get plant lat/lng
    lat = plant[:latitude] || plant['latitude'] || plant.dig(:location, :lat) || plant.dig('location', 'lat')
    lng = plant[:longitude] || plant['longitude'] || plant.dig(:location, :lng) || plant.dig('location', 'lng')
    return 30.0 unless lat && lng

    # Calculate distance in meters
    delta_lat = (lat.to_f - cam_lat).abs
    delta_lng = (lng.to_f - cam_lng).abs

    distance_lat_m = delta_lat * METERS_PER_DEG_LAT
    distance_lng_m = delta_lng * METERS_PER_DEG_LNG

    distance_m = Math.sqrt(distance_lat_m**2 + distance_lng_m**2)

    Rails.logger.debug("Distance calc: camera(#{cam_lat.round(6)}, #{cam_lng.round(6)}) to plant(#{lat}, #{lng}) = #{distance_m.round(1)}m")

    distance_m
  end

  # Calculate where a plant appears in the camera frame
  # Returns a detailed position description including:
  # - Horizontal position (left/center/right based on angle from camera direction)
  # - Depth position (foreground/middle/background based on distance)
  # - Percentage from left edge of frame for precise positioning
  def calculate_position_in_frame(plant, camera_position, camera_direction)
    return { description: "in the middle of the grass area", horizontal_pct: 50, depth: "middle" } unless camera_position && camera_direction

    # Get camera position in lat/lng
    cam_x_norm = (camera_position[:x] || camera_position['x'] || 50).to_f
    cam_y_norm = (camera_position[:y] || camera_position['y'] || 50).to_f
    cam_lng = PROPERTY_BOUNDS[:west] + (cam_x_norm / 100.0) * (PROPERTY_BOUNDS[:east] - PROPERTY_BOUNDS[:west])
    cam_lat = PROPERTY_BOUNDS[:north] - (cam_y_norm / 100.0) * (PROPERTY_BOUNDS[:north] - PROPERTY_BOUNDS[:south])
    cam_dir = camera_direction.to_f

    # Get plant lat/lng
    lat = plant[:latitude] || plant['latitude'] || plant.dig(:location, :lat) || plant.dig('location', 'lat')
    lng = plant[:longitude] || plant['longitude'] || plant.dig(:location, :lng) || plant.dig('location', 'lng')

    unless lat && lng
      return { description: "in the grass area", horizontal_pct: 50, depth: "middle" }
    end

    lat = lat.to_f
    lng = lng.to_f

    # Calculate distance in meters
    delta_lat = lat - cam_lat
    delta_lng = lng - cam_lng
    distance_lat_m = delta_lat * METERS_PER_DEG_LAT
    distance_lng_m = delta_lng * METERS_PER_DEG_LNG
    distance_m = Math.sqrt(distance_lat_m**2 + distance_lng_m**2)

    # Calculate angle from camera to plant
    # Using atan2 with the convention: 0° = North, 90° = East, 180° = South, 270° = West
    angle_to_plant = Math.atan2(delta_lng * METERS_PER_DEG_LNG, delta_lat * METERS_PER_DEG_LAT) * (180.0 / Math::PI)
    angle_to_plant += 360 if angle_to_plant < 0

    # Relative angle from camera direction (negative = left, positive = right)
    relative_angle = angle_to_plant - cam_dir
    relative_angle -= 360 if relative_angle > 180
    relative_angle += 360 if relative_angle < -180

    # Convert relative angle to horizontal percentage in frame
    # FOV is 60°, so -30° = 0% (left edge), 0° = 50% (center), +30° = 100% (right edge)
    fov_half = 30.0
    horizontal_pct = ((relative_angle + fov_half) / (fov_half * 2) * 100).clamp(0, 100).round(0)

    # Determine depth description based on distance
    depth = if distance_m <= 15
      "foreground"
    elsif distance_m <= 35
      "middle-ground"
    else
      "background"
    end

    # Determine horizontal description
    horizontal_desc = case horizontal_pct
    when 0..15 then "far left"
    when 16..35 then "left"
    when 36..45 then "center-left"
    when 46..55 then "center"
    when 56..65 then "center-right"
    when 66..85 then "right"
    when 86..100 then "far right"
    else "center"
    end

    # Build combined description
    description = "#{horizontal_desc} of the frame, in the #{depth}"

    Rails.logger.info("Position calc: plant(#{lat.round(6)}, #{lng.round(6)}) distance=#{distance_m.round(1)}m angle=#{angle_to_plant.round(1)}° relative=#{relative_angle.round(1)}° → #{horizontal_pct}% from left, #{depth}")

    {
      description: description,
      horizontal_pct: horizontal_pct,
      depth: depth,
      distance_m: distance_m.round(1),
      relative_angle: relative_angle.round(1)
    }
  end

  # Calculate distance from camera to plant (in normalized coordinates)
  def calculate_distance(plant, camera_position)
    return 50 unless camera_position

    cam_x = (camera_position[:x] || camera_position['x'] || 50).to_f
    cam_y = (camera_position[:y] || camera_position['y'] || 50).to_f

    plant_x = plant[:x] || plant['x']
    plant_y = plant[:y] || plant['y']

    unless plant_x && plant_y
      # Check both direct lat/lng keys and nested location object
      lat = plant[:latitude] || plant['latitude'] || plant.dig(:location, :lat) || plant.dig('location', 'lat')
      lng = plant[:longitude] || plant['longitude'] || plant.dig(:location, :lng) || plant.dig('location', 'lng')
      if lat && lng
        # Convert lat/lng to normalized 0-100 coordinates using property bounds
        plant_x = ((lng.to_f - PROPERTY_BOUNDS[:west]) / (PROPERTY_BOUNDS[:east] - PROPERTY_BOUNDS[:west])) * 100
        plant_y = ((PROPERTY_BOUNDS[:north] - lat.to_f) / (PROPERTY_BOUNDS[:north] - PROPERTY_BOUNDS[:south])) * 100
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
