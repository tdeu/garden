/**
 * Generate clean garden images using Replicate AI
 * Removes rocks/stones and replaces with grass
 *
 * Usage: node scripts/generate-clean-garden.mjs
 */

import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!REPLICATE_TOKEN) {
  console.error('Error: REPLICATE_API_TOKEN not found in .env.local');
  process.exit(1);
}

const replicate = new Replicate({
  auth: REPLICATE_TOKEN,
});

// Source images (current state with rocks)
const SOURCE_IMAGES = [
  'garden-.png',      // zoom 15
  'garden-c.png',     // zoom 16
  'garden-cl.png',    // zoom 17
  'garden-clo.png',   // zoom 18
  'garden-clos.png',  // zoom 19
  'garden-close.png', // zoom 20
];

// Output names (clean state)
const OUTPUT_PREFIX = 'garden-clean-';

async function processImage(imageName) {
  console.log(`\nProcessing: ${imageName}`);

  const publicDir = path.join(__dirname, '../public');
  const sourcePath = path.join(publicDir, imageName);

  if (!fs.existsSync(sourcePath)) {
    console.error(`  Error: File not found: ${sourcePath}`);
    return null;
  }

  // Read and convert to base64
  const imageBuffer = fs.readFileSync(sourcePath);
  const base64Image = imageBuffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64Image}`;

  console.log('  Sending to Replicate AI...');

  try {
    // Use SDXL img2img for editing
    const output = await replicate.run(
      "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
      {
        input: {
          image: dataUri,
          prompt: "Aerial satellite view of a rural property with a house, stone path leading to it, a single tree next to the house, surrounded by lush green grass lawn, forest/woodland in the background, photorealistic, high resolution satellite imagery",
          negative_prompt: "yellow rocks, stones, gravel, construction debris, sand, bare soil, brown patches, construction materials",
          strength: 0.6, // Moderate strength to keep structure but change surface
          guidance_scale: 7.5,
          num_inference_steps: 35,
          scheduler: "K_EULER",
        }
      }
    );

    const outputUrl = Array.isArray(output) ? output[0] : output;

    if (!outputUrl) {
      console.error('  Error: No output from model');
      return null;
    }

    console.log('  Downloading result...');

    // Download the result
    const response = await fetch(outputUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create output filename
    const outputName = OUTPUT_PREFIX + imageName.replace('garden-', '').replace('garden', '15.png');
    const outputPath = path.join(publicDir, outputName);

    fs.writeFileSync(outputPath, buffer);
    console.log(`  Saved: ${outputName}`);

    return outputName;

  } catch (error) {
    console.error(`  Error processing ${imageName}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('=================================');
  console.log('Garden Clean Slate Generator');
  console.log('=================================');
  console.log('This will process your garden images and replace rocks with grass.');
  console.log(`Processing ${SOURCE_IMAGES.length} images...\n`);

  const results = [];

  for (const imageName of SOURCE_IMAGES) {
    const result = await processImage(imageName);
    results.push({ source: imageName, output: result });

    // Small delay between API calls
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n=================================');
  console.log('Results:');
  console.log('=================================');

  for (const r of results) {
    console.log(`${r.source} -> ${r.output || 'FAILED'}`);
  }

  const successful = results.filter(r => r.output).length;
  console.log(`\nCompleted: ${successful}/${SOURCE_IMAGES.length} images`);

  if (successful > 0) {
    console.log('\nNext steps:');
    console.log('1. Check the generated images in apps/web/public/');
    console.log('2. Update GardenCanvas.tsx to use garden-clean-* images for Today mode');
  }
}

main().catch(console.error);
