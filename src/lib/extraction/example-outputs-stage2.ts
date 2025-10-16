/**
 * Example Extraction Outputs for Stage 2 (variants, modifiers, set menus)
 */

import type { ExtractionResultV2 } from './schema-stage2'

export const EXAMPLE_V2_WITH_VARIANTS_AND_MODIFIERS: ExtractionResultV2 = {
  menu: {
    categories: [
      {
        name: 'BURGERS',
        items: [
          {
            name: 'CLASSIC CHEESEBURGER',
            description: 'Beef patty, cheddar, lettuce, tomato',
            confidence: 1.0,
            variants: [
              { size: 'Single', price: 12, confidence: 1.0 },
              { size: 'Double', price: 16, confidence: 1.0 }
            ],
            modifierGroups: [
              {
                name: 'Add-ons',
                type: 'multi',
                required: false,
                options: [
                  { name: 'Bacon', priceDelta: 2 },
                  { name: 'Avocado', priceDelta: 2 },
                  { name: 'Extra Cheese', priceDelta: 1 }
                ]
              }
            ],
            additional: {
              servedWith: ['Fries', 'Pickles']
            }
          }
        ],
        confidence: 1.0
      }
    ]
  },
  currency: 'USD',
  uncertainItems: [],
  superfluousText: []
}

export const EXAMPLE_V2_SET_MENU: ExtractionResultV2 = {
  menu: {
    categories: [
      {
        name: 'LUNCH SETS',
        items: [
          {
            name: '2-COURSE LUNCH',
            confidence: 0.95,
            price: 22,
            type: 'set_menu',
            setMenu: {
              courses: [
                {
                  name: 'Starter',
                  options: [
                    { name: 'Soup of the Day' },
                    { name: 'Green Salad' }
                  ]
                },
                {
                  name: 'Main',
                  options: [
                    { name: 'Grilled Chicken' },
                    { name: 'Pasta', priceDelta: 3 }
                  ]
                }
              ],
              notes: 'Includes coffee or tea'
            }
          }
        ],
        confidence: 0.95
      }
    ]
  },
  currency: 'SGD',
  uncertainItems: [],
  superfluousText: []
}

export function formatExampleV2ForPrompt(example: ExtractionResultV2): string {
  return JSON.stringify(example, null, 2)
}

export function getStage2SimpleExampleForPrompt(): string {
  return formatExampleV2ForPrompt(EXAMPLE_V2_WITH_VARIANTS_AND_MODIFIERS)
}


