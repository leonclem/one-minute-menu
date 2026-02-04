/**
 * Stage 1 Schema Definition for AI Menu Extraction
 * 
 * This schema defines the basic structured extraction format:
 * - Hierarchical categories and subcategories
 * - Basic menu items (name, price, description)
 * - Confidence scoring
 * - Uncertain items and superfluous text handling
 */

import { z } from 'zod'

// ============================================================================
// TypeScript Interfaces (for type safety)
// ============================================================================

export interface MenuItem {
  name: string
  price: number
  description?: string
  confidence: number
}

export interface Category {
  name: string
  items: MenuItem[]
  subcategories?: Category[]
  confidence: number
}

export interface StructuredMenu {
  categories: Category[]
}

export interface UncertainItem {
  text: string
  reason: string
  confidence: number
  suggestedCategory?: string
  suggestedPrice?: number
}

export interface SuperfluousText {
  text: string
  context: string
  confidence: number
}

export interface ExtractionResult {
  menu: StructuredMenu
  currency: string
  uncertainItems: UncertainItem[]
  superfluousText: SuperfluousText[]
}

// ============================================================================
// Zod Schema Definitions (for runtime validation)
// ============================================================================

/**
 * Menu Item Schema
 * Validates individual menu items with name, price, and optional description
 */
export const MenuItemSchema = z.object({
  name: z.string().min(1, 'Item name cannot be empty').max(200, 'Item name too long'),
  price: z.number().nonnegative('Price cannot be negative').finite('Price must be a valid number'),
  description: z.string().max(500, 'Description too long').optional(),
  confidence: z.number().min(0, 'Confidence must be >= 0').max(1, 'Confidence must be <= 1')
})

/**
 * Category Schema (recursive for subcategories)
 * Validates hierarchical category structure
 */
export const CategorySchema: z.ZodType<Category> = z.lazy(() => z.object({
  name: z.string().min(1, 'Category name cannot be empty').max(100, 'Category name too long'),
  items: z.array(MenuItemSchema),
  subcategories: z.array(z.lazy(() => CategorySchema)).optional(),
  confidence: z.number().min(0, 'Confidence must be >= 0').max(1, 'Confidence must be <= 1')
})) as any

/**
 * Structured Menu Schema
 * Top-level menu structure with categories
 */
export const StructuredMenuSchema = z.object({
  categories: z.array(CategorySchema).min(1, 'Menu must have at least one category')
})

/**
 * Uncertain Item Schema
 * Items that couldn't be extracted with confidence
 */
export const UncertainItemSchema = z.object({
  text: z.string().min(1, 'Uncertain item text cannot be empty'),
  reason: z.string().min(1, 'Reason cannot be empty'),
  confidence: z.number().min(0).max(1),
  suggestedCategory: z.string().optional(),
  suggestedPrice: z.number().nonnegative().optional()
})

/**
 * Superfluous Text Schema
 * Decorative or non-menu text detected in the image
 */
export const SuperfluousTextSchema = z.object({
  text: z.string().min(1, 'Superfluous text cannot be empty'),
  context: z.string().min(1, 'Context cannot be empty'),
  confidence: z.number().min(0).max(1)
})

/**
 * Complete Extraction Result Schema
 * Full output from vision-LLM extraction
 */
export const ExtractionResultSchema = z.object({
  menu: StructuredMenuSchema,
  currency: z.string().min(1, 'Currency cannot be empty').max(10, 'Currency code too long'),
  uncertainItems: z.array(UncertainItemSchema),
  superfluousText: z.array(SuperfluousTextSchema)
})

// ============================================================================
// Schema Version
// ============================================================================

export const SCHEMA_VERSION = 'stage1' as const
export const SCHEMA_VERSION_NUMBER = '1.0.0' as const

// ============================================================================
// Type Exports (inferred from Zod schemas)
// ============================================================================

export type MenuItemType = z.infer<typeof MenuItemSchema>
export type CategoryType = z.infer<typeof CategorySchema>
export type StructuredMenuType = z.infer<typeof StructuredMenuSchema>
export type UncertainItemType = z.infer<typeof UncertainItemSchema>
export type SuperfluousTextType = z.infer<typeof SuperfluousTextSchema>
export type ExtractionResultType = z.infer<typeof ExtractionResultSchema>
