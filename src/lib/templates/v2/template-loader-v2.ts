/**
 * YAML Template Parser and Validator for V2 Layout Engine
 * 
 * This module loads and validates YAML template files, converting them to
 * TemplateV2 objects with proper validation and caching.
 */

import path from 'path'
import { readFile } from 'fs/promises'
import { load as parseYaml } from 'js-yaml'
import { TemplateSchemaV2 } from './template-schema-v2'
import { TemplateValidationError } from './errors-v2'
import { logger } from '../../logger'
import { PAGE_DIMENSIONS } from './engine-types-v2'
import type { TemplateV2, PageDimensionId } from './engine-types-v2'

// =============================================================================
// Template Cache
// =============================================================================

/** In-memory cache for parsed templates to avoid repeated YAML parsing */
const templateCache = new Map<string, TemplateV2>()

// =============================================================================
// Main Template Loader
// =============================================================================

/**
 * Load and validate a V2 template from YAML file.
 * 
 * @param templateId - The template identifier (filename without .yaml extension)
 * @returns Promise resolving to validated TemplateV2 object
 * @throws TemplateValidationError if template is invalid
 */
export async function loadTemplateV2(templateId: string): Promise<TemplateV2> {
  // Map legacy V1 IDs to V2 IDs for backward compatibility with saved selections
  const effectiveId = templateId === 'classic-grid-cards' ? 'classic-cards-v2' :
                     templateId === 'two-column-text' ? 'italian-v2' :
                     templateId === 'simple-rows' ? 'classic-cards-v2' : 
                     templateId;

  // Check cache first
  if (templateCache.has(effectiveId)) {
    return templateCache.get(effectiveId)!
  }
  
  try {
    // Use path.join for cross-platform compatibility
    const yamlPath = path.join(
      process.cwd(), 
      'src/lib/templates/v2/templates', 
      `${effectiveId}.yaml`
    )
    
    // Read and parse YAML file
    const yamlContent = await readFile(yamlPath, 'utf-8')
    const parsed = parseYaml(yamlContent)
    
    // Validate against schema
    const result = TemplateSchemaV2.safeParse(parsed)
    if (!result.success) {
      throw new TemplateValidationError(
        `Invalid template ${effectiveId}`,
        result.error.issues
      )
    }
    
    // Validate derived values (validate, don't compute)
    const template = validateDerivedValues(result.data, effectiveId)
    
    // Cache the validated template
    templateCache.set(effectiveId, template)
    return template
    
  } catch (error) {
    // Re-throw TemplateValidationError as-is
    if (error instanceof TemplateValidationError) {
      throw error
    }
    
    // Wrap other errors (file not found, YAML parse errors, etc.)
    throw new TemplateValidationError(
      `Failed to load template ${effectiveId}: ${error instanceof Error ? error.message : String(error)}`,
      []
    )
  }
}

// =============================================================================
// Derived Values Validation
// =============================================================================

/**
 * Validate derived values in template.
 * 
 * DESIGN DECISION: Validate, don't compute.
 * totalHeight MUST be explicitly provided in YAML - we validate it matches
 * expectations rather than computing it from magic numbers.
 * This makes templates self-documenting and prevents silent mismatches.
 * 
 * @param raw - Raw parsed template data from schema validation
 * @param templateId - Template ID for error messages
 * @returns Validated TemplateV2 object
 * @throws TemplateValidationError if derived values are invalid
 */
