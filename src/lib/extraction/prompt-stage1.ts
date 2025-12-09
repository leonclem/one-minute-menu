/**
 * Stage 1 Extraction Prompt Template
 * 
 * This module provides the prompt template for vision-LLM extraction
 * with schema-driven instructions, confidence scoring, and error handling.
 * 
 * Version: v1.0
 * Requirements: 1.1, 4.1, 4.2, 4.4, 6.1, 6.2, 13.1
 */

import { STAGE1_JSON_SCHEMA } from './json-schema-stage1'
import { getSimpleExampleForPrompt } from './example-outputs'

// ============================================================================
// Prompt Configuration
// ============================================================================

export const PROMPT_VERSION = 'v1.0' as const
export const PROMPT_TEMPERATURE = 0 // Deterministic extraction
export const PROMPT_SCHEMA_VERSION = 'stage1' as const

// ============================================================================
// Currency Detection Configuration
// ============================================================================

/**
 * Supported currencies with their symbols and detection patterns
 */
export const SUPPORTED_CURRENCIES = {
  SGD: { symbols: ['S$', 'SGD'], name: 'Singapore Dollar' },
  USD: { symbols: ['$', 'USD'], name: 'US Dollar' },
  MYR: { symbols: ['RM', 'MYR'], name: 'Malaysian Ringgit' },
  THB: { symbols: ['฿', 'THB'], name: 'Thai Baht' },
  IDR: { symbols: ['Rp', 'IDR'], name: 'Indonesian Rupiah' },
  PHP: { symbols: ['₱', 'PHP'], name: 'Philippine Peso' },
  VND: { symbols: ['₫', 'VND'], name: 'Vietnamese Dong' },
  JPY: { symbols: ['¥', 'JPY', '円'], name: 'Japanese Yen' },
  CNY: { symbols: ['¥', 'CNY', '元'], name: 'Chinese Yuan' },
  EUR: { symbols: ['€', 'EUR'], name: 'Euro' },
  GBP: { symbols: ['£', 'GBP'], name: 'British Pound' },
  AUD: { symbols: ['A$', 'AUD'], name: 'Australian Dollar' },
  NZD: { symbols: ['NZ$', 'NZD'], name: 'New Zealand Dollar' },
  HKD: { symbols: ['HK$', 'HKD'], name: 'Hong Kong Dollar' },
  TWD: { symbols: ['NT$', 'TWD'], name: 'Taiwan Dollar' },
  KRW: { symbols: ['₩', 'KRW'], name: 'South Korean Won' }
} as const

export type SupportedCurrency = keyof typeof SUPPORTED_CURRENCIES

export const DEFAULT_CURRENCY: SupportedCurrency = 'SGD'

// ============================================================================
// Prompt Options
// ============================================================================

export interface PromptOptions {
  /**
   * Override currency detection with a specific currency
   */
  currencyOverride?: SupportedCurrency
  
  /**
   * User's account location for currency fallback
   */
  userLocation?: string
  
  /**
   * Include detailed examples in prompt (increases token usage)
   * Default: false (optimized for cost)
   */
  includeExamples?: boolean
  
  /**
   * Custom instructions to append to the prompt
   */
  customInstructions?: string
}

// ============================================================================
// System Role
// ============================================================================

const SYSTEM_ROLE = `You are an expert data extraction assistant specializing in food and beverage menus. Your task is to convert menu images into clean, hierarchical JSON that matches the provided schema with high accuracy and confidence scoring.`

// ============================================================================
// Core Instructions
// ============================================================================

