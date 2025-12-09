/**
 * Stage 2 Extraction Prompt Template
 *
 * Extends Stage 1 with instructions for variants, modifier groups,
 * set menus, and additional serving information.
 *
 * Version: v2.0
 * Requirements: 2.1, 2.3, 3.1, 3.3, 5.2, 5.3
 */

import { getStage2SchemaForPrompt } from './json-schema-stage2'
import {
  // Reuse Stage 1 prompt currency config and options to avoid duplication
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  type SupportedCurrency,
  type PromptOptions
} from './prompt-stage1'

// ============================================================================
// Prompt Configuration
// ============================================================================

export const PROMPT_VERSION_V2 = 'v2.0' as const
export const PROMPT_TEMPERATURE_V2 = 0 // Deterministic extraction
export const PROMPT_SCHEMA_VERSION_V2 = 'stage2' as const

// ============================================================================
// System Role
// ============================================================================

const SYSTEM_ROLE_V2 = `You are an expert data extraction assistant specializing in food and beverage menus. Convert menu images into clean, hierarchical JSON that matches the provided Stage 2 schema with high accuracy and confidence scoring.

CRITICAL: Extract ALL menu items, even if pricing is not visible. If a price cannot be determined, set price to 0 and set confidence lower. Only add items to uncertainItems if the item name itself is unclear or illegible.`

// ============================================================================
// Core Instructions (Stage 2)
// ============================================================================

const CORE_INSTRUCTIONS_V2 = `Your task is to extract structured menu data from the provided image and return it as JSON.

⚠️ MOST IMPORTANT RULE: Every menu item MUST have pricing information! ⚠️
- If an item has a visible price, include it in the "price" field
- If an item has multiple size/price options, include them in "variants"
- If an item is part of a set menu, include the set menu price
- If you cannot find a price for an item, set price to 0 and lower the confidence score (e.g., 0.7-0.8)

CRITICAL RULES:
1. Return ONLY valid JSON - no commentary, no markdown, no explanations
2. Do NOT fabricate data - if uncertain, use the uncertainItems array
3. Extract ALL visible text that appears to be menu content
4. Preserve hierarchical structure (categories → subcategories → items)
5. Assign accurate confidence scores based on text clarity

EXTRACTION GUIDELINES (Stage 2):

**Categories and Hierarchy:**
- Extract ALL category names exactly as they appear (preserve capitalization)
- Detect subcategories and nest them under parent categories
- If no clear categories exist, create a single "Main Menu" category
- Category confidence should reflect certainty of categorization

**Menu Items (Base):**
- Extract item name and description (if present)
- CRITICAL: Extract ALL menu items, even if pricing is not clearly visible
- If an item shows a single price, set it in the price field
- If multiple sizes/prices are shown, use variants (see below)
- If you cannot find a price for an item, set price to 0 and lower confidence (e.g., 0.7-0.8)
- Item confidence should reflect text clarity and completeness
- Only add items to uncertainItems if the item NAME itself is unclear or illegible, not just because price is missing

**Variants (sizes/prices/attributes):**
- Detect size/price pairs (e.g., Small 9" $12, Large 12" $18) and create variants
- CRITICAL: Each variant MUST have a numeric price value
- Normalize prices to numbers only (strip currency symbols like $, S$, RM, etc.)
- Set variant.size using visible labels (e.g., Small, Large, 9", 12")
- If no explicit label but multiple prices exist, infer labels like "Regular", "Large" based on ordering
- If price is shown as a range (e.g., $12–$18), create separate variants for min and max or use attributes to encode range
- Include variant.confidence based on clarity of the size/price pairing
- If a size is visible but price is not clear, create the variant with price: 0 and lower confidence

**Modifier Groups (toppings/add-ons/options):**
- Detect groups such as "Add-ons", "Toppings", "Extras", "Choice of"
- Set group.name to the visible heading; set type to 'single' if only one may be selected, else 'multi'
- Mark required=true if wording implies mandatory selection (e.g., "Choose 1")
- For each option, include name and priceDelta when a surcharge is shown (e.g., +$2)
- If wording indicates no extra charge, omit priceDelta

**Set Menus / Combos:**
- If an item is a set/combo/meal with courses or choices, set type='set_menu' and include setMenu
- Break down courses (e.g., Starter, Main, Dessert, Drink) with options under each
- Add priceDelta to options when surcharges apply (e.g., "+$3 for premium ice cream")
- Keep base item price at the item level; use option priceDelta for upsizes/surcharges

**Additional Serving Information:**
- Extract servedWith items (sides/garnishes) into additional.servedWith
- Extract forPax when serving size is indicated (e.g., "for 2 pax")
- Extract prepTimeMin when preparation time is shown (e.g., "ready in 15 mins")
- Use additional.notes for relevant notes (spiciness level, dietary badges) that don't fit elsewhere

**Uncertain Items:**
- Include ANY text that might be a menu item but you're not confident about
- Provide a clear reason (e.g., "text blurred", "price not visible", "ambiguous category")
- If you can make a reasonable guess, include suggestedCategory and/or suggestedPrice
- Better to flag as uncertain than to fabricate data

**Superfluous Text:**
- Identify decorative or non-menu text (taglines, social accounts, service charges)
- Include context about where it appeared (header, footer, sidebar, etc.)
`

