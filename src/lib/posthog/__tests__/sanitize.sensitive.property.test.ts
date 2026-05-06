// Feature: posthog-integration, Property 3: Sensitive-key stripping, Validates Requirements: 2.5, 10.3, 10.4, 14.3

import * as fc from 'fast-check'
import { SENSITIVE_KEYS } from '../config'
import { sanitizeProperties } from '../sanitize'

const propValueArb = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
)

describe('Property 3: Sensitive-key stripping', () => {
  it('should remove all sensitive keys from the output regardless of input', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.oneof(fc.constantFrom(...Array.from(SENSITIVE_KEYS)), fc.string()),
          propValueArb,
        ),
        (input) => {
          const output = sanitizeProperties(input)
          for (const key of Object.keys(output)) {
            if (SENSITIVE_KEYS.has(key.toLowerCase())) {
              return false
            }
          }
          return true
        },
      ),
      { numRuns: 100 },
    )
  })
})
