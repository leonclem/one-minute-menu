/**
 * Template Compatibility Checker
 * 
 * This is the SINGLE SOURCE OF TRUTH for all constraint checking.
 * Evaluates whether a template is compatible with a given menu and provides
 * clear feedback about compatibility status and any issues.
 * 
 * The checker evaluates:
 * - Section count constraints (minSections, maxSections)
 * - Item count constraints (minItems, hardMaxItems)
 * - Image availability requirements
 * - Template capacity vs menu size
 */

import type { EngineMenu } from './menu-transformer'
import type { MenuTemplate, CompatibilityResult, CompatibilityStatus } from './engine-types'
import { TEMPLATE_ENGINE_CONFIG } from './engine-config'

/**
 * Check if a template is compatible with a menu
 * 
 * This function is the **single source of truth** for all constraint checking.
 * It evaluates section counts, item counts, image requirements, and capacity.
 * 
 * The compatibility checker returns one of three statuses:
 * - **OK**: Template works well with the menu
 * - **WARNING**: Template works but with caveats (e.g., missing images)
 * - **INCOMPATIBLE**: Template cannot handle the menu (e.g., too many items)
 * 
 * @param menu - Normalized menu data (from toEngineMenu)
 * @param template - Template definition to check against
 * @returns Compatibility result with status, message, and warnings
 * 
 * @example
 * ```typescript
 * import { checkCompatibility } from '@/lib/templates/compatibility-checker'
 * import { toEngineMenu } from '@/lib/templates/menu-transformer'
 * import { CLASSIC_GRID_CARDS } from '@/lib/templates/template-definitions'
 * 
 * const engineMenu = toEngineMenu(databaseMenu)
 * const result = checkCompatibility(engineMenu, CLASSIC_GRID_CARDS)
 * 
 * switch (result.status) {
 *   case 'OK':
 *     console.log('Template is compatible!')
 *     break
 *   case 'WARNING':
 *     console.log('Template works with warnings:', result.warnings)
 *     break
 *   case 'INCOMPATIBLE':
 *     console.log('Cannot use template:', result.message)
 *     break
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Check all templates for a menu
 * import { getMvpTemplates } from '@/lib/templates/template-definitions'
 * 
 * const templates = getMvpTemplates()
 * const compatibleTemplates = templates.filter(template => {
 *   const result = checkCompatibility(engineMenu, template)
 *   return result.status !== 'INCOMPATIBLE'
 * })
 * ```
 */
export function checkCompatibility(
  menu: EngineMenu,
  template: MenuTemplate
): CompatibilityResult {
  const warnings: string[] = []
  
  // Count sections and items
  const sectionCount = menu.sections.length
  const totalItems = menu.sections.reduce((sum, s) => sum + s.items.length, 0)
  const itemsWithImages = menu.sections.reduce(
    (sum, s) => sum + s.items.filter(i => i.imageUrl).length,
    0
  )
  const imageRatio = totalItems > 0 ? (itemsWithImages / totalItems) * 100 : 0
  
  // Check section constraints
  if (sectionCount < template.constraints.minSections) {
    return {
      status: 'INCOMPATIBLE',
      message: `This template requires at least ${template.constraints.minSections} section${template.constraints.minSections > 1 ? 's' : ''}, but your menu has ${sectionCount}`,
      warnings
    }
  }
  
  if (template.constraints.maxSections !== 'unbounded' && 
      sectionCount > template.constraints.maxSections) {
    return {
      status: 'INCOMPATIBLE',
      message: `This template supports up to ${template.constraints.maxSections} section${template.constraints.maxSections > 1 ? 's' : ''}, but your menu has ${sectionCount}`,
      warnings
    }
  }
  
  // Check item constraints
  if (totalItems < template.constraints.minItems) {
    return {
      status: 'INCOMPATIBLE',
      message: `This template requires at least ${template.constraints.minItems} item${template.constraints.minItems > 1 ? 's' : ''}, but your menu has ${totalItems}`,
      warnings
    }
  }
  
  // Check hard maximum items
  const hardMax = template.constraints.hardMaxItems || TEMPLATE_ENGINE_CONFIG.hardMaxItemsDefault
  if (totalItems > hardMax) {
    return {
      status: 'INCOMPATIBLE',
      message: `This template supports up to ${hardMax} items, but your menu has ${totalItems}`,
      warnings
    }
  }
  
  // Check image requirements
  if (template.constraints.requiresImages && imageRatio < 50) {
    warnings.push(
      `This template works best with images. Only ${Math.round(imageRatio)}% of your items have images.`
    )
  }
  
  // Check capacity
  const capacity = calculateTemplateCapacity(template)
  if (totalItems > capacity.comfortable) {
    warnings.push(
      `This template is designed for ${capacity.comfortable} items. Your menu has ${totalItems} items, which may affect layout quality.`
    )
  }
  
  return {
    status: warnings.length > 0 ? 'WARNING' : 'OK',
    warnings
  }
}

/**
 * Calculate the comfortable and maximum capacity of a template
 * 
 * Comfortable capacity is the base capacity plus 60% of repeat capacity.
 * Maximum capacity is the base capacity plus full repeat capacity.
 * 
 * @param template - Template definition
 * @returns Object with comfortable and maximum item counts
 * 
 * @example
 * ```typescript
 * import { calculateTemplateCapacity } from '@/lib/templates/compatibility-checker'
 * import { CLASSIC_GRID_CARDS } from '@/lib/templates/template-definitions'
 * 
 * const capacity = calculateTemplateCapacity(CLASSIC_GRID_CARDS)
 * console.log(`Comfortable: ${capacity.comfortable} items`)
 * console.log(`Maximum: ${capacity.maximum} items`)
 * ```
 */
export function calculateTemplateCapacity(template: MenuTemplate): { 
  comfortable: number
  maximum: number 
} {
  // Count ITEM and ITEM_TEXT_ONLY tiles in base layout
  const itemTiles = template.layout.tiles.filter(t => 
    t.type === 'ITEM' || t.type === 'ITEM_TEXT_ONLY'
  ).length
  
  // Calculate capacity from repeat pattern if defined
  const repeatCapacity = template.layout.repeatPattern
    ? template.layout.repeatPattern.repeatItemTileIds.length * 
      template.layout.repeatPattern.maxRepeats
    : 0
  
  // Comfortable capacity is base + 60% of repeat capacity
  // Maximum capacity is base + full repeat capacity
  return {
    comfortable: itemTiles + Math.floor(repeatCapacity * 0.6),
    maximum: itemTiles + repeatCapacity
  }
}
