import type { Plant, Zone } from '@/stores/garden-store';

export interface FutureVisionRequest {
  plants: Plant[];
  zones: Zone[];
  targetYears: number;
  season: 'spring' | 'summer' | 'fall' | 'winter';
  baseImagePath?: string;
}

export interface FutureVisionResponse {
  imageUrl: string;
  prompt: string;
  provider: 'pollinations' | 'huggingface';
  cached: boolean;
}

// Season-specific visual descriptors
const SEASON_DESCRIPTORS: Record<string, string> = {
  spring: 'spring blooms, fresh green leaves, cherry blossoms, tulips, daffodils, soft morning light',
  summer: 'lush green foliage, full canopy, vibrant flowers, warm golden sunlight, mature growth',
  fall: 'autumn colors, orange and red leaves, golden light, some fallen leaves, harvest time',
  winter: 'bare branches, frost, evergreen trees, snow patches, dormant garden, cold blue light',
};

// Growth stage visual descriptors based on years
function getGrowthDescriptor(years: number): string {
  if (years <= 1) return 'newly planted, small saplings, fresh mulch, establishing roots';
  if (years <= 2) return 'young growth, small trees starting to fill in, developing garden';
  if (years <= 5) return 'established garden, medium-sized trees, filling canopy, maturing plants';
  if (years <= 10) return 'mature garden, large trees, full canopy coverage, well-established landscape';
  return 'fully mature landscape, large spreading trees, dense vegetation, old-growth feel';
}

// Build a detailed prompt from garden data
export function buildVisionPrompt(request: FutureVisionRequest): string {
  const { plants, zones, targetYears, season } = request;

  // Group plants by category
  const plantsByCategory: Record<string, string[]> = {};
  plants.forEach(plant => {
    const category = plant.category || 'other';
    if (!plantsByCategory[category]) plantsByCategory[category] = [];
    plantsByCategory[category].push(plant.common_name);
  });

  // Build plant descriptions
  const plantDescriptions: string[] = [];

  if (plantsByCategory.tree?.length) {
    const treeCount = plantsByCategory.tree.length;
    const treeNames = plantsByCategory.tree.slice(0, 3).join(', ');
    plantDescriptions.push(`${treeCount} mature trees (${treeNames})`);
  }

  if (plantsByCategory.shrub?.length) {
    plantDescriptions.push(`${plantsByCategory.shrub.length} established shrubs`);
  }

  if (plantsByCategory.hedge?.length) {
    plantDescriptions.push('well-trimmed hedgerows');
  }

  if (plantsByCategory.perennial?.length) {
    plantDescriptions.push('flowering perennial beds');
  }

  if (plantsByCategory.annual?.length) {
    plantDescriptions.push('colorful annual flower beds');
  }

  // Build zone descriptions
  const zoneDescriptions: string[] = [];
  zones.forEach(zone => {
    switch (zone.type) {
      case 'flower_bed':
        zoneDescriptions.push('beautiful flower gardens');
        break;
      case 'vegetable_garden':
        zoneDescriptions.push('productive vegetable garden');
        break;
      case 'lawn':
        zoneDescriptions.push('manicured green lawn');
        break;
      case 'woodland':
        zoneDescriptions.push('natural woodland area');
        break;
      case 'water_feature':
        zoneDescriptions.push('garden pond with water plants');
        break;
    }
  });

  const growthDesc = getGrowthDescriptor(targetYears);
  const seasonDesc = SEASON_DESCRIPTORS[season] || SEASON_DESCRIPTORS.summer;
  const targetYear = new Date().getFullYear() + targetYears;

  // Combine into a cohesive prompt
  const prompt = [
    'Aerial satellite view of a Belgian countryside garden',
    `in ${targetYear}, ${targetYears} years of growth`,
    growthDesc,
    plantDescriptions.length > 0 ? plantDescriptions.join(', ') : 'mixed garden plantings',
    zoneDescriptions.length > 0 ? zoneDescriptions.join(', ') : '',
    seasonDesc,
    'photorealistic, high detail, drone photography style',
    'modern house with dark roof visible',
    'surrounded by agricultural fields',
    'natural Belgian Ardennes landscape',
  ].filter(Boolean).join(', ');

  return prompt;
}

// Generate image using Pollinations.ai (completely free, no API key)
export async function generateWithPollinations(prompt: string): Promise<string> {
  // Pollinations.ai provides free image generation
  // URL format: https://image.pollinations.ai/prompt/{encoded_prompt}
  const encodedPrompt = encodeURIComponent(prompt);

  // Add parameters for better quality
  const params = new URLSearchParams({
    width: '1024',
    height: '768',
    seed: Math.floor(Math.random() * 1000000).toString(),
    model: 'flux', // Using Flux model for better quality
  });

  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`;

  return imageUrl;
}

// Generate image using Hugging Face Inference API (free tier)
export async function generateWithHuggingFace(prompt: string): Promise<string | null> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) {
    console.log('Hugging Face API key not configured, skipping');
    return null;
  }

  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt: 'blurry, low quality, distorted, cartoon, anime, drawing, painting, watermark, text, logo',
            num_inference_steps: 30,
            guidance_scale: 7.5,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Hugging Face API error:', error);
      return null;
    }

    // Response is binary image data
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Hugging Face generation failed:', error);
    return null;
  }
}

// Main function to generate future vision
export async function generateFutureVision(
  request: FutureVisionRequest
): Promise<FutureVisionResponse> {
  const prompt = buildVisionPrompt(request);

  // Try Hugging Face first (better quality if available)
  if (process.env.HUGGINGFACE_API_KEY) {
    const hfImage = await generateWithHuggingFace(prompt);
    if (hfImage) {
      return {
        imageUrl: hfImage,
        prompt,
        provider: 'huggingface',
        cached: false,
      };
    }
  }

  // Fall back to Pollinations (always free, no API key needed)
  const pollinationsUrl = await generateWithPollinations(prompt);

  return {
    imageUrl: pollinationsUrl,
    prompt,
    provider: 'pollinations',
    cached: false,
  };
}
