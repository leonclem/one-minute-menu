/**
 * Schema Version Management
 * 
 * Manages multiple schema versions and provides version detection,
 * migration, and compatibility checking.
 */

import type { ExtractionResult } from './schema-stage1'
import { SchemaValidator } from './schema-validator'
import { STAGE1_JSON_SCHEMA } from './json-schema-stage1'

// ============================================================================
// Schema Version Types
// ============================================================================

export type SchemaVersion = 'stage1' | 'stage2'

export interface SchemaInfo {
  version: SchemaVersion
  versionNumber: string
  description: string
  releaseDate: string
  deprecated: boolean
}

export interface SchemaMetadata {
  schemaVersion: SchemaVersion
  schemaVersionNumber: string
  extractedAt: Date
  promptVersion?: string
}

// ============================================================================
// Schema Registry
// ============================================================================

export const SCHEMA_REGISTRY: Record<SchemaVersion, SchemaInfo> = {
  stage1: {
    version: 'stage1',
    versionNumber: '1.0.0',
    description: 'Basic structured extraction with hierarchical categories',
    releaseDate: '2025-01-01',
    deprecated: false
  },
  stage2: {
    version: 'stage2',
    versionNumber: '2.0.0',
    description: 'Full schema with variants, modifiers, and complex structures',
    releaseDate: '2025-03-01', // Future release
    deprecated: false
  }
}

// ============================================================================
// Schema Version Manager
// ============================================================================

export class SchemaVersionManager {
  /**
   * Get information about a specific schema version
   */
  static getSchemaInfo(version: SchemaVersion): SchemaInfo {
    return SCHEMA_REGISTRY[version]
  }

  /**
   * Get all available schema versions
   */
  static getAllVersions(): SchemaInfo[] {
    return Object.values(SCHEMA_REGISTRY)
  }

  /**
   * Get the latest schema version
   */
  static getLatestVersion(): SchemaVersion {
    // For now, stage1 is the latest implemented version
    // This will return stage2 once it's implemented
    return 'stage1'
  }

  /**
   * Check if a schema version is supported
   */
  static isVersionSupported(version: string): version is SchemaVersion {
    return version === 'stage1' || version === 'stage2'
  }

  /**
   * Detect schema version from extraction result data
   */
  static detectVersion(data: any): SchemaVersion {
    // Check for Stage 2 specific fields
    if (this.hasStage2Fields(data)) {
      return 'stage2'
    }
    
    // Default to Stage 1
    return 'stage1'
  }

  /**
   * Get the appropriate validator for a schema version
   */
  static getValidator(version: SchemaVersion): SchemaValidator {
    // For now, only Stage 1 validator is implemented
    if (version === 'stage1') {
      return new SchemaValidator('stage1')
    }
    
    // Stage 2 validator will be implemented later
    throw new Error(`Validator for schema version ${version} not yet implemented`)
  }

  /**
   * Get the JSON schema for a specific version
   */
  static getJSONSchema(version: SchemaVersion): object {
    if (version === 'stage1') {
      return STAGE1_JSON_SCHEMA
    }
    
    // Stage 2 JSON schema will be added later
    throw new Error(`JSON schema for version ${version} not yet implemented`)
  }

  /**
   * Check if data needs migration to a newer schema version
   */
  static needsMigration(data: any, targetVersion: SchemaVersion): boolean {
    const currentVersion = this.detectVersion(data)
    return currentVersion !== targetVersion
  }

  /**
   * Migrate data from one schema version to another
   */
  static migrate(data: any, fromVersion: SchemaVersion, toVersion: SchemaVersion): any {
    if (fromVersion === toVersion) {
      return data
    }

    // Stage 1 to Stage 2 migration
    if (fromVersion === 'stage1' && toVersion === 'stage2') {
      return this.migrateStage1ToStage2(data)
    }

    // Stage 2 to Stage 1 migration (downgrade)
    if (fromVersion === 'stage2' && toVersion === 'stage1') {
      return this.migrateStage2ToStage1(data)
    }

    throw new Error(`Migration from ${fromVersion} to ${toVersion} not supported`)
  }

