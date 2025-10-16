/**
 * Menu Extraction Schema Module
 * 
 * Central export point for all schema-related functionality including:
 * - TypeScript interfaces and types
 * - Zod schemas for validation
 * - JSON schemas for prompt inclusion
 * - Schema validators
 * - Example outputs
 * - Version management
 */

// ============================================================================
// Stage 1 Schema Exports
// ============================================================================

export {
  // TypeScript Interfaces
  type MenuItem,
  type Category,
  type StructuredMenu,
  type UncertainItem,
  type SuperfluousText,
  type ExtractionResult,
  
  // Zod Schemas
  MenuItemSchema,
  CategorySchema,
  StructuredMenuSchema,
  UncertainItemSchema,
  SuperfluousTextSchema,
  ExtractionResultSchema,
  
  // Zod Inferred Types
  type MenuItemType,
  type CategoryType,
  type StructuredMenuType,
  type UncertainItemType,
  type SuperfluousTextType,
  type ExtractionResultType,
  
  // Schema Version Constants
  SCHEMA_VERSION,
  SCHEMA_VERSION_NUMBER
} from './schema-stage1'

// ============================================================================
// JSON Schema Exports
// ============================================================================

export {
  STAGE1_JSON_SCHEMA,
  getSchemaForPrompt,
  getMinifiedSchema
} from './json-schema-stage1'

// Stage 2 JSON Schema Exports
export {
  STAGE2_JSON_SCHEMA,
  getStage2SchemaForPrompt,
  getStage2MinifiedSchema
} from './json-schema-stage2'

// ============================================================================
// Validator Exports
// ============================================================================

export {
  type ValidationError,
  type ValidationWarning,
  type ValidationResult,
  SchemaValidator,
  validateExtraction,
  validateMenuStructure,
  isValidExtractionResult
} from './schema-validator'

// ============================================================================
// Example Outputs Exports
// ============================================================================

export {
  EXAMPLE_SIMPLE_MENU,
  EXAMPLE_HIERARCHICAL_MENU,
  EXAMPLE_WITH_UNCERTAINTIES,
  EXAMPLE_MULTI_CURRENCY,
  EXAMPLE_PRICE_RANGES,
  ALL_EXAMPLES,
  getExample,
  formatExampleForPrompt,
  getSimpleExampleForPrompt
} from './example-outputs'

// ============================================================================
// Version Management Exports
// ============================================================================

export {
  type SchemaVersion,
  type SchemaInfo,
  type SchemaMetadata,
  SCHEMA_REGISTRY,
  SchemaVersionManager,
  getDefaultSchemaVersion,
  isValidSchemaVersion,
  getDefaultSchemaInfo
} from './schema-version'

// Stage 2 Schema Exports
export {
  // Interfaces
  type ItemVariant,
  type ModifierOption,
  type ModifierGroup,
  type AdditionalInfo,
  type SetMenuOption,
  type SetMenuCourse,
  type SetMenu,
  type MenuItemV2,
  type CategoryV2,
  type StructuredMenuV2,
  type UncertainItemV2,
  type SuperfluousTextV2,
  type ExtractionResultV2,

  // Zod Schemas
  ItemVariantSchema,
  ModifierOptionSchema,
  ModifierGroupSchema,
  AdditionalInfoSchema,
  SetMenuOptionSchema,
  SetMenuCourseSchema,
  SetMenuSchema,
  MenuItemV2Schema,
  CategoryV2Schema,
  StructuredMenuV2Schema,
  UncertainItemV2Schema,
  SuperfluousTextV2Schema,
  ExtractionResultV2Schema,

  // Versions
  SCHEMA_VERSION_V2,
  SCHEMA_VERSION_NUMBER_V2,

  // Inferred Types
  type ItemVariantType,
  type ModifierOptionType,
  type ModifierGroupType,
  type AdditionalInfoType,
  type SetMenuOptionType,
  type SetMenuCourseType,
  type SetMenuType,
  type MenuItemV2Type,
  type CategoryV2Type,
  type StructuredMenuV2Type,
  type UncertainItemV2Type,
  type SuperfluousTextV2Type,
  type ExtractionResultV2Type
} from './schema-stage2'

// ============================================================================
// Prompt Template Exports (Stage 1)
// ============================================================================

export {
  // Prompt Configuration
  PROMPT_VERSION,
  PROMPT_TEMPERATURE,
  PROMPT_SCHEMA_VERSION,
  
  // Currency Support
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
  DEFAULT_CURRENCY,
  
  // Prompt Options
  type PromptOptions,
  type PromptPackage,
  
  // Prompt Builders
  buildStage1Prompt,
  getSystemRole,
  getTemperature,
  getPromptVersion,
  getPromptPackage,
  
  // Validation
  validatePromptOptions,
  
  // Utility Functions
  getCurrencyFromLocation,
  getSupportedCurrencies,
  isSupportedCurrency,
  getCurrencyInfo
} from './prompt-stage1'

// ============================================================================
// Menu Extraction Service Exports
// ============================================================================

export {
  // Service Class
  MenuExtractionService,
  createMenuExtractionService,
  
  // Types
  type ExtractionJob,
  type TokenUsage,
  type ExtractionOptions,
  type ProcessingMetadata,
  
  // Utility Functions
  estimateExtractionCost,
  isWithinCostBudget
} from './menu-extraction-service'
