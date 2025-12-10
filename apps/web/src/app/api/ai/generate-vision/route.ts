import { NextRequest, NextResponse } from 'next/server';
import {
  generateFutureVision,
  buildVisionPrompt,
  type FutureVisionRequest,
} from '@/lib/ai/future-vision-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as FutureVisionRequest;

    // Validate request
    if (!body.targetYears || body.targetYears < 1 || body.targetYears > 50) {
      return NextResponse.json(
        { error: 'targetYears must be between 1 and 50' },
        { status: 400 }
      );
    }

    if (!body.season) {
      body.season = 'summer';
    }

    if (!body.plants) {
      body.plants = [];
    }

    if (!body.zones) {
      body.zones = [];
    }

    // Generate the future vision
    const vision = await generateFutureVision(body);

    return NextResponse.json(vision);
  } catch (error) {
    console.error('Vision generation API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate vision' },
      { status: 500 }
    );
  }
}

// GET endpoint to generate a quick preview with query params
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const years = parseInt(searchParams.get('years') || '5');
  const season = (searchParams.get('season') || 'summer') as FutureVisionRequest['season'];

  // Simple prompt for preview
  const simpleRequest: FutureVisionRequest = {
    plants: [],
    zones: [],
    targetYears: years,
    season,
  };

  const prompt = buildVisionPrompt(simpleRequest);

  // Return just the Pollinations URL for quick preview
  const encodedPrompt = encodeURIComponent(prompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=768&model=flux`;

  return NextResponse.json({
    imageUrl,
    prompt,
    provider: 'pollinations',
  });
}