const CORE_INSTRUCTIONS = `Extract structured menu data from the image as JSON.

CRITICAL RULES:
1. Return ONLY valid JSON - no commentary, markdown, or explanations
2. Do NOT fabricate data - use uncertainItems array if unsure
3. Extract ALL visible menu content
4. Preserve hierarchy (categories → subcategories → items)
5. Assign accurate confidence scores (0.0-1.0)

EXTRACTION GUIDELINES:

**Categories:**
- Extract category names exactly as shown (preserve case)
- Nest subcategories under parents
- Use "Main Menu" if no categories visible
- Confidence reflects categorization certainty

**Items:**
- Extract ALL items, even if price is not visible
- Extract name, price, description (if present)
- Strip currency symbols - numeric values only
- For multiple sizes/prices, use first/smallest
- If price not visible, set to 0 and lower confidence (0.7-0.8)
- Only use uncertainItems if item NAME is unclear, not just price

**Confidence Scores:**
- 0.9-1.0: Clear and complete
- 0.7-0.8: Mostly readable, minor ambiguity
- 0.5-0.6: Partially readable or inferred
- 0.3-0.4: Fragmentary or obscured
- 0.0-0.2: Barely visible or uncertain

**Uncertain Items:**
- Flag any uncertain text with reason
- Include suggestedCategory/suggestedPrice if possible
- Better to flag than fabricate

**Superfluous Text:**
- Identify non-menu text (taglines, social media, service charges)
- Note context (header, footer, sidebar)

**Currency:**
- Detect from symbols ($, S$, RM, ฿, etc.) or codes (SGD, USD, etc.)
- Use most common if multiple found
- Fall back to provided default if none detected`

// ============================================================================
// Currency Detection Instructions
// ============================================================================

function getCurrencyInstructions(options: PromptOptions): string {
  const fallbackCurrency = options.currencyOverride || DEFAULT_CURRENCY
  
  const currencyList = Object.entries(SUPPORTED_CURRENCIES)
    .map(([code, info]) => `  - ${code}: ${info.symbols.join(', ')}`)
    .join('\n')
  
  return `
**Currency Detection:**
Detect the currency used in the menu from these supported currencies:

${currencyList}

Detection priority:
1. Look for explicit currency codes (SGD, USD, MYR, etc.)
2. Look for currency symbols ($, S$, RM, ฿, etc.)
3. If ambiguous (e.g., $ could be USD, SGD, AUD), use context clues
4. If no currency detected, default to: ${fallbackCurrency}

IMPORTANT: Strip all currency symbols from price values. Store prices as numbers only.`
}

// ============================================================================
// Schema Instructions
// ============================================================================

function getSchemaInstructions(): string {
  // Optimized: Provide concise schema structure instead of full JSON Schema
  return `
**OUTPUT SCHEMA:**

Return JSON with this structure:

{
  "menu": {
    "categories": [
      {
        "name": "string (1-100 chars)",
        "confidence": number (0.0-1.0),
        "items": [
          {
            "name": "string (1-200 chars)",
            "price": number (non-negative),
            "description": "string (optional, max 500 chars)",
            "confidence": number (0.0-1.0)
          }
        ],
        "subcategories": [] // Optional nested categories
      }
    ]
  },
  "currency": "string (e.g., SGD, USD, MYR)",
  "uncertainItems": [
    {
      "text": "string",
      "reason": "string",
      "confidence": number,
      "suggestedCategory": "string (optional)",
      "suggestedPrice": number (optional)
    }
  ],
  "superfluousText": [
    {
      "text": "string",
      "context": "string",
      "confidence": number
    }
  ]
}

**Required:** menu.categories (min 1), currency, uncertainItems, superfluousText (arrays can be empty)`
}

// ============================================================================
// Example Output
// ============================================================================

function getExampleSection(includeExamples: boolean): string {
  if (!includeExamples) {
    return ''
  }
  
  const exampleOutput = getSimpleExampleForPrompt()
  
  return `

**EXAMPLE OUTPUT:**

Here's an example of correctly formatted output:

\`\`\`json
${exampleOutput}
\`\`\`

Notice:
- Clear hierarchical structure with categories
- Numeric prices without currency symbols
- Confidence scores for each item and category
- Empty arrays for uncertainItems and superfluousText (this menu was clear)
- Currency detected as "SGD"`
}

// ============================================================================
// Final Output Instructions
// ============================================================================

