# Stage 1 Extraction Prompt Template Usage

## Overview

The Stage 1 extraction prompt template provides a complete, schema-driven prompt for vision-LLM extraction of menu data. It includes:

- System role definition
- Detailed extraction instructions
- Confidence scoring guidelines
- Currency detection logic with fallback
- Uncertain items and superfluous text handling
- JSON schema embedding
- Example outputs
- Temperature setting (0 for deterministic extraction)
- Prompt versioning (v1.0)

## Basic Usage

```typescript
import { getPromptPackage } from '@/lib/extraction'

// Get the complete prompt package with default options
const promptPackage = getPromptPackage()

// Use with OpenAI API
const response = await openai.chat.completions.create({
  model: 'gpt-4-vision-preview',
  messages: [
    {
      role: 'system',
      content: promptPackage.systemRole
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: promptPackage.userPrompt
        },
        {
          type: 'image_url',
          image_url: {
            url: menuImageUrl
          }
        }
      ]
    }
  ],
  temperature: promptPackage.temperature, // 0 for deterministic
  response_format: { type: 'json_object' }
})
```

## Advanced Options

### Currency Override

Override automatic currency detection:

```typescript
const promptPackage = getPromptPackage({
  currencyOverride: 'USD'
})
```

### User Location Fallback

Use user's location for currency fallback:

```typescript
import { getCurrencyFromLocation } from '@/lib/extraction'

const userCurrency = getCurrencyFromLocation('SG') // Returns 'SGD'

const promptPackage = getPromptPackage({
  currencyOverride: userCurrency
})
```

### Exclude Examples (Reduce Token Usage)

Exclude example outputs to reduce token usage:

```typescript
const promptPackage = getPromptPackage({
  includeExamples: false
})
```

### Custom Instructions

Add custom instructions for specific use cases:

```typescript
const promptPackage = getPromptPackage({
  customInstructions: 'Focus on extracting vegetarian and vegan items. Mark dietary restrictions in descriptions.'
})
```

## Prompt Validation

Validate options before building the prompt:

```typescript
import { validatePromptOptions } from '@/lib/extraction'

const options = {
  currencyOverride: 'USD',
  customInstructions: 'Extract allergen information'
}

const validation = validatePromptOptions(options)

if (!validation.valid) {
  console.error('Invalid options:', validation.errors)
} else {
  const promptPackage = getPromptPackage(options)
  // Use the prompt...
}
```

## Currency Utilities

### Get Supported Currencies

```typescript
import { getSupportedCurrencies } from '@/lib/extraction'

const currencies = getSupportedCurrencies()
// ['SGD', 'USD', 'MYR', 'THB', 'IDR', 'PHP', 'VND', 'JPY', 'CNY', 'EUR', 'GBP', 'AUD', 'NZD', 'HKD', 'TWD', 'KRW']
```

### Check Currency Support

```typescript
import { isSupportedCurrency } from '@/lib/extraction'

if (isSupportedCurrency('SGD')) {
  // Currency is supported
}
```

### Get Currency Info

```typescript
import { getCurrencyInfo } from '@/lib/extraction'

const info = getCurrencyInfo('SGD')
// { symbols: ['S$', 'SGD'], name: 'Singapore Dollar' }
```

## Prompt Components

### Individual Components

If you need more control, you can access individual components:

```typescript
import {
  getSystemRole,
  buildStage1Prompt,
  getTemperature,
  getPromptVersion
} from '@/lib/extraction'

const systemRole = getSystemRole()
const userPrompt = buildStage1Prompt({ includeExamples: true })
const temperature = getTemperature() // 0
const version = getPromptVersion() // 'v1.0'
```

## Prompt Versioning

The prompt template includes versioning for tracking and A/B testing:

```typescript
import { PROMPT_VERSION, PROMPT_SCHEMA_VERSION } from '@/lib/extraction'

console.log(PROMPT_VERSION) // 'v1.0'
console.log(PROMPT_SCHEMA_VERSION) // 'stage1'
```

When logging extraction jobs, include the prompt version:

```typescript
await supabase.from('menu_extraction_jobs').insert({
  user_id: userId,
  image_url: imageUrl,
  prompt_version: PROMPT_VERSION,
  schema_version: PROMPT_SCHEMA_VERSION,
  status: 'queued'
})
```

## Best Practices

### 1. Always Use Temperature 0

For deterministic extraction, always use `temperature: 0`:

