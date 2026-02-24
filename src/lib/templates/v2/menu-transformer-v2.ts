/**
 * Menu Transformer V2
 *
 * Transforms existing menu data (from Supabase/API) to EngineMenuV2 format.
 *
 * KEY DESIGN DECISIONS:
 * 1. Indicator fields use explicit defaults (never undefined):
 *    - dietary: defaults to empty array []
 *    - allergens: defaults to empty array []
 *    - spiceLevel: defaults to null
 * 2. Deterministic output: consistent ordering, no random IDs
 * 3. Graceful handling of missing/null fields with sensible defaults
 */

import type { Menu, MenuItem, MenuCategory } from '@/types'
import type {
  EngineMenuV2,
  EngineSectionV2,
  EngineItemV2,
  ItemIndicatorsV2,
} from './engine-types-v2'

/**
 * Options for menu transformation
 */
export interface TransformOptionsV2 {
  /** Override currency from menu theme */
  currency?: string
  /** Override venue name */
  venueName?: string
  /** Override venue address */
  venueAddress?: string
  /** Override logo URL */
  logoUrl?: string
}

/**
 * Transform existing menu data to EngineMenuV2 format.
 *
 * This function converts a database Menu object into the V2 engine format,
 * handling both categorized menus (with categories) and flat menus (items only).
 *
 * @param menu - Database menu object
 * @param options - Optional transformation overrides
 * @returns Normalized EngineMenuV2 for V2 layout engine
 *
 * @example
 * ```typescript
 * const engineMenu = transformMenuToV2(databaseMenu)
 * const layout = await generateLayoutV2({
 *   menu: engineMenu,
 *   templateId: '4-column-portrait'
 * })
 * ```
 */
export function transformMenuToV2(
  menu: Menu,
  options?: TransformOptionsV2
): EngineMenuV2 {
  // Extract currency from options, theme, or use default
  const currency =
    options?.currency ?? menu.theme?.layout?.currency ?? '$'

  // Determine which data source to use
  const hasValidCategories =
    menu.categories &&
    menu.categories.length > 0 &&
    menu.categories.some((cat) => cat.items && cat.items.length > 0)

  const hasValidItems = menu.items && menu.items.length > 0

  // Check for data inconsistency between categories and flat items
  const categoryItemCount = menu.categories
    ? menu.categories.reduce((sum, cat) => sum + (cat.items?.length || 0), 0)
    : 0
  const flatItemCount = menu.items?.length || 0
  const hasDataInconsistency =
    hasValidCategories &&
    hasValidItems &&
    categoryItemCount !== flatItemCount

  // Create image lookup map from flat items array
  const itemsImageLookup = new Map<string, MenuItem>()
  if (menu.items) {
    menu.items.forEach((item) => {
      if (
        item.imageSource !== 'none' ||
        item.aiImageId ||
        item.customImageUrl
      ) {
        itemsImageLookup.set(item.id, item)
      }
    })
  }

  let sections: EngineSectionV2[]

  // Use categories if valid and consistent
  if (hasValidCategories && !hasDataInconsistency) {
    sections = menu
      .categories!.filter((cat) => cat.items && cat.items.length > 0)
      .map((cat, idx) =>
        transformCategoryToV2(cat, idx, itemsImageLookup)
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }
  // Otherwise, create sections from flat items grouped by category
  else if (hasValidItems) {
    sections = createSectionsFromFlatItems(menu.items!)
  }
  // Fallback: empty menu with single empty section
  else {
    sections = [
      {
        id: 'empty-section',
        name: 'Menu',
        sortOrder: 0,
        items: [],
      },
    ]
  }

  return {
    id: menu.id,
    name: menu.name,
    sections,
    metadata: {
      currency,
      venueName: options?.venueName ?? menu.name,
      venueAddress: options?.venueAddress ?? menu.venueInfo?.address,
      logoUrl: options?.logoUrl ?? menu.logoUrl,
      establishmentType: menu.establishmentType,
      primaryCuisine: menu.primaryCuisine,
      venueInfo: menu.venueInfo,
    },
  }
}

/**
 * Transform MenuCategory to EngineSectionV2 with image lookup
 */
function transformCategoryToV2(
  category: MenuCategory,
  fallbackOrder: number,
  itemsImageLookup: Map<string, MenuItem>
): EngineSectionV2 {
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.order ?? fallbackOrder,
    items: category.items
      .map((item, idx) =>
        transformItemToV2(item, idx, itemsImageLookup)
      )
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }
}