  /**
   * Add schema metadata to extraction result
   */
  static addMetadata(
    data: ExtractionResult,
    version: SchemaVersion,
    promptVersion?: string
  ): ExtractionResult & { metadata: SchemaMetadata } {
    const info = this.getSchemaInfo(version)
    
    return {
      ...data,
      metadata: {
        schemaVersion: version,
        schemaVersionNumber: info.versionNumber,
        extractedAt: new Date(),
        promptVersion
      }
    }
  }

  /**
   * Validate backward compatibility
   */
  static isBackwardCompatible(data: any, targetVersion: SchemaVersion): boolean {
    const currentVersion = this.detectVersion(data)
    
    // Stage 2 data should be backward compatible with Stage 1
    if (currentVersion === 'stage2' && targetVersion === 'stage1') {
      return true
    }
    
    // Stage 1 data is not forward compatible with Stage 2 (missing fields)
    if (currentVersion === 'stage1' && targetVersion === 'stage2') {
      return false
    }
    
    return currentVersion === targetVersion
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private static hasStage2Fields(data: any): boolean {
    // Check for Stage 2 specific fields (variants, modifiers, etc.)
    // This will be implemented when Stage 2 is added
    
    if (!data?.menu?.categories) {
      return false
    }

    // Check if any item has variants or modifierGroups
    for (const category of data.menu.categories) {
      if (category.items) {
        for (const item of category.items) {
          if (item.variants || item.modifierGroups || item.additional) {
            return true
          }
        }
      }
      
      // Check subcategories recursively
      if (category.subcategories) {
        if (this.hasStage2FieldsInCategories(category.subcategories)) {
          return true
        }
      }
    }

    return false
  }

  private static hasStage2FieldsInCategories(categories: any[]): boolean {
    for (const category of categories) {
      if (category.items) {
        for (const item of category.items) {
          if (item.variants || item.modifierGroups || item.additional) {
            return true
          }
        }
      }
      
      if (category.subcategories) {
        if (this.hasStage2FieldsInCategories(category.subcategories)) {
          return true
        }
      }
    }
    return false
  }

  private static migrateStage1ToStage2(data: any): any {
    // Stage 1 to Stage 2: Add empty arrays for new fields
    // This will be fully implemented when Stage 2 is added
    
    const migrated = JSON.parse(JSON.stringify(data)) // Deep clone
    
    // Add Stage 2 fields to all items
    this.addStage2FieldsToCategories(migrated.menu.categories)
    
    return migrated
  }

  private static addStage2FieldsToCategories(categories: any[]): void {
    for (const category of categories) {
      if (category.items) {
        for (const item of category.items) {
          // Add Stage 2 fields if they don't exist
          if (!item.variants) {
            item.variants = []
          }
          if (!item.modifierGroups) {
            item.modifierGroups = []
          }
          if (!item.additional) {
            item.additional = {}
          }
        }
      }
      
      if (category.subcategories) {
        this.addStage2FieldsToCategories(category.subcategories)
      }
    }
  }

  private static migrateStage2ToStage1(data: any): any {
    // Stage 2 to Stage 1: Remove Stage 2 specific fields
    const migrated = JSON.parse(JSON.stringify(data)) // Deep clone
    
    // Remove Stage 2 fields from all items
    this.removeStage2FieldsFromCategories(migrated.menu.categories)
    
    return migrated
  }

  private static removeStage2FieldsFromCategories(categories: any[]): void {
    for (const category of categories) {
      if (category.items) {
        for (const item of category.items) {
          // Remove Stage 2 fields
          delete item.variants
          delete item.modifierGroups
          delete item.additional
        }
      }
      
      if (category.subcategories) {
        this.removeStage2FieldsFromCategories(category.subcategories)
      }
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the current default schema version
 */
export function getDefaultSchemaVersion(): SchemaVersion {
  return SchemaVersionManager.getLatestVersion()
}

/**
 * Quick check if a version string is valid
 */
export function isValidSchemaVersion(version: string): version is SchemaVersion {
  return SchemaVersionManager.isVersionSupported(version)
}

/**
 * Get schema info for the default version
 */
export function getDefaultSchemaInfo(): SchemaInfo {
  return SchemaVersionManager.getSchemaInfo(getDefaultSchemaVersion())
}
