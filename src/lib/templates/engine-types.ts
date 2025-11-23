/**
 * GridMenu Template Engine - Type Definitions
 * 
 * This module defines the core types for the template engine including:
 * - MenuTemplate: Declarative template definitions
 * - TileDefinition: Grid cell specifications
 * - GridLayoutDefinition: Complete grid structures
 * - TemplateConstraints: Template limitations
 * - TemplateCapabilities: Supported features
 * - LayoutInstance: Generated layout output
 */

import { z } from 'zod'

// ============================================================================
// Template Identifiers and Enums
// ============================================================================

export type TemplateId = string
export type PageOrientation = 'A4_PORTRAIT' | 'A4_LANDSCAPE'
export type AspectRatioHint = 'A4_PORTRAIT' | 'A4_LANDSCAPE' | 'SQUARE_1080' | 'WEB_FULL'

export type TileType =
  | 'ITEM'              // Menu item with optional image
  | 'ITEM_TEXT_ONLY'    // Menu item without image
  | 'SECTION_HEADER'    // Section name header
  | 'LOGO'              // Restaurant logo placeholder (MVP: text/icon only)
  | 'TITLE'             // Menu title
  | 'TEXT_BLOCK'        // Venue info (address, etc.)
  | 'IMAGE_DECORATION'  // Decorative image/pattern
  | 'SPACER'            // Empty space for breathing room
  | 'QR_CODE'           // Reserved for post-MVP; engine must not depend on this

export type CompatibilityStatus = 'OK' | 'WARNING' | 'INCOMPATIBLE'

// ============================================================================
// Tile Definitions
// ============================================================================

export interface TileDefinition {
  id: string
  type: TileType
  col: number           // 0-based column index
  row: number           // 0-based row index
  colSpan: number       // Width in grid columns
  rowSpan: number       // Height in grid rows
  sectionSlot?: number  // For templates with fixed section regions
  options?: {
    showImage?: boolean
    showDescription?: boolean
    emphasisePrice?: boolean
    align?: 'left' | 'centre' | 'right'
    decorativeVariant?: string
    emphasiseAsHero?: boolean
  }
}

// Zod schema for TileDefinition
export const TileDefinitionSchema = z.object({
  id: z.string(),
  type: z.enum(['ITEM', 'ITEM_TEXT_ONLY', 'SECTION_HEADER', 'LOGO', 'TITLE', 'TEXT_BLOCK', 'IMAGE_DECORATION', 'SPACER', 'QR_CODE']),
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

// ============================================================================
// Grid Layout Definition
// ============================================================================

export interface RepeatPatternConfig {
  fromRow: number              // Starting row for repeat
  rowsPerRepeat: number        // Height of one repeat block
  repeatItemTileIds: string[]  // ITEM tiles in the repeat block
  maxRepeats: number           // Safety cap
  newPagePerRepeat?: boolean   // Each repeat = new page
}

export const RepeatPatternConfigSchema = z.object({
  fromRow: z.number().int().nonnegative(),
  rowsPerRepeat: z.number().int().positive(),
  repeatItemTileIds: z.array(z.string()),
  maxRepeats: z.number().int().positive(),
  newPagePerRepeat: z.boolean().optional()
})

export interface GridLayoutDefinition {
  baseCols: number
  baseRows: number
  tiles: TileDefinition[]
  repeatPattern?: RepeatPatternConfig
}

export const GridLayoutDefinitionSchema = z.object({
  baseCols: z.number().int().positive(),
  baseRows: z.number().int().positive(),
  tiles: z.array(TileDefinitionSchema),
  repeatPattern: RepeatPatternConfigSchema.optional()
})

// ============================================================================
// Template Constraints and Capabilities
// ============================================================================

export interface TemplateConstraints {
  minSections: number
  maxSections: number | 'unbounded'
  minItems: number
  maxItemsPerPage?: number
  hardMaxItems?: number        // Default 150
  requiresImages?: boolean
}

export const TemplateConstraintsSchema = z.object({
  minSections: z.number().int().positive(),
  maxSections: z.union([z.number().int().positive(), z.literal('unbounded')]),
  minItems: z.number().int().positive(),
  maxItemsPerPage: z.number().int().positive().optional(),
  hardMaxItems: z.number().int().positive().optional(),
  requiresImages: z.boolean().optional()
})

export interface TemplateCapabilities {
  supportsImages: boolean
  supportsLogoPlaceholder: boolean
  supportsColourPalettes: boolean
  supportsTextOnlyMode: boolean
  supportsResponsiveWeb: boolean
  autoFillerTiles: boolean  // If true, engine inserts filler tiles in empty spaces
}

export const TemplateCapabilitiesSchema = z.object({
  supportsImages: z.boolean(),
  supportsLogoPlaceholder: z.boolean(),
  supportsColourPalettes: z.boolean(),
  supportsTextOnlyMode: z.boolean(),
  supportsResponsiveWeb: z.boolean(),
  autoFillerTiles: z.boolean()
})

export interface TemplateConfigurationSchema {
  allowColourPalette?: boolean  // Default: false
  allowLogoUpload?: boolean     // Default: false
  allowImageToggle?: boolean    // Default: false
}

export const TemplateConfigurationSchemaSchema = z.object({
  allowColourPalette: z.boolean().optional(),
  allowLogoUpload: z.boolean().optional(),
  allowImageToggle: z.boolean().optional()
})

// ============================================================================
// Menu Template
// ============================================================================

export interface MenuTemplate {
  id: TemplateId
  name: string
  description: string
  thumbnailUrl: string
  aspectRatio: AspectRatioHint
  orientation: PageOrientation
  layout: GridLayoutDefinition
  constraints: TemplateConstraints
  capabilities: TemplateCapabilities
  configurationSchema: TemplateConfigurationSchema
  version: string
  isPostMvp?: boolean  // If true, template not exposed in /available until ready
}

export const MenuTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  thumbnailUrl: z.string().min(1),
  aspectRatio: z.enum(['A4_PORTRAIT', 'A4_LANDSCAPE', 'SQUARE_1080', 'WEB_FULL']),
  orientation: z.enum(['A4_PORTRAIT', 'A4_LANDSCAPE']),
  layout: GridLayoutDefinitionSchema,
  constraints: TemplateConstraintsSchema,
  capabilities: TemplateCapabilitiesSchema,
  configurationSchema: TemplateConfigurationSchemaSchema.optional(),
  version: z.string(),
  isPostMvp: z.boolean().optional()
})

