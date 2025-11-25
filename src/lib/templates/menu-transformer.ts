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
  
  // If menu has categories, use them as sections
  if (menu.categories && menu.categories.length > 0) {
    return {
      id: menu.id,
      name: menu.name,
      sections: menu.categories
        .map((cat, idx) => transformCategory(cat, idx))
        .sort((a, b) => a.sortOrder - b.sortOrder),
      metadata: {
        currency,
        venueName: menu.name,
        venueAddress: undefined // TODO: Add to Menu model
      }
    }
  }
  
  // Otherwise, create implicit "Menu" section from flat items
  return {
    id: menu.id,
    name: menu.name,
    sections: [{
      id: 'implicit-section',
      name: 'Menu',
      sortOrder: 0,
      items: menu.items
        .map((item, idx) => transformItem(item, idx))
        .sort((a, b) => a.sortOrder - b.sortOrder)
    }],
    metadata: {
      currency,
      venueName: menu.name,
      venueAddress: undefined
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
 * Get the image URL for a menu item based on its imageSource
 */
function getItemImageUrl(item: MenuItem): string | undefined {
  if (item.imageSource === 'ai' && item.aiImageId) {
    // TODO: Resolve AI image URL from storage
    // For now, return undefined until AI image resolution is implemented
    return undefined
  }
  
  if (item.imageSource === 'custom' && item.customImageUrl) {
    return item.customImageUrl
  }
  
  return undefined
}
