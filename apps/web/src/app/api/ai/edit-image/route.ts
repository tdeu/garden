import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: NextRequest) {
  try {
    const { imagePath, prompt, outputName } = await request.json();

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN not configured' },
        { status: 500 }
      );
    }

    // Read the source image from public folder
    const publicDir = path.join(process.cwd(), 'public');
    const sourceImagePath = path.join(publicDir, imagePath);

    if (!fs.existsSync(sourceImagePath)) {
      return NextResponse.json(
        { error: `Image not found: ${imagePath}` },
        { status: 404 }
      );
    }

    // Read image and convert to base64 data URI
    const imageBuffer = fs.readFileSync(sourceImagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${base64Image}`;

    // Use SDXL Inpainting model to edit the image
    // This model can intelligently fill areas based on a prompt
    const output = await replicate.run(
      "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
      {
        input: {
          image: dataUri,
          prompt: prompt || "Lush green grass lawn, natural garden, satellite aerial view, photorealistic",
          negative_prompt: "rocks, stones, gravel, yellow stones, construction materials, debris",
          strength: 0.75, // How much to change (0.75 = significant change while keeping structure)
          guidance_scale: 7.5,
          num_inference_steps: 30,
          scheduler: "K_EULER",
        }
      }
    );

    // The output is typically an array of image URLs
    const outputUrl = Array.isArray(output) ? output[0] : output;

    if (!outputUrl) {
      return NextResponse.json(
        { error: 'No output from AI model' },
        { status: 500 }
      );
    }

    // Download the generated image
    const response = await fetch(outputUrl as string);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to public folder with the specified output name
    const outputPath = path.join(publicDir, outputName || 'garden-clean.png');
    fs.writeFileSync(outputPath, buffer);

    return NextResponse.json({
      success: true,
      message: 'Image edited successfully',
      outputPath: outputName || 'garden-clean.png',
      previewUrl: outputUrl,
    });

  } catch (error) {
    console.error('Image editing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check status and list available images
export async function GET() {
  const publicDir = path.join(process.cwd(), 'public');

  // List all garden images
  const files = fs.readdirSync(publicDir);
  const gardenImages = files.filter(f => f.startsWith('garden'));

  return NextResponse.json({
    configured: !!process.env.REPLICATE_API_TOKEN,
    availableImages: gardenImages,
  });
}
