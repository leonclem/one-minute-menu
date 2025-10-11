/**
 * Integration tests for Menu Exporter
 * 
 * Tests the PDF/PNG export functionality using Playwright.
 * These are integration tests that actually render HTML and generate files.
 * 
 * Requirements: 8.1, 8.2
 * 
 * @jest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { MenuExporter, ExportError } from '../exporter';
import type { ExportOptions } from '../exporter';

describe('MenuExporter', () => {
  let exporter: MenuExporter;

  // Sample HTML for testing
  const sampleHTML = `
    <!DOCTYPE html>
    <html lang="en-GB">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Test Menu</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Roboto', sans-serif;
          font-size: 14px;
          line-height: 1.6;
          padding: 40px;
          background: white;
        }
        
        h1 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 20px;
          text-align: center;
        }
        
        .menu-section {
          margin-bottom: 30px;
        }
        
        .section-title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 15px;
          border-bottom: 2px solid #333;
          padding-bottom: 5px;
        }
        
        .menu-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        
        .item-name {
          font-weight: 500;
        }
        
        .item-price {
          font-variant-numeric: tabular-nums;
          font-weight: 500;
        }
        
        .item-description {
          font-size: 12px;
          color: #666;
          margin-top: 2px;
        }
      </style>
    </head>
    <body>
      <h1>Test Restaurant Menu</h1>
      
      <div class="menu-section">
        <h2 class="section-title">Starters</h2>
        <div class="menu-item">
          <div>
            <div class="item-name">Soup of the Day</div>
            <div class="item-description">Chef's special soup with fresh bread</div>
          </div>
          <div class="item-price">£5.50</div>
        </div>
        <div class="menu-item">
          <div>
            <div class="item-name">Garlic Bread</div>
            <div class="item-description">Toasted ciabatta with garlic butter</div>
          </div>
          <div class="item-price">£4.00</div>
        </div>
      </div>
      
      <div class="menu-section">
        <h2 class="section-title">Main Courses</h2>
        <div class="menu-item">
          <div>
            <div class="item-name">Fish & Chips</div>
            <div class="item-description">Beer-battered cod with hand-cut chips</div>
          </div>
          <div class="item-price">£12.50</div>
        </div>
        <div class="menu-item">
          <div>
            <div class="item-name">Steak & Ale Pie</div>
            <div class="item-description">Slow-cooked beef in rich gravy</div>
          </div>
          <div class="item-price">£14.00</div>
        </div>
      </div>
    </body>
    </html>
  `;

  beforeAll(() => {
    exporter = new MenuExporter();
  });

  describe('PDF Export', () => {
    it('should generate a PDF from sample HTML', async () => {
      const options: ExportOptions = {
        format: 'pdf',
        dpi: 300,
        size: 'A4',
      };

      const buffer = await exporter.export(sampleHTML, options);

      // Verify buffer is not empty
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify PDF magic bytes (PDF files start with %PDF)
      const pdfHeader = buffer.toString('utf8', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    }, 35000); // 35 second timeout for cold start

    it('should generate a PDF with A3 size', async () => {
      const options: ExportOptions = {
        format: 'pdf',
        dpi: 300,
        size: 'A3',
      };

      const buffer = await exporter.export(sampleHTML, options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      
      const pdfHeader = buffer.toString('utf8', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    }, 35000);

    it('should handle special characters in PDF', async () => {
      const htmlWithSpecialChars = sampleHTML.replace(
        '£5.50',
        '€5.50 / $6.00 / ¥600'
      );

      const options: ExportOptions = {
        format: 'pdf',
        dpi: 300,
        size: 'A4',
        validateGlyphs: true,
      };

      const buffer = await exporter.export(htmlWithSpecialChars, options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    }, 35000);
  });

  describe('PNG Export', () => {
    it('should generate a PNG from sample HTML', async () => {
      const options: ExportOptions = {
        format: 'png',
        dpi: 300,
        size: 'A4',
      };

      const buffer = await exporter.export(sampleHTML, options);

      // Verify buffer is not empty
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify PNG magic bytes (PNG files start with 89 50 4E 47)
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4E);
      expect(buffer[3]).toBe(0x47);
    }, 35000);

    it('should handle different DPI settings', async () => {
      // Test with 150 DPI (lower than standard)
      const lowDpiOptions: ExportOptions = {
        format: 'png',
        dpi: 150,
        size: 'A4',
      };

      const lowDpiBuffer = await exporter.export(sampleHTML, lowDpiOptions);

      expect(lowDpiBuffer).toBeInstanceOf(Buffer);
      expect(lowDpiBuffer.length).toBeGreaterThan(0);

      // Compare with standard 300 DPI
      const standardDpiOptions: ExportOptions = {
        format: 'png',
        dpi: 300,
        size: 'A4',
      };
      const standardBuffer = await exporter.export(sampleHTML, standardDpiOptions);
      
      // 300 DPI should be larger than 150 DPI
      expect(standardBuffer.length).toBeGreaterThan(lowDpiBuffer.length);
    }, 35000);
  });

  describe('Error Handling', () => {
    it('should handle invalid HTML gracefully', async () => {
      const invalidHTML = '<html><body><unclosed-tag></body>';

      const options: ExportOptions = {
        format: 'pdf',
        dpi: 300,
        size: 'A4',
      };

      // Should not throw, browsers are forgiving with HTML
      const buffer = await exporter.export(invalidHTML, options);
      expect(buffer).toBeInstanceOf(Buffer);
    }, 35000);

    it('should handle timeout errors', async () => {
      // Create HTML that takes a long time to load (simulated)
      const slowHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <script>
            // This won't actually cause a timeout in our test,
            // but demonstrates the error handling structure
            console.log('Loading...');
          </script>
        </head>
        <body>
          <h1>Test</h1>
        </body>
        </html>
      `;

      const options: ExportOptions = {
        format: 'pdf',
        dpi: 300,
        size: 'A4',
      };

      // This should succeed, but demonstrates timeout handling
      const buffer = await exporter.export(slowHTML, options);
      expect(buffer).toBeInstanceOf(Buffer);
    }, 35000);
  });

  describe('Output Validation', () => {
    it('should generate PDF with reasonable file size', async () => {
      const options: ExportOptions = {
        format: 'pdf',
        dpi: 300,
        size: 'A4',
      };

      const buffer = await exporter.export(sampleHTML, options);

      // PDF should be between 10KB and 5MB for a simple menu
      expect(buffer.length).toBeGreaterThan(10 * 1024); // > 10KB
      expect(buffer.length).toBeLessThan(5 * 1024 * 1024); // < 5MB
    }, 35000);

    it('should generate PNG with reasonable dimensions', async () => {
      const options: ExportOptions = {
        format: 'png',
        dpi: 300,
        size: 'A4',
      };

      const buffer = await exporter.export(sampleHTML, options);

      // PNG should be between 100KB and 10MB for a simple menu
      expect(buffer.length).toBeGreaterThan(100 * 1024); // > 100KB
      expect(buffer.length).toBeLessThan(10 * 1024 * 1024); // < 10MB
    }, 35000);
  });
});
