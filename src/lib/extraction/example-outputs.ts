/**
 * Example Extraction Outputs for Prompt Inclusion
 * 
 * These examples are included in the vision-LLM prompt to guide
 * the extraction format and demonstrate expected output structure.
 */

import type { ExtractionResult } from './schema-stage1'

/**
 * Example 1: Simple single-column menu with clear categories
 */
export const EXAMPLE_SIMPLE_MENU: ExtractionResult = {
  menu: {
    categories: [
      {
        name: 'BAR BITES',
        items: [
          {
            name: 'GARLIC BUTTER TOAST',
            price: 6,
            confidence: 1.0
          },
          {
            name: 'TRUFFLE FRIES',
            price: 12,
            description: 'With parmesan and herbs',
            confidence: 1.0
          },
          {
            name: 'CHICKEN WINGS',
            price: 14,
            description: 'Choice of BBQ or Buffalo sauce',
            confidence: 0.95
          }
        ],
        confidence: 1.0
      },
      {
        name: 'MAIN COURSES',
        items: [
          {
            name: 'GRILLED SALMON',
            price: 28,
            description: 'With seasonal vegetables',
            confidence: 1.0
          },
          {
            name: 'RIBEYE STEAK',
            price: 42,
            description: '300g, served with mashed potatoes',
            confidence: 1.0
          }
        ],
        confidence: 1.0
      }
    ]
  },
  currency: 'SGD',
  uncertainItems: [],
  superfluousText: [
    {
      text: 'Follow us @restaurant_name',
      context: 'footer',
      confidence: 1.0
    }
  ]
}

/**
 * Example 2: Hierarchical menu with subcategories
 */
export const EXAMPLE_HIERARCHICAL_MENU: ExtractionResult = {
  menu: {
    categories: [
      {
        name: 'PREMIUM STEAKS',
        items: [],
        subcategories: [
          {
            name: 'WAGYU SELECTION',
            items: [
              {
                name: 'A5 WAGYU RIBEYE',
                price: 180,
                description: '200g Japanese A5 grade',
                confidence: 1.0
              },
              {
                name: 'WAGYU SIRLOIN',
                price: 150,
                description: '250g premium cut',
                confidence: 1.0
              }
            ],
            confidence: 1.0
          },
          {
            name: 'ANGUS BEEF',
            items: [
              {
                name: 'ANGUS RIBEYE',
                price: 48,
                description: '300g grain-fed',
                confidence: 1.0
              },
              {
                name: 'ANGUS TENDERLOIN',
                price: 52,
                description: '250g center cut',
                confidence: 1.0
              }
            ],
            confidence: 1.0
          }
        ],
        confidence: 1.0
      },
      {
        name: 'SIDES',
        items: [
          {
            name: 'MASHED POTATOES',
            price: 8,
            confidence: 1.0
          },
          {
            name: 'GRILLED VEGETABLES',
            price: 10,
            confidence: 1.0
          }
        ],
        confidence: 1.0
      }
    ]
  },
  currency: 'SGD',
  uncertainItems: [],
  superfluousText: []
}

/**
 * Example 3: Menu with uncertain items and low confidence
 */
export const EXAMPLE_WITH_UNCERTAINTIES: ExtractionResult = {
  menu: {
    categories: [
      {
        name: 'APPETIZERS',
        items: [
          {
            name: 'SPRING ROLLS',
            price: 8,
            description: 'Vegetarian',
            confidence: 1.0
          },
          {
            name: 'SOUP OF THE DAY',
            price: 10,
            confidence: 0.85
          }
        ],
        confidence: 0.9
      },
      {
        name: 'MAINS',
        items: [
          {
            name: 'GRILLED CHICKEN',
            price: 22,
            confidence: 0.75
          }
        ],
        confidence: 0.8
      }
    ]
  },
  currency: 'SGD',
  uncertainItems: [
    {
      text: 'Sp...al Pasta - $18',
      reason: 'Item name partially obscured by shadow',
      confidence: 0.4,
      suggestedCategory: 'MAINS',
      suggestedPrice: 18
    },
    {
      text: 'Chef\'s Recommendation',
      reason: 'No price visible, appears to be section header',
      confidence: 0.3
    }
  ],
  superfluousText: [
    {
      text: 'All prices subject to 10% service charge and 7% GST',
      context: 'footer',
      confidence: 1.0
    },
    {
      text: 'Established 2015',
      context: 'header',
      confidence: 1.0
    }
  ]
}

