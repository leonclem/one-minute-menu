/**
 * Schema Validator for Menu Extraction Results
 * 
 * Provides validation functions for extraction results using Zod schemas.
 * Supports multiple schema versions and detailed error reporting.
 */

import { z } from 'zod'
import {
  ExtractionResultSchema,
  StructuredMenuSchema,
  CategorySchema,
  MenuItemSchema,
  SCHEMA_VERSION,
  SCHEMA_VERSION_NUMBER,
  type ExtractionResult,
  type StructuredMenu,
  type Category,
  type MenuItem
} from './schema-stage1'
import {
  ExtractionResultV2Schema,
  StructuredMenuV2Schema
} from './schema-stage2'

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ValidationError {
  path: string
  message: string
  code: string
}

export interface ValidationWarning {
  path: string
  message: string
  severity: 'low' | 'medium' | 'high'
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  data?: any
}

// ============================================================================
// Schema Validator Class
// ============================================================================

export class SchemaValidator {
  private schemaVersion: string

  constructor(schemaVersion: string = SCHEMA_VERSION) {
    this.schemaVersion = schemaVersion
  }

  /**
   * Validate a complete extraction result
   */
  validateExtractionResult(data: unknown): ValidationResult {
    try {
      const parsed = this.schemaVersion === 'stage2'
        ? ExtractionResultV2Schema.parse(data)
        : ExtractionResultSchema.parse(data)
      const warnings = this.schemaVersion === 'stage2' ? [] : this.generateWarnings(parsed as ExtractionResult)
      
      return {
        valid: true,
        errors: [],
        warnings,
        data: parsed
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: this.formatZodErrors(error),
          warnings: []
        }
      }
      
      return {
        valid: false,
        errors: [{
          path: 'root',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'UNKNOWN_ERROR'
        }],
        warnings: []
      }
    }
  }

  /**
   * Validate just the menu structure
   */
  validateMenu(data: unknown): ValidationResult {
    try {
      const parsed = this.schemaVersion === 'stage2'
        ? StructuredMenuV2Schema.parse(data)
        : StructuredMenuSchema.parse(data)
      
      return {
        valid: true,
        errors: [],
        warnings: [],
        data: { menu: parsed } as any
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: this.formatZodErrors(error),
          warnings: []
        }
      }
      
      return {
        valid: false,
        errors: [{
          path: 'menu',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'UNKNOWN_ERROR'
        }],
        warnings: []
      }
    }
  }

  /**
   * Validate a single category
   */
  validateCategory(data: unknown): ValidationResult {
    try {
      CategorySchema.parse(data)
      
      return {
        valid: true,
        errors: [],
        warnings: []
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: this.formatZodErrors(error),
          warnings: []
        }
      }
      
      return {
        valid: false,
        errors: [{
          path: 'category',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'UNKNOWN_ERROR'
        }],
        warnings: []
      }
    }
  }

  /**
   * Validate a single menu item
   */
  validateMenuItem(data: unknown): ValidationResult {
    try {
      MenuItemSchema.parse(data)
      
      return {
        valid: true,
        errors: [],
        warnings: []
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: this.formatZodErrors(error),
          warnings: []
        }
      }
      
      return {
        valid: false,
        errors: [{
          path: 'menuItem',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'UNKNOWN_ERROR'
        }],
        warnings: []
      }
    }
  }

  /**
   * Attempt to salvage partial data from invalid extraction
   */
  salvagePartialData(data: unknown): {
    salvaged: Partial<ExtractionResult>
    itemsRecovered: number
    categoriesRecovered: number
  } {
    const salvaged: Partial<ExtractionResult> = {
      menu: { categories: [] },
      currency: 'SGD', // Default fallback
      uncertainItems: [],
      superfluousText: []
    }
    
    let itemsRecovered = 0
    let categoriesRecovered = 0

    try {
      const raw = data as any

      // Try to salvage currency
      if (typeof raw.currency === 'string' && raw.currency.length > 0) {
        salvaged.currency = raw.currency
      }

      // Try to salvage categories
      if (Array.isArray(raw.menu?.categories)) {
        for (const cat of raw.menu.categories) {
          try {
            const validatedCat = CategorySchema.parse(cat)
            salvaged.menu!.categories.push(validatedCat)
            categoriesRecovered++
            itemsRecovered += validatedCat.items.length
          } catch {
            // Try to salvage individual items from invalid category
            if (cat.name && Array.isArray(cat.items)) {
              const validItems: MenuItem[] = []
              for (const item of cat.items) {
                try {
                  const validatedItem = MenuItemSchema.parse(item)
                  validItems.push(validatedItem)
                  itemsRecovered++
                } catch {
                  // Skip invalid items
                }
              }
              
              if (validItems.length > 0) {
                salvaged.menu!.categories.push({
                  name: String(cat.name),
                  items: validItems,
                  confidence: typeof cat.confidence === 'number' ? cat.confidence : 0.5
                })
                categoriesRecovered++
              }
            }
          }
        }
      }

      // Try to salvage uncertain items
      if (Array.isArray(raw.uncertainItems)) {
        salvaged.uncertainItems = raw.uncertainItems.filter((item: any) => 
          item && typeof item.text === 'string' && typeof item.reason === 'string'
        )
      }

      // Try to salvage superfluous text
      if (Array.isArray(raw.superfluousText)) {
        salvaged.superfluousText = raw.superfluousText.filter((item: any) => 
          item && typeof item.text === 'string' && typeof item.context === 'string'
        )
      }
    } catch (error) {
      // Return whatever we managed to salvage
    }

    return {
      salvaged,
      itemsRecovered,
      categoriesRecovered
    }
  }

  /**
   * Get schema version information
   */
  getSchemaInfo() {
    return {
      version: this.schemaVersion,
      versionNumber: SCHEMA_VERSION_NUMBER,
      description: this.schemaVersion === 'stage2'
        ? 'Stage 2 schema with variants, modifiers, and complex structures'
        : 'Stage 1 schema with basic structured extraction'
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private formatZodErrors(error: z.ZodError): ValidationError[] {
    return error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
  }

  private generateWarnings(data: ExtractionResult): ValidationWarning[] {
    const warnings: ValidationWarning[] = []

    // Check for low confidence items
    this.checkLowConfidence(data.menu.categories, warnings)

    // Check for empty categories
    data.menu.categories.forEach((cat, idx) => {
      if (cat.items.length === 0 && (!cat.subcategories || cat.subcategories.length === 0)) {
        warnings.push({
          path: `menu.categories[${idx}]`,
          message: `Category "${cat.name}" has no items or subcategories`,
          severity: 'medium'
        })
      }
    })

    // Check for high number of uncertain items
    if (data.uncertainItems.length > 5) {
      warnings.push({
        path: 'uncertainItems',
        message: `High number of uncertain items (${data.uncertainItems.length}). Image quality may be poor.`,
        severity: 'high'
      })
    }

    // Check for suspicious prices
    this.checkSuspiciousPrices(data.menu.categories, warnings)

    // Stage 2: set menu completeness warnings (best-effort on Stage 1 types)
    // Note: We only have Stage 1 types here. Heuristically check items with keywords
    // that imply set/combo but missing structured courses.
    try {
      const checkSetMenuHeuristics = (categories: any[], basePath = 'menu.categories') => {
        categories.forEach((cat: any, ci: number) => {
          const catPath = `${basePath}[${ci}]`
          ;(cat.items || []).forEach((item: any, ii: number) => {
            const name: string = String(item?.name || '')
            const desc: string = String(item?.description || '')
            const looksLikeSet = /(set|combo|meal|course)/i.test(name) || /(choose|choice|includes|course)/i.test(desc)
            if (looksLikeSet && (item as any).type !== 'set_menu') {
              warnings.push({
                path: `${catPath}.items[${ii}]`,
                message: 'Item looks like a set/combo but is not structured as set_menu. Consider annotating courses and options.',
                severity: 'low'
              })
            }
          })
          if (Array.isArray(cat.subcategories)) {
            checkSetMenuHeuristics(cat.subcategories, `${catPath}.subcategories`)
          }
        })
      }
      checkSetMenuHeuristics((data as any).menu?.categories || [])
    } catch {}

    return warnings
  }

  private checkLowConfidence(categories: Category[], warnings: ValidationWarning[], path = 'menu.categories') {
    categories.forEach((cat, catIdx) => {
      const catPath = `${path}[${catIdx}]`
      
      if (cat.confidence < 0.6) {
        warnings.push({
          path: catPath,
          message: `Category "${cat.name}" has low confidence (${cat.confidence.toFixed(2)})`,
          severity: 'medium'
        })
      }

      cat.items.forEach((item, itemIdx) => {
        if (item.confidence < 0.6) {
          warnings.push({
            path: `${catPath}.items[${itemIdx}]`,
            message: `Item "${item.name}" has low confidence (${item.confidence.toFixed(2)})`,
            severity: 'medium'
          })
        }
      })

      if (cat.subcategories) {
        this.checkLowConfidence(cat.subcategories, warnings, `${catPath}.subcategories`)
      }
    })
  }

  private checkSuspiciousPrices(categories: Category[], warnings: ValidationWarning[], path = 'menu.categories') {
    categories.forEach((cat, catIdx) => {
      const catPath = `${path}[${catIdx}]`
      
      cat.items.forEach((item, itemIdx) => {
        // Check for extremely high prices (likely OCR error)
        if (item.price > 10000) {
          warnings.push({
            path: `${catPath}.items[${itemIdx}]`,
            message: `Item "${item.name}" has unusually high price ($${item.price}). May be OCR error.`,
            severity: 'high'
          })
        }

        // Check for zero prices
        if (item.price === 0) {
          warnings.push({
            path: `${catPath}.items[${itemIdx}]`,
            message: `Item "${item.name}" has zero price. May need review.`,
            severity: 'low'
          })
        }
      })

      if (cat.subcategories) {
        this.checkSuspiciousPrices(cat.subcategories, warnings, `${catPath}.subcategories`)
      }
    })
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick validation function for extraction results
 */
export function validateExtraction(data: unknown): ValidationResult {
  const validator = new SchemaValidator()
  return validator.validateExtractionResult(data)
}

/**
 * Quick validation function for menu structure only
 */
export function validateMenuStructure(data: unknown): ValidationResult {
  const validator = new SchemaValidator()
  return validator.validateMenu(data)
}

/**
 * Type guard to check if data is a valid extraction result
 */
export function isValidExtractionResult(data: unknown): data is ExtractionResult {
  const result = validateExtraction(data)
  return result.valid
}
