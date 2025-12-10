# app/services/gemini_service.rb
# Service for interacting with Google Gemini AI API

class GeminiService
  API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'.freeze
  TEXT_MODEL = 'gemini-1.5-flash'
  VISION_MODEL = 'gemini-1.5-flash'  # Can analyze images

  class GeminiError < StandardError; end

  def initialize
    @api_key = ENV.fetch('GOOGLE_GEMINI_API_KEY', nil) || ENV.fetch('GEMINI_API_KEY', nil)
  end

  # Generate content from text prompt
  def generate_content(prompt, model: TEXT_MODEL)
    return fallback_response(prompt) if @api_key.blank?

    url = "#{API_URL}/#{model}:generateContent?key=#{@api_key}"

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
      extract_text_from_response(response.parsed_response)
    else
      Rails.logger.error("Gemini API error: #{response.code} - #{response.body}")
      raise GeminiError, "Gemini API error: #{response.code}"
    end
  rescue HTTParty::Error, Net::TimeoutError => e
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

    url = "#{API_URL}/#{VISION_MODEL}:generateContent?key=#{@api_key}"

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
      extract_text_from_response(response.parsed_response)
    else
      Rails.logger.error("Gemini Vision API error: #{response.code} - #{response.body}")
      raise GeminiError, "Gemini Vision API error: #{response.code}"
    end
  rescue HTTParty::Error, Net::TimeoutError => e
    Rails.logger.error("Gemini connection error: #{e.message}")
    raise GeminiError, "Connection error: #{e.message}"
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

    # Build the prompt
    prompt = build_viewpoint_prompt(
      photo_name: viewpoint_photo.name,
      photo_description: viewpoint_photo.description,
      plants: plants_with_growth,
      target_years: target_years,
      target_year: target_year,
      season: season
    )

    # If photo is attached, use vision API
    response_text = if viewpoint_photo.photo.attached?
      image_url = viewpoint_photo.photo_url
      generate_with_image(prompt, image_url: image_url)
    else
      generate_content(prompt)
    end

    # Parse the response
    parse_viewpoint_response(response_text, plants_with_growth, prompt)
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
