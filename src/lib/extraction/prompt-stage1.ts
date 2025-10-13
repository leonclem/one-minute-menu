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

const CORE_INSTRUCTIONS = `Your task is to extract structured menu data from the provided image and return it as JSON.

CRITICAL RULES:
1. Return ONLY valid JSON - no commentary, no markdown, no explanations
2. Do NOT fabricate data - if uncertain, use the uncertainItems array
3. Extract ALL visible text that appears to be menu content
4. Preserve hierarchical structure (categories → subcategories → items)
5. Assign accurate confidence scores based on text clarity

EXTRACTION GUIDELINES:

**Categories and Hierarchy:**
- Extract ALL category names exactly as they appear (preserve capitalization)
- Detect subcategories and nest them under parent categories
- If no clear categories exist, create a single "Main Menu" category
- Category confidence should reflect how certain you are about the categorization

**Menu Items:**
- Extract item name, price, and description (if present)
- Strip currency symbols from prices - store as numeric values only
- If an item has multiple sizes/prices, extract the first/smallest price for Stage 1
- Include any visible description text (ingredients, preparation, serving info)
- Item confidence should reflect text clarity and completeness

**Confidence Scoring Logic:**
- 0.9-1.0: Text is clear, certain, and complete
- 0.7-0.8: Text is mostly readable with minor ambiguity
- 0.5-0.6: Text is partially readable or inferred from context
- 0.3-0.4: Text is fragmentary or heavily obscured
- 0.0-0.2: Text is barely visible or completely uncertain

**Uncertain Items:**
- Include ANY text that might be a menu item but you're not confident about
- Provide a clear reason (e.g., "text blurred", "price not visible", "ambiguous category")
- If you can make a reasonable guess, include suggestedCategory and/or suggestedPrice
- Better to flag as uncertain than to fabricate data

**Superfluous Text:**
- Identify decorative or non-menu text (taglines, social media, service charges)
- Include context about where it appeared (header, footer, sidebar, etc.)
- Examples: "Follow us @...", "Established 20XX", "All prices subject to..."

**Currency Detection:**
- Detect currency from symbols: $, S$, RM, ฿, Rp, ₱, ₫, ¥, €, £, etc.
- Look for currency codes: SGD, USD, MYR, THB, IDR, PHP, VND, JPY, CNY, EUR, GBP
- If multiple currencies appear, use the most common one
- If no currency is detected, use the fallback currency provided`

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
  const schemaString = JSON.stringify(STAGE1_JSON_SCHEMA, null, 2)
  
  return `
**OUTPUT SCHEMA:**

Your output MUST conform to this JSON schema:

\`\`\`json
${schemaString}
\`\`\`

**Required Fields:**
- menu.categories: Array of at least one category
- currency: Currency code (e.g., "SGD", "USD", "MYR")
- uncertainItems: Array (can be empty if all items extracted confidently)
- superfluousText: Array (can be empty if no decorative text found)

**Field Constraints:**
- Item names: 1-200 characters
- Category names: 1-100 characters
- Descriptions: max 500 characters
- Prices: non-negative numbers
- Confidence: 0.0 to 1.0`
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
 */
export function buildStage1Prompt(options: PromptOptions = {}): string {
  const {
    includeExamples = true,
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