```typescript
const promptPackage = getPromptPackage()
// promptPackage.temperature is already 0
```

### 2. Include Examples for Better Quality

Unless token usage is a concern, include examples:

```typescript
const promptPackage = getPromptPackage({
  includeExamples: true // Default
})
```

### 3. Use Currency Override When Known

If you know the user's currency, override detection:

```typescript
const promptPackage = getPromptPackage({
  currencyOverride: user.currency
})
```

### 4. Log Prompt Version

Always log the prompt version with extraction jobs for tracking:

```typescript
const promptPackage = getPromptPackage()

await logExtractionJob({
  promptVersion: promptPackage.version,
  schemaVersion: promptPackage.schemaVersion
})
```

### 5. Validate Options

Always validate options before using them:

```typescript
const validation = validatePromptOptions(options)
if (!validation.valid) {
  throw new Error(`Invalid prompt options: ${validation.errors.join(', ')}`)
}
```

## Example: Complete Extraction Flow

```typescript
import {
  getPromptPackage,
  validatePromptOptions,
  getCurrencyFromLocation,
  ExtractionResultSchema
} from '@/lib/extraction'
import { openai } from '@/lib/openai'

async function extractMenu(imageUrl: string, userLocation?: string) {
  // 1. Prepare options
  const options = {
    currencyOverride: userLocation ? getCurrencyFromLocation(userLocation) : undefined,
    includeExamples: true
  }
  
  // 2. Validate options
  const validation = validatePromptOptions(options)
  if (!validation.valid) {
    throw new Error(`Invalid options: ${validation.errors.join(', ')}`)
  }
  
  // 3. Get prompt package
  const promptPackage = getPromptPackage(options)
  
  // 4. Call vision-LLM API
  const response = await openai.chat.completions.create({
    model: 'gpt-4-vision-preview',
    messages: [
      {
        role: 'system',
        content: promptPackage.systemRole
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: promptPackage.userPrompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ],
    temperature: promptPackage.temperature,
    response_format: { type: 'json_object' }
  })
  
  // 5. Parse and validate result
  const resultText = response.choices[0].message.content
  const resultData = JSON.parse(resultText)
  
  const validationResult = ExtractionResultSchema.safeParse(resultData)
  
  if (!validationResult.success) {
    throw new Error(`Invalid extraction result: ${validationResult.error.message}`)
  }
  
  // 6. Return validated result with metadata
  return {
    ...validationResult.data,
    metadata: {
      promptVersion: promptPackage.version,
      schemaVersion: promptPackage.schemaVersion,
      tokenUsage: response.usage
    }
  }
}
```

## Supported Currencies

The prompt template supports automatic detection of these currencies:

| Code | Symbols | Name |
|------|---------|------|
| SGD | S$, SGD | Singapore Dollar |
| USD | $, USD | US Dollar |
| MYR | RM, MYR | Malaysian Ringgit |
| THB | ฿, THB | Thai Baht |
| IDR | Rp, IDR | Indonesian Rupiah |
| PHP | ₱, PHP | Philippine Peso |
| VND | ₫, VND | Vietnamese Dong |
| JPY | ¥, JPY, 円 | Japanese Yen |
| CNY | ¥, CNY, 元 | Chinese Yuan |
| EUR | €, EUR | Euro |
| GBP | £, GBP | British Pound |
| AUD | A$, AUD | Australian Dollar |
| NZD | NZ$, NZD | New Zealand Dollar |
| HKD | HK$, HKD | Hong Kong Dollar |
| TWD | NT$, TWD | Taiwan Dollar |
| KRW | ₩, KRW | South Korean Won |

## Requirements Satisfied

This implementation satisfies the following requirements:

- **Requirement 1.1**: Hierarchical category extraction with confidence scoring
- **Requirement 4.1**: Confidence scores for each item (0.0 to 1.0)
- **Requirement 4.2**: Uncertain items flagged with reasons
- **Requirement 4.4**: Superfluous text separation
- **Requirement 6.1**: Currency detection from symbols and codes
- **Requirement 6.2**: Currency fallback to user location
- **Requirement 13.1**: Prompt versioning (v1.0)

## Next Steps

After implementing the prompt template, the next tasks are:

1. **Task 4**: Build vision-LLM extraction service
2. **Task 5**: Implement result validation and error handling
3. **Task 6**: Update job queue integration

See `tasks.md` for the complete implementation plan.
