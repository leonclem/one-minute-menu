/**
 * Stage 2 Schema Definition for AI Menu Extraction
 *
 * Extends Stage 1 with support for:
 * - Variants (sizes/prices/attributes)
 * - Modifier groups (single/multi select, required/optional)
 * - Additional item info (servedWith, forPax, prepTimeMin, notes)
 * - Set menus with courses and options
 *
 * Backward compatibility: Stage 2 schemas accept Stage 1-shaped items
 * (name, price, description, confidence) without Stage 2 fields.
 */

import { z } from 'zod'

// ============================================================================
// TypeScript Interfaces (for type safety)
// ============================================================================

export interface ItemVariant {
  size?: string
  price: number
  attributes?: Record<string, string | number | boolean>
  confidence?: number
}

export interface ModifierOption {
  name: string
  priceDelta?: number
}

export interface ModifierGroup {
  name: string
  type: 'single' | 'multi'
  required: boolean
  options: ModifierOption[]
}

export interface AdditionalInfo {
  servedWith?: string[]
  forPax?: number
  prepTimeMin?: number
  notes?: string
}

export interface SetMenuOption {
  name: string
  priceDelta?: number
}

export interface SetMenuCourse {
  name: string
  options: SetMenuOption[]
}

export interface SetMenu {
  courses: SetMenuCourse[]
  notes?: string
}

export interface MenuItemV2 {
  name: string
  price?: number // Stage 1 compatibility: base price allowed
  description?: string
  confidence: number
  variants?: ItemVariant[]
  modifierGroups?: ModifierGroup[]
  additional?: AdditionalInfo
  type?: 'standard' | 'set_menu' | 'combo'
  setMenu?: SetMenu // Required if type === 'set_menu'
}

export interface CategoryV2 {
  name: string
  items: MenuItemV2[]
  subcategories?: CategoryV2[]
  confidence: number
}

export interface StructuredMenuV2 {
  categories: CategoryV2[]
}

export interface UncertainItemV2 {
  text: string
  reason: string
  confidence: number
  suggestedCategory?: string
  suggestedPrice?: number
}

export interface SuperfluousTextV2 {
  text: string
  context: string
  confidence: number
}

export interface ExtractionResultV2 {
  menu: StructuredMenuV2
  currency: string
  uncertainItems: UncertainItemV2[]
  superfluousText: SuperfluousTextV2[]
}

// ============================================================================
// Zod Schema Definitions (for runtime validation)
// ============================================================================

export const ItemVariantSchema = z.object({
  size: z.string().max(100).optional(),
  price: z.number().nonnegative('Variant price cannot be negative').finite('Variant price must be a valid number'),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  confidence: z.number().min(0).max(1).optional()
})

export const ModifierOptionSchema = z.object({
  name: z.string().min(1).max(100),
  priceDelta: z.number().finite().optional()
})

export const ModifierGroupSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['single', 'multi']),
  required: z.boolean(),
  options: z.array(ModifierOptionSchema).min(1)
})

export const AdditionalInfoSchema = z.object({
  servedWith: z.array(z.string().min(1)).optional(),
  forPax: z.number().int().positive().optional(),
  prepTimeMin: z.number().int().nonnegative().optional(),
  notes: z.string().max(500).optional()
})

export const SetMenuOptionSchema = z.object({
  name: z.string().min(1).max(200),
  priceDelta: z.number().finite().optional()
})

export const SetMenuCourseSchema = z.object({
  name: z.string().min(1).max(200),
  options: z.array(SetMenuOptionSchema).min(1)
})

export const SetMenuSchema = z.object({
  courses: z.array(SetMenuCourseSchema).min(1),
  notes: z.string().max(500).optional()
})

export const MenuItemV2SchemaBase = z.object({
  name: z.string().min(1, 'Item name cannot be empty').max(200),
  price: z.number().nonnegative().finite().optional(),
  description: z.string().max(500).optional(),
  confidence: z.number().min(0).max(1),
  variants: z.array(ItemVariantSchema).optional(),
  modifierGroups: z.array(ModifierGroupSchema).optional(),
  additional: AdditionalInfoSchema.optional(),
  type: z.enum(['standard', 'set_menu', 'combo']).optional(),
  setMenu: SetMenuSchema.optional()
})

/**
 * Enforce at least one of: price, variants, or setMenu
 * This preserves backward compatibility with Stage 1 (price present)
 */
export const MenuItemV2Schema = MenuItemV2SchemaBase.refine(
  (val) => typeof val.price === 'number' || (Array.isArray(val.variants) && val.variants.length > 0) || !!val.setMenu,
  {
    message: 'Menu item must have a price, at least one variant, or a set menu',
    path: ['price']
  }
).refine(
  (val) => (val.type === 'set_menu' ? !!val.setMenu : true),
  { message: 'setMenu details required when type is set_menu', path: ['setMenu'] }
)

export const CategoryV2Schema: z.ZodType<CategoryV2> = z.lazy(() => z.object({
  name: z.string().min(1).max(100),
  items: z.array(MenuItemV2Schema),
  subcategories: z.array(CategoryV2Schema).optional(),
  confidence: z.number().min(0).max(1)
}))

export const StructuredMenuV2Schema = z.object({
  categories: z.array(CategoryV2Schema).min(1)
})

export const UncertainItemV2Schema = z.object({
  text: z.string().min(1),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1),
  suggestedCategory: z.string().optional(),
  suggestedPrice: z.number().nonnegative().optional()
})

export const SuperfluousTextV2Schema = z.object({
  text: z.string().min(1),
  context: z.string().min(1),
  confidence: z.number().min(0).max(1)
})

export const ExtractionResultV2Schema = z.object({
  menu: StructuredMenuV2Schema,
  currency: z.string().min(1).max(10),
  uncertainItems: z.array(UncertainItemV2Schema),
  superfluousText: z.array(SuperfluousTextV2Schema)
})

// ============================================================================
// Schema Version
// ============================================================================

export const SCHEMA_VERSION_V2 = 'stage2' as const
export const SCHEMA_VERSION_NUMBER_V2 = '2.0.0' as const

// ============================================================================
// Type Exports (inferred from Zod schemas)
// ============================================================================

export type ItemVariantType = z.infer<typeof ItemVariantSchema>
export type ModifierOptionType = z.infer<typeof ModifierOptionSchema>
export type ModifierGroupType = z.infer<typeof ModifierGroupSchema>
export type AdditionalInfoType = z.infer<typeof AdditionalInfoSchema>
export type SetMenuOptionType = z.infer<typeof SetMenuOptionSchema>
export type SetMenuCourseType = z.infer<typeof SetMenuCourseSchema>
export type SetMenuType = z.infer<typeof SetMenuSchema>
export type MenuItemV2Type = z.infer<typeof MenuItemV2Schema>
export type CategoryV2Type = z.infer<typeof CategoryV2Schema>
export type StructuredMenuV2Type = z.infer<typeof StructuredMenuV2Schema>
export type UncertainItemV2Type = z.infer<typeof UncertainItemV2Schema>
export type SuperfluousTextV2Type = z.infer<typeof SuperfluousTextV2Schema>
export type ExtractionResultV2Type = z.infer<typeof ExtractionResultV2Schema>


