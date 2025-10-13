/**
 * JSON Schema Definition for Stage 1 Extraction
 * 
 * This JSON Schema is embedded in the vision-LLM prompt to guide
 * the extraction output format. It's a plain JSON object that can
 * be stringified and included in prompts.
 */

export const STAGE1_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Menu Extraction Result (Stage 1)',
  description: 'Structured menu data extracted from image with hierarchical categories',
  type: 'object',
  required: ['menu', 'currency', 'uncertainItems', 'superfluousText'],
  properties: {
    menu: {
      type: 'object',
      required: ['categories'],
      properties: {
        categories: {
          type: 'array',
          minItems: 1,
          items: {
            $ref: '#/definitions/category'
          }
        }
      }
    },
    currency: {
      type: 'string',
      description: 'Currency code (e.g., SGD, USD, MYR, JPY)',
      minLength: 1,
      maxLength: 10
    },
    uncertainItems: {
      type: 'array',
      description: 'Items that could not be extracted with confidence',
      items: {
        type: 'object',
        required: ['text', 'reason', 'confidence'],
        properties: {
          text: {
            type: 'string',
            description: 'The uncertain text from the menu'
          },
          reason: {
            type: 'string',
            description: 'Why this item is uncertain (e.g., "text too blurry", "ambiguous price")'
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          },
          suggestedCategory: {
            type: 'string',
            description: 'Best guess for which category this belongs to'
          },
          suggestedPrice: {
            type: 'number',
            minimum: 0,
            description: 'Best guess for the price if partially readable'
          }
        }
      }
    },
    superfluousText: {
      type: 'array',
      description: 'Decorative or non-menu text (taglines, social media, service charges)',
      items: {
        type: 'object',
        required: ['text', 'context', 'confidence'],
        properties: {
          text: {
            type: 'string',
            description: 'The decorative text'
          },
          context: {
            type: 'string',
            description: 'Where it appeared (e.g., "header", "footer", "sidebar")'
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          }
        }
      }
    }
  },
  definitions: {
    category: {
      type: 'object',
      required: ['name', 'items', 'confidence'],
      properties: {
        name: {
          type: 'string',
          description: 'Category name (e.g., "APPETIZERS", "MAIN COURSES")',
          minLength: 1,
          maxLength: 100
        },
        items: {
          type: 'array',
          items: {
            $ref: '#/definitions/menuItem'
          }
        },
        subcategories: {
          type: 'array',
          description: 'Nested subcategories for hierarchical menus',
          items: {
            $ref: '#/definitions/category'
          }
        },
        confidence: {
          type: 'number',
          description: 'Confidence score for this category (0.0 to 1.0)',
          minimum: 0,
          maximum: 1
        }
      }
    },
    menuItem: {
      type: 'object',
      required: ['name', 'price', 'confidence'],
      properties: {
        name: {
          type: 'string',
          description: 'Item name',
          minLength: 1,
          maxLength: 200
        },
        price: {
          type: 'number',
          description: 'Price as numeric value (no currency symbols)',
          minimum: 0
        },
        description: {
          type: 'string',
          description: 'Optional item description',
          maxLength: 500
        },
        confidence: {
          type: 'number',
          description: 'Confidence score for this item (0.0 to 1.0)',
          minimum: 0,
          maximum: 1
        }
      }
    }
  }
} as const

/**
 * Get a compact JSON string representation for prompt inclusion
 */
export function getSchemaForPrompt(): string {
  return JSON.stringify(STAGE1_JSON_SCHEMA, null, 2)
}

/**
 * Get a minified JSON string for API transmission
 */
export function getMinifiedSchema(): string {
  return JSON.stringify(STAGE1_JSON_SCHEMA)
}