const OUTPUT_INSTRUCTIONS = `

**FINAL OUTPUT FORMAT:**

Return ONLY the JSON object. Do not include:
- Markdown code fences (\`\`\`json)
- Explanatory text before or after the JSON
- Comments within the JSON
- Any other formatting

Your response should start with { and end with } - nothing else.`

// ============================================================================
// Prompt Builder
// ============================================================================

/**
 * Build the complete extraction prompt for Stage 1
 * 
 * Optimization: Examples are now disabled by default to reduce token usage
 * and cost. The model performs well without examples in most cases.
 */
export function buildStage1Prompt(options: PromptOptions = {}): string {
  const {
    includeExamples = false, // Changed default to false for cost optimization
    customInstructions = ''
  } = options
  
  const sections = [
    CORE_INSTRUCTIONS,
    getCurrencyInstructions(options),
    getSchemaInstructions(),
    getExampleSection(includeExamples),
    customInstructions ? `\n**ADDITIONAL INSTRUCTIONS:**\n${customInstructions}` : '',
    OUTPUT_INSTRUCTIONS
  ]
  
  return sections.filter(Boolean).join('\n')
}

/**
 * Get the system role for the extraction
 */
export function getSystemRole(): string {
  return SYSTEM_ROLE
}

/**
 * Get the temperature setting for deterministic extraction
 */
export function getTemperature(): number {
  return PROMPT_TEMPERATURE
}

/**
 * Get the prompt version
 */
export function getPromptVersion(): string {
  return PROMPT_VERSION
}

// ============================================================================
// Complete Prompt Package
// ============================================================================

export interface PromptPackage {
  systemRole: string
  userPrompt: string
  temperature: number
  version: string
  schemaVersion: typeof PROMPT_SCHEMA_VERSION
}

/**
 * Get the complete prompt package ready for API submission
 */
export function getPromptPackage(options: PromptOptions = {}): PromptPackage {
  return {
    systemRole: getSystemRole(),
    userPrompt: buildStage1Prompt(options),
    temperature: getTemperature(),
    version: getPromptVersion(),
    schemaVersion: PROMPT_SCHEMA_VERSION
  }
}

// ============================================================================
// Prompt Validation
// ============================================================================

/**
 * Validate prompt options
 */
export function validatePromptOptions(options: PromptOptions): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Validate currency override
  if (options.currencyOverride && !SUPPORTED_CURRENCIES[options.currencyOverride]) {
    errors.push(`Invalid currency override: ${options.currencyOverride}`)
  }
  
  // Validate custom instructions length
  if (options.customInstructions && options.customInstructions.length > 1000) {
    errors.push('Custom instructions too long (max 1000 characters)')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get currency fallback based on user location
 */
export function getCurrencyFromLocation(location?: string): SupportedCurrency {
  if (!location) {
    return DEFAULT_CURRENCY
  }
  
  const locationMap: Record<string, SupportedCurrency> = {
    SG: 'SGD',
    US: 'USD',
    MY: 'MYR',
    TH: 'THB',
    ID: 'IDR',
    PH: 'PHP',
    VN: 'VND',
    JP: 'JPY',
    CN: 'CNY',
    EU: 'EUR',
    GB: 'GBP',
    AU: 'AUD',
    NZ: 'NZD',
    HK: 'HKD',
    TW: 'TWD',
    KR: 'KRW'
  }
  
  const countryCode = location.toUpperCase().substring(0, 2)
  return locationMap[countryCode] || DEFAULT_CURRENCY
}

/**
 * Get list of all supported currencies
 */
export function getSupportedCurrencies(): SupportedCurrency[] {
  return Object.keys(SUPPORTED_CURRENCIES) as SupportedCurrency[]
}

/**
 * Check if a currency is supported
 */
export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return currency in SUPPORTED_CURRENCIES
}

/**
 * Get currency info
 */
export function getCurrencyInfo(currency: SupportedCurrency) {
  return SUPPORTED_CURRENCIES[currency]
}
