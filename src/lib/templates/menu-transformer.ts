/**
 * Menu Data Transformer
 * 
 * @module menu-transformer
 * @description
 * Transforms database Menu objects into EngineMenu format for the template engine.
 * This separation allows the engine to work with a clean, normalized data structure
 * independent of the database schema.
 * 
 * @example
 * ```typescript
 * import { toEngineMenu, isEngineMenu } from '@/lib/templates/menu-transformer'
 * 
 * const engineMenu = toEngineMenu(databaseMenu)
 * if (isEngineMenu(data)) {
 *   // Type-safe access to menu data
 * }
 * ```
 */

import type { Menu, MenuItem, MenuCategory } from '@/types'

// Re-export types from engine-types for convenience
// These are the canonical type definitions with Zod schemas
export type { EngineMenu, EngineSection, EngineItem } from './engine-types'

import type { EngineMenu, EngineSection, EngineItem } from './engine-types'

/**
 * Type guard to check if a value is an EngineMenu
 */
export function isEngineMenu(value: unknown): value is EngineMenu {
  if (!value || typeof value !== 'object') return false
  const menu = value as any
  
  return (
    typeof menu.id === 'string' &&
    typeof menu.name === 'string' &&
    Array.isArray(menu.sections) &&
    menu.sections.every(isEngineSection) &&
    typeof menu.metadata === 'object' &&
    typeof menu.metadata.currency === 'string'
  )
}

/**
 * Type guard to check if a value is an EngineSection
 */
export function isEngineSection(value: unknown): value is EngineSection {
  if (!value || typeof value !== 'object') return false
  const section = value as any
  
  return (
    typeof section.id === 'string' &&
    typeof section.name === 'string' &&
    typeof section.sortOrder === 'number' &&
    Array.isArray(section.items) &&
    section.items.every(isEngineItem)
  )
}

/**
 * Type guard to check if a value is an EngineItem
 */
export function isEngineItem(value: unknown): value is EngineItem {
  if (!value || typeof value !== 'object') return false
  const item = value as any
  
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.price === 'number' &&
    typeof item.sortOrder === 'number' &&
    (item.description === undefined || typeof item.description === 'string') &&
    (item.imageUrl === undefined || typeof item.imageUrl === 'string')
  )
}

/**
 * Transform database Menu to EngineMenu
 * 
 * This function converts a raw database Menu object into the normalized
 * EngineMenu format used by the template engine. It handles both
 * categorized menus (with categories) and flat menus (items only).
 * 
 * **What this function does:**
 * - Groups items by category into sections (if categories exist)
 * - Creates a single implicit section "Menu" when there are no categories
 * - Ensures consistent sortOrder for sections and items
 * - Extracts metadata (currency, venue name)
 * - Normalizes image URLs based on imageSource
 * 
 * @param menu - Database menu object
 * @returns Normalized EngineMenu for template engine
 * 
 * @example
 * ```typescript
 * import { toEngineMenu } from '@/lib/templates/menu-transformer'
 * 
 * // From database menu
 * const engineMenu = toEngineMenu(databaseMenu)
 * 
 * console.log(`Menu: ${engineMenu.name}`)
 * console.log(`Sections: ${engineMenu.sections.length}`)
 * engineMenu.sections.forEach(section => {
 *   console.log(`  ${section.name}: ${section.items.length} items`)
 * })
 * ```
 * 
 * @example
 * ```typescript
 * // Flat menu (no categories) becomes single section
 * const flatMenu = { id: '1', name: 'Lunch', items: [...], categories: [] }
 * const engineMenu = toEngineMenu(flatMenu)
 * // engineMenu.sections = [{ id: 'implicit-section', name: 'Menu', items: [...] }]
 * ```
 */
