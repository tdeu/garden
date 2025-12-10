import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Plant, Zone, Structure } from '@/stores/garden-store';
import { getGrowthModel, calculateGrowth, getGrowthStage } from './growth-calculator';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

export interface GardenPredictionRequest {
  plants: Plant[];
  zones: Zone[];
  structures: Structure[];
  targetYears: number;
  season?: 'spring' | 'summer' | 'fall' | 'winter';
  propertyLocation?: { lat: number; lng: number };
}

export interface PlantPrediction {
  plantId: string;
  plantName: string;
  predictedHeightCm: number;
  predictedCanopyCm: number;
  predictedCarbonKg: number;
  growthStage: string;
  visualDescription: string;
}

export interface GardenPredictionResponse {
  description: string;
  plantPredictions: PlantPrediction[];
  atmosphereNotes: string;
  totalCarbonKg: number;
}

/**
 * Generate a prediction prompt for Gemini
 */
function buildPredictionPrompt(request: GardenPredictionRequest): string {
  const { plants, zones, structures, targetYears, season = 'summer' } = request;
  const targetYear = new Date().getFullYear() + targetYears;

  // Build plant descriptions
  const plantDescriptions = plants.map((plant) => {
    const model = getGrowthModel(plant.species);
    const prediction = calculateGrowth(plant, targetYears);
    const stage = getGrowthStage(plant, targetYears);

    return `- ${plant.common_name} (${plant.species.replace(/_/g, ' ')}):
      Currently ${getGrowthStage(plant)}, will be ${stage} in ${targetYears} years.
      ${prediction ? `Predicted height: ${(prediction.predicted_height_cm / 100).toFixed(1)}m, Canopy: ${(prediction.predicted_canopy_diameter_cm / 100).toFixed(1)}m diameter` : ''}
      ${model ? `Mature size: ${(model.mature_height_cm / 100).toFixed(1)}m, Growth rate: ${model.yearly_height_growth_cm}cm/year` : ''}`;
  }).join('\n');

  // Build zone descriptions
  const zoneDescriptions = zones.map((zone) =>
    `- ${zone.name}: ${zone.type.replace(/_/g, ' ')}`
  ).join('\n');

  // Build structure descriptions
  const structureDescriptions = structures.map((structure) =>
    `- ${structure.name || structure.type}: ${structure.type.replace(/_/g, ' ')}`
  ).join('\n');

  return `You are an expert garden designer and horticulturist analyzing a garden in Wallonia, Belgium.

Based on the following garden plan, provide a vivid and detailed description of how this garden will look in ${targetYears} years (by ${targetYear}), during ${season}.

## Current Garden State

### Plants (${plants.length} total):
${plantDescriptions || 'No plants yet'}

### Garden Zones (${zones.length} total):
${zoneDescriptions || 'No zones defined'}

### Structures (${structures.length} total):
${structureDescriptions || 'No structures'}

## Your Task

Please provide a response in the following JSON format:
{
  "description": "A 2-3 paragraph vivid description of how the garden will look and feel in ${targetYears} years during ${season}. Include sensory details - colors, sounds, smells, and the overall atmosphere.",
  "plantPredictions": [
    {
      "plantId": "the plant's id",
      "visualDescription": "A short (1-2 sentence) description of how this specific plant will look"
    }
  ],
  "atmosphereNotes": "A short paragraph about the overall mood, wildlife activity, and experience of being in this garden"
}

Focus on creating an evocative, inspiring vision of the garden's future while staying grounded in the botanical reality of the plants' growth patterns.`;
}

/**
 * Generate a garden prediction using Gemini AI
 */
export async function generateGardenPrediction(
  request: GardenPredictionRequest
): Promise<GardenPredictionResponse> {
  const { plants, targetYears } = request;

  // Calculate growth predictions using our growth models
  const plantPredictions: PlantPrediction[] = plants.map((plant) => {
    const prediction = calculateGrowth(plant, targetYears);
    const stage = getGrowthStage(plant, targetYears);

    return {
      plantId: plant.id,
      plantName: plant.common_name,
      predictedHeightCm: prediction?.predicted_height_cm || 0,
      predictedCanopyCm: prediction?.predicted_canopy_diameter_cm || 0,
      predictedCarbonKg: prediction?.predicted_carbon_kg || 0,
      growthStage: stage,
      visualDescription: '', // Will be filled by Gemini
    };
  });

  // Calculate total carbon
  const totalCarbonKg = plantPredictions.reduce(
    (sum, p) => sum + p.predictedCarbonKg,
    0
  );

  // If no API key, return basic predictions without AI description
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    return {
      description: `In ${targetYears} years, your garden will have matured significantly. ${
        plants.length > 0
          ? `Your ${plants.length} plant${plants.length > 1 ? 's' : ''} will have grown and established themselves.`
          : 'Consider adding some plants to see future predictions!'
      }`,
      plantPredictions,
      atmosphereNotes: 'Configure your Google Gemini API key to get detailed AI-generated predictions.',
      totalCarbonKg,
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = buildPredictionPrompt(request);

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Merge AI descriptions with our predictions
      if (parsed.plantPredictions) {
        for (const aiPred of parsed.plantPredictions) {
          const ourPred = plantPredictions.find((p) => p.plantId === aiPred.plantId);
          if (ourPred && aiPred.visualDescription) {
            ourPred.visualDescription = aiPred.visualDescription;
          }
        }
      }

      return {
        description: parsed.description || 'Your garden will evolve beautifully over time.',
        plantPredictions,
        atmosphereNotes: parsed.atmosphereNotes || '',
        totalCarbonKg,
      };
    }

    // Fallback if JSON parsing fails
    return {
      description: text.slice(0, 500),
      plantPredictions,
      atmosphereNotes: '',
      totalCarbonKg,
    };
  } catch (error) {
    console.error('Gemini API error:', error);

    // Return basic predictions on error
    return {
      description: `Your garden will continue to grow and thrive over the next ${targetYears} years.`,
      plantPredictions,
      atmosphereNotes: 'AI description unavailable.',
      totalCarbonKg,
    };
  }
}
