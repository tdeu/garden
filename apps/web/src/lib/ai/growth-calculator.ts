/**
 * Growth Calculator - Calculate plant growth predictions
 * Uses data from plant-library.ts
 */

import type { Plant } from '@/stores/garden-store';
import { PLANT_LIBRARY, GrowthModel, PlantCategory } from '@/lib/plant-library';

// Growth rates in cm/year (approximate)
const GROWTH_RATES: Record<'slow' | 'medium' | 'fast', number> = {
  slow: 30,
  medium: 50,
  fast: 80,
};

export interface GrowthPrediction {
  predicted_height_cm: number;
  predicted_canopy_diameter_cm: number;
  predicted_carbon_kg: number;
  years_to_mature: number;
  maturity_percentage: number;
}

/**
 * Get the growth model for a specific plant species
 */
export function getGrowthModel(species: string): GrowthModel | null {
  // Search through all categories
  for (const category of Object.keys(PLANT_LIBRARY) as PlantCategory[]) {
    const plants = PLANT_LIBRARY[category];
    const found = plants.find(p => p.species === species);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Calculate the current age of a plant in years
 */
export function getPlantAge(plant: Plant): number {
  if (!plant.planted_date) return 0;

  const plantedDate = new Date(plant.planted_date);
  const now = new Date();
  const ageMs = now.getTime() - plantedDate.getTime();
  const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);

  return Math.max(0, ageYears);
}

/**
 * Calculate growth prediction for a plant after a number of years
 */
export function calculateGrowth(plant: Plant, targetYears: number): GrowthPrediction | null {
  const model = getGrowthModel(plant.species);
  if (!model) {
    return null;
  }

  const currentAge = getPlantAge(plant);
  const futureAge = currentAge + targetYears;

  // Calculate yearly growth rate
  const yearlyHeightGrowth = model.mature_height_cm / model.years_to_mature;
  const yearlyCanopyGrowth = model.mature_canopy_cm / model.years_to_mature;

  // Calculate predicted sizes (capped at mature size)
  const predicted_height_cm = Math.min(
    model.mature_height_cm,
    futureAge * yearlyHeightGrowth
  );

  const predicted_canopy_diameter_cm = Math.min(
    model.mature_canopy_cm,
    futureAge * yearlyCanopyGrowth
  );

  // Calculate carbon sequestered over time
  // Younger trees sequester less, mature trees sequester at full rate
  const carbonMultiplier = Math.min(1, futureAge / model.years_to_mature);
  const predicted_carbon_kg = model.carbon_per_year_kg * futureAge * carbonMultiplier;

  // Calculate maturity percentage
  const maturity_percentage = Math.min(100, (futureAge / model.years_to_mature) * 100);

  return {
    predicted_height_cm: Math.round(predicted_height_cm),
    predicted_canopy_diameter_cm: Math.round(predicted_canopy_diameter_cm),
    predicted_carbon_kg: Math.round(predicted_carbon_kg * 10) / 10,
    years_to_mature: Math.max(0, model.years_to_mature - Math.floor(futureAge)),
    maturity_percentage: Math.round(maturity_percentage),
  };
}

/**
 * Get the growth stage of a plant
 */
export function getGrowthStage(plant: Plant, targetYears: number = 0): string {
  const model = getGrowthModel(plant.species);
  if (!model) {
    return 'unknown';
  }

  const currentAge = getPlantAge(plant);
  const totalAge = currentAge + targetYears;
  const maturityRatio = totalAge / model.years_to_mature;

  if (maturityRatio < 0.1) {
    return 'seedling';
  } else if (maturityRatio < 0.25) {
    return 'young';
  } else if (maturityRatio < 0.5) {
    return 'establishing';
  } else if (maturityRatio < 0.75) {
    return 'maturing';
  } else if (maturityRatio < 1) {
    return 'nearly mature';
  } else {
    return 'mature';
  }
}

/**
 * Get default growth model for unknown species
 */
export function getDefaultGrowthModel(category: PlantCategory): Partial<GrowthModel> {
  const defaults: Record<PlantCategory, Partial<GrowthModel>> = {
    tree: { mature_height_cm: 1500, mature_canopy_cm: 1000, growth_rate: 'medium', years_to_mature: 30, carbon_per_year_kg: 15 },
    fruit_tree: { mature_height_cm: 500, mature_canopy_cm: 400, growth_rate: 'medium', years_to_mature: 15, carbon_per_year_kg: 8 },
    shrub: { mature_height_cm: 200, mature_canopy_cm: 150, growth_rate: 'medium', years_to_mature: 5, carbon_per_year_kg: 2 },
    perennial: { mature_height_cm: 80, mature_canopy_cm: 60, growth_rate: 'fast', years_to_mature: 3, carbon_per_year_kg: 0.5 },
    hedge: { mature_height_cm: 250, mature_canopy_cm: 100, growth_rate: 'medium', years_to_mature: 8, carbon_per_year_kg: 3 },
    annual: { mature_height_cm: 60, mature_canopy_cm: 40, growth_rate: 'fast', years_to_mature: 1, carbon_per_year_kg: 0.1 },
    vegetable: { mature_height_cm: 80, mature_canopy_cm: 50, growth_rate: 'fast', years_to_mature: 1, carbon_per_year_kg: 0.1 },
    herb: { mature_height_cm: 50, mature_canopy_cm: 40, growth_rate: 'fast', years_to_mature: 2, carbon_per_year_kg: 0.2 },
    berry: { mature_height_cm: 150, mature_canopy_cm: 100, growth_rate: 'medium', years_to_mature: 4, carbon_per_year_kg: 1 },
    wall_plant: { mature_height_cm: 30, mature_canopy_cm: 50, growth_rate: 'medium', years_to_mature: 3, carbon_per_year_kg: 0.3 },
    bulb: { mature_height_cm: 40, mature_canopy_cm: 20, growth_rate: 'fast', years_to_mature: 2, carbon_per_year_kg: 0.1 },
  };

  return defaults[category] || defaults.perennial;
}
