/**
 * Type definitions and validation schemas for the Dynamic Menu Layout Engine
 * 
 * This module defines all core data structures used throughout the layout system,
 * including input data, layout configurations, grid structures, and export options.
 */

import { z } from 'zod'

// ============================================================================
// Input Data Structures (normalized from extraction)
// ============================================================================

/**
 * Normalized menu data structure for layout generation
 */
export interface LayoutMenuData {
  metadata: {
    title: string
    currency: string
  }
  sections: LayoutSection[]
}

export interface LayoutSection {
  name: string
  items: LayoutItem[]
}

export interface LayoutItem {
  name: string
  price: number
  description?: string
  imageRef?: string
  featured: boolean
}

// ============================================================================
// Layout Configuration
// ============================================================================

/**
 * Layout preset family types
 */
export type PresetFamily = 'dense' | 'image-forward' | 'balanced' | 'feature-band'

/**
 * Complete layout preset configuration
 */
export interface LayoutPreset {
  id: string
  name: string
  family: PresetFamily
  gridConfig: GridConfig
  tileConfig: TileConfig
  metadataMode: 'overlay' | 'adjacent'
}

/**
 * Grid configuration for responsive layouts
 */
export interface GridConfig {
  columns: {
    mobile: number
    tablet: number
    desktop: number
    print: number
  }
  gap: string // Tailwind spacing class (e.g., 'gap-2', 'gap-4')
  sectionSpacing: string // Tailwind margin class (e.g., 'mb-6', 'mb-8')
}

/**
 * Tile-specific configuration
 */
export interface TileConfig {
  aspectRatio: string // CSS aspect ratio (e.g., '1/1', '4/3', '16/9')
  borderRadius: string // Tailwind class (e.g., 'rounded-md', 'rounded-lg')
  padding: string // Tailwind padding class (e.g., 'p-3', 'p-4')
  textSize: {
    name: string // Tailwind text size (e.g., 'text-sm', 'text-base')
    price: string
    description: string
  }
}

// ============================================================================
// Output Context and Breakpoints
// ============================================================================

/**
 * Target rendering environment
 */
export type OutputContext = 'mobile' | 'tablet' | 'desktop' | 'print'

/**
 * Responsive breakpoint configuration
 */
export interface Breakpoint {
  name: OutputContext
  minWidth: number // Minimum width in pixels
  maxWidth?: number // Maximum width in pixels (optional for largest breakpoint)
  columns: number // Number of grid columns at this breakpoint
}

// ============================================================================
// Grid Layout Result
// ============================================================================

/**
 * Complete grid layout with positioned tiles
 */
export interface GridLayout {
  preset: LayoutPreset
  context: OutputContext
  sections: GridSection[]
  totalTiles: number
}

/**
 * Section within the grid layout
 */
export interface GridSection {
  name: string
  tiles: GridTile[]
  startRow: number
}

/**
 * Union type for all tile types
 */
export type GridTile = ItemTile | FillerTile

/**
 * Tile representing a menu item
 */
export interface ItemTile {
  type: 'item'
  item: LayoutItem
  column: number
  row: number
  span: { columns: number; rows: number }
}

/**
 * Decorative filler tile for dead space
 */
export interface FillerTile {
  type: 'filler'
  style: 'color' | 'pattern' | 'icon'
  content?: string // Icon name or pattern identifier
  column: number
  row: number
  span: { columns: number; rows: number }
}

// ============================================================================
// Theme Configuration
// ============================================================================

/**
 * Template-specific theme configuration
 * Extends the existing theme system with layout-specific settings
 */
export interface TemplateTheme {
  typography: {
    scale: number // Base multiplier for font sizes
    spacing: number // Base spacing unit
    borderRadius: number // Base border radius
  }
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
  }
}

// ============================================================================
// Export Options
// ============================================================================

/**
 * Export format options
 */
