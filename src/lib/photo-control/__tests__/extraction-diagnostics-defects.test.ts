/**
 * Bug-condition exploration for Property 7: Unknown Fields Omitted And
 * Recorded, Never Defaulted.
 *
 * This deliberately runs against the pre-Group-B extraction contract. The
 * current route exposes MinimalSchemaValidator.data as the hydrated state,
 * which is also the only state available to the legacy model-facing path.
 * The expected failures document default leakage and discarded diagnostics;
 * they are not production-code fixes.
 *
 * **Validates: Requirements 2.17, 2.17a, 2.17b**
 */

import fc from 'fast-check'
import {
  ENUM_DEFAULTS,
  type MinimalSchema,
} from '../minimal-schema'
import { validateMinimalSchema } from '../schema-validator'

type FieldStatus = 'absent' | 'invalid' | 'valid'
type Issue = { path: string; status: Exclude<FieldStatus, 'valid'> }
type PartialExtractionCase = {
  raw: Record<string, unknown>
  issues: Issue[]
}

type CurrentExtractionResponse = ReturnType<typeof validateMinimalSchema> & {
  extractionDiagnostics?: unknown
  metadata?: { extractionDiagnostics?: unknown }
}

const statusArb = fc.constantFrom<FieldStatus>('absent', 'invalid', 'valid')

/** Build arbitrary partial responses while retaining the fields' provenance. */
const partialExtractionArb: fc.Arbitrary<PartialExtractionCase> = fc
  .record({
    angle: statusArb,
    framing: statusArb,
    lighting: statusArb,
    spin: statusArb,
    background: statusArb,
    backgroundStyle: statusArb,
    surfaceStyle: statusArb,
    mainVessel: statusArb,
    mainItem: statusArb,
    garnishes: statusArb,
    sides: statusArb,
  })
  .map((statuses) => {
    const raw: Record<string, unknown> = {}
    const issues: Issue[] = []

    const set = (path: string, status: FieldStatus, valid: unknown, invalid: unknown) => {
      if (status === 'absent') {
        issues.push({ path, status })
        return
      }
      const [section, field] = path.split('.')
      const sectionValue = (raw[section] ??= {}) as Record<string, unknown>
      sectionValue[field] = status === 'valid' ? valid : invalid
      if (status === 'invalid') issues.push({ path, status })
    }

    set('scene_setup.angle', statuses.angle, 'top-down', 'not-an-angle')
    set('scene_setup.framing', statuses.framing, 'wide', 7)
    set('scene_setup.lighting', statuses.lighting, 'studio', null)
    set('scene_setup.spin', statuses.spin, 'left-45', 'not-a-spin')
    set('canvas.background', statuses.background, 'observed tabletop', 7)
    set('canvas.background_style', statuses.backgroundStyle, 'studio-yellow', {})
    set('canvas.surface_style', statuses.surfaceStyle, 'dark-slate', [])
    set('canvas.main_vessel', statuses.mainVessel, 'ceramic plate', [])
    set('food_components.main_item', statuses.mainItem, 'rice bowl', null)
    set('food_components.garnishes', statuses.garnishes, ['cilantro'], [7])
    set('food_components.sides', statuses.sides, ['sauce'], 'not-an-array')

    return { raw, issues }
  })
  .filter(({ issues }) => issues.length > 0)

function readPath(root: unknown, path: string): unknown {
  let value: unknown = root
  for (const segment of path.split('.')) {
    if (!value || typeof value !== 'object' || !(segment in value)) return undefined
    value = (value as Record<string, unknown>)[segment]
  }
  return value
}

function currentExtractionResponse(raw: Record<string, unknown>): CurrentExtractionResponse {
  // This is the actual unfixed extraction contract: the route returns the
  // validator result and persists no descriptor/diagnostics envelope here.
  return validateMinimalSchema(raw) as CurrentExtractionResponse
}

function diagnosticsFrom(response: CurrentExtractionResponse): unknown {
  return response.extractionDiagnostics ?? response.metadata?.extractionDiagnostics
}

function isEnumPath(path: string): path is keyof typeof ENUM_DEFAULTS {
  return path in ENUM_DEFAULTS
}

function enumTier1Default(path: string, value: unknown): boolean {
  return isEnumPath(path) && value === ENUM_DEFAULTS[path]
}

describe('Studio extraction defects: Property 7', () => {
  it('omits absent or invalid fields from the model-facing descriptor while allowing Tier 1 enum backfill', () => {
    fc.assert(
      fc.property(partialExtractionArb, ({ raw, issues }) => {
        const response = currentExtractionResponse(raw)

        for (const issue of issues) {
          const tier1Value = readPath(response.data, issue.path)
          // Tier 1 may remain hydratable through ENUM_DEFAULTS. This is the
          // permitted divergence; the assertion below is Tier 2's contract.
          if (issue.status === 'invalid' || issue.status === 'absent') {
            expect({ path: issue.path, tier1Value }).toEqual(
              isEnumPath(issue.path)
                ? { path: issue.path, tier1Value: expect.any(String) }
                : { path: issue.path, tier1Value: expect.anything() },
            )
            if (isEnumPath(issue.path)) expect(enumTier1Default(issue.path, tier1Value)).toBe(true)
          }

          // Before the descriptor redesign, response.data is what the client
          // can carry forward as observed fact. Unknown values must not appear
          // there once the Property 7 fix is present.
          expect({ path: issue.path, descriptorValue: tier1Value, raw }).toEqual({
            path: issue.path,
            descriptorValue: undefined,
            raw,
          })
        }
      }),
      { numRuns: 100 },
    )
  })

  it('persists bounded, image-byte-free omission diagnostics with validator evidence', () => {
    const imageBytes = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'

    fc.assert(
      fc.property(partialExtractionArb, ({ raw, issues }) => {
        const response = currentExtractionResponse(raw)
        const diagnostics = diagnosticsFrom(response) as {
          strictConformance?: unknown
          warnings?: unknown
          omittedFields?: Array<{ path?: unknown; reason?: unknown }>
          omissions?: Array<{ path?: unknown; reason?: unknown }>
        } | undefined

        expect(diagnostics).toBeDefined()
        if (!diagnostics) return

        expect(diagnostics.strictConformance).toBe(response.strictConformance)
        expect(diagnostics.warnings).toEqual(expect.arrayContaining(response.warnings))

        const omittedFields = diagnostics.omittedFields ?? diagnostics.omissions
        expect(omittedFields).toEqual(expect.any(Array))
        for (const issue of issues) {
          const entry = omittedFields?.find((candidate) => candidate.path === issue.path)
          expect(entry).toEqual(expect.objectContaining({
            path: issue.path,
            reason: expect.stringMatching(/^(absent|invalid|coerced_for_control_state)$/),
          }))
        }

        const serialized = JSON.stringify(diagnostics)
        expect(serialized.length).toBeLessThanOrEqual(8_192)
        expect(serialized).not.toContain(imageBytes)
      }),
      { numRuns: 100 },
    )
  })
})

// Expected unfixed counterexamples are recorded in the Task 16 evidence file:
// validator.data contains defaults for omitted/invalid fields, while the
// extraction response has no extractionDiagnostics or persisted metadata block.
