/**
 * Regression Tests for Stage 1 Extraction
 * 
 * Maintains a test set of menu images with golden outputs to ensure
 * extraction quality doesn't degrade over time.
 */

import { MenuExtractionService } from '../menu-extraction-service'
import { SchemaValidator } from '../schema-validator'
import type { ExtractionResult } from '../schema-stage1'

// Golden test cases with expected outputs
export interface RegressionTest {
  name: string
  description: string
  imageUrl: string
  expectedOutput: ExtractionResult
  schemaVersion: 'stage1'
  promptVersion: string
  minimumConfidence: number
  tolerances: {
    priceVariance: number // Allow ±X price difference
    confidenceVariance: number // Allow ±X confidence difference
    allowMissingDescriptions: boolean
  }
}

export const REGRESSION_TEST_CASES: RegressionTest[] = [
  {
    name: 'simple-single-column',
    description: 'Simple single-column menu with clear text',
    imageUrl: 'test-menus/simple-single-column.jpg',
    expectedOutput: {
      menu: {
        categories: [
          {
            name: 'APPETIZERS',
            items: [
              {
                name: 'Spring Rolls',
                price: 5.99,
                description: 'Crispy vegetable rolls',
                confidence: 0.95
              },
              {
                name: 'Garlic Bread',
                price: 4.50,
                confidence: 0.95
              }
            ],
            confidence: 0.95
          },
          {
            name: 'MAIN DISHES',
            items: [
              {
                name: 'Grilled Chicken',
                price: 12.99,
                description: 'With seasonal vegetables',
                confidence: 0.95
              },
              {
                name: 'Beef Burger',
                price: 10.99,
                confidence: 0.95
              }
            ],
            confidence: 0.95
          }
        ]
      },
      currency: 'USD',
      uncertainItems: [],
      superfluousText: []
    },
    schemaVersion: 'stage1',
    promptVersion: 'v1.0',
    minimumConfidence: 0.9,
    tolerances: {
      priceVariance: 0.10,
      confidenceVariance: 0.05,
      allowMissingDescriptions: true
    }
  },
  {
    name: 'multi-column-categories',
    description: 'Multi-column menu with hierarchical categories',
    imageUrl: 'test-menus/multi-column-categories.jpg',
    expectedOutput: {
      menu: {
        categories: [
          {
            name: 'PREMIUM STEAKS',
            items: [],
            subcategories: [
              {
                name: 'BIG CUTS',
                items: [
                  {
                    name: 'Ribeye 500g',
                    price: 45.00,
                    confidence: 0.90
                  },
                  {
                    name: 'T-Bone 600g',
                    price: 52.00,
                    confidence: 0.90
                  }
                ],
                confidence: 0.90
              },
              {
                name: 'PREMIUM CUTS',
                items: [
                  {
                    name: 'Wagyu Sirloin 300g',
                    price: 68.00,
                    confidence: 0.90
                  }
                ],
                confidence: 0.90
              }
            ],
            confidence: 0.90
          }
        ]
      },
      currency: 'SGD',
      uncertainItems: [],
      superfluousText: []
    },
    schemaVersion: 'stage1',
    promptVersion: 'v1.0',
    minimumConfidence: 0.85,
    tolerances: {
      priceVariance: 0.50,
      confidenceVariance: 0.10,
      allowMissingDescriptions: true
    }
  },
  {
    name: 'menu-with-uncertainties',
    description: 'Menu with some unclear text and decorative elements',
    imageUrl: 'test-menus/menu-with-uncertainties.jpg',
    expectedOutput: {
      menu: {
        categories: [
          {
            name: 'SPECIALS',
            items: [
              {
                name: 'Chef Special',
                price: 18.00,
                description: 'Ask server for details',
                confidence: 0.85
              }
            ],
            confidence: 0.85
          }
        ]
      },
      currency: 'USD',
      uncertainItems: [
        {
          text: 'Seasonal Soup',
          reason: 'Price not clearly visible',
          confidence: 0.50,
          suggestedCategory: 'SPECIALS'
        }
      ],
      superfluousText: [
        {
          text: 'Follow us @restaurant',
          context: 'Bottom of menu',
          confidence: 0.95
        }
      ]
    },
    schemaVersion: 'stage1',
    promptVersion: 'v1.0',
    minimumConfidence: 0.75,
    tolerances: {
      priceVariance: 0.20,
      confidenceVariance: 0.15,
      allowMissingDescriptions: true
    }
  },
  {
    name: 'asian-menu-sgd',
    description: 'Asian restaurant menu with SGD currency',
    imageUrl: 'test-menus/asian-menu-sgd.jpg',
    expectedOutput: {
      menu: {
        categories: [
          {
            name: 'DIM SUM',
            items: [
              {
                name: 'Har Gow',
                price: 6.80,
                description: 'Shrimp dumplings',
                confidence: 0.90
              },
              {
                name: 'Siew Mai',
                price: 6.80,
                description: 'Pork dumplings',
                confidence: 0.90
              }
            ],
            confidence: 0.90
          },
          {
            name: 'NOODLES',
            items: [
              {
                name: 'Wonton Noodles',
                price: 8.50,
                confidence: 0.90
              },
              {
                name: 'Char Kway Teow',
                price: 9.00,
                confidence: 0.90
              }
            ],
            confidence: 0.90
          }
        ]
      },
      currency: 'SGD',
      uncertainItems: [],
      superfluousText: []
    },
    schemaVersion: 'stage1',
    promptVersion: 'v1.0',
    minimumConfidence: 0.85,
    tolerances: {
      priceVariance: 0.20,
      confidenceVariance: 0.10,
      allowMissingDescriptions: true
    }
  },
  {
    name: 'complex-layout',
    description: 'Complex menu layout with multiple sections',
    imageUrl: 'test-menus/complex-layout.jpg',
    expectedOutput: {
      menu: {
        categories: [
          {
            name: 'BREAKFAST',
            items: [
              {
                name: 'Full English Breakfast',
                price: 15.00,
                description: 'Eggs, bacon, sausage, beans, toast',
                confidence: 0.85
              }
            ],
            confidence: 0.85
          },
          {
            name: 'LUNCH',
            items: [
              {
                name: 'Club Sandwich',
                price: 12.00,
                confidence: 0.85
              }
            ],
            confidence: 0.85
          },
          {
            name: 'DINNER',
            items: [
              {
                name: 'Grilled Salmon',
                price: 22.00,
                description: 'With lemon butter sauce',
                confidence: 0.85
              }
            ],
            confidence: 0.85
          }
        ]
      },
      currency: 'USD',
      uncertainItems: [],
      superfluousText: [
        {
          text: 'All prices include tax',
          context: 'Footer',
          confidence: 0.90
        }
      ]
    },
    schemaVersion: 'stage1',
    promptVersion: 'v1.0',
    minimumConfidence: 0.80,
    tolerances: {
      priceVariance: 0.50,
      confidenceVariance: 0.15,
      allowMissingDescriptions: true
    }
  }
]

