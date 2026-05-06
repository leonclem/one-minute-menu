// Feature: posthog-integration, Property 4: Undefined-value stripping, Validates Requirements: 2.6, 14.4

import * as fc from 'fast-check'
import { sanitizeProperties } from '../sanitize'

const propValueArb = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
)

describe('Property 4: Undefined-value stripping', () => {
  it('should remove all undefined values from the output', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string(),
          fc.oneof(fc.constant(undefined), propValueArb),
        ),
        (input) => {
          const output = sanitizeProperties(input)
          for (const value of Object.values(output)) {
            if (value === undefined) {
              return false
            }
          }
          return true
        },
      ),
      { numRuns: 100 },
    )
  })

  it('should preserve null values but drop undefined values (explicit example)', () => {
    const result = sanitizeProperties({ keep: null, drop: undefined })
    expect(result).toHaveProperty('keep', null)
    expect(result).not.toHaveProperty('drop')
  })
})
