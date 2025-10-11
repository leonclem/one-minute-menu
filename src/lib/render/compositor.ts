/**
 * Image Compositor
 * 
 * Composites text layers over AI-generated backgrounds using Sharp.
 * Supports multiple blend modes while maintaining text crispness.
 */

import sharp, { Sharp, OverlayOptions } from 'sharp';

/**
 * Options for compositing layers
 */
export interface CompositeOptions {
  /** Text layer as a buffer (PNG with transparency) */
  textLayer: Buffer;
  /** Background layer as a buffer */
  backgroundLayer: Buffer;
  /** Blend mode for compositing */
  blend: 'normal' | 'multiply' | 'overlay';
}

/**
 * Result of a composite operation
 */
export interface CompositeResult {
  /** Composited image buffer */
  buffer: Buffer;
  /** Metadata about the composited image */
  metadata: {
    width: number;
    height: number;
    format: string;
  };
}

/**
 * ImageCompositor class for layering text over backgrounds
 */
export class ImageCompositor {
  /**
   * Composite text layer over background layer
   * 
   * @param options - Composite options including layers and blend mode
   * @returns Composited image buffer
   */
  async composite(options: CompositeOptions): Promise<Buffer> {
    const { textLayer, backgroundLayer, blend } = options;

    // Load both images
    const background = await this.loadImage(backgroundLayer);
    const text = await this.loadImage(textLayer);

    // Get dimensions to ensure they match
    const bgMeta = await background.metadata();
    const textMeta = await text.metadata();

    if (!bgMeta.width || !bgMeta.height || !textMeta.width || !textMeta.height) {
      throw new Error('Unable to read image dimensions');
    }

    // Resize text layer if dimensions don't match
    let processedText = text;
    if (bgMeta.width !== textMeta.width || bgMeta.height !== textMeta.height) {
      processedText = text.resize(bgMeta.width, bgMeta.height, {
        fit: 'fill',
        kernel: 'lanczos3', // High-quality resampling for text
      });
    }

    // Perform the blend
    const composited = await this.blendLayers(
      background,
      processedText,
      blend
    );

    // Return as PNG buffer to preserve quality
    return composited.png({ quality: 100 }).toBuffer();
  }

  /**
   * Load an image buffer into a Sharp instance
   * 
   * @param buffer - Image buffer to load
   * @returns Sharp instance
   */
  private async loadImage(buffer: Buffer): Promise<Sharp> {
    try {
      const image = sharp(buffer);
      
      // Validate the image by reading metadata
      await image.metadata();
      
      return image;
    } catch (error) {
      throw new Error(
        `Failed to load image: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Blend foreground layer over background using specified mode
   * 
   * @param background - Background Sharp instance
   * @param foreground - Foreground Sharp instance (text layer)
   * @param mode - Blend mode to apply
   * @returns Composited Sharp instance
   */
  private async blendLayers(
    background: Sharp,
    foreground: Sharp,
    mode: 'normal' | 'multiply' | 'overlay'
  ): Promise<Sharp> {
    // Convert foreground to buffer for overlay
    const foregroundBuffer = await foreground.toBuffer();

    // Map our blend modes to Sharp's blend modes
    const blendModeMap: Record<string, OverlayOptions['blend']> = {
      normal: 'over',
      multiply: 'multiply',
      overlay: 'overlay',
    };

    const sharpBlendMode = blendModeMap[mode];

    // Composite the layers
    return background.composite([
      {
        input: foregroundBuffer,
        blend: sharpBlendMode,
      },
    ]);
  }

  /**
   * Composite with result metadata
   * 
   * @param options - Composite options
   * @returns Composite result with buffer and metadata
   */
  async compositeWithMetadata(options: CompositeOptions): Promise<CompositeResult> {
    const buffer = await this.composite(options);
    
    // Get metadata from the result
    const image = sharp(buffer);
    const metadata = await image.metadata();

    return {
      buffer,
      metadata: {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
      },
    };
  }
}

/**
 * Convenience function to create and use a compositor
 * 
 * @param options - Composite options
 * @returns Composited image buffer
 */
export async function compositeImages(options: CompositeOptions): Promise<Buffer> {
  const compositor = new ImageCompositor();
  return compositor.composite(options);
}