export interface ExportOptions {
  format: 'html' | 'pdf' | 'png' | 'jpg'
  pdfOrientation?: 'portrait' | 'landscape'
  imageWidth?: number
  imageHeight?: number
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Schema for validating layout item data
 */
export const LayoutItemSchema = z.object({
  name: z.string().min(1, 'Item name cannot be empty').max(200, 'Item name too long'),
  price: z.number().nonnegative('Price cannot be negative').finite('Price must be a valid number'),
  description: z.string().max(500, 'Description too long').optional(),
  imageRef: z.string().url('Invalid image URL').optional(),
  featured: z.boolean()
})

/**
 * Schema for validating layout section data
 */
export const LayoutSectionSchema = z.object({
  name: z.string().min(1, 'Section name cannot be empty').max(100, 'Section name too long'),
  items: z.array(LayoutItemSchema).min(1, 'Section must have at least one item')
})

/**
 * Schema for validating complete layout menu data
 */
export const LayoutMenuDataSchema = z.object({
  metadata: z.object({
    title: z.string().min(1, 'Menu title cannot be empty').max(200, 'Menu title too long'),
    currency: z.string().min(1, 'Currency cannot be empty').max(10, 'Currency code too long')
  }),
  sections: z.array(LayoutSectionSchema).min(1, 'Menu must have at least one section')
})

/**
 * Schema for validating export options
 */
export const ExportOptionsSchema = z.object({
  format: z.enum(['html', 'pdf', 'png', 'jpg']),
  pdfOrientation: z.enum(['portrait', 'landscape']).optional(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional()
})

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a tile is an ItemTile
 */
export function isItemTile(tile: GridTile): tile is ItemTile {
  return tile.type === 'item'
}

/**
 * Type guard to check if a tile is a FillerTile
 */
export function isFillerTile(tile: GridTile): tile is FillerTile {
  return tile.type === 'filler'
}

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate layout menu data and return typed result
 * @throws {z.ZodError} if validation fails
 */
export function validateLayoutMenuData(data: unknown): LayoutMenuData {
  return LayoutMenuDataSchema.parse(data)
}

/**
 * Validate export options and return typed result
 * @throws {z.ZodError} if validation fails
 */
export function validateExportOptions(options: unknown): ExportOptions {
  return ExportOptionsSchema.parse(options)
}

/**
 * Perform semantic validation on layout menu data
 * Checks for business logic issues beyond schema validation
 */
export interface SemanticValidationError {
  field: string
  message: string
  value?: any
}

export function performSemanticValidation(data: LayoutMenuData): SemanticValidationError[] {
  const errors: SemanticValidationError[] = []

  // Check for duplicate section names
  const sectionNames = new Set<string>()
  for (const section of data.sections) {
    if (sectionNames.has(section.name)) {
      errors.push({
        field: 'sections',
        message: `Duplicate section name: "${section.name}"`,
        value: section.name
      })
    }
    sectionNames.add(section.name)
  }

  // Check for empty sections (should be caught by schema, but double-check)
  for (const section of data.sections) {
    if (section.items.length === 0) {
      errors.push({
        field: `sections.${section.name}`,
        message: `Section "${section.name}" has no items`,
        value: section.items.length
      })
    }
  }

  // Check for negative or zero prices (should be caught by schema, but double-check)
  for (const section of data.sections) {
    for (const item of section.items) {
      if (item.price < 0) {
        errors.push({
          field: `sections.${section.name}.items.${item.name}.price`,
          message: `Item "${item.name}" has negative price`,
          value: item.price
        })
      }
    }
  }

  // Check for extremely long item names that might break layout
  for (const section of data.sections) {
    for (const item of section.items) {
      if (item.name.length > 150) {
        errors.push({
          field: `sections.${section.name}.items.${item.name}.name`,
          message: `Item name is very long (${item.name.length} chars) and may affect layout`,
          value: item.name.length
        })
      }
    }
  }

  // Check for invalid image URLs (basic check beyond schema)
  for (const section of data.sections) {
    for (const item of section.items) {
      if (item.imageRef && !item.imageRef.startsWith('http')) {
        errors.push({
          field: `sections.${section.name}.items.${item.name}.imageRef`,
          message: `Item "${item.name}" has invalid image URL`,
          value: item.imageRef
        })
      }
    }
  }

  return errors
}

/**
 * Check if semantic validation passed (no errors)
 */
export function isSemanticValidationPassed(errors: SemanticValidationError[]): boolean {
  return errors.length === 0
}

// ============================================================================
// Type Exports (for convenience)
// ============================================================================

export type LayoutItemType = z.infer<typeof LayoutItemSchema>
export type LayoutSectionType = z.infer<typeof LayoutSectionSchema>
export type LayoutMenuDataType = z.infer<typeof LayoutMenuDataSchema>
export type ExportOptionsType = z.infer<typeof ExportOptionsSchema>
