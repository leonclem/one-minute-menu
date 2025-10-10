/**
 * Template Descriptor Validation
 * 
 * This module provides schema validation for template descriptors using Zod.
 * It ensures that template JSON files conform to the expected structure and
 * contain valid values before being used by the rendering system.
 */

import { z } from 'zod';
import type { TemplateDescriptor, TemplateValidationError } from './types';

/**
 * Canvas configuration schema
 */
const CanvasConfigSchema = z.object({
  size: z.enum(['A4', 'A3'], {
    errorMap: () => ({ message: 'Canvas size must be either A4 or A3' })
  }),
  dpi: z.union([z.literal(300), z.literal(600)], {
    errorMap: () => ({ message: 'DPI must be either 300 or 600' })
  }),
  cols: z.number().int().positive({
    message: 'Column count must be a positive integer'
  }),
  gutter: z.number().nonnegative({
    message: 'Gutter spacing must be non-negative'
  }),
  margins: z.object({
    top: z.number().nonnegative({ message: 'Top margin must be non-negative' }),
    right: z.number().nonnegative({ message: 'Right margin must be non-negative' }),
    bottom: z.number().nonnegative({ message: 'Bottom margin must be non-negative' }),
    left: z.number().nonnegative({ message: 'Left margin must be non-negative' })
  }),
  bleed: z.number().nonnegative({ message: 'Bleed must be non-negative' }).optional()
});

/**
 * Background layer schema
 */
const BackgroundLayerSchema = z.object({
  type: z.enum(['raster', 'solid'], {
    errorMap: () => ({ message: 'Background type must be either raster or solid' })
  }),
  src: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color (e.g., #FF5733)'
  }).optional(),
  blend: z.enum(['normal', 'multiply', 'overlay']).optional()
}).refine(
  (data) => {
    // If type is raster, src should be provided
    if (data.type === 'raster' && !data.src) {
      return false;
    }
    // If type is solid, color should be provided
    if (data.type === 'solid' && !data.color) {
      return false;
    }
    return true;
  },
  {
    message: 'Raster backgrounds require src, solid backgrounds require color'
  }
);

/**
 * Ornament schema
 */
const OrnamentSchema = z.object({
  type: z.enum(['svg', 'raster']),
  src: z.string().min(1, { message: 'Ornament src cannot be empty' }),
  position: z.object({
    x: z.number(),
    y: z.number()
  })
});

/**
 * Layer configuration schema
 */
const LayerConfigSchema = z.object({
  background: BackgroundLayerSchema,
  ornaments: z.array(OrnamentSchema).optional()
});

/**
 * Font specification schema
 */
const FontSpecSchema = z.object({
  family: z.string().min(1, { message: 'Font family cannot be empty' }),
  weight: z.number().int().min(100).max(900).optional(),
  min: z.number().positive({ message: 'Minimum font size must be positive' }),
  max: z.number().positive({ message: 'Maximum font size must be positive' }),
  tabular: z.boolean().optional()
}).refine(
  (data) => data.min <= data.max,
  {
    message: 'Minimum font size must be less than or equal to maximum font size'
  }
);

/**
 * Font configuration schema
 */
const FontConfigSchema = z.object({
  heading: FontSpecSchema,
  body: FontSpecSchema,
  price: FontSpecSchema
});

/**
 * Overflow policy schema
 */
const OverflowPolicySchema = z.enum(['wrap', 'compact', 'reflow', 'paginate', 'shrink']);

/**
 * Text frame schema
 */
const TextFrameSchema = z.object({
  key: z.string().min(1, { message: 'Text frame key cannot be empty' }),
  col: z.number().int().positive({ message: 'Column number must be a positive integer' }),
  overflow: z.array(OverflowPolicySchema).min(1, {
    message: 'At least one overflow policy must be specified'
  })
});

/**
 * Price configuration schema
 */
const PriceConfigSchema = z.object({
  currency: z.string().min(1, { message: 'Currency cannot be empty' }),
  decimals: z.number().int().nonnegative({ message: 'Decimals must be non-negative' }),
  align: z.enum(['left', 'right'])
});

/**
 * Content limits schema
 */
const ContentLimitsSchema = z.object({
  nameChars: z.number().int().positive({ message: 'Name character limit must be positive' }),
  descLinesWeb: z.number().int().positive({ message: 'Web description line limit must be positive' }),
  descLinesPrint: z.number().int().positive({ message: 'Print description line limit must be positive' })
});

/**
 * Image display mode schema
 */
const ImageDisplayModeSchema = z.enum(['icon', 'thumbnail', 'hero', 'none']);

/**
 * Accessibility configuration schema
 */
const AccessibilityConfigSchema = z.object({
  minBodyPx: z.number().positive({ message: 'Minimum body font size must be positive' }),
  contrastMin: z.number().positive({ message: 'Minimum contrast ratio must be positive' })
});

/**
 * Template migration schema
 */
const TemplateMigrationSchema = z.object({
  from: z.string().min(1, { message: 'Migration from version cannot be empty' }),
  notes: z.string().min(1, { message: 'Migration notes cannot be empty' })
});

/**
 * Complete template descriptor schema
 */
export const TemplateDescriptorSchema = z.object({
  id: z.string().min(1, { message: 'Template ID cannot be empty' }),
  name: z.string().min(1, { message: 'Template name cannot be empty' }),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, {
    message: 'Version must be in semver format (e.g., 1.0.0)'
  }),
  canvas: CanvasConfigSchema,
  layers: LayerConfigSchema,
  fonts: FontConfigSchema,
  textFrames: z.array(TextFrameSchema).min(1, {
    message: 'At least one text frame must be defined'
  }),
  imageDisplay: ImageDisplayModeSchema,
  price: PriceConfigSchema,
  limits: ContentLimitsSchema,
  overflowPolicies: z.array(OverflowPolicySchema).min(1, {
    message: 'At least one overflow policy must be specified'
  }),
  accessibility: AccessibilityConfigSchema,
  migration: TemplateMigrationSchema.optional()
}).refine(
  (data) => {
    // Validate that text frame columns don't exceed canvas columns
    const maxCol = Math.max(...data.textFrames.map(f => f.col));
    return maxCol <= data.canvas.cols;
  },
  {
    message: 'Text frame column numbers cannot exceed canvas column count'
  }
);

/**
 * Validates a template descriptor object against the schema
 * 
 * @param descriptor - The template descriptor to validate
 * @returns Validated template descriptor
 * @throws Error with detailed validation messages if validation fails
 */
export function validateDescriptor(descriptor: unknown): TemplateDescriptor {
  try {
    return TemplateDescriptorSchema.parse(descriptor);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: TemplateValidationError[] = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
      
      const errorMessage = errors
        .map(e => `  - ${e.field}: ${e.message}`)
        .join('\n');
      
      throw new Error(
        `Template descriptor validation failed:\n${errorMessage}`
      );
    }
    throw error;
  }
}

/**
 * Validates a template descriptor and returns validation errors without throwing
 * 
 * @param descriptor - The template descriptor to validate
 * @returns Object with success flag and either data or errors
 */
export function validateDescriptorSafe(descriptor: unknown): {
  success: boolean;
  data?: TemplateDescriptor;
  errors?: TemplateValidationError[];
} {
  const result = TemplateDescriptorSchema.safeParse(descriptor);
  
  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }
  
  const errors: TemplateValidationError[] = result.error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }));
  
  return {
    success: false,
    errors
  };
}
