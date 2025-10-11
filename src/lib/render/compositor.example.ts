/**
 * Image Compositor Usage Examples
 * 
 * This file demonstrates how to use the ImageCompositor class
 * to composite text layers over AI-generated backgrounds.
 */

import { ImageCompositor, compositeImages } from './compositor';
import type { CompositeOptions } from './compositor';
import sharp from 'sharp';
import fs from 'fs/promises';

/**
 * Example 1: Basic compositing with normal blend mode
 * 
 * This is the most common use case - layering crisp text
 * over an AI-generated background.
 */
async function example1_basicComposite() {
  // Load your background image (from AI generation)
  const backgroundBuffer = await fs.readFile('path/to/background.png');
  
  // Load your text layer (rendered HTML/CSS as PNG)
  const textLayerBuffer = await fs.readFile('path/to/text-layer.png');

  // Composite them together
  const compositor = new ImageCompositor();
  const result = await compositor.composite({
    textLayer: textLayerBuffer,
    backgroundLayer: backgroundBuffer,
    blend: 'normal',
  });

  // Save the result
  await fs.writeFile('path/to/output.png', result);
}

/**
 * Example 2: Using the convenience function
 * 
 * For simple one-off compositing, use the compositeImages function.
 */
async function example2_convenienceFunction() {
  const backgroundBuffer = await fs.readFile('path/to/background.png');
  const textLayerBuffer = await fs.readFile('path/to/text-layer.png');

  const result = await compositeImages({
    textLayer: textLayerBuffer,
    backgroundLayer: backgroundBuffer,
    blend: 'normal',
  });

  await fs.writeFile('path/to/output.png', result);
}

/**
 * Example 3: Using multiply blend mode
 * 
 * Multiply blend mode darkens the background where text appears,
 * useful for creating subtle text effects.
 */
async function example3_multiplyBlend() {
  const backgroundBuffer = await fs.readFile('path/to/background.png');
  const textLayerBuffer = await fs.readFile('path/to/text-layer.png');

  const compositor = new ImageCompositor();
  const result = await compositor.composite({
    textLayer: textLayerBuffer,
    backgroundLayer: backgroundBuffer,
    blend: 'multiply',
  });

  await fs.writeFile('path/to/output-multiply.png', result);
}

/**
 * Example 4: Using overlay blend mode
 * 
 * Overlay blend mode creates a more dramatic effect,
 * preserving highlights and shadows.
 */
async function example4_overlayBlend() {
  const backgroundBuffer = await fs.readFile('path/to/background.png');
  const textLayerBuffer = await fs.readFile('path/to/text-layer.png');

  const compositor = new ImageCompositor();
  const result = await compositor.composite({
    textLayer: textLayerBuffer,
    backgroundLayer: backgroundBuffer,
    blend: 'overlay',
  });

  await fs.writeFile('path/to/output-overlay.png', result);
}

/**
 * Example 5: Getting metadata with the result
 * 
 * Use compositeWithMetadata to get information about the output.
 */
async function example5_withMetadata() {
  const backgroundBuffer = await fs.readFile('path/to/background.png');
  const textLayerBuffer = await fs.readFile('path/to/text-layer.png');

  const compositor = new ImageCompositor();
  const result = await compositor.compositeWithMetadata({
    textLayer: textLayerBuffer,
    backgroundLayer: backgroundBuffer,
    blend: 'normal',
  });

  console.log('Output dimensions:', result.metadata.width, 'x', result.metadata.height);
  console.log('Output format:', result.metadata.format);

  await fs.writeFile('path/to/output.png', result.buffer);
}

/**
 * Example 6: Complete menu export workflow
 * 
 * This shows how the compositor fits into the full menu export pipeline.
 */
async function example6_completeWorkflow() {
  // Step 1: Generate AI background (using nano-banana)
  // const backgroundUrl = await generateBackground({ templateId, brandColors });
  // const backgroundBuffer = await fetch(backgroundUrl).then(r => r.arrayBuffer());

  // Step 2: Render menu HTML to PNG (using MenuExporter)
  // const textLayerBuffer = await renderMenuToPNG(menuData, template);

  // Step 3: Composite them together
  const compositor = new ImageCompositor();
  
  // For this example, we'll use placeholder buffers
  const backgroundBuffer = Buffer.from(''); // Replace with actual buffer
  const textLayerBuffer = Buffer.from(''); // Replace with actual buffer

  const finalMenu = await compositor.composite({
    textLayer: textLayerBuffer,
    backgroundLayer: backgroundBuffer,
    blend: 'normal', // Use 'normal' for crisp text
  });

  // Step 4: Save or return the final menu
  await fs.writeFile('path/to/final-menu.png', finalMenu);
  
  // Or convert to PDF if needed
  // const pdfBuffer = await convertToPDF(finalMenu);
}

/**
 * Example 7: Handling mismatched dimensions
 * 
 * The compositor automatically handles dimension mismatches
 * by resizing the text layer to match the background.
 */
async function example7_mismatchedDimensions() {
  // Background is 2480x3508 (A4 at 300 DPI)
  const backgroundBuffer = await sharp({
    create: {
      width: 2480,
      height: 3508,
      channels: 4,
      background: { r: 255, g: 200, b: 150, alpha: 1 },
    },
  }).png().toBuffer();

  // Text layer is smaller (will be resized)
  const textLayerBuffer = await sharp({
    create: {
      width: 1240,
      height: 1754,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).png().toBuffer();

  const compositor = new ImageCompositor();
  const result = await compositor.composite({
    textLayer: textLayerBuffer,
    backgroundLayer: backgroundBuffer,
    blend: 'normal',
  });

  // Result will be 2480x3508 (matching background)
  const metadata = await sharp(result).metadata();
  console.log('Output size:', metadata.width, 'x', metadata.height);
}

/**
 * Example 8: Error handling
 * 
 * Always wrap compositor calls in try-catch for production use.
 */
async function example8_errorHandling() {
  try {
    const backgroundBuffer = await fs.readFile('path/to/background.png');
    const textLayerBuffer = await fs.readFile('path/to/text-layer.png');

    const compositor = new ImageCompositor();
    const result = await compositor.composite({
      textLayer: textLayerBuffer,
      backgroundLayer: backgroundBuffer,
      blend: 'normal',
    });

    await fs.writeFile('path/to/output.png', result);
    console.log('Compositing successful!');
  } catch (error) {
    console.error('Compositing failed:', error);
    
    // Fall back to text-only export
    // const textOnlyPDF = await exportTextOnly(menuData, template);
  }
}

// Export examples for documentation
export {
  example1_basicComposite,
  example2_convenienceFunction,
  example3_multiplyBlend,
  example4_overlayBlend,
  example5_withMetadata,
  example6_completeWorkflow,
  example7_mismatchedDimensions,
  example8_errorHandling,
};