/**
 * Create sections from flat items array grouped by category
 */
function createSectionsFromFlatItems(
  items: MenuItem[]
): EngineSectionV2[] {
  // Group items by category
  const categoryGroups = new Map<string, MenuItem[]>()

  items.forEach((item) => {
    const categoryName =
      item.category && item.category.trim()
        ? item.category.trim()
        : 'Menu'
    if (!categoryGroups.has(categoryName)) {
      categoryGroups.set(categoryName, [])
    }
    categoryGroups.get(categoryName)!.push(item)
  })

  // Convert groups to sections
  return Array.from(categoryGroups.entries()).map(
    ([categoryName, categoryItems], idx) => {
      // Use special ID for implicit single section when all items are uncategorized
      const isImplicitSection =
        categoryGroups.size === 1 && categoryName === 'Menu'

      return {
        id: isImplicitSection ? 'implicit-section' : `section-${idx}`,
        name: categoryName,
        sortOrder: idx,
        items: categoryItems
          .map((item, itemIdx) =>
            transformItemToV2(item, itemIdx, new Map())
          )
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }
    }
  )
}

/**
 * Transform MenuItem to EngineItemV2 with image lookup
 */
function transformItemToV2(
  item: MenuItem,
  fallbackOrder: number,
  itemsImageLookup: Map<string, MenuItem>
): EngineItemV2 {
  // Get image URL from item or lookup
  let imageUrl = getItemImageUrl(item)
  if (!imageUrl && itemsImageLookup.has(item.id)) {
    const lookupItem = itemsImageLookup.get(item.id)!
    imageUrl = getItemImageUrl(lookupItem)
  }

  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    imageUrl,
    sortOrder: item.order ?? fallbackOrder,
    indicators: transformIndicators(item),
    isFeatured: item.isFeatured ?? false,
  }
}

/**
 * Transform item indicators to V2 format.
 *
 * CRITICAL: All indicator fields use explicit defaults (never undefined):
 * - dietary: empty array [] (never undefined)
 * - allergens: empty array [] (never undefined)
 * - spiceLevel: null (never undefined)
 *
 * This ensures deterministic rendering and simplifies null checks downstream.
 */
function transformIndicators(item: MenuItem): ItemIndicatorsV2 {
  return {
    dietary: (item as any).dietary || [],
    allergens: (item as any).allergens || [],
    spiceLevel: (item as any).spiceLevel !== undefined ? (item as any).spiceLevel : null,
  }
}

/**
 * Get the image URL for a menu item based on its imageSource
 */
function getItemImageUrl(item: MenuItem): string | undefined {
  if (item.imageSource === 'ai') {
    // AI-generated images - URL is populated in customImageUrl
    return item.customImageUrl
  }

  if (item.imageSource === 'custom' && item.customImageUrl) {
    return item.customImageUrl
  }

  return undefined
}

/**
 * Type guard to check if a value is an EngineMenuV2
 */
export function isEngineMenuV2(value: unknown): value is EngineMenuV2 {
  if (!value || typeof value !== 'object') return false
  const menu = value as any

  return (
    typeof menu.id === 'string' &&
    typeof menu.name === 'string' &&
    Array.isArray(menu.sections) &&
    menu.sections.every(isEngineSectionV2) &&
    typeof menu.metadata === 'object' &&
    typeof menu.metadata.currency === 'string'
  )
}

/**
 * Type guard to check if a value is an EngineSectionV2
 */
export function isEngineSectionV2(
  value: unknown
): value is EngineSectionV2 {
  if (!value || typeof value !== 'object') return false
  const section = value as any

  return (
    typeof section.id === 'string' &&
    typeof section.name === 'string' &&
    typeof section.sortOrder === 'number' &&
    Array.isArray(section.items) &&
    section.items.every(isEngineItemV2)
  )
}

/**
 * Type guard to check if a value is an EngineItemV2
 */
export function isEngineItemV2(value: unknown): value is EngineItemV2 {
  if (!value || typeof value !== 'object') return false
  const item = value as any

  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.price === 'number' &&
    typeof item.sortOrder === 'number' &&
    (item.description === undefined ||
      typeof item.description === 'string') &&
    (item.imageUrl === undefined || typeof item.imageUrl === 'string') &&
    typeof item.indicators === 'object' &&
    Array.isArray(item.indicators.dietary) &&
    Array.isArray(item.indicators.allergens) &&
    (item.indicators.spiceLevel === null ||
      typeof item.indicators.spiceLevel === 'number')
  )
}