// ============================================================================
// Currency Detection Instructions (reuse supported list)
// ============================================================================

function getCurrencyInstructionsV2(options: PromptOptions): string {
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
// Schema Instructions (embed Stage 2 JSON schema)
// ============================================================================

function getSchemaInstructionsV2(): string {
  const schemaString = getStage2SchemaForPrompt()

  return `
**OUTPUT SCHEMA (Stage 2):**

Your output MUST conform to this JSON schema:

\`\`\`json
${schemaString}
\`\`\`

Key fields to use for Stage 2:
- variants: for multiple sizes/prices per item
- modifierGroups: for toppings/add-ons with optional priceDelta
- type and setMenu: for set/combos with courses and options
- additional: for servedWith, forPax, prepTimeMin, notes
`
}

// ============================================================================
// Example Output (Stage 2)
// ============================================================================

import { getStage2SimpleExampleForPrompt } from './example-outputs-stage2'

function getExampleSectionV2(includeExamples: boolean): string {
  if (!includeExamples) {
    return ''
  }

  const exampleOutput = getStage2SimpleExampleForPrompt()

  return `

**EXAMPLE OUTPUT (Stage 2):**

Here's an example of correctly formatted output with variants and a modifier group:

\`\`\`json
${exampleOutput}
\`\`\`
`
}

// ============================================================================
// Final Output Instructions
// ============================================================================

const OUTPUT_INSTRUCTIONS_V2 = `

**FINAL OUTPUT FORMAT:**

Return ONLY the JSON object. Do not include:
- Markdown code fences (\`\`\`json)
- Explanatory text before or after the JSON
- Comments within the JSON
- Any other formatting

Your response should start with { and end with } - nothing else.`

// ============================================================================
// Prompt Builder (Stage 2)
// ============================================================================

/**
 * Build the complete extraction prompt for Stage 2
 * 
 * Optimization: Examples are now disabled by default to reduce token usage
 * and cost. The model performs well without examples in most cases.
 */
export function buildStage2Prompt(options: PromptOptions = {}): string {
  const {
    includeExamples = false, // Changed default to false for cost optimization
    customInstructions = ''
  } = options

  const sections = [
    CORE_INSTRUCTIONS_V2,
    getCurrencyInstructionsV2(options),
    getSchemaInstructionsV2(),
    getExampleSectionV2(includeExamples),
    customInstructions ? `\n**ADDITIONAL INSTRUCTIONS:**\n${customInstructions}` : '',
    OUTPUT_INSTRUCTIONS_V2
  ]

  return sections.filter(Boolean).join('\n')
}

// ============================================================================
// Prompt Package (Stage 2)
// ============================================================================

export interface PromptPackageV2 {
  systemRole: string
  userPrompt: string
  temperature: number
  version: string
  schemaVersion: typeof PROMPT_SCHEMA_VERSION_V2
}

export function getSystemRoleV2(): string {
  return SYSTEM_ROLE_V2
}

export function getTemperatureV2(): number {
  return PROMPT_TEMPERATURE_V2
}

export function getPromptVersionV2(): string {
  return PROMPT_VERSION_V2
}

export function getPromptPackageV2(options: PromptOptions = {}): PromptPackageV2 {
  return {
    systemRole: getSystemRoleV2(),
    userPrompt: buildStage2Prompt(options),
    temperature: getTemperatureV2(),
    version: getPromptVersionV2(),
    schemaVersion: PROMPT_SCHEMA_VERSION_V2
  }
}


