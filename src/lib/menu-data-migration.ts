/**
 * Menu Data Migration Utilities
 * 
 * Handles migration between Stage 1 and Stage 2 menu data structures
 * Maintains backward compatibility with flat items array
 */

import type { Menu, MenuItem, MenuCategory, ExtractionMetadata } from '@/types'

/**
 * Migrates Stage 1 menu data (flat items) to Stage 2 (hierarchical categories)
 * Groups items by category and creates a hierarchical structure
 */
export function migrateStage1ToStage2(menu: Menu): Menu {
  // If already has categories, no migration needed
  if (menu.categories && menu.categories.length > 0) {
    return menu
  }

  // Group items by category
  const categoryMap = new Map<string, MenuItem[]>()
  const uncategorizedItems: MenuItem[] = []

  menu.items.forEach(item => {
    const categoryName = item.category || 'Uncategorized'
    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, [])
    }
    categoryMap.get(categoryName)!.push(item)
  })

  // Create category structure
  const categories: MenuCategory[] = []
  let order = 0

  categoryMap.forEach((items, categoryName) => {
    categories.push({
      id: generateCategoryId(),
      name: categoryName,
      items: items,
      order: order++,
      confidence: calculateAverageConfidence(items),
    })
  })

  // Sort categories by order (which preserves original item order)
  categories.sort((a, b) => a.order - b.order)

  return {
    ...menu,
    categories,
    extractionMetadata: menu.extractionMetadata || {
      schemaVersion: 'stage1',
      promptVersion: 'legacy',
      confidence: calculateAverageConfidence(menu.items),
      extractedAt: new Date(),
    }
  }
}

/**
 * Flattens Stage 2 hierarchical categories back to Stage 1 flat items array
 * Maintains backward compatibility with existing code
 */
export function flattenCategoriesToItems(categories: MenuCategory[]): MenuItem[] {
  const items: MenuItem[] = []
  
  function flattenCategory(category: MenuCategory, parentPath: string = '') {
    const categoryPath = parentPath ? `${parentPath} > ${category.name}` : category.name
    
    // Add items from this category
    category.items.forEach(item => {
      items.push({
        ...item,
        category: categoryPath,
      })
    })
    
    // Recursively flatten subcategories
    if (category.subcategories) {
      category.subcategories.forEach(subcat => {
        flattenCategory(subcat, categoryPath)
      })
    }
  }
  
  categories.forEach(category => flattenCategory(category))
  
  // Reorder items
  return items.map((item, index) => ({
    ...item,
    order: index,
  }))
}

/**
 * Ensures menu has both items and categories for backward compatibility
 * If categories exist but items is empty, flatten categories to items
 * If items exist but categories is empty, create categories from items
 */
export function ensureBackwardCompatibility(menu: Menu): Menu {
  // Case 1: Has categories but no items - flatten categories
  if (menu.categories && menu.categories.length > 0 && menu.items.length === 0) {
    return {
      ...menu,
      items: flattenCategoriesToItems(menu.categories),
    }
  }
  
  // Case 2: Has items but no categories - create categories
  if (menu.items.length > 0 && (!menu.categories || menu.categories.length === 0)) {
    return migrateStage1ToStage2(menu)
  }
  
  // Case 3: Has both or has neither - no change needed
  return menu
}

/**
 * Converts extraction result from Stage 2 format to Menu structure
 */
export function extractionResultToMenu(
  extractionResult: any,
  menuId: string,
  userId: string,
  menuName: string,
  slug: string,
  schemaVersion: 'stage1' | 'stage2',
  promptVersion: string,
  jobId?: string
): Partial<Menu> {
  const categories: MenuCategory[] = []
  
  function convertCategory(cat: any, order: number): MenuCategory {
    const items: MenuItem[] = cat.items.map((item: any, idx: number) => ({
      id: generateItemId(),
      name: item.name,
      description: item.description,
      price: item.price || (item.variants && item.variants.length > 0 ? item.variants[0].price : 0),
      available: true,
      category: cat.name,
      order: idx,
      confidence: item.confidence,
      variants: item.variants,
      modifierGroups: item.modifierGroups,
      additional: item.additional,
      type: item.type,
      setMenu: item.setMenu,
      imageSource: 'none' as const,
    }))
    
    const subcategories = cat.subcategories?.map((subcat: any, idx: number) => 
      convertCategory(subcat, idx)
    )
    
    return {
      id: generateCategoryId(),
      name: cat.name,
      items,
      subcategories,
      confidence: cat.confidence,
      order,
    }
  }
  
  if (extractionResult.menu?.categories) {
    extractionResult.menu.categories.forEach((cat: any, idx: number) => {
      categories.push(convertCategory(cat, idx))
    })
  }
  
  // Flatten categories to items for backward compatibility
  const items = flattenCategoriesToItems(categories)
  
  const extractionMetadata: ExtractionMetadata = {
    schemaVersion,
    promptVersion,
    confidence: extractionResult.confidence || calculateAverageConfidence(items),
    extractedAt: new Date(),
    jobId,
  }
  
  return {
    items,
    categories,
    extractionMetadata,
  }
}

