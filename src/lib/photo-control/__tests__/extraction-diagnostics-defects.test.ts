/**
 * Bug-condition exploration for Property 7: Unknown Fields Omitted And
 * Recorded, Never Defaulted.
 *
 * The test keeps the Tier 1 control-state seam separate from the Tier 2
 * descriptor seam. Validator backfills are valid for Tier 1, but the same
 * values must not be carried into the model-facing descriptor as observed
 * facts.
 *
 * **Validates: Requirements 2.17, 2.17a, 2.17b**
 */

import fc from 'fast-check'
import {
  ENUM_DEFAULTS,
  type MinimalSchema,
  type StateDelta,
} from '../minimal-schema'
import { validateMinimalSchema } from '../schema-validator'
import { buildSceneDescriptor } from '../scene-descriptor'
import { buildExtractionDiagnostics } from '@/lib/studio/extraction-diagnostics'

type FieldStatus = 'absent' | 'invalid' | 'valid'
type Issue = { path: string; status: Exclude<FieldStatus, 'valid'> }
type PartialExtractionCase = {
  raw: Record<string, unknown>
  issues: Issue[]
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

function isEnumPath(path: string): path is keyof typeof ENUM_DEFAULTS {
  return path in ENUM_DEFAULTS
}

function cloneSchema(schema: MinimalSchema): MinimalSchema {
  return JSON.parse(JSON.stringify(schema)) as MinimalSchema
}

function descriptorDelta(): StateDelta {
  return {
    scalarChanges: [
      { path: 'scene_setup.angle', from: '45-degree', to: 'eye-level' },
      { path: 'scene_setup.framing', from: 'close-up', to: 'wide' },
      { path: 'scene_setup.lighting', from: 'bright-and-airy', to: 'studio' },
      { path: 'scene_setup.spin', from: '0', to: 'left-45' },
      { path: 'canvas.background_style', from: '', to: 'studio-yellow' },
      { path: 'canvas.surface_style', from: '', to: 'dark-slate' },
    ],
    arrays: {
      garnishes: { added: ['cilantro'], removed: [] },
      sides: { added: ['sauce'], removed: [] },
    },
    isEmpty: false,
  }
}

function buildTier2Descriptor(
  original: MinimalSchema,
  observations: ReturnType<typeof buildExtractionDiagnostics>,
) {
  const target = cloneSchema(original)
  target.scene_setup = {
    ...target.scene_setup,
    angle: 'eye-level',
    framing: 'wide',
    lighting: 'studio',
    spin: 'left-45',
  }
  target.canvas = {
    ...target.canvas,
    background_style: 'studio-yellow',
    surface_style: 'dark-slate',
  }
  target.food_components = {
    ...target.food_components,
    garnishes: [...target.food_components.garnishes, 'cilantro'],
    sides: [...target.food_components.sides, 'sauce'],
  }

  return buildSceneDescriptor({
    original,
    target,
    delta: descriptorDelta(),
    styles: {
      lighting: {
        descriptor: {
          quality: 'clean commercial studio light',
          temperature: 'neutral',
          shadows: 'soft',
          falloff: 'gradual',
        },
      },
      backdrop: {
        descriptor: {
          material: 'seamless studio backdrop',
          colour: '#F2C200',
          falloff: 'soft',
        },
      },
      surface: {
        descriptor: {
          material: 'dark slate stone',
          finish: 'honed matte',
          colour: '#2E3338',
        },
      },
    },
    observations,
    labels: ['Image A'],
  })
}

function assertTier2Omission(
  descriptor: ReturnType<typeof buildSceneDescriptor>,
  path: string,
): void {
  switch (path) {
    case 'scene_setup.angle':
    case 'scene_setup.framing':
    case 'scene_setup.spin':
      expect(descriptor.current.camera ?? {}).not.toHaveProperty(path.split('.')[1])
      break
    case 'scene_setup.lighting':
      expect(descriptor.current).not.toHaveProperty('lighting')
      break
    case 'canvas.background_style':
      expect(descriptor.current).not.toHaveProperty('backdrop')
      break
    case 'canvas.surface_style':
      expect(descriptor.current).not.toHaveProperty('surface')
      break
    case 'canvas.background':
      expect(descriptor.current).not.toHaveProperty('background')
      break
    case 'canvas.main_vessel':
      expect(descriptor.subject).not.toHaveProperty('vessel')
      break
    case 'food_components.main_item':
      expect(descriptor.subject).not.toHaveProperty('dish')
      break
    case 'food_components.garnishes':
    case 'food_components.sides':
      expect(descriptor.subject.components ?? {}).not.toHaveProperty(path.split('.')[1])
      break
    default:
      throw new Error(`Unhandled extraction path: ${path}`)
  }
}

describe('Studio extraction defects: Property 7', () => {
  it('keeps Tier 1 backfill separate from omitted Tier 2 observations', () => {
    fc.assert(
      fc.property(partialExtractionArb, ({ raw, issues }) => {
        const validated = validateMinimalSchema(raw)
        const tier1 = validated.data
        const diagnostics = buildExtractionDiagnostics({
          raw,
          validated,
          warnings: validated.warnings,
          strictConformance: validated.strictConformance,
        })
        const descriptor = buildTier2Descriptor(tier1, diagnostics)

        for (const issue of issues) {
          const tier1Value = readPath(tier1, issue.path)
          expect(tier1Value).toBeDefined()
          if (isEnumPath(issue.path)) {
            expect(tier1Value).toBe(ENUM_DEFAULTS[issue.path])
          }

          assertTier2Omission(descriptor, issue.path)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('records bounded, image-byte-free omission diagnostics from validator evidence', () => {
    const imageBytes = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'

    fc.assert(
      fc.property(partialExtractionArb, ({ raw, issues }) => {
        const rawWithImageBytes = { ...raw, description: imageBytes }
        const validated = validateMinimalSchema(rawWithImageBytes)
        const diagnostics = buildExtractionDiagnostics({
          raw: rawWithImageBytes,
          validated,
          warnings: validated.warnings,
          strictConformance: validated.strictConformance,
        })

        expect(diagnostics.strictConformance).toBe(validated.strictConformance)
        expect(diagnostics.warnings).toEqual(expect.arrayContaining(validated.warnings))

        const omittedFields = diagnostics.omittedFields
        expect(omittedFields).toEqual(expect.any(Array))
        for (const issue of issues) {
          const entry = omittedFields.find((candidate) => candidate.path === issue.path)
          expect(entry).toEqual(expect.objectContaining({
            path: issue.path,
            reason: expect.stringMatching(/^(absent|invalid|coerced_for_control_state)$/),
          }))
          if (isEnumPath(issue.path)) {
            expect(entry?.reason).toBe('coerced_for_control_state')
          }
        }

        const serialized = JSON.stringify(diagnostics)
        expect(serialized.length).toBeLessThanOrEqual(8_192)
        expect(serialized).not.toContain(imageBytes)
      }),
      { numRuns: 100 },
    )
  })
})

// The original Task 16 exploration read Tier 1 validator.data as if it were
// Tier 2 and looked for diagnostics on the validator response. Task 19.8 uses
// the approved seams instead: validateMinimalSchema(...).data, then
// buildSceneDescriptor(...), and buildExtractionDiagnostics(...).