/**
 * Example 4: Multi-currency menu (Malaysian Ringgit)
 */
export const EXAMPLE_MULTI_CURRENCY: ExtractionResult = {
  menu: {
    categories: [
      {
        name: 'NASI LEMAK SPECIALS',
        items: [
          {
            name: 'NASI LEMAK AYAM GORENG',
            price: 12.90,
            description: 'With fried chicken, sambal, egg, anchovies',
            confidence: 1.0
          },
          {
            name: 'NASI LEMAK RENDANG',
            price: 15.90,
            description: 'With beef rendang',
            confidence: 1.0
          }
        ],
        confidence: 1.0
      },
      {
        name: 'BEVERAGES',
        items: [
          {
            name: 'TEH TARIK',
            price: 3.50,
            confidence: 1.0
          },
          {
            name: 'KOPI O',
            price: 2.80,
            confidence: 1.0
          }
        ],
        confidence: 1.0
      }
    ]
  },
  currency: 'MYR',
  uncertainItems: [],
  superfluousText: []
}

/**
 * Example 5: Menu with price ranges (should extract minimum)
 */
export const EXAMPLE_PRICE_RANGES: ExtractionResult = {
  menu: {
    categories: [
      {
        name: 'PIZZAS',
        items: [
          {
            name: 'MARGHERITA',
            price: 18,
            description: 'Small 9" - $18, Large 12" - $28',
            confidence: 0.9
          },
          {
            name: 'PEPPERONI',
            price: 22,
            description: 'Small 9" - $22, Large 12" - $32',
            confidence: 0.9
          }
        ],
        confidence: 1.0
      }
    ]
  },
  currency: 'SGD',
  uncertainItems: [
    {
      text: 'Note: Prices shown are for small size. See description for large size pricing.',
      reason: 'Informational note about pricing structure',
      confidence: 0.8
    }
  ],
  superfluousText: []
}

/**
 * Get all examples as an array
 */
export const ALL_EXAMPLES = [
  EXAMPLE_SIMPLE_MENU,
  EXAMPLE_HIERARCHICAL_MENU,
  EXAMPLE_WITH_UNCERTAINTIES,
  EXAMPLE_MULTI_CURRENCY,
  EXAMPLE_PRICE_RANGES
]

/**
 * Get a specific example by name for prompt inclusion
 */
export function getExample(name: 'simple' | 'hierarchical' | 'uncertainties' | 'multi-currency' | 'price-ranges'): ExtractionResult {
  switch (name) {
    case 'simple':
      return EXAMPLE_SIMPLE_MENU
    case 'hierarchical':
      return EXAMPLE_HIERARCHICAL_MENU
    case 'uncertainties':
      return EXAMPLE_WITH_UNCERTAINTIES
    case 'multi-currency':
      return EXAMPLE_MULTI_CURRENCY
    case 'price-ranges':
      return EXAMPLE_PRICE_RANGES
  }
}

/**
 * Format an example as a string for prompt inclusion
 */
export function formatExampleForPrompt(example: ExtractionResult): string {
  return JSON.stringify(example, null, 2)
}

/**
 * Get the simple example formatted for prompt (most commonly used)
 */
export function getSimpleExampleForPrompt(): string {
  return formatExampleForPrompt(EXAMPLE_SIMPLE_MENU)
}
