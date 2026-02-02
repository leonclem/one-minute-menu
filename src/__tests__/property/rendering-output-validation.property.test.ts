/**
 * Property-Based Tests for Rendering Output Validation
 * Feature: railway-workers
 * 
 * These tests verify that rendered outputs meet format requirements across
 * all valid export types and formats using randomized test data generation.
 */

import fc from 'fast-check';
import {
  validatePDF,
  validatePNG,
  validateJPEG,
  validateOutput,
  type ValidationResult,
} from '@/lib/worker/output-validator';

// Feature: railway-workers, Property 4: Rendering Output Validation
describe('Property 4: Rendering Output Validation', () => {
  describe('PDF validation properties', () => {
    it('should validate any buffer with valid PDF signature and adequate size', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Generate content after PDF signature
            contentSize: fc.integer({ min: 256, max: 10000 }),
            content: fc.string({ minLength: 1, maxLength: 1000 })
          }),
          async (input) => {
            // Create a buffer with valid PDF signature
            const pdfSignature = '%PDF-1.4\n';
            const content = input.content.padEnd(input.contentSize, 'x');
            const buffer = Buffer.from(pdfSignature + content + '\n%%EOF', 'utf8');

            const result = validatePDF(buffer);

            // Property: Valid PDF signature + adequate size = valid output
            expect(result.valid).toBe(true);
            expect(result.format_verified).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.file_size).toBeGreaterThanOrEqual(256);
            expect(result.warnings).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject any buffer without valid PDF signature', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 1000 })
            .filter(s => !s.startsWith('%PDF-')),
          async (invalidContent) => {
            const buffer = Buffer.from(invalidContent, 'utf8');

            const result = validatePDF(buffer);

            // Property: Invalid PDF signature = invalid output
            expect(result.valid).toBe(false);
            expect(result.format_verified).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Invalid PDF signature');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should warn on any valid PDF with size below 256 bytes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 255 }),
          async (size) => {
            // Create valid PDF with specific small size
            const pdfSignature = '%PDF-1.4\n';
            const padding = 'x'.repeat(Math.max(0, size - pdfSignature.length - 6));
            const buffer = Buffer.from(pdfSignature + padding + '\n%%EOF', 'utf8');
            
            // Ensure buffer is actually below 256 bytes
            if (buffer.length >= 256) {
              return; // Skip this iteration
            }

            const result = validatePDF(buffer);

            // Property: Valid signature + size < 256 = valid but with warning
            expect(result.valid).toBe(true);
            expect(result.format_verified).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0]).toContain('below recommended minimum');
            expect(result.file_size).toBeLessThan(256);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('PNG validation properties', () => {
    it('should validate any buffer with valid PNG signature and adequate size', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 256, max: 10000 }),
          async (contentSize) => {
            // PNG signature: 89 50 4E 47 0D 0A 1A 0A
            const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            const content = Buffer.alloc(contentSize);
            const buffer = Buffer.concat([pngSignature, content]);

            const result = validatePNG(buffer);

            // Property: Valid PNG signature + adequate size = valid output
            expect(result.valid).toBe(true);
            expect(result.format_verified).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.file_size).toBeGreaterThanOrEqual(256);
            expect(result.warnings).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject any buffer without valid PNG signature', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 8, maxLength: 1000 })
            .filter(arr => {
              // Filter out valid PNG signatures
              const pngSig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
              return !arr.slice(0, 8).every((val, idx) => val === pngSig[idx]);
            }),
          async (invalidBytes) => {
            const buffer = Buffer.from(invalidBytes);

            const result = validatePNG(buffer);

            // Property: Invalid PNG signature = invalid output
            expect(result.valid).toBe(false);
            expect(result.format_verified).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should warn on any valid PNG with size below 256 bytes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 247 }), // 247 + 8 (signature) = max 255 bytes
          async (contentSize) => {
            const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            const content = Buffer.alloc(contentSize);
            const buffer = Buffer.concat([pngSignature, content]);

            const result = validatePNG(buffer);

            // Property: Valid signature + size < 256 = valid but with warning
            expect(result.valid).toBe(true);
            expect(result.format_verified).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0]).toContain('below recommended minimum');
            expect(result.file_size).toBeLessThan(256);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('JPEG validation properties', () => {
    it('should validate any buffer with valid JPEG markers and adequate size', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 256, max: 10000 }),
          async (contentSize) => {
            // JPEG SOI: FF D8, EOI: FF D9
            const jpegSOI = Buffer.from([0xFF, 0xD8]);
            const jpegEOI = Buffer.from([0xFF, 0xD9]);
            const content = Buffer.alloc(contentSize);
            const buffer = Buffer.concat([jpegSOI, content, jpegEOI]);

            const result = validateJPEG(buffer);

            // Property: Valid JPEG markers + adequate size = valid output
            expect(result.valid).toBe(true);
            expect(result.format_verified).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.file_size).toBeGreaterThanOrEqual(256);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject any buffer without valid JPEG SOI marker', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 2, maxLength: 1000 })
            .filter(arr => !(arr[0] === 0xFF && arr[1] === 0xD8)),
          async (invalidBytes) => {
            const buffer = Buffer.from(invalidBytes);

            const result = validateJPEG(buffer);

            // Property: Invalid JPEG SOI marker = invalid output
            expect(result.valid).toBe(false);
            expect(result.format_verified).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Invalid JPEG SOI marker');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should warn on valid JPEG without EOI marker', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 256, max: 10000 }),
          async (contentSize) => {
            // Valid SOI but no EOI
            const jpegSOI = Buffer.from([0xFF, 0xD8]);
            const content = Buffer.alloc(contentSize);
            // Ensure content doesn't accidentally end with EOI marker
            if (content.length >= 2) {
              content[content.length - 2] = 0x00;
              content[content.length - 1] = 0x00;
            }
            const buffer = Buffer.concat([jpegSOI, content]);

            const result = validateJPEG(buffer);

            // Property: Valid SOI + no EOI = valid but with warning
            expect(result.valid).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some(w => w.includes('JPEG EOI marker not found'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should warn on any valid JPEG with size below 256 bytes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 251 }), // 251 + 2 (SOI) + 2 (EOI) = max 255 bytes
          async (contentSize) => {
            const jpegSOI = Buffer.from([0xFF, 0xD8]);
            const jpegEOI = Buffer.from([0xFF, 0xD9]);
            const content = Buffer.alloc(contentSize);
            const buffer = Buffer.concat([jpegSOI, content, jpegEOI]);

            const result = validateJPEG(buffer);

            // Property: Valid markers + size < 256 = valid but with warning
            expect(result.valid).toBe(true);
            expect(result.format_verified).toBe(true);
            expect(result.warnings.some(w => w.includes('below recommended minimum'))).toBe(true);
            expect(result.file_size).toBeLessThan(256);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('validateOutput routing properties', () => {
    it('should correctly route PDF exports to PDF validator', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 256, max: 10000 }),
          async (contentSize) => {
            const pdfSignature = '%PDF-1.4\n';
            const content = 'x'.repeat(contentSize);
            const buffer = Buffer.from(pdfSignature + content + '\n%%EOF', 'utf8');

            const result = validateOutput(buffer, 'pdf');

            // Property: PDF export type routes to PDF validation
            expect(result.valid).toBe(true);
            expect(result.format_verified).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly route PNG image exports to PNG validator', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 256, max: 10000 }),
          async (contentSize) => {
            const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            const content = Buffer.alloc(contentSize);
            const buffer = Buffer.concat([pngSignature, content]);

            const result = validateOutput(buffer, 'image', 'png');

            // Property: Image export with PNG format routes to PNG validation
            expect(result.valid).toBe(true);
            expect(result.format_verified).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly route JPEG image exports to JPEG validator', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 256, max: 10000 }),
          async (contentSize) => {
            const jpegSOI = Buffer.from([0xFF, 0xD8]);
            const jpegEOI = Buffer.from([0xFF, 0xD9]);
            const content = Buffer.alloc(contentSize);
            const buffer = Buffer.concat([jpegSOI, content, jpegEOI]);

            const result = validateOutput(buffer, 'image', 'jpeg');

            // Property: Image export with JPEG format routes to JPEG validation
            expect(result.valid).toBe(true);
            expect(result.format_verified).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject image exports without format specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 256, maxLength: 10000 }),
          async (bytes) => {
            const buffer = Buffer.from(bytes);

            const result = validateOutput(buffer, 'image');

            // Property: Image export without format = invalid
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Image format must be specified for image exports');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cross-format validation properties', () => {
    it('should reject PDF signature when validating as PNG', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 256, max: 10000 }),
          async (contentSize) => {
            // Create valid PDF buffer
            const pdfSignature = '%PDF-1.4\n';
            const content = 'x'.repeat(contentSize);
            const buffer = Buffer.from(pdfSignature + content + '\n%%EOF', 'utf8');

            // Validate as PNG (wrong format)
            const result = validatePNG(buffer);

            // Property: PDF signature should fail PNG validation
            expect(result.valid).toBe(false);
            expect(result.format_verified).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject PNG signature when validating as PDF', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 256, max: 10000 }),
          async (contentSize) => {
            // Create valid PNG buffer
            const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            const content = Buffer.alloc(contentSize);
            const buffer = Buffer.concat([pngSignature, content]);

            // Validate as PDF (wrong format)
            const result = validatePDF(buffer);

            // Property: PNG signature should fail PDF validation
            expect(result.valid).toBe(false);
            expect(result.format_verified).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject JPEG signature when validating as PNG', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 256, max: 10000 }),
          async (contentSize) => {
            // Create valid JPEG buffer
            const jpegSOI = Buffer.from([0xFF, 0xD8]);
            const jpegEOI = Buffer.from([0xFF, 0xD9]);
            const content = Buffer.alloc(contentSize);
            const buffer = Buffer.concat([jpegSOI, content, jpegEOI]);

            // Validate as PNG (wrong format)
            const result = validatePNG(buffer);

            // Property: JPEG signature should fail PNG validation
            expect(result.valid).toBe(false);
            expect(result.format_verified).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge case properties', () => {
    it('should handle empty buffers consistently across all validators', async () => {
      const emptyBuffer = Buffer.alloc(0);

      const pdfResult = validatePDF(emptyBuffer);
      const pngResult = validatePNG(emptyBuffer);
      const jpegResult = validateJPEG(emptyBuffer);

      // Property: Empty buffer should always be invalid
      expect(pdfResult.valid).toBe(false);
      expect(pngResult.valid).toBe(false);
      expect(jpegResult.valid).toBe(false);

      expect(pdfResult.errors.length).toBeGreaterThan(0);
      expect(pngResult.errors.length).toBeGreaterThan(0);
      expect(jpegResult.errors.length).toBeGreaterThan(0);
    });

    it('should handle very large buffers without errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('pdf', 'png', 'jpeg'),
          fc.integer({ min: 1000000, max: 10000000 }), // 1MB to 10MB
          async (format, size) => {
            let buffer: Buffer;

            if (format === 'pdf') {
              const pdfSignature = '%PDF-1.4\n';
              const content = 'x'.repeat(size);
              buffer = Buffer.from(pdfSignature + content + '\n%%EOF', 'utf8');
            } else if (format === 'png') {
              const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
              const content = Buffer.alloc(size);
              buffer = Buffer.concat([pngSignature, content]);
            } else {
              const jpegSOI = Buffer.from([0xFF, 0xD8]);
              const jpegEOI = Buffer.from([0xFF, 0xD9]);
              const content = Buffer.alloc(size);
              buffer = Buffer.concat([jpegSOI, content, jpegEOI]);
            }

            let result: ValidationResult;
            if (format === 'pdf') {
              result = validatePDF(buffer);
            } else if (format === 'png') {
              result = validatePNG(buffer);
            } else {
              result = validateJPEG(buffer);
            }

            // Property: Large valid buffers should validate successfully
            expect(result.valid).toBe(true);
            expect(result.format_verified).toBe(true);
            expect(result.file_size).toBeGreaterThan(1000000);
          }
        ),
        { numRuns: 20 } // Fewer runs for large buffers to avoid memory issues
      );
    });

    it('should maintain validation consistency for the same buffer', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 256, max: 10000 }),
          async (contentSize) => {
            const pdfSignature = '%PDF-1.4\n';
            const content = 'x'.repeat(contentSize);
            const buffer = Buffer.from(pdfSignature + content + '\n%%EOF', 'utf8');

            // Validate the same buffer multiple times
            const result1 = validatePDF(buffer);
            const result2 = validatePDF(buffer);
            const result3 = validatePDF(buffer);

            // Property: Validation should be deterministic
            expect(result1.valid).toBe(result2.valid);
            expect(result2.valid).toBe(result3.valid);
            expect(result1.format_verified).toBe(result2.format_verified);
            expect(result2.format_verified).toBe(result3.format_verified);
            expect(result1.file_size).toBe(result2.file_size);
            expect(result2.file_size).toBe(result3.file_size);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
