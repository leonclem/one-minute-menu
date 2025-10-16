/**
 * JSON Schema Definition for Stage 2 Extraction
 *
 * Backward-compatible with Stage 1: items may either have a base price
 * or variants, and may omit Stage 2-specific fields.
 */

export const STAGE2_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Menu Extraction Result (Stage 2)',
  description: 'Structured menu data with variants, modifiers, and set menus',
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
          items: { $ref: '#/definitions/category' }
        }
      }
    },
    currency: { type: 'string', minLength: 1, maxLength: 10 },
    uncertainItems: {
      type: 'array',
      items: {
        type: 'object',
        required: ['text', 'reason', 'confidence'],
        properties: {
          text: { type: 'string' },
          reason: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          suggestedCategory: { type: 'string' },
          suggestedPrice: { type: 'number', minimum: 0 }
        }
      }
    },
    superfluousText: {
      type: 'array',
      items: {
        type: 'object',
        required: ['text', 'context', 'confidence'],
        properties: {
          text: { type: 'string' },
          context: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        }
      }
    }
  },
  definitions: {
    category: {
      type: 'object',
      required: ['name', 'items', 'confidence'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        items: {
          type: 'array',
          items: { $ref: '#/definitions/menuItemV2' }
        },
        subcategories: {
          type: 'array',
          items: { $ref: '#/definitions/category' }
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 }
      }
    },
    menuItemV2: {
      type: 'object',
      required: ['name', 'confidence'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200 },
        price: { type: 'number', minimum: 0 },
        description: { type: 'string', maxLength: 500 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        variants: {
          type: 'array',
          items: { $ref: '#/definitions/itemVariant' }
        },
        modifierGroups: {
          type: 'array',
          items: { $ref: '#/definitions/modifierGroup' }
        },
        additional: { $ref: '#/definitions/additionalInfo' },
        type: { type: 'string', enum: ['standard', 'set_menu', 'combo'] },
        setMenu: { $ref: '#/definitions/setMenu' }
      },
      allOf: [
        {
          anyOf: [
            { required: ['price'] },
            { required: ['variants'] },
            { required: ['setMenu'] }
          ]
        },
        {
          if: { properties: { type: { const: 'set_menu' } } },
          then: { required: ['setMenu'] }
        }
      ]
    },
    itemVariant: {
      type: 'object',
      required: ['price'],
      properties: {
        size: { type: 'string', maxLength: 100 },
        price: { type: 'number', minimum: 0 },
        attributes: {
          type: 'object',
          additionalProperties: {
            anyOf: [
              { type: 'string' },
              { type: 'number' },
              { type: 'boolean' }
            ]
          }
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 }
      }
    },
    modifierGroup: {
      type: 'object',
      required: ['name', 'type', 'required', 'options'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        type: { type: 'string', enum: ['single', 'multi'] },
        required: { type: 'boolean' },
        options: {
          type: 'array',
          minItems: 1,
          items: { $ref: '#/definitions/modifierOption' }
        }
      }
    },
    modifierOption: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        priceDelta: { type: 'number' }
      }
    },
    additionalInfo: {
      type: 'object',
      properties: {
        servedWith: { type: 'array', items: { type: 'string' } },
        forPax: { type: 'integer', minimum: 1 },
        prepTimeMin: { type: 'integer', minimum: 0 },
        notes: { type: 'string', maxLength: 500 }
      },
      additionalProperties: false
    },
    setMenu: {
      type: 'object',
      required: ['courses'],
      properties: {
        courses: {
          type: 'array',
          minItems: 1,
          items: { $ref: '#/definitions/setMenuCourse' }
        },
        notes: { type: 'string', maxLength: 500 }
      }
    },
    setMenuCourse: {
      type: 'object',
      required: ['name', 'options'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200 },
        options: {
          type: 'array',
          minItems: 1,
          items: { $ref: '#/definitions/setMenuOption' }
        }
      }
    },
    setMenuOption: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200 },
        priceDelta: { type: 'number' }
      }
    }
  }
} as const

export function getStage2SchemaForPrompt(): string {
  return JSON.stringify(STAGE2_JSON_SCHEMA, null, 2)
}

export function getStage2MinifiedSchema(): string {
  return JSON.stringify(STAGE2_JSON_SCHEMA)
}


