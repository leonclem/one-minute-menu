/**
 * Bug-condition exploration for validation coverage of staged Studio changes.
 *
 * Feature: studio-json-metadata-defects, Property 8: Validation Assesses What Was Requested
 * **Validates: Requirements 2.18**
 *
 * This suite intentionally runs against the unfixed scorer. The staged-fields
 * argument is represented at the test boundary so the expected contract can be
 * asserted before production accepts it; the unfixed implementation ignores it.
 */

import fc from 'fast-check'
import {
  scoreOutputAgainstExpected,
  type OutputValidationResult,
} from '@/lib/photo-control/output-validator'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'

const STAGED_FIELDS = [
  'lighting',
  'background_style',
  'surface_style',
  'angle',
  'spin',
] as const

type StagedField = (typeof STAGED_FIELDS)[number]
type ScoreWithStagedFields = (
  expected: MinimalSchema,
  actual: MinimalSchema,
  stagedFields: readonly StagedField[],
) => OutputValidationResult

// The unfixed two-argument function accepts the call at runtime; this keeps the
// exploration focused on its missing staged-intent behavior without production changes.
const scoreRequestedOutput = scoreOutputAgainstExpected as ScoreWithStagedFields

const textArbitrary = fc
  .string({ minLength: 1, maxLength: 24 })
  .map((value) => value.replace(/\s+/g, ' ').trim() || 'observed')

const schemaArbitrary: fc.Arbitrary<MinimalSchema> = fc
  .record({
    angle: fc.constantFrom('top-down', '45-degree', 'eye-level', 'macro-close-up'),
    framing: fc.constantFrom('close-up', 'medium', 'wide'),
    lighting: textArbitrary,
    spin: fc.constantFrom('0', 'left-45', 'right-45'),
    background: textArbitrary,
    backgroundStyle: fc.oneof(fc.constant(''), textArbitrary),
    surfaceStyle: fc.oneof(fc.constant(''), textArbitrary),
    mainVessel: textArbitrary,
    mainItem: textArbitrary,
    garnishes: fc.array(textArbitrary, { maxLength: 3 }),
    sides: fc.array(textArbitrary, { maxLength: 3 }),
  })
  .map((value) => ({
    scene_setup: {
      angle: value.angle,
      framing: value.framing,
      lighting: value.lighting,
      spin: value.spin,
    },
    canvas: {
      background: value.background,
      background_style: value.backgroundStyle,
      surface_style: value.surfaceStyle,
      main_vessel: value.mainVessel,
    },
    food_components: {
      main_item: value.mainItem,
      garnishes: value.garnishes,
      sides: value.sides,
    },
  }))

function preserveIdentity(expected: MinimalSchema, extracted: MinimalSchema): MinimalSchema {
  return {
    ...extracted,
    scene_setup: { ...extracted.scene_setup, framing: expected.scene_setup.framing },
    canvas: { ...extracted.canvas, main_vessel: expected.canvas.main_vessel },
    food_components: { ...expected.food_components },
  }
}

function makeScenario(
  expected: MinimalSchema,
  extracted: MinimalSchema,
  stagedFields: readonly StagedField[],
): { expected: MinimalSchema; actual: MinimalSchema; stagedFields: readonly StagedField[] } {
  const requested = { ...expected, scene_setup: { ...expected.scene_setup }, canvas: { ...expected.canvas } }
  const actual = preserveIdentity(requested, extracted)

  if (stagedFields.includes('lighting')) {
    requested.scene_setup.lighting = 'db-style-requested-lighting'
    actual.scene_setup.lighting = ''
  }
  if (stagedFields.includes('background_style')) {
    requested.canvas.background_style = 'requested-background-style'
    actual.canvas.background = ''
  }
  if (stagedFields.includes('surface_style')) {
    requested.canvas.surface_style = 'requested-surface-style'
    actual.canvas.surface_style = ''
  }

  return { expected: requested, actual, stagedFields }
}

const identityPassingScenarioArbitrary = fc
  .record({
    expected: schemaArbitrary,
    extracted: schemaArbitrary,
    stagedFields: fc.subarray(STAGED_FIELDS, { minLength: 1 }),
  })
  .map(({ expected, extracted, stagedFields }) =>
    makeScenario(expected, extracted, stagedFields),
  )


