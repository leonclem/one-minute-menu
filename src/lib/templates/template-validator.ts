/**
 * Template Validator
 * 
 * @module template-validator
 * @description
 * Validates template definitions against schemas using Zod.
 * Ensures templates are well-formed before use in the layout engine.
 * 
 * This module provides runtime validation for template objects,
 * useful for validating external templates or during development.
 * 
 * @example
 * ```typescript
 * import { validateTemplate } from '@/lib/templates/template-validator'
 * 
 * const validTemplate = validateTemplate(untrustedTemplateObject)
 * ```
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
 * Zod schema for TemplateColorPalette
 */
const TemplateColorPaletteSchema = z.object({
  id: z.string(),
  name: z.string(),
  background: z.string(),
  text: z.string(),
  heading: z.string(),
  price: z.string(),
  accent: z.string(),
  cardBackground: z.string()
})

/**
 * Zod schema for TemplateItemCardStyle
 */
const TemplateItemCardStyleSchema = z.object({
  borderRadius: z.string(),
  shadow: z.string(),
  imagePosition: z.enum(['top', 'left', 'circle', 'background', 'none']),
  imageBorderRadius: z.string().optional(),
  showLeaderDots: z.boolean().optional()
})

/**
 * Zod schema for TemplateStyle
 */
const TemplateStyleSchema = z.object({
  colors: TemplateColorPaletteSchema,
  alternatePalettes: z.array(TemplateColorPaletteSchema).optional(),
  fonts: z.object({
    heading: z.string(),
    body: z.string()
  }),
  itemCard: TemplateItemCardStyleSchema,
  pageBackground: z.string().optional(),
  fillerTileStyle: z.enum(['icon', 'pattern', 'color']).optional()
})

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
  style: TemplateStyleSchema,
  isPostMvp: z.boolean().optional(),
  version: z.string()
})

/**
 * Validate a template definition against the schema
 * 
 * This function validates that a template object conforms to the
 * MenuTemplate schema. It should be used to validate external or
 * user-provided template definitions before use.
 * 
 * @param template - Template object to validate (can be unknown type)
 * @returns Validated MenuTemplate with correct types
 * @throws {TemplateValidationError} If validation fails with detailed error info
 * 
 * @example
 * ```typescript
 * import { validateTemplate } from '@/lib/templates/template-validator'
 * 
 * try {
 *   const validTemplate = validateTemplate(userProvidedTemplate)
 *   console.log(`Template "${validTemplate.name}" is valid`)
 * } catch (error) {
 *   if (error instanceof TemplateValidationError) {
 *     console.error('Validation failed:', error.details?.errors)
 *   }
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Validate all templates in registry
 * import { TEMPLATE_REGISTRY } from '@/lib/templates/template-definitions'
 * 
 * Object.values(TEMPLATE_REGISTRY).forEach(template => {
 *   validateTemplate(template) // Throws if invalid
 * })
 * ```
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
