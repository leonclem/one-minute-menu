/**
 * **Validates: Requirements 8.5, 8.6, 10.5**
 */

import fc from 'fast-check'
import { ANALYTICS_EVENTS } from '@/lib/posthog/events'
import {
  sanitizeStudioProperties,
  trackStudioEvent,
} from '@/lib/studio/analytics/studio-analytics'
import {
  STUDIO_ALLOWED_PROPERTY_KEYS,
  type StudioEventName,
} from '@/lib/studio/analytics/studio-events'

let consentGranted = false
const emittedEventNames: string[] = []
const mockTransport = jest.fn(
  (eventName: string, _properties?: Record<string, unknown>) => {
    emittedEventNames.push(eventName)
    throw new Error('analytics transport failed')
  },
)

/**
 * Preserve the contract of the real consent-aware captureEvent wrapper while
 * isolating this property test from the PostHog SDK and network transport.
 */
jest.mock('@/lib/posthog', () => {
  const actual = jest.requireActual('@/lib/posthog')
  return {
    ...actual,
    captureEvent: (
      eventName: string,
      properties?: Record<string, unknown>,
    ) => {
      if (!consentGranted) return
      mockTransport(eventName, properties)
    },
  }
})

type Scalar = string | number | boolean | null

const scalarArbitrary: fc.Arbitrary<Scalar> = fc.oneof(
  fc.constantFrom('preserved-scalar', 'another-preserved-scalar'),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
)

const markerArbitrary = (prefix: string) =>
  fc.string({ minLength: 1, maxLength: 40 }).map((value) => `${prefix}:${value}`)

const allowedPropertiesArbitrary = fc.dictionary(
  fc.constantFrom(...STUDIO_ALLOWED_PROPERTY_KEYS),
  scalarArbitrary,
  { maxKeys: STUDIO_ALLOWED_PROPERTY_KEYS.length },
)

const analyticsInputArbitrary = fc.record({
  allowedProperties: allowedPropertiesArbitrary,
  prompt: markerArbitrary('prompt-text'),
  storagePath: markerArbitrary('storage-path'),
  comment: markerArbitrary('feedback-comment'),
  extractedJson: fc.record({
    marker: markerArbitrary('extracted-json'),
    nested: fc.record({ marker: markerArbitrary('extracted-nested') }),
  }),
  imageBytes: fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 32 }),
  nestedObject: fc.record({ marker: markerArbitrary('nested-object') }),
  nestedArray: fc.array(markerArbitrary('nested-array'), { minLength: 1, maxLength: 8 }),
})

describe('Feature: studio-controlled-beta-readiness, Property 11', () => {
  it('sanitises arbitrary analytics properties to non-PII scalar allow-listed values', () => {
    fc.assert(
      fc.property(analyticsInputArbitrary, ({
        allowedProperties,
        prompt,
        storagePath,
        comment,
        extractedJson,
        imageBytes,
        nestedObject,
        nestedArray,
      }) => {
        const input = {
          ...allowedProperties,
          prompt,
          storage_path: storagePath,
          comment,
          extracted_json: extractedJson,
          image_bytes: imageBytes,
          nested_object: nestedObject,
          nested_array: nestedArray,
        }
        const sanitised = sanitizeStudioProperties(input)
        const injectedSubstrings = [
          prompt,
          storagePath,
          comment,
          extractedJson.marker,
          extractedJson.nested.marker,
          nestedObject.marker,
          ...nestedArray,
        ]
        const injectedKeys = [
          'prompt',
          'storage_path',
          'comment',
          'extracted_json',
          'image_bytes',
          'nested_object',
          'nested_array',
        ]

        expect(Object.keys(sanitised)).toEqual(Object.keys(allowedProperties))
        expect(Object.keys(sanitised)).toEqual(
          expect.not.arrayContaining(injectedKeys),
        )
        expect(Object.keys(sanitised).every((key) =>
          (STUDIO_ALLOWED_PROPERTY_KEYS as readonly string[]).includes(key),
        )).toBe(true)
        expect(
          Object.values(sanitised).every(
            (value) =>
              value === null ||
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean',
          ),
        ).toBe(true)
        expect(sanitised).toEqual(allowedProperties)

        const serialised = JSON.stringify(sanitised)
        for (const injectedSubstring of injectedSubstrings) {
          expect(serialised).not.toContain(injectedSubstring)
        }
      }),
      { numRuns: 100 },
    )
  })
})


type EmissionPropertyCase = {
  properties: Record<string, unknown>
  throwsDuringRead: boolean
}

const studioEventNames = Object.values(ANALYTICS_EVENTS).filter(
  (eventName): eventName is StudioEventName => eventName.startsWith('studio_'),
)

const emissionPropertiesArbitrary: fc.Arbitrary<EmissionPropertyCase> = fc.oneof(
  fc
    .dictionary(fc.string({ minLength: 1, maxLength: 24 }), scalarArbitrary)
    .map((properties) => ({ properties, throwsDuringRead: false })),
  fc.constant(undefined).map(() => ({
    properties: new Proxy(
      { hostile_property: 'not-reached' },
      {
        get() {
          throw new Error('property getter failed')
        },
      },
    ),
    throwsDuringRead: true,
  })),
)

describe('Feature: studio-controlled-beta-readiness, Property 12', () => {
  beforeEach(() => {
    consentGranted = false
    emittedEventNames.length = 0
    mockTransport.mockClear()
  })

  it('registers, gates, and isolates every Studio analytics emission', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...studioEventNames),
        emissionPropertiesArbitrary,
        fc.boolean(),
        (eventName, { properties, throwsDuringRead }, hasConsent) => {
          consentGranted = hasConsent
          emittedEventNames.length = 0
          mockTransport.mockClear()

          let userFacingResult = 'not-completed'
          expect(() => {
            trackStudioEvent(eventName, properties)
            userFacingResult = 'completed'
          }).not.toThrow()
          expect(userFacingResult).toBe('completed')

          expect(
            emittedEventNames.every((emittedName) =>
              Object.values(ANALYTICS_EVENTS).includes(
                emittedName as (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS],
              ),
            ),
          ).toBe(true)

          if (!hasConsent || throwsDuringRead) {
            expect(mockTransport).not.toHaveBeenCalled()
          } else {
            expect(mockTransport).toHaveBeenCalledTimes(1)
            expect(mockTransport.mock.calls[0][0]).toBe(eventName)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