/**
 * Validates that menu data is consistent between items and categories
 */
export function validateMenuDataConsistency(menu: Menu): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check if both items and categories exist
  if (menu.items.length > 0 && menu.categories && menu.categories.length > 0) {
    // Count items in categories
    const categoryItemCount = countItemsInCategories(menu.categories)
    
    if (categoryItemCount !== menu.items.length) {
      errors.push(`Item count mismatch: ${menu.items.length} items but ${categoryItemCount} in categories`)
    }
  }
  
  // Check for duplicate item IDs
  const itemIds = new Set<string>()
  menu.items.forEach(item => {
    if (itemIds.has(item.id)) {
      errors.push(`Duplicate item ID: ${item.id}`)
    }
    itemIds.add(item.id)
  })
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

// Helper functions

function generateCategoryId(): string {
  return `cat_${Math.random().toString(36).substr(2, 9)}`
}

function generateItemId(): string {
  return `item_${Math.random().toString(36).substr(2, 9)}`
}

function calculateAverageConfidence(items: MenuItem[]): number {
  if (items.length === 0) return 1.0
  
  const total = items.reduce((sum, item) => sum + (item.confidence || 1.0), 0)
  return total / items.length
}

function countItemsInCategories(categories: MenuCategory[]): number {
  let count = 0
  
  function countCategory(category: MenuCategory) {
    count += category.items.length
    if (category.subcategories) {
      category.subcategories.forEach(countCategory)
    }
  }
  
  categories.forEach(countCategory)
  return count
}


/**
 * Prepares menu data for publishing
 * Ensures all required fields are present and data is consistent
 */
export function prepareMenuForPublishing(menu: Menu): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Validate menu has items
  if (menu.items.length === 0) {
    errors.push('Menu must have at least one item')
  }
  
  // Validate all items have required fields
  menu.items.forEach((item, index) => {
    if (!item.name || item.name.trim() === '') {
      errors.push(`Item ${index + 1} is missing a name`)
    }
    if (typeof item.price !== 'number' || item.price < 0) {
      errors.push(`Item ${index + 1} has invalid price`)
    }
  })
  
  // Validate data consistency
  const consistency = validateMenuDataConsistency(menu)
  if (!consistency.valid) {
    errors.push(...consistency.errors)
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Gets all items from a menu, whether stored in flat items array or hierarchical categories
 */
export function getAllMenuItems(menu: Menu): MenuItem[] {
  // If categories exist and have items, use those
  if (menu.categories && menu.categories.length > 0) {
    return flattenCategoriesToItems(menu.categories)
  }
  
  // Otherwise use flat items array
  return menu.items
}

/**
 * Updates a specific item in the menu, handling both flat and hierarchical structures
 */
export function updateMenuItem(menu: Menu, itemId: string, updates: Partial<MenuItem>): Menu {
  // Update in flat items array
  const updatedItems = menu.items.map(item =>
    item.id === itemId ? { ...item, ...updates } : item
  )
  
  // Update in categories if they exist
  let updatedCategories = menu.categories
  if (updatedCategories) {
    updatedCategories = updateItemInCategories(updatedCategories, itemId, updates)
  }
  
  return {
    ...menu,
    items: updatedItems,
    categories: updatedCategories,
  }
}

function updateItemInCategories(
  categories: MenuCategory[],
  itemId: string,
  updates: Partial<MenuItem>
): MenuCategory[] {
  return categories.map(category => ({
    ...category,
    items: category.items.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    ),
    subcategories: category.subcategories
      ? updateItemInCategories(category.subcategories, itemId, updates)
      : undefined,
  }))
}
