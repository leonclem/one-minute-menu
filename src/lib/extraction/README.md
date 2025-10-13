# Menu Extraction Schema Module

This module provides schema definitions, validation, and versioning for AI-powered menu extraction from images.

## Overview

The extraction module implements a **Stage 1 schema** for basic structured menu extraction with:
- Hierarchical categories and subcategories
- Menu items with name, price, description, and confidence scores
- Uncertain items handling
- Superfluous text detection
- Currency detection

**Stage 2** (future) will add support for variants, modifiers, set menus, and complex structures.

## Quick Start

```typescript
import {
  validateExtraction,
  SchemaValidator,
  EXAMPLE_SIMPLE_MENU,
  getSchemaForPrompt
} from '@/lib/extraction'

// Validate extraction result
const result = validateExtraction(extractedData)
if (result.valid) {
  console.log('Extraction valid!', result.data)
} else {
  console.error('Validation errors:', result.errors)
}

// Get JSON schema for prompt inclusion
const schemaForPrompt = getSchemaForPrompt()
```

## Module Structure

```
src/lib/extraction/
├── schema-stage1.ts          # TypeScript interfaces and Zod schemas
├── json-schema-stage1.ts     # JSON Schema for prompt inclusion
├── schema-validator.ts       # Validation logic and error handling
├── example-outputs.ts        # Example extraction outputs
├── schema-version.ts         # Version management and migration
├── index.ts                  # Central export point
├── __tests__/
│   └── schema-validator.test.ts
└── README.md                 # This file
```

## Core Types

### ExtractionResult

The complete output from vision-LLM extraction:

```typescript
interface ExtractionResult {
  menu: StructuredMenu
  currency: string
  uncertainItems: UncertainItem[]
  superfluousText: SuperfluousText[]
}
```

### StructuredMenu

Hierarchical menu structure:

```typescript
interface StructuredMenu {
  categories: Category[]
}

interface Category {
  name: string
  items: MenuItem[]
  subcategories?: Category[]  // Nested hierarchy
  confidence: number
}

interface MenuItem {
  name: string
  price: number
  description?: string
  confidence: number
}
```

### UncertainItem

Items that couldn't be extracted with confidence:

```typescript
interface UncertainItem {
  text: string
  reason: string
  confidence: number
  suggestedCategory?: string
  suggestedPrice?: number
}
```

## Validation

### Basic Validation

```typescript
import { validateExtraction } from '@/lib/extraction'

const result = validateExtraction(data)

if (result.valid) {
  // Use result.data (typed as ExtractionResult)
  console.log('Valid extraction:', result.data)
} else {
  // Handle errors
  result.errors.forEach(error => {
    console.error(`${error.path}: ${error.message}`)
  })
}

// Check warnings (non-blocking issues)
result.warnings.forEach(warning => {
  console.warn(`${warning.path}: ${warning.message} (${warning.severity})`)
})
```

### Advanced Validation

```typescript
import { SchemaValidator } from '@/lib/extraction'

const validator = new SchemaValidator('stage1')

// Validate complete extraction
const result = validator.validateExtractionResult(data)

// Validate just the menu structure
const menuResult = validator.validateMenu(data.menu)

// Validate a single category
const categoryResult = validator.validateCategory(category)

// Validate a single item
const itemResult = validator.validateMenuItem(item)
```

### Partial Data Salvage

When extraction returns invalid data, attempt to salvage valid items:

```typescript
const { salvaged, itemsRecovered, categoriesRecovered } = 
  validator.salvagePartialData(invalidData)

console.log(`Recovered ${itemsRecovered} items in ${categoriesRecovered} categories`)

if (itemsRecovered > 0) {
  // Use salvaged data
  return salvaged
} else {
  // Fall back to manual entry
  return null
}
```

## JSON Schema for Prompts

Include the JSON schema in vision-LLM prompts:

```typescript
import { getSchemaForPrompt } from '@/lib/extraction'

const prompt = `
You are extracting menu data from an image.
Output must match this JSON schema:

${getSchemaForPrompt()}

Return ONLY valid JSON matching this schema.
`
```

## Example Outputs

Use example outputs in prompts or for testing:

```typescript
import {
  EXAMPLE_SIMPLE_MENU,
  EXAMPLE_HIERARCHICAL_MENU,
  EXAMPLE_WITH_UNCERTAINTIES,
  getSimpleExampleForPrompt
} from '@/lib/extraction'

// Include example in prompt
const prompt = `
Extract menu data matching this example format:

${getSimpleExampleForPrompt()}
`

// Use examples in tests
expect(extractedData).toMatchObject(EXAMPLE_SIMPLE_MENU)
```

### Available Examples

- `EXAMPLE_SIMPLE_MENU` - Basic single-column menu
- `EXAMPLE_HIERARCHICAL_MENU` - Menu with subcategories
- `EXAMPLE_WITH_UNCERTAINTIES` - Menu with low confidence items
- `EXAMPLE_MULTI_CURRENCY` - Malaysian Ringgit menu
- `EXAMPLE_PRICE_RANGES` - Menu with size variations