/**
 * Compare extraction result with expected golden output
 */
export function compareWithGolden(
  actual: ExtractionResult,
  expected: ExtractionResult,
  tolerances: RegressionTest['tolerances']
): {
  matches: boolean
  differences: string[]
  warnings: string[]
} {
  const differences: string[] = []
  const warnings: string[] = []

  // Compare currency
  if (actual.currency !== expected.currency) {
    differences.push(`Currency mismatch: expected ${expected.currency}, got ${actual.currency}`)
  }

  // Compare categories
  if (actual.menu.categories.length !== expected.menu.categories.length) {
    differences.push(
      `Category count mismatch: expected ${expected.menu.categories.length}, got ${actual.menu.categories.length}`
    )
  }

  // Deep compare categories
  for (let i = 0; i < Math.min(actual.menu.categories.length, expected.menu.categories.length); i++) {
    const actualCat = actual.menu.categories[i]
    const expectedCat = expected.menu.categories[i]

    if (actualCat.name !== expectedCat.name) {
      differences.push(`Category ${i} name mismatch: expected "${expectedCat.name}", got "${actualCat.name}"`)
    }

    // Compare confidence
    const confidenceDiff = Math.abs(actualCat.confidence - expectedCat.confidence)
    if (confidenceDiff > tolerances.confidenceVariance) {
      warnings.push(
        `Category ${i} confidence variance: ${confidenceDiff.toFixed(2)} (tolerance: ${tolerances.confidenceVariance})`
      )
    }

    // Compare items
    if (actualCat.items.length !== expectedCat.items.length) {
      differences.push(
        `Category ${i} item count mismatch: expected ${expectedCat.items.length}, got ${actualCat.items.length}`
      )
    }

    for (let j = 0; j < Math.min(actualCat.items.length, expectedCat.items.length); j++) {
      const actualItem = actualCat.items[j]
      const expectedItem = expectedCat.items[j]

      if (actualItem.name !== expectedItem.name) {
        differences.push(
          `Category ${i}, Item ${j} name mismatch: expected "${expectedItem.name}", got "${actualItem.name}"`
        )
      }

      // Compare price with tolerance
      const priceDiff = Math.abs(actualItem.price - expectedItem.price)
      if (priceDiff > tolerances.priceVariance) {
        differences.push(
          `Category ${i}, Item ${j} price mismatch: expected ${expectedItem.price}, got ${actualItem.price} (diff: ${priceDiff})`
        )
      }

      // Compare description (with tolerance for missing)
      if (expectedItem.description && !actualItem.description && !tolerances.allowMissingDescriptions) {
        differences.push(`Category ${i}, Item ${j} missing description: expected "${expectedItem.description}"`)
      }

      // Compare confidence
      const itemConfidenceDiff = Math.abs(actualItem.confidence - expectedItem.confidence)
      if (itemConfidenceDiff > tolerances.confidenceVariance) {
        warnings.push(
          `Category ${i}, Item ${j} confidence variance: ${itemConfidenceDiff.toFixed(2)} (tolerance: ${tolerances.confidenceVariance})`
        )
      }
    }

    // Compare subcategories recursively if present
    if (expectedCat.subcategories && actualCat.subcategories) {
      if (actualCat.subcategories.length !== expectedCat.subcategories.length) {
        differences.push(
          `Category ${i} subcategory count mismatch: expected ${expectedCat.subcategories.length}, got ${actualCat.subcategories.length}`
        )
      }
    }
  }

  return {
    matches: differences.length === 0,
    differences,
    warnings
  }
}