describe('Studio validation defects: requested dimensions are assessed', () => {
  /** **Validates: Requirements 2.18** */
  it('contains every staged dimension and downgrades unassessed requests', () => {
    fc.assert(
      fc.property(identityPassingScenarioArbitrary, ({ expected, actual, stagedFields }) => {
        const result = scoreRequestedOutput(expected, actual, stagedFields)
        const stagedDimensions = stagedFields.map((id) =>
          result.dimensions.find((dimension) => dimension.id === id),
        )
        const unassessed = stagedDimensions.filter(
          (dimension) => dimension?.status === 'not_evaluated',
        )
        const evaluated = result.dimensions.filter(
          (dimension) => dimension.status !== 'not_evaluated',
        )

        expect({
          missingStagedDimensions: stagedDimensions.filter((dimension) => dimension === undefined),
          statusVocabulary: ['pass', 'warn', 'fail', 'skipped'].includes(result.status),
          status: result.status,
          statusForUnassessed: unassessed.length > 0 ? result.status : 'not-applicable',
          summaryNamesUnassessed: unassessed.every((dimension) =>
            result.summary.includes(dimension?.id ?? ''),
          ),
          skippedOnlyWhenNothingEvaluated:
            result.status !== 'skipped' || evaluated.length === 0,
        }).toEqual({
          missingStagedDimensions: [],
          statusVocabulary: true,
          status:
            evaluated.some((dimension) => dimension.status === 'fail')
              ? 'fail'
              : unassessed.length > 0
                ? 'warn'
                : 'pass',
          statusForUnassessed:
            unassessed.length > 0
              ? evaluated.some((dimension) => dimension.status === 'fail')
                ? 'fail'
                : 'warn'
              : 'not-applicable',
          summaryNamesUnassessed: true,
          skippedOnlyWhenNothingEvaluated: true,
        })
      }),
      { numRuns: 100 },
    )
  })

  /** **Validates: Requirements 2.18** */
  it('names all unassessed staged styles and returns warn rather than pass', () => {
    const expected: MinimalSchema = {
      scene_setup: {
        angle: '45-degree',
        framing: 'close-up',
        lighting: 'db-style-studio',
        spin: '0',
      },
      canvas: {
        background: 'white table',
        background_style: 'studio-yellow',
        surface_style: 'dark-slate',
        main_vessel: 'white plate',
      },
      food_components: { main_item: 'burger', garnishes: [], sides: [] },
    }
    const actual: MinimalSchema = {
      ...expected,
      scene_setup: { ...expected.scene_setup, lighting: '' },
      canvas: { ...expected.canvas, background: '', surface_style: '' },
    }
    const stagedFields = ['lighting', 'background_style', 'surface_style'] as const
    const result = scoreRequestedOutput(expected, actual, stagedFields)

    expect({
      dimensionIds: result.dimensions.map((dimension) => dimension.id),
      unassessedStatuses: stagedFields.map(
        (id) => result.dimensions.find((dimension) => dimension.id === id)?.status,
      ),
      status: result.status,
      summary: result.summary,
    }).toEqual({
      dimensionIds: expect.arrayContaining(stagedFields),
      unassessedStatuses: ['not_evaluated', 'not_evaluated', 'not_evaluated'],
      status: 'warn',
      summary: expect.stringContaining('lighting'),
    })

    for (const field of stagedFields) {
      expect(result.summary).toContain(field)
    }
  })

  /** **Validates: Requirements 2.18** */
  it('keeps an evaluated fail above the unassessed-dimension downgrade', () => {
    const expected: MinimalSchema = {
      scene_setup: {
        angle: '45-degree',
        framing: 'close-up',
        lighting: 'db-style-studio',
        spin: '0',
      },
      canvas: {
        background: 'white table',
        background_style: 'studio-yellow',
        surface_style: '',
        main_vessel: 'white plate',
      },
      food_components: { main_item: 'burger', garnishes: [], sides: [] },
    }
    const actual: MinimalSchema = {
      ...expected,
      scene_setup: { ...expected.scene_setup, lighting: '' },
      food_components: { ...expected.food_components, main_item: 'sushi' },
      canvas: { ...expected.canvas, background_style: '' },
    }
    const result = scoreRequestedOutput(expected, actual, ['lighting', 'background_style'])

    expect({
      identityFailure: result.dimensions.find((dimension) => dimension.id === 'dish_identity')?.status,
      stagedDimensionIds: result.dimensions
        .filter((dimension) => ['lighting', 'background_style'].includes(dimension.id))
        .map((dimension) => dimension.id),
      status: result.status,
    }).toEqual({
      identityFailure: 'fail',
      stagedDimensionIds: ['lighting', 'background_style'],
      status: 'fail',
    })
  })
})