## Schema Versioning

### Get Current Version

```typescript
import { getDefaultSchemaVersion, getDefaultSchemaInfo } from '@/lib/extraction'

const version = getDefaultSchemaVersion() // 'stage1'
const info = getDefaultSchemaInfo()
console.log(info.versionNumber) // '1.0.0'
```

### Version Detection

```typescript
import { SchemaVersionManager } from '@/lib/extraction'

const version = SchemaVersionManager.detectVersion(data)
console.log(`Detected schema version: ${version}`)
```

### Migration (Future)

When Stage 2 is implemented:

```typescript
// Migrate Stage 1 data to Stage 2
const migratedData = SchemaVersionManager.migrate(data, 'stage1', 'stage2')

// Check if migration is needed
if (SchemaVersionManager.needsMigration(data, 'stage2')) {
  const migrated = SchemaVersionManager.migrate(
    data,
    SchemaVersionManager.detectVersion(data),
    'stage2'
  )
}
```

## Validation Rules

### Confidence Scores

- **1.0**: Certain extraction
- **0.8-0.9**: High confidence
- **0.6-0.8**: Moderate confidence (generates warning)
- **< 0.6**: Low confidence (generates warning, may need review)

### Price Validation

- Must be non-negative
- Prices > $10,000 generate warning (likely OCR error)
- Zero prices generate low-severity warning

### Category Validation

- Name must be 1-100 characters
- Must have at least one item or subcategory
- Empty categories generate warning

### Item Validation

- Name must be 1-200 characters
- Description max 500 characters
- Price must be finite number

## Error Handling

### Validation Errors

```typescript
interface ValidationError {
  path: string      // e.g., 'menu.categories[0].items[1].price'
  message: string   // Human-readable error message
  code: string      // Error code (from Zod)
}
```

### Validation Warnings

```typescript
interface ValidationWarning {
  path: string
  message: string
  severity: 'low' | 'medium' | 'high'
}
```

### Common Errors

- `Required` - Missing required field
- `too_small` - String too short or array empty
- `too_big` - String or number exceeds maximum
- `invalid_type` - Wrong data type

## Type Guards

```typescript
import { isValidExtractionResult } from '@/lib/extraction'

if (isValidExtractionResult(data)) {
  // TypeScript knows data is ExtractionResult
  console.log(data.menu.categories)
}
```

## Testing

Run the test suite:

```bash
npm test -- --testPathPattern=schema-validator.test
```

### Test Coverage

- ✅ Valid extraction results
- ✅ Invalid data rejection
- ✅ Partial data salvage
- ✅ Warning generation
- ✅ Type validation
- ✅ Confidence scoring
- ✅ Price validation
- ✅ Category validation

## Integration Example

```typescript
import {
  validateExtraction,
  SchemaValidator,
  getSchemaForPrompt,
  EXAMPLE_SIMPLE_MENU
} from '@/lib/extraction'

async function extractMenuFromImage(imageUrl: string) {
  // 1. Build prompt with schema
  const prompt = `
    Extract menu data from this image.
    
    Schema:
    ${getSchemaForPrompt()}
    
    Example:
    ${JSON.stringify(EXAMPLE_SIMPLE_MENU, null, 2)}
  `
  
  // 2. Call vision-LLM API
  const response = await callVisionAPI(imageUrl, prompt)
  
  // 3. Validate response
  const validator = new SchemaValidator('stage1')
  const result = validator.validateExtractionResult(response)
  
  if (result.valid) {
    return result.data
  }
  
  // 4. Try to salvage partial data
  const { salvaged, itemsRecovered } = validator.salvagePartialData(response)
  
  if (itemsRecovered > 0) {
    console.warn('Partial extraction recovered')
    return salvaged
  }
  
  // 5. Fall back to manual entry
  throw new Error('Extraction failed: ' + result.errors[0].message)
}
```

## Future: Stage 2 Schema

Stage 2 will extend the schema with:

- **Variants**: Multiple sizes/prices per item
- **Modifiers**: Customization options (sauces, add-ons)
- **Set Menus**: Multi-course meals with choices
- **Additional Info**: Serving size, prep time, dietary info

```typescript
// Stage 2 (future)
interface MenuItem {
  name: string
  price: number
  description?: string
  confidence: number
  
  // Stage 2 additions
  variants?: ItemVariant[]
  modifierGroups?: ModifierGroup[]
  additional?: AdditionalInfo
}
```

## Requirements Mapping

This implementation satisfies:

- **Requirement 9.1**: Stage 1 schema with basic fields
- **Requirement 10.3**: JSON Schema for validation
- **Requirement 15.4**: Schema versioning support

## Related Files

- Design: `.kiro/specs/ai-text-extraction/design.md`
- Requirements: `.kiro/specs/ai-text-extraction/requirements.md`
- Tasks: `.kiro/specs/ai-text-extraction/tasks.md`