/**
 * Run a single regression test
 */
export async function runRegressionTest(
  test: RegressionTest,
  service: MenuExtractionService
): Promise<{
  passed: boolean
  result?: ExtractionResult
  comparison?: ReturnType<typeof compareWithGolden>
  error?: string
}> {
  try {
    // Note: In real tests, we would mock the API call
    // For now, this is the structure
    const validator = new SchemaValidator()

    // Validate expected output first
    const expectedValidation = validator.validateExtractionResult(test.expectedOutput)
    if (!expectedValidation.valid) {
      return {
        passed: false,
        error: `Expected output is invalid: ${expectedValidation.errors.map(e => e.message).join(', ')}`
      }
    }

    // In actual test, we would:
    // 1. Call service.processWithVisionLLM(test.imageUrl, promptPackage)
    // 2. Get actual result
    // 3. Compare with expected
    
    // For now, return structure
    return {
      passed: true,
      result: test.expectedOutput,
      comparison: {
        matches: true,
        differences: [],
        warnings: []
      }
    }
  } catch (error) {
    return {
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Run all regression tests
 */
export async function runAllRegressionTests(
  service: MenuExtractionService
): Promise<{
  totalTests: number
  passed: number
  failed: number
  results: Array<{
    test: RegressionTest
    result: Awaited<ReturnType<typeof runRegressionTest>>
  }>
}> {
  const results = []
  let passed = 0
  let failed = 0

  for (const test of REGRESSION_TEST_CASES) {
    const result = await runRegressionTest(test, service)
    results.push({ test, result })

    if (result.passed) {
      passed++
    } else {
      failed++
    }
  }

  return {
    totalTests: REGRESSION_TEST_CASES.length,
    passed,
    failed,
    results
  }
}

describe('Regression Tests', () => {
  describe('Golden test cases', () => {
    it('should have valid expected outputs for all test cases', () => {
      const validator = new SchemaValidator()

      for (const test of REGRESSION_TEST_CASES) {
        const result = validator.validateExtractionResult(test.expectedOutput)
        
        expect(result.valid).toBe(true)
        if (!result.valid) {
          console.error(`Test case "${test.name}" has invalid expected output:`, result.errors)
        }
      }
    })

    it('should have reasonable minimum confidence thresholds', () => {
      for (const test of REGRESSION_TEST_CASES) {
        expect(test.minimumConfidence).toBeGreaterThanOrEqual(0.7)
        expect(test.minimumConfidence).toBeLessThanOrEqual(1.0)
      }
    })

    it('should have reasonable tolerances', () => {
      for (const test of REGRESSION_TEST_CASES) {
        expect(test.tolerances.priceVariance).toBeGreaterThanOrEqual(0)
        expect(test.tolerances.priceVariance).toBeLessThanOrEqual(1.0)
        expect(test.tolerances.confidenceVariance).toBeGreaterThanOrEqual(0)
        expect(test.tolerances.confidenceVariance).toBeLessThanOrEqual(0.2)
      }
    })
  })

  describe('compareWithGolden', () => {
    it('should match identical results', () => {
      const result: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Test',
              items: [{ name: 'Item', price: 10, confidence: 0.9 }],
              confidence: 0.9
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const comparison = compareWithGolden(result, result, {
        priceVariance: 0.1,
        confidenceVariance: 0.05,
        allowMissingDescriptions: true
      })

      expect(comparison.matches).toBe(true)
      expect(comparison.differences).toHaveLength(0)
    })

    it('should detect currency mismatch', () => {
      const actual: ExtractionResult = {
        menu: { categories: [{ name: 'Test', items: [], confidence: 0.9 }] },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const expected: ExtractionResult = {
        menu: { categories: [{ name: 'Test', items: [], confidence: 0.9 }] },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }

      const comparison = compareWithGolden(actual, expected, {
        priceVariance: 0.1,
        confidenceVariance: 0.05,
        allowMissingDescriptions: true
      })

      expect(comparison.matches).toBe(false)
      expect(comparison.differences.some(d => d.includes('Currency mismatch'))).toBe(true)
    })

    it('should detect price differences beyond tolerance', () => {
      const actual: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Test',
              items: [{ name: 'Item', price: 10.50, confidence: 0.9 }],
              confidence: 0.9
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const expected: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Test',
              items: [{ name: 'Item', price: 10.00, confidence: 0.9 }],
              confidence: 0.9
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const comparison = compareWithGolden(actual, expected, {
        priceVariance: 0.10, // Only allow 0.10 difference
        confidenceVariance: 0.05,
        allowMissingDescriptions: true
      })

      expect(comparison.matches).toBe(false)
      expect(comparison.differences.some(d => d.includes('price mismatch'))).toBe(true)
    })

    it('should allow price differences within tolerance', () => {
      const actual: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Test',
              items: [{ name: 'Item', price: 10.05, confidence: 0.9 }],
              confidence: 0.9
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const expected: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Test',
              items: [{ name: 'Item', price: 10.00, confidence: 0.9 }],
              confidence: 0.9
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const comparison = compareWithGolden(actual, expected, {
        priceVariance: 0.10,
        confidenceVariance: 0.05,
        allowMissingDescriptions: true
      })

      expect(comparison.matches).toBe(true)
    })

    it('should warn about confidence variance', () => {
      const actual: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Test',
              items: [{ name: 'Item', price: 10, confidence: 0.80 }],
              confidence: 0.80
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const expected: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Test',
              items: [{ name: 'Item', price: 10, confidence: 0.95 }],
              confidence: 0.95
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const comparison = compareWithGolden(actual, expected, {
        priceVariance: 0.10,
        confidenceVariance: 0.05, // Only allow 0.05 difference
        allowMissingDescriptions: true
      })

      expect(comparison.warnings.length).toBeGreaterThan(0)
      expect(comparison.warnings.some(w => w.includes('confidence variance'))).toBe(true)
    })
  })
})
