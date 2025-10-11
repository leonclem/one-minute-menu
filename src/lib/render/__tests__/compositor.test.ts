/**
 * Unit tests for Image Compositor
 * 
 * Tests the image compositing functionality using Sharp.
 * These tests verify that text layers can be properly composited
 * over background images with different blend modes.
 * 
 * Requirements: 5.5, 3.1
 * 
 * @jest-environment node
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ImageCompositor, compositeImages } from '../compositor';
import type { CompositeOptions } from '../compositor';
import sharp from 'sharp';

describe('ImageCompositor', () => {
  let compositor: ImageCompositor;

  beforeEach(() => {
    compositor = new ImageCompositor();
  });

  /**
   * Helper function to create a test image buffer
   */
  async function createTestImage(
    width: number,
    height: number,
    color: { r: number; g: number; b: number; alpha?: number }
  ): Promise<Buffer> {
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: color,
      },
    })
      .png()
      .toBuffer();
  }

  /**
   * Helper function to create a text layer with transparency
   */
  async function createTextLayer(
    width: number,
    height: number
  ): Promise<Buffer> {
    // Create a transparent background with some opaque pixels (simulating text)
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: Math.floor(width / 2),
              height: Math.floor(height / 4),
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          top: Math.floor(height / 2),
          left: Math.floor(width / 4),
        },
      ])
      .png()
      .toBuffer();
  }

  describe('composite()', () => {
    it('should composite text layer over background with normal blend', async () => {
      const background = await createTestImage(800, 600, { r: 255, g: 200, b: 150 });
      const textLayer = await createTextLayer(800, 600);

      const options: CompositeOptions = {
        textLayer,
        backgroundLayer: background,
        blend: 'normal',
      };

      const result = await compositor.composite(options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      // Verify the result is a valid image
      const metadata = await sharp(result).metadata();
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(600);
      expect(metadata.format).toBe('png');
    });

    it('should composite with multiply blend mode', async () => {
      const background = await createTestImage(800, 600, { r: 255, g: 200, b: 150 });
      const textLayer = await createTextLayer(800, 600);

      const options: CompositeOptions = {
        textLayer,
        backgroundLayer: background,
        blend: 'multiply',
      };

      const result = await compositor.composite(options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      const metadata = await sharp(result).metadata();
      expect(metadata.format).toBe('png');
    });

    it('should composite with overlay blend mode', async () => {
      const background = await createTestImage(800, 600, { r: 255, g: 200, b: 150 });
      const textLayer = await createTextLayer(800, 600);

      const options: CompositeOptions = {
        textLayer,
        backgroundLayer: background,
        blend: 'overlay',
      };

      const result = await compositor.composite(options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      const metadata = await sharp(result).metadata();
      expect(metadata.format).toBe('png');
    });

    it('should handle mismatched dimensions by resizing text layer', async () => {
      const background = await createTestImage(800, 600, { r: 255, g: 200, b: 150 });
      const textLayer = await createTextLayer(400, 300);

      const options: CompositeOptions = {
        textLayer,
        backgroundLayer: background,
        blend: 'normal',
      };

      const result = await compositor.composite(options);

      expect(result).toBeInstanceOf(Buffer);

      // Result should match background dimensions
      const metadata = await sharp(result).metadata();
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(600);
    });

    it('should throw error for invalid background buffer', async () => {
      const textLayer = await createTextLayer(800, 600);
      const invalidBuffer = Buffer.from('not an image');

      const options: CompositeOptions = {
        textLayer,
        backgroundLayer: invalidBuffer,
        blend: 'normal',
      };

      await expect(compositor.composite(options)).rejects.toThrow();
    });

    it('should throw error for invalid text layer buffer', async () => {
      const background = await createTestImage(800, 600, { r: 255, g: 200, b: 150 });
      const invalidBuffer = Buffer.from('not an image');

      const options: CompositeOptions = {
        textLayer: invalidBuffer,
        backgroundLayer: background,
        blend: 'normal',
      };

      await expect(compositor.composite(options)).rejects.toThrow();
    });

    it('should maintain high quality output', async () => {
      const background = await createTestImage(800, 600, { r: 255, g: 200, b: 150 });
      const textLayer = await createTextLayer(800, 600);

      const options: CompositeOptions = {
        textLayer,
        backgroundLayer: background,
        blend: 'normal',
      };

      const result = await compositor.composite(options);

      // Check that the output is PNG with reasonable size (not over-compressed)
      const metadata = await sharp(result).metadata();
      expect(metadata.format).toBe('png');
      
      // PNG should be larger than a heavily compressed JPEG would be
      expect(result.length).toBeGreaterThan(1000);
    });
  });

  describe('compositeWithMetadata()', () => {
    it('should return buffer with metadata', async () => {
      const background = await createTestImage(800, 600, { r: 255, g: 200, b: 150 });
      const textLayer = await createTextLayer(800, 600);

      const options: CompositeOptions = {
        textLayer,
        backgroundLayer: background,
        blend: 'normal',
      };

      const result = await compositor.compositeWithMetadata(options);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.width).toBe(800);
      expect(result.metadata.height).toBe(600);
      expect(result.metadata.format).toBe('png');
    });
  });

  describe('compositeImages() convenience function', () => {
    it('should work as a standalone function', async () => {
      const background = await createTestImage(800, 600, { r: 255, g: 200, b: 150 });
      const textLayer = await createTextLayer(800, 600);

      const options: CompositeOptions = {
        textLayer,
        backgroundLayer: background,
        blend: 'normal',
      };

      const result = await compositeImages(options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      const metadata = await sharp(result).metadata();
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(600);
    });
  });

  describe('Edge cases', () => {
    it('should handle very small images', async () => {
      const background = await createTestImage(10, 10, { r: 255, g: 200, b: 150 });
      const textLayer = await createTextLayer(10, 10);

      const options: CompositeOptions = {
        textLayer,
        backgroundLayer: background,
        blend: 'normal',
      };

      const result = await compositor.composite(options);

      expect(result).toBeInstanceOf(Buffer);
      const metadata = await sharp(result).metadata();
      expect(metadata.width).toBe(10);
      expect(metadata.height).toBe(10);
    });

    it('should handle large images', async () => {
      const background = await createTestImage(2480, 3508, { r: 255, g: 200, b: 150 }); // A4 at 300 DPI
      const textLayer = await createTextLayer(2480, 3508);

      const options: CompositeOptions = {
        textLayer,
        backgroundLayer: background,
        blend: 'normal',
      };

      const result = await compositor.composite(options);

      expect(result).toBeInstanceOf(Buffer);
      const metadata = await sharp(result).metadata();
      expect(metadata.width).toBe(2480);
      expect(metadata.height).toBe(3508);
    }, 30000); // Increase timeout for large image processing

    it('should preserve transparency in text layer', async () => {
      const background = await createTestImage(800, 600, { r: 255, g: 200, b: 150 });
      const textLayer = await createTextLayer(800, 600);

      const options: CompositeOptions = {
        textLayer,
        backgroundLayer: background,
        blend: 'normal',
      };

      const result = await compositor.composite(options);

      // The result should have the background color visible where text layer is transparent
      const metadata = await sharp(result).metadata();
      expect(metadata.hasAlpha).toBeFalsy(); // PNG output should flatten transparency
    });
  });
});
