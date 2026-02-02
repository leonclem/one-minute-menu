/**
 * Property-based tests for export request validation
 * 
 * These tests verify universal properties across all inputs through randomization.
 * Each test runs 100 iterations with randomly generated inputs.
 */

import fc from 'fast-check';
import {
  validateExportType,
  validateMenuHTML,
  validateImageCount,
} from '../export-validation';

describe('Export Validation Property Tests', () => {
  // Feature: railway-workers, Property 16: Export Type Validation
  // Validates: Requirements 11.1, 11.5
  describe('Property 16: Export Type Validation', () => {
    it('should accept only "pdf" or "image" as valid export types', async () => {
      await fc.assert(
        fc.property(
          fc.string(),
          (exportType) => {
            const result = validateExportType(exportType);
            
            // Property: Only 'pdf' and 'image' are valid
            if (exportType === 'pdf' || exportType === 'image') {
              expect(result.valid).toBe(true);
              expect(result.errors).toHaveLength(0);
            } else {
              expect(result.valid).toBe(false);
              expect(result.errors.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject empty or null export types', async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom('', null, undefined),
          (exportType) => {
            const result = validateExportType(exportType as any);
            
            // Property: Empty/null values are always invalid
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be case-sensitive for export type validation', async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom('PDF', 'Image', 'JPEG', 'Pdf', 'IMAGE'),
          (exportType) => {
            const result = validateExportType(exportType);
            
            // Property: Case variations are invalid (must be lowercase)
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject export types with whitespace', async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom(' pdf', 'pdf ', ' image ', 'p df', 'ima ge'),
          (exportType) => {
            const result = validateExportType(exportType);
            
            // Property: Whitespace variations are invalid
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide meaningful error messages for invalid types', async () => {
      await fc.assert(
        fc.property(
          fc.string().filter(s => s !== 'pdf' && s !== 'image' && s !== ''),
          (exportType) => {
            const result = validateExportType(exportType);
            
            // Property: Invalid types should have descriptive error messages
            if (!result.valid) {
              expect(result.errors[0]).toContain('Invalid export type');
              expect(result.errors[0]).toContain(exportType);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: railway-workers, Property 23: HTML Size Validation
  // Validates: Requirements 13.5, 13.7
  describe('Property 23: HTML Size Validation', () => {
    const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
    const WARNING_THRESHOLD = MAX_SIZE_BYTES * 0.8; // 80% of max

    it('should accept HTML within size limit', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 1, max: MAX_SIZE_BYTES }),
          (size) => {
            const html = 'x'.repeat(size);
            const result = validateMenuHTML(html);
            
            // Property: HTML within limit should be valid
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject HTML exceeding size limit', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: MAX_SIZE_BYTES + 1, max: MAX_SIZE_BYTES + 1024 * 1024 }),
          (size) => {
            const html = 'x'.repeat(size);
            const result = validateMenuHTML(html);
            
            // Property: HTML exceeding limit should be invalid
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('exceeds maximum allowed size');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should warn when HTML approaches size limit', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: WARNING_THRESHOLD, max: MAX_SIZE_BYTES }),
          (size) => {
            const html = 'x'.repeat(size);
            const result = validateMenuHTML(html);
            
            // Property: HTML in warning zone should be valid but have warnings
            expect(result.valid).toBe(true);
            if (size > WARNING_THRESHOLD) {
              expect(result.warnings.length).toBeGreaterThan(0);
              expect(result.warnings[0]).toContain('approaching the maximum limit');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty HTML', async () => {
      const result = validateMenuHTML('');
      
      // Property: Empty HTML is invalid
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('required');
    });

    it('should calculate size correctly for multi-byte characters', async () => {
      await fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (content) => {
            const html = `<html><body>${content}</body></html>`;
            const result = validateMenuHTML(html);
            
            // Property: Size calculation should use byte length, not character count
            const actualBytes = Buffer.byteLength(html, 'utf8');
            
            if (actualBytes <= MAX_SIZE_BYTES) {
              expect(result.valid).toBe(true);
            } else {
              expect(result.valid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be deterministic for same input', async () => {
      await fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 10000 }),
          (html) => {
            const result1 = validateMenuHTML(html);
            const result2 = validateMenuHTML(html);
            
            // Property: Same input should always produce same result
            expect(result1.valid).toBe(result2.valid);
            expect(result1.errors).toEqual(result2.errors);
            expect(result1.warnings).toEqual(result2.warnings);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: railway-workers, Property 24: Image Count Validation
  // Validates: Requirements 13.6, 13.7
  describe('Property 24: Image Count Validation', () => {
    const MAX_IMAGE_COUNT = 100;
    const WARNING_THRESHOLD = MAX_IMAGE_COUNT * 0.8; // 80 images

    it('should accept HTML with images within limit', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: MAX_IMAGE_COUNT }),
          (imageCount) => {
            const images = Array.from({ length: imageCount }, (_, i) => 
              `<img src="image${i}.jpg" />`
            ).join('');
            const html = `<html><body>${images}</body></html>`;
            const result = validateImageCount(html);
            
            // Property: Image count within limit should be valid
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject HTML exceeding image count limit', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: MAX_IMAGE_COUNT + 1, max: MAX_IMAGE_COUNT + 50 }),
          (imageCount) => {
            const images = Array.from({ length: imageCount }, (_, i) => 
              `<img src="image${i}.jpg" />`
            ).join('');
            const html = `<html><body>${images}</body></html>`;
            const result = validateImageCount(html);
            
            // Property: Image count exceeding limit should be invalid
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('exceeds the maximum allowed');
            expect(result.errors[0]).toContain(imageCount.toString());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should warn when image count approaches limit', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: WARNING_THRESHOLD, max: MAX_IMAGE_COUNT }),
          (imageCount) => {
            const images = Array.from({ length: imageCount }, (_, i) => 
              `<img src="image${i}.jpg" />`
            ).join('');
            const html = `<html><body>${images}</body></html>`;
            const result = validateImageCount(html);
            
            // Property: Image count in warning zone should be valid but have warnings
            expect(result.valid).toBe(true);
            if (imageCount > WARNING_THRESHOLD) {
              expect(result.warnings.length).toBeGreaterThan(0);
              expect(result.warnings[0]).toContain('approaching the maximum limit');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should count images with various attribute formats', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          (imageCount, attributes) => {
            // Generate images with random attributes
            const images = Array.from({ length: imageCount }, (_, i) => {
              const attrs = attributes.slice(0, Math.min(attributes.length, 3)).join(' ');
              return `<img src="image${i}.jpg" ${attrs} />`;
            }).join('');
            const html = `<html><body>${images}</body></html>`;
            const result = validateImageCount(html);
            
            // Property: Image count should be accurate regardless of attributes
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle HTML with no images', async () => {
      await fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }).filter(s => !s.includes('<img')),
          (content) => {
            const html = `<html><body>${content}</body></html>`;
            const result = validateImageCount(html);
            
            // Property: HTML with no images should be valid
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be deterministic for same input', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 150 }),
          (imageCount) => {
            const images = Array.from({ length: imageCount }, (_, i) => 
              `<img src="image${i}.jpg" />`
            ).join('');
            const html = `<html><body>${images}</body></html>`;
            
            const result1 = validateImageCount(html);
            const result2 = validateImageCount(html);
            
            // Property: Same input should always produce same result
            expect(result1.valid).toBe(result2.valid);
            expect(result1.errors).toEqual(result2.errors);
            expect(result1.warnings).toEqual(result2.warnings);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