export function toEngineMenu(menu: Menu): EngineMenu {
  // Extract currency from theme layout or use default
  const currency = menu.theme?.layout?.currency ?? '$'
  
  console.log('🔄 [Menu Transformer] Input menu:', {
    id: menu.id,
    name: menu.name,
    itemsCount: menu.items?.length || 0,
    categoriesCount: menu.categories?.length || 0,
    hasItems: !!(menu.items && menu.items.length > 0),
    hasCategories: !!(menu.categories && menu.categories.length > 0)
  })
  
  // Create a lookup map from flat items array for image data
  // This ensures we use the most up-to-date image information even if categories haven't been synced
  const itemsImageLookup = new Map<string, MenuItem>()
  if (menu.items) {
    menu.items.forEach(item => {
      if (item.imageSource !== 'none' || item.aiImageId || item.customImageUrl) {
        itemsImageLookup.set(item.id, item)
      }
    })
  }
  
  // Determine which data source to use with better fallback logic
  const hasValidCategories = menu.categories && menu.categories.length > 0 && 
    menu.categories.some(cat => cat.items && cat.items.length > 0)
  const hasValidItems = menu.items && menu.items.length > 0
  
  // Check for data inconsistency between categories and flat items
  const categoryItemCount = menu.categories ? 
    menu.categories.reduce((sum, cat) => sum + (cat.items?.length || 0), 0) : 0
  const flatItemCount = menu.items?.length || 0
  
  const hasDataInconsistency = hasValidCategories && hasValidItems && 
    categoryItemCount !== flatItemCount
  
  console.log('🔄 [Menu Transformer] Data source decision:', {
    hasValidCategories,
    hasValidItems,
    categoryItemCount,
    flatItemCount,
    hasDataInconsistency,
    willUseCategories: hasValidCategories && !hasDataInconsistency,
    willUseFlatItems: hasValidItems && (!hasValidCategories || hasDataInconsistency)
  })
  
  // If menu has valid categories with items AND no data inconsistency, use them as sections
  if (hasValidCategories && !hasDataInconsistency) {
    const sections = menu.categories!
      .filter(cat => cat.items && cat.items.length > 0) // Only include categories with items
      .map((cat, idx) => transformCategoryWithImageLookup(cat, idx, itemsImageLookup))
      .sort((a, b) => a.sortOrder - b.sortOrder)
    
    console.log('🔄 [Menu Transformer] Using categories, created sections:', sections.length)
    
    return {
      id: menu.id,
      name: menu.name,
      sections,
      metadata: {
        currency,
        venueName: menu.name,
        venueAddress: undefined, // TODO: Add to Menu model
        logoUrl: menu.logoUrl
      }
    }
  }
  
  // Otherwise, create sections from flat items grouped by category
  // This handles both cases: no categories, or categories that are out of sync with items
  if (hasValidItems) {
    // Group items by category
    const categoryGroups = new Map<string, MenuItem[]>()
    
    menu.items!.forEach(item => {
      const categoryName = item.category && item.category.trim() ? item.category.trim() : 'Menu'
      if (!categoryGroups.has(categoryName)) {
        categoryGroups.set(categoryName, [])
      }
      categoryGroups.get(categoryName)!.push(item)
    })
    
    // Convert groups to sections
    const sections = Array.from(categoryGroups.entries()).map(([categoryName, items], idx) => {
      // Use special ID for implicit single section when all items are uncategorized
      const isImplicitSection = categoryGroups.size === 1 && categoryName === 'Menu'
      
      return {
        id: isImplicitSection ? 'implicit-section' : `section-${idx}`,
        name: categoryName,
        sortOrder: idx,
        items: items
          .map((item, itemIdx) => transformItem(item, itemIdx))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      }
    })
    
    console.log('🔄 [Menu Transformer] Using flat items, created sections:', sections.length)
    
    return {
      id: menu.id,
      name: menu.name,
      sections,
      metadata: {
        currency,
        venueName: menu.name,
        venueAddress: undefined,
        logoUrl: menu.logoUrl
      }
    }
  }
  
  // Fallback: empty menu with single empty section
  console.warn('🔄 [Menu Transformer] No valid data found, creating empty menu')
  return {
    id: menu.id,
    name: menu.name,
    sections: [{
      id: 'empty-section',
      name: 'Menu',
      sortOrder: 0,
      items: []
    }],
    metadata: {
      currency,
      venueName: menu.name,
      venueAddress: undefined,
      logoUrl: menu.logoUrl
    }
  }
}

/**
 * Transform MenuCategory to EngineSection
 */
function transformCategory(category: MenuCategory, fallbackOrder: number): EngineSection {
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.order ?? fallbackOrder,
    items: category.items
      .map((item, idx) => transformItem(item, idx))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }
}

/**
 * Transform MenuCategory to EngineSection with image lookup from flat items
 * This ensures image data is used even if categories haven't been synced
 */
function transformCategoryWithImageLookup(
  category: MenuCategory, 
  fallbackOrder: number,
  itemsImageLookup: Map<string, MenuItem>
): EngineSection {
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.order ?? fallbackOrder,
    items: category.items
      .map((item, idx) => transformItemWithImageLookup(item, idx, itemsImageLookup))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }
}

/**
 * Transform MenuItem to EngineItem
 */
function transformItem(item: MenuItem, fallbackOrder: number): EngineItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    imageUrl: getItemImageUrl(item),
    sortOrder: item.order ?? fallbackOrder
  }
}

/**
 * Transform MenuItem to EngineItem with image lookup from flat items
 * Falls back to the flat items array for image data if the category item doesn't have it
 */
function transformItemWithImageLookup(
  item: MenuItem, 
  fallbackOrder: number,
  itemsImageLookup: Map<string, MenuItem>
): EngineItem {
  // First try to get image from the category item itself
  let imageUrl = getItemImageUrl(item)
  
  // If no image URL, check the flat items lookup for updated image data
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
    sortOrder: item.order ?? fallbackOrder
  }
}

/**
 * Get the image URL for a menu item based on its imageSource
 */
function getItemImageUrl(item: MenuItem): string | undefined {
  if (item.imageSource === 'ai') {
    // AI-generated images - URL is populated in customImageUrl by enrichMenuItemsWithImageUrls
    return item.customImageUrl
  }
  
  if (item.imageSource === 'custom' && item.customImageUrl) {
    return item.customImageUrl
  }
  
  return undefined
}
