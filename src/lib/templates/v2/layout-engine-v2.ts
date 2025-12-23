/**
 * GridMenu V2 Layout Engine - Main Entry Point
 *
 * This module provides the main API for the V2 layout engine, orchestrating
 * all components to generate complete layout documents from menu data.
 *
 * The V2 engine uses streaming pagination with region-based page partitioning
 * and supports filler tiles, invariant validation, and deterministic output.
 */

import { loadTemplateV2 } from './template-loader-v2'
import { streamingPaginate } from './streaming-paginator'
import { insertFillers } from './filler-manager-v2'
import { validateInvariants } from './invariant-validator'
import { InvariantViolationError } from './errors-v2'
import { buildPageSpec, PAGE_DIMENSIONS } from './engine-types-v2'
import type {
  EngineMenuV2,
  TemplateV2,
  PageSpecV2,
  LayoutDocumentV2,
  SelectionConfigV2,
} from './engine-types-v2'

// =============================================================================
// Input Interface
// =============================================================================

/**
 * Input parameters for V2 layout generation.
 */
export interface LayoutEngineInputV2 {
  /** Normalized menu data with sections and items */
  menu: EngineMenuV2
  
  /** Template identifier (YAML filename without extension) */
  templateId: string
  
  /** Optional user selection overrides */
  selection?: SelectionConfigV2
  
  /** Optional page specification (overrides template defaults) */
  pageSpec?: PageSpecV2
  
  /** Enable debug mode (forces invariant validation) */
  debug?: boolean
}

// =============================================================================
// Main Layout Generation Function
// =============================================================================

/**
 * Generate a complete layout document using the V2 engine.
 * 
 * This is the main entry point that orchestrates all V2 components:
 * 1. Load and validate template from YAML
 * 2. Build page specification (input overrides > template defaults)
 * 3. Run streaming pagination to place all content
 * 4. Insert filler tiles in safe zones
 * 5. Validate invariants in dev mode or when debug=true
 * 
 * @param input - Layout generation parameters
 * @returns Promise resolving to complete layout document
 * @throws TemplateValidationError if template is invalid
 * @throws InvariantViolationError if layout violates constraints
 * @throws LayoutEngineErrorV2 for other generation failures
 */
export async function generateLayoutV2(
  input: LayoutEngineInputV2
): Promise<LayoutDocumentV2> {
  // Step 1: Load and validate template
  const template = await loadTemplateV2(input.templateId)
  
  // Step 2: Build page spec from input or template defaults
  // Priority: input.pageSpec > template.page configuration
  const pageSpec = input.pageSpec ?? buildPageSpec(
    template.page.size,
    template.page.margins
  )
  
  // Step 3: Call streamingPaginate for main layout
  // This handles all content placement, pagination, and page type assignment
  const document = streamingPaginate(
    input.menu,
    template,
    pageSpec,
    input.selection
  )
  
  // Step 4: Call insertFillers for each page
  // Fillers are added after main layout to avoid interfering with content
  for (const page of document.pages) {
    const fillers = insertFillers(
      page,
      template,
      input.menu.id,
      page.pageIndex,
      input.selection?.fillersEnabled
    )
    page.tiles.push(...fillers)
  }
  
  // Step 5: Call validateInvariants in dev mode or when debug=true
  // This catches layout bugs early with descriptive error messages
  if (process.env.NODE_ENV === 'development' || input.debug) {
    const violations = validateInvariants(document, template)
    if (violations.length > 0) {
      throw new InvariantViolationError(
        `Layout invariants violated: ${violations.length} violation(s) found`,
        violations
      )
    }
  }
  
  // Step 6: Return complete LayoutDocumentV2
  return document
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get available page dimensions for template configuration.
 * Useful for UI components that need to list page size options.
 */
export function getAvailablePageDimensions() {
  return PAGE_DIMENSIONS
}

/**
 * Validate a menu structure for V2 compatibility.
 * Checks that all required fields are present and properly formatted.
 * 
 * @param menu - Menu to validate
 * @returns Array of validation issues (empty = valid)
 */
export function validateMenuForV2(menu: EngineMenuV2): string[] {
  const issues: string[] = []
  
  if (!menu.id) {
    issues.push('Menu must have an id')
  }
  
  if (!menu.name) {
    issues.push('Menu must have a name')
  }
  
  if (!menu.sections || menu.sections.length === 0) {
    issues.push('Menu must have at least one section')
  }
  
  for (const section of menu.sections || []) {
    if (!section.id) {
      issues.push(`Section "${section.name}" must have an id`)
    }
    
    if (!section.name) {
      issues.push(`Section with id "${section.id}" must have a name`)
    }
    
    if (!section.items || section.items.length === 0) {
      issues.push(`Section "${section.name}" must have at least one item`)
    }
    
    for (const item of section.items || []) {
      if (!item.id) {
        issues.push(`Item "${item.name}" must have an id`)
      }
      
      if (!item.name) {
        issues.push(`Item with id "${item.id}" must have a name`)
      }
      
      if (typeof item.price !== 'number' || item.price < 0) {
        issues.push(`Item "${item.name}" must have a valid price`)
      }
      
      // Validate indicator fields have proper defaults
      if (!item.indicators) {
        issues.push(`Item "${item.name}" must have indicators object`)
      } else {
        if (!Array.isArray(item.indicators.dietary)) {
          issues.push(`Item "${item.name}" indicators.dietary must be an array`)
        }
        
        if (!Array.isArray(item.indicators.allergens)) {
          issues.push(`Item "${item.name}" indicators.allergens must be an array`)
        }
        
        if (item.indicators.spiceLevel !== null && 
            (typeof item.indicators.spiceLevel !== 'number' || 
             item.indicators.spiceLevel < 0 || 
             item.indicators.spiceLevel > 3)) {
          issues.push(`Item "${item.name}" indicators.spiceLevel must be null or 0-3`)
        }
      }
    }
  }
  
  return issues
}