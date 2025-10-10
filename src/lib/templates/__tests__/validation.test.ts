/**
 * Template Descriptor Validation Tests
 */

import { validateDescriptor, validateDescriptorSafe } from '../validation';
import type { TemplateDescriptor } from '../types';

describe('Template Descriptor Validation', () => {
  const validDescriptor: TemplateDescriptor = {
    id: 'test-template',
    name: 'Test Template',
    version: '1.0.0',
    canvas: {
      size: 'A4',
      dpi: 300,
      cols: 2,
      gutter: 20,
      margins: {
        top: 40,
        right: 40,
        bottom: 40,
        left: 40
      }
    },
    layers: {
      background: {
        type: 'solid',
        color: '#FFFFFF'
      }
    },
    fonts: {
      heading: {
        family: 'Playfair Display',
        weight: 700,
        min: 18,
        max: 24,
        tabular: false
      },
      body: {
        family: 'Open Sans',
        weight: 400,
        min: 12,
        max: 14,
        tabular: false
      },
      price: {
        family: 'Open Sans',
        weight: 600,
        min: 12,
        max: 14,
        tabular: true
      }
    },
    textFrames: [
      {
        key: 'main',
        col: 1,
        overflow: ['wrap', 'compact', 'shrink']
      }
    ],
    imageDisplay: 'icon',
    price: {
      currency: 'auto',
      decimals: 2,
      align: 'right'
    },
    limits: {
      nameChars: 50,
      descLinesWeb: 3,
      descLinesPrint: 2
    },
    overflowPolicies: ['wrap', 'compact', 'reflow', 'paginate', 'shrink'],
    accessibility: {
      minBodyPx: 13,
      contrastMin: 4.5
    }
  };

  describe('validateDescriptor', () => {
    it('should validate a correct descriptor', () => {
      expect(() => validateDescriptor(validDescriptor)).not.toThrow();
      const result = validateDescriptor(validDescriptor);
      expect(result.id).toBe('test-template');
    });

    it('should reject descriptor with missing required fields', () => {
      const invalid = { ...validDescriptor };
      delete (invalid as any).id;
      
      expect(() => validateDescriptor(invalid)).toThrow('Template descriptor validation failed');
    });

    it('should reject descriptor with invalid version format', () => {
      const invalid = { ...validDescriptor, version: 'invalid' };
      
      expect(() => validateDescriptor(invalid)).toThrow('Version must be in semver format');
    });

    it('should reject descriptor with invalid DPI', () => {
      const invalid = {
        ...validDescriptor,
        canvas: { ...validDescriptor.canvas, dpi: 150 as any }
      };
      
      expect(() => validateDescriptor(invalid)).toThrow();
    });

    it('should reject descriptor with invalid canvas size', () => {
      const invalid = {
        ...validDescriptor,
        canvas: { ...validDescriptor.canvas, size: 'Letter' as any }
      };
      
      expect(() => validateDescriptor(invalid)).toThrow('Canvas size must be either A4 or A3');
    });

    it('should reject descriptor with min font size greater than max', () => {
      const invalid = {
        ...validDescriptor,
        fonts: {
          ...validDescriptor.fonts,
          body: { ...validDescriptor.fonts.body, min: 20, max: 10 }
        }
      };
      
      expect(() => validateDescriptor(invalid)).toThrow('Minimum font size must be less than or equal to maximum font size');
    });

    it('should reject descriptor with text frame column exceeding canvas columns', () => {
      const invalid = {
        ...validDescriptor,
        textFrames: [
          {
            key: 'main',
            col: 5, // exceeds canvas.cols = 2
            overflow: ['wrap']
          }
        ]
      };
      
      expect(() => validateDescriptor(invalid)).toThrow('Text frame column numbers cannot exceed canvas column count');
    });

    it('should reject descriptor with invalid hex color', () => {
      const invalid = {
        ...validDescriptor,
        layers: {
          background: {
            type: 'solid' as const,
            color: 'red' // invalid hex format
          }
        }
      };
      
      expect(() => validateDescriptor(invalid)).toThrow('Color must be a valid hex color');
    });

    it('should reject raster background without src', () => {
      const invalid = {
        ...validDescriptor,
        layers: {
          background: {
            type: 'raster' as const
            // missing src
          }
        }
      };
      
      expect(() => validateDescriptor(invalid)).toThrow('Raster backgrounds require src');
    });

    it('should reject solid background without color', () => {
      const invalid = {
        ...validDescriptor,
        layers: {
          background: {
            type: 'solid' as const
            // missing color
          }
        }
      };
      
      expect(() => validateDescriptor(invalid)).toThrow('solid backgrounds require color');
    });

    it('should accept descriptor with optional migration field', () => {
      const withMigration = {
        ...validDescriptor,
        migration: {
          from: '0.9.0',
          notes: 'Updated canvas configuration'
        }
      };
      
      expect(() => validateDescriptor(withMigration)).not.toThrow();
    });

    it('should accept descriptor with bleed configuration', () => {
      const withBleed = {
        ...validDescriptor,
        canvas: {
          ...validDescriptor.canvas,
          bleed: 3
        }
      };
      
      expect(() => validateDescriptor(withBleed)).not.toThrow();
    });
  });

  describe('validateDescriptorSafe', () => {
    it('should return success for valid descriptor', () => {
      const result = validateDescriptorSafe(validDescriptor);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should return errors for invalid descriptor', () => {
      const invalid = { ...validDescriptor };
      delete (invalid as any).id;
      
      const result = validateDescriptorSafe(invalid);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should provide detailed error information', () => {
      const invalid = {
        ...validDescriptor,
        version: 'invalid',
        canvas: { ...validDescriptor.canvas, dpi: 150 as any }
      };
      
      const result = validateDescriptorSafe(invalid);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      
      const errorFields = result.errors!.map(e => e.field);
      expect(errorFields).toContain('version');
      expect(errorFields).toContain('canvas.dpi');
    });
  });
});
