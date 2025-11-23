/**
 * Template Validator
 * 
 * Validates template definitions against schemas using Zod.
 * Ensures templates are well-formed before use in the layout engine.
 */

import { z } from 'zod'
import type { MenuTemplate } from './engine-types'
import { TemplateValidationError } from './engine-errors'

/**
 * Zod schema for TileDefinition
 */
const TileDefinitionSchema = z.object({
  id: z.string(),
  type: z.enum([
    'ITEM',
    'ITEM_TEXT_ONLY',
    'SECTION_HEADER',
    'LOGO',
    'TITLE',
    'TEXT_BLOCK',
    'IMAGE_DECORATION',
    'SPACER',
    'QR_CODE'
  ]),
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
  colSpan: z.number().int().positive(),
  rowSpan: z.number().int().positive(),
  sectionSlot: z.number().int().nonnegative().optional(),
  options: z.object({
    showImage: z.boolean().optional(),
    showDescription: z.boolean().optional(),
    emphasisePrice: z.boolean().optional(),
    align: z.enum(['left', 'centre', 'right']).optional(),
    decorativeVariant: z.string().optional(),
    emphasiseAsHero: z.boolean().optional()
  }).optional()
})

/**
 * Zod schema for RepeatPatternConfig
 */
const RepeatPatternConfigSchema = z.object({
  fromRow: z.number().int().nonnegative(),
  rowsPerRepeat: z.number().int().positive(),
  repeatItemTileIds: z.array(z.string()),
  maxRepeats: z.number().int().positive(),
  newPagePerRepeat: z.boolean().optional()
})

/**
 * Zod schema for GridLayoutDefinition
 */
const GridLayoutDefinitionSchema = z.object({
  baseCols: z.number().int().positive(),
  baseRows: z.number().int().positive(),
  tiles: z.array(TileDefinitionSchema),
  repeatPattern: RepeatPatternConfigSchema.optional()
})

/**
 * Zod schema for TemplateConstraints
 */
const TemplateConstraintsSchema = z.object({
  minSections: z.number().int().positive(),
  maxSections: z.union([z.number().int().positive(), z.literal('unbounded')]),
  minItems: z.number().int().positive(),
  maxItemsPerPage: z.number().int().positive().optional(),
  hardMaxItems: z.number().int().positive().optional(),
  requiresImages: z.boolean().optional()
})

/**
 * Zod schema for TemplateCapabilities
 */
const TemplateCapabilitiesSchema = z.object({
  supportsImages: z.boolean(),
  supportsLogoPlaceholder: z.boolean(),
  supportsColourPalettes: z.boolean(),
  supportsTextOnlyMode: z.boolean(),
  supportsResponsiveWeb: z.boolean(),
  autoFillerTiles: z.boolean()
})

/**
 * Zod schema for TemplateConfigurationSchema
 */
const TemplateConfigurationSchemaSchema = z.object({
  allowColourPalette: z.boolean().optional(),
  allowLogoUpload: z.boolean().optional(),
  allowImageToggle: z.boolean().optional()
}).optional()

/**
 * Zod schema for MenuTemplate
 */
const MenuTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  thumbnailUrl: z.string().min(1),
  aspectRatio: z.enum(['A4_PORTRAIT', 'A4_LANDSCAPE', 'SQUARE_1080', 'WEB_FULL']),
  orientation: z.enum(['A4_PORTRAIT', 'A4_LANDSCAPE']),
  layout: GridLayoutDefinitionSchema,
  constraints: TemplateConstraintsSchema,
  capabilities: TemplateCapabilitiesSchema,
  configurationSchema: TemplateConfigurationSchemaSchema,
  isPostMvp: z.boolean().optional(),
  version: z.string()
})

/**
 * Validate a template definition
 * 
 * @param template - Template object to validate
 * @returns Validated MenuTemplate
 * @throws TemplateValidationError if validation fails
 */
export function validateTemplate(template: unknown): MenuTemplate {
  try {
    return MenuTemplateSchema.parse(template) as MenuTemplate
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new TemplateValidationError(
        'Template validation failed',
        { errors: error.errors }
      )
    }
    throw error
  }
}
