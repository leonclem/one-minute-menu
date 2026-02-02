/**
 * Unit tests for export request validation
 */

import {
  validateExportType,
  validateMenuHTML,
  validateImageCount,
  validateImageURLs,
  validateExportRequest,
} from '../export-validation';

describe('Export Request Validation', () => {
  describe('validateExportType', () => {
    it('should accept valid pdf export type', () => {
      const result = validateExportType('pdf');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid image export type', () => {
      const result = validateExportType('image');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid export type', () => {
      const result = validateExportType('invalid');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid export type');
    });

    it('should reject empty export type', () => {
      const result = validateExportType('');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('required');
    });

    it('should reject null export type', () => {
      const result = validateExportType(null as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('validateMenuHTML', () => {
    it('should accept valid HTML within size limit', () => {
      const html = '<html><body><h1>Test Menu</h1></body></html>';
      const result = validateMenuHTML(html);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty HTML', () => {
      const result = validateMenuHTML('');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('required');
    });

    it('should reject HTML exceeding 5MB', () => {
      // Create HTML larger than 5MB
      const largeContent = 'x'.repeat(6 * 1024 * 1024); // 6MB
      const html = `<html><body>${largeContent}</body></html>`;
      const result = validateMenuHTML(html);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('exceeds maximum allowed size');
    });

    it('should warn for HTML approaching size limit', () => {
      // Create HTML at 85% of 5MB limit (4.25MB)
      const largeContent = 'x'.repeat(Math.floor(4.25 * 1024 * 1024));
      const html = `<html><body>${largeContent}</body></html>`;
      const result = validateMenuHTML(html);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('approaching the maximum limit');
    });
  });

  describe('validateImageCount', () => {
    it('should accept HTML with no images', () => {
      const html = '<html><body><h1>Text Only Menu</h1></body></html>';
      const result = validateImageCount(html);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept HTML with images within limit', () => {
      const images = Array.from({ length: 50 }, (_, i) => 
        `<img src="image${i}.jpg" />`
      ).join('');
      const html = `<html><body>${images}</body></html>`;
      const result = validateImageCount(html);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject HTML with more than 100 images', () => {
      const images = Array.from({ length: 150 }, (_, i) => 
        `<img src="image${i}.jpg" />`
      ).join('');
      const html = `<html><body>${images}</body></html>`;
      const result = validateImageCount(html);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('exceeds the maximum allowed');
      expect(result.errors[0]).toContain('150');
    });

    it('should warn for HTML approaching image limit', () => {
      const images = Array.from({ length: 90 }, (_, i) => 
        `<img src="image${i}.jpg" />`
      ).join('');
      const html = `<html><body>${images}</body></html>`;
      const result = validateImageCount(html);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('approaching the maximum limit');
    });

    it('should count images with various attributes', () => {
      const html = `
        <html><body>
          <img src="test1.jpg" alt="Test 1" />
          <img src="test2.jpg" class="menu-image" />
          <img src='test3.jpg' />
          <img src="test4.jpg" width="100" height="100" />
        </body></html>
      `;
      const result = validateImageCount(html);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateImageURLs', () => {
    it('should accept images from Supabase Storage', () => {
      const html = `
        <html><body>
          <img src="https://project.supabase.co/storage/v1/object/public/bucket/image1.jpg" />
          <img src="https://project.supabase.in/storage/v1/object/public/bucket/image2.jpg" />
        </body></html>
      `;
      const result = validateImageURLs(html);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept data URLs (base64 images)', () => {
      const html = `
        <html><body>
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />
        </body></html>
      `;
      const result = validateImageURLs(html);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept relative URLs', () => {
      const html = `
        <html><body>
          <img src="/images/logo.png" />
          <img src="images/menu-item.jpg" />
        </body></html>
      `;
      const result = validateImageURLs(html);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject images from untrusted domains', () => {
      const html = `
        <html><body>
          <img src="https://evil.com/malicious.jpg" />
          <img src="https://untrusted-cdn.com/image.png" />
        </body></html>
      `;
      const result = validateImageURLs(html);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('untrusted domains');
      expect(result.errors[0]).toContain('evil.com');
    });

    it('should handle mixed trusted and untrusted URLs', () => {
      const html = `
        <html><body>
          <img src="https://project.supabase.co/storage/v1/object/public/bucket/image1.jpg" />
          <img src="https://evil.com/malicious.jpg" />
          <img src="data:image/png;base64,..." />
        </body></html>
      `;
      const result = validateImageURLs(html);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('1 image(s) from untrusted domains');
    });

    it('should limit untrusted URL list in error message', () => {
      const untrustedImages = Array.from({ length: 10 }, (_, i) => 
        `<img src="https://evil${i}.com/image.jpg" />`
      ).join('');
      const html = `<html><body>${untrustedImages}</body></html>`;
      const result = validateImageURLs(html);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('10 image(s)');
      expect(result.errors[0]).toContain('...');
    });
  });

  describe('validateExportRequest', () => {
    it('should accept valid export request', () => {
      const html = `
        <html><body>
          <h1>Test Menu</h1>
          <img src="https://project.supabase.co/storage/v1/object/public/bucket/image.jpg" />
        </body></html>
      `;
      const result = validateExportRequest('pdf', html);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect all validation errors', () => {
      const largeContent = 'x'.repeat(6 * 1024 * 1024); // 6MB
      const images = Array.from({ length: 150 }, (_, i) => 
        `<img src="https://evil.com/image${i}.jpg" />`
      ).join('');
      const html = `<html><body>${largeContent}${images}</body></html>`;
      
      const result = validateExportRequest('invalid', html);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      
      // Should have errors for: invalid type, HTML size, image count, untrusted URLs
      expect(result.errors.some(e => e.includes('Invalid export type'))).toBe(true);
      expect(result.errors.some(e => e.includes('exceeds maximum allowed size'))).toBe(true);
      expect(result.errors.some(e => e.includes('exceeds the maximum allowed'))).toBe(true);
      expect(result.errors.some(e => e.includes('untrusted domains'))).toBe(true);
    });

    it('should collect all warnings', () => {
      const largeContent = 'x'.repeat(Math.floor(4.25 * 1024 * 1024)); // 4.25MB
      const images = Array.from({ length: 90 }, (_, i) => 
        `<img src="https://project.supabase.co/storage/image${i}.jpg" />`
      ).join('');
      const html = `<html><body>${largeContent}${images}</body></html>`;
      
      const result = validateExportRequest('pdf', html);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBe(2);
      expect(result.warnings.some(w => w.includes('HTML size'))).toBe(true);
      expect(result.warnings.some(w => w.includes('images'))).toBe(true);
    });

    it('should handle empty HTML', () => {
      const result = validateExportRequest('pdf', '');
      expect(result.valid).toBe(false);
      // Should have multiple errors for empty HTML
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