function validateDerivedValues(
  raw: typeof TemplateSchemaV2._type, 
  templateId: string
): TemplateV2 {
  const errors: string[] = []
  
  // Validate tile content budgets
  for (const [tileKey, variant] of Object.entries(raw.tiles)) {
    // Skip FILLER array (handled separately)
    if (tileKey === 'FILLER') continue
    
    const budget = (variant as any).contentBudget
    
    // Validate that totalHeight is provided and reasonable
    if (budget.totalHeight <= 0) {
      errors.push(`Tile ${tileKey} has invalid totalHeight: ${budget.totalHeight}`)
      continue
    }
    
    // Calculate minimum required height from components
    const minHeight = budget.paddingTop + 
                     budget.paddingBottom + 
                     budget.imageBoxHeight + 
                     budget.indicatorAreaHeight
    
    // Strict validation: totalHeight must be at least the sum of fixed components
    if (budget.totalHeight < minHeight) {
      errors.push(
        `Tile ${tileKey} totalHeight (${budget.totalHeight}) is less than ` +
        `minimum component sum (${minHeight}). This will cause clipping.`
      )
    }
    
    // Dev-mode warnings for suspicious values (but don't fail)
    if (process.env.NODE_ENV === 'development') {
      // Warn if totalHeight is much larger than components suggest
      const reasonableMax = minHeight + (budget.nameLines + budget.descLines) * 20 // ~20pt per line
      if (budget.totalHeight > reasonableMax * 1.5) {
        logger.warn(
          `[Template Warning] Tile ${tileKey} totalHeight (${budget.totalHeight}) ` +
          `seems unusually large compared to content budget. Expected ~${reasonableMax}pt.`
        )
      }
      
      // Warn if image box is specified but nameLines + descLines seems too high
      if (budget.imageBoxHeight > 0 && (budget.nameLines + budget.descLines) > 4) {
        logger.warn(
          `[Template Warning] Tile ${tileKey} has image box (${budget.imageBoxHeight}pt) ` +
          `but many text lines (${budget.nameLines + budget.descLines}). ` +
          `Consider reducing text lines for better layout.`
        )
      }
    }
  }
  
  // Validate region heights don't exceed reasonable bounds
  const totalRegionHeight = raw.regions.header.height + 
                           raw.regions.title.height + 
                           raw.regions.footer.height
  
  // For A4 portrait (841.89pt height), regions shouldn't consume more than ~60% of page
  // Calculate limit based on actual page dimensions instead of hardcoding per size
  const pageDims = PAGE_DIMENSIONS[raw.page.size as PageDimensionId]
  const maxRegionHeight = Math.round(pageDims.height * 0.6)
  if (totalRegionHeight > maxRegionHeight) {
    errors.push(
      `Total region height (${totalRegionHeight}pt) exceeds reasonable limit ` +
      `(${maxRegionHeight}pt) for ${raw.page.size}. Body region will be too small.`
    )
  }
  
  // Validate grid configuration
  if (raw.body.container.rowHeight < 50) {
    errors.push(
      `Body rowHeight (${raw.body.container.rowHeight}pt) is too small. ` +
      `Minimum 50pt required for readable text.`
    )
  }
  
  if (raw.body.container.cols < 1 || raw.body.container.cols > 6) {
    errors.push(
      `Body cols (${raw.body.container.cols}) must be between 1 and 6.`
    )
  }
  
  // Throw validation error if any issues found
  if (errors.length > 0) {
    throw new TemplateValidationError(
      `Template ${templateId} has validation errors`,
      errors.map(msg => ({
        code: 'custom',
        message: msg,
        path: []
      }))
    )
  }
  
  // Cast to TemplateV2 (schema validation ensures type safety)
  return raw as unknown as TemplateV2
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Clear the template cache.
 * Useful for testing or when templates are updated during development.
 */
export function clearTemplateCache(): void {
  templateCache.clear()
}

/**
 * Get cache statistics for debugging.
 */
export function getTemplateCacheStats(): { size: number; keys: string[] } {
  return {
    size: templateCache.size,
    keys: Array.from(templateCache.keys())
  }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Check if a template exists without loading it.
 * 
 * @param templateId - Template identifier to check
 * @returns Promise resolving to true if template file exists
 */
export async function templateExists(templateId: string): Promise<boolean> {
  const effectiveId = templateId === 'classic-grid-cards' ? 'classic-cards-v2' :
                     templateId === 'two-column-text' ? 'italian-v2' :
                     templateId === 'simple-rows' ? 'classic-cards-v2' : 
                     templateId;
  try {
    const yamlPath = path.join(
      process.cwd(), 
      'src/lib/templates/v2/templates', 
      `${effectiveId}.yaml`
    )
    
    await readFile(yamlPath, 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * List all available template IDs.
 * 
 * @returns Promise resolving to array of template IDs (without .yaml extension)
 */
export async function listAvailableTemplates(): Promise<string[]> {
  try {
    const { readdir } = await import('fs/promises')
    const templatesDir = path.join(process.cwd(), 'src/lib/templates/v2/templates')
    
    const files = await readdir(templatesDir)
    return files
      .filter(file => file.endsWith('.yaml'))
      .map(file => file.replace('.yaml', ''))
  } catch {
    return []
  }
}