// ============================================================================
// Layout Instance (Output)
// ============================================================================

export interface LayoutInstance {
  templateId: TemplateId
  templateVersion: string
  orientation: PageOrientation
  pages: PageLayout[]
}

export interface PageLayout {
  pageIndex: number
  tiles: TileContentInstance[]
}

export type TileContentInstance =
  | StaticTileInstance
  | SectionHeaderTileInstance
  | MenuItemTileInstance
  | SpacerTileInstance

export interface BaseTileInstance {
  id: string
  type: TileType
  col: number
  row: number
  colSpan: number
  rowSpan: number
}

export interface StaticTileInstance extends BaseTileInstance {
  type: 'TITLE' | 'LOGO' | 'TEXT_BLOCK' | 'IMAGE_DECORATION' | 'QR_CODE'
  content: string
  options?: TileDefinition['options']
}

export interface SectionHeaderTileInstance extends BaseTileInstance {
  type: 'SECTION_HEADER'
  label: string
  sectionId: string
  options?: TileDefinition['options']
}

export interface MenuItemTileInstance extends BaseTileInstance {
  type: 'ITEM' | 'ITEM_TEXT_ONLY'
  itemId: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  showImage: boolean
  options?: TileDefinition['options']
}

export interface SpacerTileInstance extends BaseTileInstance {
  type: 'SPACER'
  backgroundColor?: string
  options?: TileDefinition['options']
}

// ============================================================================
// Compatibility Result
// ============================================================================

export interface CompatibilityResult {
  status: CompatibilityStatus
  message?: string
  warnings: string[]
}

// ============================================================================
// Template Selection
// ============================================================================

export interface MenuTemplateSelection {
  id: string
  menuId: string
  templateId: string
  templateVersion: string
  configuration: {
    textOnly: boolean
    colourPaletteId?: string
    useLogo: boolean
  }
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// Layout Engine Input
// ============================================================================

export interface LayoutEngineInput {
  menu: EngineMenu
  template: MenuTemplate
  selection?: MenuTemplateSelection
}

// ============================================================================
// Engine Menu (Normalized Menu Data)
// ============================================================================

export interface EngineMenu {
  id: string
  name: string
  sections: EngineSection[]
  metadata: {
    currency: string
    venueName?: string
    venueAddress?: string
  }
}

export interface EngineSection {
  id: string
  name: string
  sortOrder: number
  items: EngineItem[]
}

export interface EngineItem {
  id: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  sortOrder: number
}

export const EngineItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  imageUrl: z.string().optional(),
  sortOrder: z.number()
})

export const EngineSectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number(),
  items: z.array(EngineItemSchema)
})

export const EngineMenuSchema = z.object({
  id: z.string(),
  name: z.string(),
  sections: z.array(EngineSectionSchema),
  metadata: z.object({
    currency: z.string(),
    venueName: z.string().optional(),
    venueAddress: z.string().optional()
  })
})
