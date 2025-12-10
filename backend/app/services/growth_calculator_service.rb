# app/services/growth_calculator_service.rb
# Service for calculating plant growth predictions

class GrowthCalculatorService
  # Growth models for common plants (simplified version)
  # In production, this should come from a database or external source
  GROWTH_MODELS = {
    # Trees
    'quercus_robur' => { mature_height_cm: 3000, yearly_height_growth_cm: 40, canopy_spread_rate_cm: 30, carbon_per_year_kg: 22, maturity_years: 50 },
    'fagus_sylvatica' => { mature_height_cm: 2500, yearly_height_growth_cm: 35, canopy_spread_rate_cm: 25, carbon_per_year_kg: 18, maturity_years: 40 },
    'acer_campestre' => { mature_height_cm: 1500, yearly_height_growth_cm: 30, canopy_spread_rate_cm: 25, carbon_per_year_kg: 12, maturity_years: 30 },
    'betula_pendula' => { mature_height_cm: 2000, yearly_height_growth_cm: 50, canopy_spread_rate_cm: 30, carbon_per_year_kg: 10, maturity_years: 25 },
    'prunus_avium' => { mature_height_cm: 1500, yearly_height_growth_cm: 35, canopy_spread_rate_cm: 25, carbon_per_year_kg: 8, maturity_years: 20 },
    'tilia_cordata' => { mature_height_cm: 2500, yearly_height_growth_cm: 30, canopy_spread_rate_cm: 25, carbon_per_year_kg: 15, maturity_years: 40 },

    # Fruit trees
    'malus_domestica' => { mature_height_cm: 400, yearly_height_growth_cm: 30, canopy_spread_rate_cm: 30, carbon_per_year_kg: 5, maturity_years: 8 },
    'pyrus_communis' => { mature_height_cm: 500, yearly_height_growth_cm: 35, canopy_spread_rate_cm: 25, carbon_per_year_kg: 6, maturity_years: 10 },
    'prunus_cerasus' => { mature_height_cm: 400, yearly_height_growth_cm: 40, canopy_spread_rate_cm: 30, carbon_per_year_kg: 4, maturity_years: 7 },
    'prunus_domestica' => { mature_height_cm: 400, yearly_height_growth_cm: 30, canopy_spread_rate_cm: 25, carbon_per_year_kg: 4, maturity_years: 8 },

    # Shrubs
    'corylus_avellana' => { mature_height_cm: 500, yearly_height_growth_cm: 40, canopy_spread_rate_cm: 35, carbon_per_year_kg: 3, maturity_years: 10 },
    'sambucus_nigra' => { mature_height_cm: 400, yearly_height_growth_cm: 50, canopy_spread_rate_cm: 40, carbon_per_year_kg: 2, maturity_years: 5 },
    'viburnum_opulus' => { mature_height_cm: 300, yearly_height_growth_cm: 30, canopy_spread_rate_cm: 30, carbon_per_year_kg: 1.5, maturity_years: 8 },
    'rosa_canina' => { mature_height_cm: 300, yearly_height_growth_cm: 40, canopy_spread_rate_cm: 30, carbon_per_year_kg: 1, maturity_years: 5 },
    'crataegus_monogyna' => { mature_height_cm: 600, yearly_height_growth_cm: 25, canopy_spread_rate_cm: 25, carbon_per_year_kg: 3, maturity_years: 15 },

    # Hedge plants
    'carpinus_betulus' => { mature_height_cm: 200, yearly_height_growth_cm: 30, canopy_spread_rate_cm: 20, carbon_per_year_kg: 2, maturity_years: 10 },
    'ligustrum_vulgare' => { mature_height_cm: 250, yearly_height_growth_cm: 35, canopy_spread_rate_cm: 25, carbon_per_year_kg: 1.5, maturity_years: 8 },
    'buxus_sempervirens' => { mature_height_cm: 150, yearly_height_growth_cm: 10, canopy_spread_rate_cm: 10, carbon_per_year_kg: 0.5, maturity_years: 20 },

    # Perennials (smaller, faster growth)
    'lavandula_angustifolia' => { mature_height_cm: 60, yearly_height_growth_cm: 20, canopy_spread_rate_cm: 25, carbon_per_year_kg: 0.2, maturity_years: 3 },
    'salvia_officinalis' => { mature_height_cm: 60, yearly_height_growth_cm: 25, canopy_spread_rate_cm: 30, carbon_per_year_kg: 0.15, maturity_years: 3 },
    'rosmarinus_officinalis' => { mature_height_cm: 120, yearly_height_growth_cm: 30, canopy_spread_rate_cm: 30, carbon_per_year_kg: 0.3, maturity_years: 5 }
  }.freeze

  # Default model for unknown species
  DEFAULT_MODEL = {
    mature_height_cm: 300,
    yearly_height_growth_cm: 30,
    canopy_spread_rate_cm: 25,
    carbon_per_year_kg: 2,
    maturity_years: 10
  }.freeze

  class << self
    def calculate_growth(plant, years_ahead)
      model = get_growth_model(plant['species'])
      planted_date = parse_date(plant['planted_date'])
      current_age = calculate_age(planted_date)
      projected_age = current_age + years_ahead

      # Calculate predicted height (capped at mature height)
      predicted_height = [
        model[:yearly_height_growth_cm] * projected_age,
        model[:mature_height_cm]
      ].min

      # Calculate predicted canopy diameter
      predicted_canopy = [
        model[:canopy_spread_rate_cm] * projected_age,
        model[:mature_height_cm] * 0.8 # Assume canopy is about 80% of height
      ].min

      # Calculate predicted carbon sequestration (cumulative)
      predicted_carbon = model[:carbon_per_year_kg] * projected_age

      {
        year: Time.current.year + years_ahead,
        predicted_height_cm: predicted_height.round,
        predicted_canopy_cm: predicted_canopy.round,
        predicted_carbon_kg: predicted_carbon.round(1),
        growth_stage: get_growth_stage(projected_age, model[:maturity_years])
      }
    end

    def calculate_garden_growth(plants, years_ahead)
      plants.map do |plant|
        {
          plant: plant,
          prediction: calculate_growth(plant, years_ahead)
        }
      end
    end

    def calculate_total_carbon(plants, years_ahead)
      plants.sum do |plant|
        prediction = calculate_growth(plant, years_ahead)
        prediction[:predicted_carbon_kg]
      end.round(1)
    end

    def get_growth_model(species)
      GROWTH_MODELS[species.to_s.downcase] || DEFAULT_MODEL
    end

    def get_growth_stage(age_years, maturity_years)
      maturity_progress = age_years.to_f / maturity_years

      case maturity_progress
      when 0...0.1 then 'Seedling'
      when 0.1...0.3 then 'Young'
      when 0.3...0.6 then 'Established'
      when 0.6...1.0 then 'Maturing'
      else 'Mature'
      end
    end

    private

    def parse_date(date_string)
      return Time.current if date_string.blank?

      Date.parse(date_string.to_s)
    rescue ArgumentError
      Time.current
    end

    def calculate_age(planted_date)
      return 0 if planted_date.nil?

      days_since_planted = (Time.current.to_date - planted_date.to_date).to_i
      [days_since_planted / 365.25, 0].max
    end
  end
end
