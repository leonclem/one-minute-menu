/**
 * Unit tests for output validator
 * 
 * Tests validation of PDF and image outputs
 */

import {
  validatePDF,
  validatePNG,
  validateJPEG,
  validateSize,
  validateOutput,
  type ValidationResult,
} from '../output-validator';

describe('Output Validator', () => {
  describe('validatePDF', () => {
    it('should validate a valid PDF buffer', () => {
      // Create a minimal valid PDF buffer
      const pdfContent = '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\n0000000000 65535 f\ntrailer\n<<\n/Size 1\n>>\nstartxref\n0\n%%EOF';
      const buffer = Buffer.from(pdfContent, 'utf8');

      const result = validatePDF(buffer);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.format_verified).toBe(true);
      expect(result.file_size).toBeGreaterThan(0);
    });

    it('should reject empty buffer', () => {
      const buffer = Buffer.alloc(0);

      const result = validatePDF(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PDF buffer is empty');
      expect(result.format_verified).toBe(false);
    });

    it('should reject invalid PDF signature', () => {
      const buffer = Buffer.from('NOT A PDF FILE', 'utf8');

      const result = validatePDF(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid PDF signature');
      expect(result.format_verified).toBe(false);
    });

    it('should warn on small file size', () => {
      // Create a valid but very small PDF
      const buffer = Buffer.from('%PDF-1.4\n%%EOF', 'utf8');

      const result = validatePDF(buffer);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('below recommended minimum');
      expect(result.format_verified).toBe(true);
    });

    it('should not warn on adequate file size', () => {
      // Create a PDF buffer larger than 256 bytes
      const pdfContent = '%PDF-1.4\n' + 'x'.repeat(300) + '\n%%EOF';
      const buffer = Buffer.from(pdfContent, 'utf8');

      const result = validatePDF(buffer);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.format_verified).toBe(true);
      expect(result.file_size).toBeGreaterThan(256);
    });
  });

  describe('validatePNG', () => {
    it('should validate a valid PNG buffer', () => {
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      // Add some dummy data to make it larger
      const dummyData = Buffer.alloc(300);
      const buffer = Buffer.concat([pngSignature, dummyData]);

      const result = validatePNG(buffer);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.format_verified).toBe(true);
      expect(result.file_size).toBeGreaterThan(256);
    });

    it('should reject empty buffer', () => {
      const buffer = Buffer.alloc(0);

      const result = validatePNG(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PNG buffer is empty');
      expect(result.format_verified).toBe(false);
    });

    it('should reject invalid PNG signature', () => {
      const buffer = Buffer.from('NOT A PNG FILE', 'utf8');

      const result = validatePNG(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid PNG signature');
      expect(result.format_verified).toBe(false);
    });

    it('should reject buffer too small for signature', () => {
      const buffer = Buffer.from([0x89, 0x50]); // Only 2 bytes

      const result = validatePNG(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('PNG buffer too small');
      expect(result.format_verified).toBe(false);
    });

    it('should warn on small file size', () => {
      // Valid PNG signature but small file
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const buffer = pngSignature;

      const result = validatePNG(buffer);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('below recommended minimum');
      expect(result.format_verified).toBe(true);
    });
  });

  describe('validateJPEG', () => {
    it('should validate a valid JPEG buffer', () => {
      // JPEG SOI: FF D8, EOI: FF D9
      const jpegSOI = Buffer.from([0xFF, 0xD8]);
      const jpegEOI = Buffer.from([0xFF, 0xD9]);
      const dummyData = Buffer.alloc(300);
      const buffer = Buffer.concat([jpegSOI, dummyData, jpegEOI]);

      const result = validateJPEG(buffer);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.format_verified).toBe(true);
      expect(result.file_size).toBeGreaterThan(256);
    });

    it('should reject empty buffer', () => {
      const buffer = Buffer.alloc(0);

      const result = validateJPEG(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('JPEG buffer is empty');
      expect(result.format_verified).toBe(false);
    });

    it('should reject invalid JPEG SOI marker', () => {
      const buffer = Buffer.from('NOT A JPEG FILE', 'utf8');

      const result = validateJPEG(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid JPEG SOI marker');
      expect(result.format_verified).toBe(false);
    });

    it('should warn on missing JPEG EOI marker', () => {
      // Valid SOI but no EOI
      const jpegSOI = Buffer.from([0xFF, 0xD8]);
      const dummyData = Buffer.alloc(300);
      const buffer = Buffer.concat([jpegSOI, dummyData]);

      const result = validateJPEG(buffer);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('JPEG EOI marker not found');
    });

    it('should reject buffer too small for SOI marker', () => {
      const buffer = Buffer.from([0xFF]); // Only 1 byte

      const result = validateJPEG(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('JPEG buffer too small');
      expect(result.format_verified).toBe(false);
    });

    it('should warn on small file size', () => {
      // Valid JPEG markers but small file
      const jpegSOI = Buffer.from([0xFF, 0xD8]);
      const jpegEOI = Buffer.from([0xFF, 0xD9]);
      const buffer = Buffer.concat([jpegSOI, jpegEOI]);

      const result = validateJPEG(buffer);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('below recommended minimum');
      expect(result.format_verified).toBe(true);
    });
  });

  describe('validateSize', () => {
    it('should validate adequate file size', () => {
      const buffer = Buffer.alloc(300);

      const result = validateSize(buffer);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.file_size).toBe(300);
    });

    it('should warn on small file size', () => {
      const buffer = Buffer.alloc(100);

      const result = validateSize(buffer);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('below recommended minimum');
      expect(result.file_size).toBe(100);
    });

    it('should reject empty buffer', () => {
      const buffer = Buffer.alloc(0);

      const result = validateSize(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File buffer is empty');
    });
  });

  describe('validateOutput', () => {
    it('should route to validatePDF for pdf export type', () => {
      const pdfContent = '%PDF-1.4\n' + 'x'.repeat(300) + '\n%%EOF';
      const buffer = Buffer.from(pdfContent, 'utf8');

      const result = validateOutput(buffer, 'pdf');

      expect(result.valid).toBe(true);
      expect(result.format_verified).toBe(true);
    });

    it('should route to validatePNG for image export type with png format', () => {
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const dummyData = Buffer.alloc(300);
      const buffer = Buffer.concat([pngSignature, dummyData]);

      const result = validateOutput(buffer, 'image', 'png');

      expect(result.valid).toBe(true);
      expect(result.format_verified).toBe(true);
    });

    it('should route to validateJPEG for image export type with jpeg format', () => {
      const jpegSOI = Buffer.from([0xFF, 0xD8]);
      const jpegEOI = Buffer.from([0xFF, 0xD9]);
      const dummyData = Buffer.alloc(300);
      const buffer = Buffer.concat([jpegSOI, dummyData, jpegEOI]);

      const result = validateOutput(buffer, 'image', 'jpeg');

      expect(result.valid).toBe(true);
      expect(result.format_verified).toBe(true);
    });

    it('should reject image export without format specified', () => {
      const buffer = Buffer.alloc(300);

      const result = validateOutput(buffer, 'image');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Image format must be specified for image exports');
    });

    it('should reject unsupported image format', () => {
      const buffer = Buffer.alloc(300);

      const result = validateOutput(buffer, 'image', 'gif' as any);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unsupported image format');
    });

    it('should reject unsupported export type', () => {
      const buffer = Buffer.alloc(300);

      const result = validateOutput(buffer, 'video' as any);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unsupported export type');
    });
  });

  describe('Edge cases', () => {
    it('should handle null buffer gracefully', () => {
      const result = validatePDF(null as any);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle undefined buffer gracefully', () => {
      const result = validatePNG(undefined as any);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle very large buffers', () => {
      // 10MB buffer
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024);
      // Add PDF signature
      largeBuffer.write('%PDF-1.4', 0, 'utf8');

      const result = validatePDF(largeBuffer);

      expect(result.valid).toBe(true);
      expect(result.file_size).toBe(10 * 1024 * 1024);
    });
  });
});
