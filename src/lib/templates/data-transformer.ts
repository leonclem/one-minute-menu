/**
 * Data Transformation Layer
 * 
 * Transforms extraction results (ExtractionResultV2Type or ExtractionResultType) into normalized
 * layout data (LayoutMenuData) for the layout engine.
 */

import type { ExtractionResultV2Type, CategoryV2Type, MenuItemV2Type } from '@/lib/extraction/schema-stage2'
import type { ExtractionResultType, Category, MenuItem } from '@/lib/extraction/schema-stage1'
import type { LayoutMenuData, LayoutSection, LayoutItem } from './types'
import { LayoutMenuDataSchema } from './types'

// Union type for both extraction formats
type ExtractionResult = ExtractionResultV2Type | ExtractionResultType
type CategoryType = CategoryV2Type | Category
type MenuItemType = MenuItemV2Type | MenuItem

/**
 * Transform extraction result to normalized layout data
 * 
 * @param extraction - The extraction result from the AI extraction pipeline (stage1 or stage2)
 * @param menuTitle - Optional menu title (defaults to 'Menu')
 * @returns Validated LayoutMenuData ready for layout generation
 * @throws {Error} if extraction data is invalid
 * @throws {z.ZodError} if the transformed data fails validation
 */
export function transformExtractionToLayout(
  extraction: ExtractionResult | any,
  menuTitle: string = 'Menu'
): LayoutMenuData {
  const sections: LayoutSection[] = []

  // Validate extraction structure
  if (!extraction) {
    throw new Error('Invalid extraction data: extraction is null or undefined')
  }
  
  if (!extraction.menu) {
    throw new Error(`Invalid extraction data: missing 'menu' property. Available keys: ${Object.keys(extraction).join(', ')}`)
  }
  
  if (!extraction.menu.categories) {
    throw new Error(`Invalid extraction data: missing 'menu.categories' property. Menu keys: ${Object.keys(extraction.menu).join(', ')}`)
  }
  
  if (!Array.isArray(extraction.menu.categories)) {
    throw new Error(`Invalid extraction data: 'menu.categories' is not an array, got ${typeof extraction.menu.categories}`)
  }

  // Process all categories (including nested subcategories)
  for (const category of extraction.menu.categories) {
    processCategory(category, sections)
  }

  const layoutData: LayoutMenuData = {
    metadata: {
      title: menuTitle,
      currency: extraction.currency || '$'
    },
    sections
  }

  // Validate transformed data
  const validated = LayoutMenuDataSchema.parse(layoutData)
  return validated
}

/**
 * Recursively process a category and its subcategories
 * Flattens nested categories into a single array of sections
 * Handles both stage1 and stage2 category formats
 */
function processCategory(category: CategoryType, sections: LayoutSection[]): void {
  // Only add category if it has items
  if (category.items.length > 0) {
    const items: LayoutItem[] = category.items.map(item => transformMenuItem(item))
    
    sections.push({
      name: category.name,
      items
    })
  }

  // Recursively process subcategories
  if (category.subcategories && category.subcategories.length > 0) {
    for (const subcategory of category.subcategories) {
      processCategory(subcategory, sections)
    }
  }
}

/**
 * Transform a menu item from extraction format to layout format
 * Handles variants, set menus, and missing prices
 * Works with both stage1 and stage2 item formats
 */
function transformMenuItem(item: MenuItemType): LayoutItem {
  // Determine the price to use
  let price = 0
  
  if (typeof item.price === 'number') {
    // Use base price if available
    price = item.price
  } else if ('variants' in item && item.variants && item.variants.length > 0) {
    // Stage2 format: Use first variant price if no base price
    price = item.variants[0].price
  } else if ('setMenu' in item && item.setMenu) {
    // Stage2 format: For set menus, calculate base price from first option of each course
    price = calculateSetMenuBasePrice(item as MenuItemV2Type)
  }

  return {
    name: item.name,
    price,
    description: item.description,
    imageRef: (item as any).imageRef || undefined, // Preserve imageRef if present
    featured: false // Default value, can be enhanced later
  }
}

/**
 * Calculate base price for a set menu
 * Uses the first option from each course
 */
function calculateSetMenuBasePrice(item: MenuItemV2Type): number {
  if (!item.setMenu) return 0

  let basePrice = 0
  for (const course of item.setMenu.courses) {
    if (course.options.length > 0) {
      const firstOption = course.options[0]
      if (firstOption.priceDelta) {
        basePrice += firstOption.priceDelta
      }
    }
  }

  return basePrice
}

/**
 * Menu characteristics for layout selection
 */
export interface MenuCharacteristics {
  sectionCount: number
  totalItems: number
  avgItemsPerSection: number
  avgNameLength: number
  imageRatio: number // Percentage of items with images (0-100)
  hasDescriptions: boolean
}

/**
 * Analyze menu characteristics for layout selection
 * 
 * Calculates metrics used by the layout selector to choose optimal presets:
 * - Section and item counts
 * - Average items per section
 * - Average item name length
 * - Percentage of items with images
 * - Whether any items have descriptions
 * 
 * @param data - The normalized layout menu data
 * @returns MenuCharacteristics object with calculated metrics
 */
export function analyzeMenuCharacteristics(
  data: LayoutMenuData
): MenuCharacteristics {
  const totalItems = data.sections.reduce((sum, s) => sum + s.items.length, 0)
  
  // Handle edge case of empty menu
  if (totalItems === 0) {
    return {
      sectionCount: data.sections.length,
      totalItems: 0,
      avgItemsPerSection: 0,
      avgNameLength: 0,
      imageRatio: 0,
      hasDescriptions: false
    }
  }

  const itemsWithImages = data.sections.reduce(
    (sum, s) => sum + s.items.filter(i => i.imageRef).length,
    0
  )
  
  const totalNameLength = data.sections.reduce(
    (sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.name.length, 0),
    0
  )
  
  const hasDescriptions = data.sections.some(s =>
    s.items.some(i => i.description && i.description.length > 0)
  )

  return {
    sectionCount: data.sections.length,
    totalItems,
    avgItemsPerSection: totalItems / data.sections.length,
    avgNameLength: totalNameLength / totalItems,
    imageRatio: (itemsWithImages / totalItems) * 100,
    hasDescriptions
  }
}
