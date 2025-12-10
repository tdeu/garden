import { NextRequest, NextResponse } from 'next/server';
import { generateGardenPrediction, GardenPredictionRequest } from '@/lib/ai/gemini-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GardenPredictionRequest;

    // Validate request
    if (!body.targetYears || body.targetYears < 1 || body.targetYears > 50) {
      return NextResponse.json(
        { error: 'targetYears must be between 1 and 50' },
        { status: 400 }
      );
    }

    if (!body.plants) {
      return NextResponse.json(
        { error: 'plants array is required' },
        { status: 400 }
      );
    }

    // Generate prediction
    const prediction = await generateGardenPrediction(body);

    return NextResponse.json(prediction);
  } catch (error) {
    console.error('Prediction API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    );
  }
}
