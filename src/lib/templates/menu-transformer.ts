/**
 * Menu Data Transformer
 * 
 * Transforms database Menu objects into EngineMenu format for the template engine.
 * This separation allows the engine to work with a clean, normalized data structure
 * independent of the database schema.
 */

import type { Menu, MenuItem, MenuCategory } from '@/types'

/**
 * Normalized menu structure for the template engine
 */
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

/**
 * Normalized section (category) structure
 */
export interface EngineSection {
  id: string
  name: string
  sortOrder: number
  items: EngineItem[]
}

/**
 * Normalized menu item structure
 */
export interface EngineItem {
  id: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  sortOrder: number
}

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
 * This function:
 * - Groups items by category into sections (if categories exist)
 * - Creates a single implicit section "Menu" when there are no categories
 * - Ensures consistent sortOrder for sections and items
 * - Normalizes the data structure for the layout engine
 * 
 * @param menu - Database menu object
 * @returns Normalized EngineMenu for template engine
 */
export function toEngineMenu(menu: Menu): EngineMenu {
  // Extract currency from theme or use default
  // TODO: Add currency to Menu model or Theme configuration
  const currency = '$'
  
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
