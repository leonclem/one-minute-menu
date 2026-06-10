/**
 * Property-Based Tests for State_Delta_Engine — Scalar-Change Capture
 *
 * Feature: photo-control, Property 7: Scalar-change capture
 *
 * Property 7 (Scalar-change capture): For any pair of EditorState values
 * differing in zero or more Enum_Fields, the delta records a scalar change with
 * the correct previous and target values for exactly the fields that changed,
 * and records no scalar change for unchanged fields. The `isEmpty` flag is false
 * when any scalar differs, and true when all three scalars are equal (and arrays
 * and position are also equal).
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property (configured at 200)
 *
 * Validates: Requirements 5.2, 6.2, 9.3
 */

import fc from 'fast-check'
import { computeDelta } from '../state-delta'
import {
  ANGLE_VALUES,
  LIGHTING_VALUES,
  FRAMING_VALUES,
  CENTER,
  type EditorState,
  type MinimalSchema,
} from '../minimal-schema'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal but valid EditorState from explicit enum values. */
function makeState(
  angle: (typeof ANGLE_VALUES)[number],
  lighting: (typeof LIGHTING_VALUES)[number],
  framing: (typeof FRAMING_VALUES)[number],
): EditorState {
  const schema: MinimalSchema = {
    scene_setup: { angle, lighting, framing },
    canvas: { background: 'white', main_vessel: 'plate' },
    food_components: { main_item: 'salmon', garnishes: [], sides: [] },
  }
  return { schema, position: { ...CENTER } }
}

// ── Arbitraries ──────────────────────────────────────────────────────────────

const angleArb = fc.constantFrom(...ANGLE_VALUES)
const lightingArb = fc.constantFrom(...LIGHTING_VALUES)
const framingArb = fc.constantFrom(...FRAMING_VALUES)

/**
 * A pair of enum values for a single field where the two values MAY or MAY NOT
 * differ. Tracks whether a change is expected.
 */
interface FieldPair<T extends string> {
  from: T
  to: T
  changed: boolean
}

function fieldPairArb<T extends string>(arb: fc.Arbitrary<T>): fc.Arbitrary<FieldPair<T>> {
  return fc.tuple(arb, arb).map(([from, to]) => ({ from, to, changed: from !== to }))
}

/** A pair of EditorStates that differ only in their scene_setup enum fields. */
interface ScalarPair {
  original: EditorState
  target: EditorState
  angle: FieldPair<(typeof ANGLE_VALUES)[number]>
  lighting: FieldPair<(typeof LIGHTING_VALUES)[number]>
  framing: FieldPair<(typeof FRAMING_VALUES)[number]>
}

const scalarPairArb: fc.Arbitrary<ScalarPair> = fc
  .tuple(
    fieldPairArb(angleArb),
    fieldPairArb(lightingArb),
    fieldPairArb(framingArb),
  )
  .map(([angle, lighting, framing]) => ({
    original: makeState(angle.from, lighting.from, framing.from),
    target: makeState(angle.to, lighting.to, framing.to),
    angle,
    lighting,
    framing,
  }))

// ── Property 7: Scalar-change capture ────────────────────────────────────────

describe('Feature: photo-control, Property 7: Scalar-change capture', () => {
  /**
   * Core property: for any pair of EditorStates that differ in zero or more
   * scene_setup enum fields, computeDelta records a scalarChange entry with the
   * correct `from` and `to` values for exactly the fields that changed, and
   * records no entry for unchanged fields. (Requirements 5.2, 6.2, 9.3)
   */
  it('records exactly the changed enum fields with correct from/to values', () => {
    fc.assert(
      fc.property(scalarPairArb, ({ original, target, angle, lighting, framing }) => {
        const delta = computeDelta(original, target)

        // Helper: find the scalarChange entry for a given dotted path.
        const findChange = (path: string) =>
          delta.scalarChanges.find((sc) => sc.path === path)

        // scene_setup.angle
        if (angle.changed) {
          const entry = findChange('scene_setup.angle')
          expect(entry).toBeDefined()
          expect(entry!.from).toBe(angle.from)
          expect(entry!.to).toBe(angle.to)
        } else {
          expect(findChange('scene_setup.angle')).toBeUndefined()
        }

        // scene_setup.lighting
        if (lighting.changed) {
          const entry = findChange('scene_setup.lighting')
          expect(entry).toBeDefined()
          expect(entry!.from).toBe(lighting.from)
          expect(entry!.to).toBe(lighting.to)
        } else {
          expect(findChange('scene_setup.lighting')).toBeUndefined()
        }

        // scene_setup.framing
        if (framing.changed) {
          const entry = findChange('scene_setup.framing')
          expect(entry).toBeDefined()
          expect(entry!.from).toBe(framing.from)
          expect(entry!.to).toBe(framing.to)
        } else {
          expect(findChange('scene_setup.framing')).toBeUndefined()
        }

        // No extra scalar-change entries beyond the three known enum paths.
        const knownPaths = new Set([
          'scene_setup.angle',
          'scene_setup.lighting',
          'scene_setup.framing',
        ])
        for (const sc of delta.scalarChanges) {
          expect(knownPaths.has(sc.path)).toBe(true)
        }

        // The total count of scalarChanges equals the number of changed fields.
        const expectedCount = [angle.changed, lighting.changed, framing.changed].filter(
          Boolean,
        ).length
        expect(delta.scalarChanges).toHaveLength(expectedCount)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * isEmpty is false when any scalar field differs, and true when all three
   * scalars are equal (arrays and position are also equal in these states).
   * (Requirements 9.3, 9.5)
   */
  it('isEmpty is false when any scalar differs and true when all scalars are equal', () => {
    fc.assert(
      fc.property(scalarPairArb, ({ original, target, angle, lighting, framing }) => {
        const delta = computeDelta(original, target)
        const anyChanged = angle.changed || lighting.changed || framing.changed

        if (anyChanged) {
          expect(delta.isEmpty).toBe(false)
        } else {
          // All three scalars are equal, arrays are empty, position is CENTER.
          expect(delta.isEmpty).toBe(true)
        }
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Targeted: angle-only change (Requirement 5.2).
   * When only scene_setup.angle changes, exactly one scalarChange is emitted
   * for that path, with no entries for lighting or framing.
   */
  it('angle-only change emits exactly one scalarChange for scene_setup.angle', () => {
    fc.assert(
      fc.property(
        angleArb,
        angleArb.filter((v) => ANGLE_VALUES.length > 1), // ensure a different value is possible
        lightingArb,
        framingArb,
        (fromAngle, _unused, lighting, framing) => {
          // Pick a target angle that is different from fromAngle.
          const toAngle = ANGLE_VALUES.find((v) => v !== fromAngle) ?? fromAngle
          if (fromAngle === toAngle) return // skip if only one value exists (shouldn't happen)

          const original = makeState(fromAngle, lighting, framing)
          const target = makeState(toAngle, lighting, framing)
          const delta = computeDelta(original, target)

          expect(delta.scalarChanges).toHaveLength(1)
          expect(delta.scalarChanges[0].path).toBe('scene_setup.angle')
          expect(delta.scalarChanges[0].from).toBe(fromAngle)
          expect(delta.scalarChanges[0].to).toBe(toAngle)
          expect(delta.isEmpty).toBe(false)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Targeted: lighting-only change (Requirement 6.2).
   * When only scene_setup.lighting changes, exactly one scalarChange is emitted
   * for that path, with no entries for angle or framing.
   */
  it('lighting-only change emits exactly one scalarChange for scene_setup.lighting', () => {
    fc.assert(
      fc.property(angleArb, framingArb, (angle, framing) => {
        // LIGHTING_VALUES has exactly two members; toggle between them.
        const [fromLighting, toLighting] = LIGHTING_VALUES as unknown as [string, string]

        const original = makeState(
          angle,
          fromLighting as (typeof LIGHTING_VALUES)[number],
          framing,
        )
        const target = makeState(
          angle,
          toLighting as (typeof LIGHTING_VALUES)[number],
          framing,
        )
        const delta = computeDelta(original, target)

        expect(delta.scalarChanges).toHaveLength(1)
        expect(delta.scalarChanges[0].path).toBe('scene_setup.lighting')
        expect(delta.scalarChanges[0].from).toBe(fromLighting)
        expect(delta.scalarChanges[0].to).toBe(toLighting)
        expect(delta.isEmpty).toBe(false)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Targeted: framing-only change (Requirement 9.3).
   * When only scene_setup.framing changes, exactly one scalarChange is emitted
   * for that path, with no entries for angle or lighting.
   */
  it('framing-only change emits exactly one scalarChange for scene_setup.framing', () => {
    fc.assert(
      fc.property(angleArb, lightingArb, framingArb, (angle, lighting, fromFraming) => {
        const toFraming = FRAMING_VALUES.find((v) => v !== fromFraming) ?? fromFraming
        if (fromFraming === toFraming) return // skip if only one value (shouldn't happen)

        const original = makeState(angle, lighting, fromFraming)
        const target = makeState(angle, lighting, toFraming)
        const delta = computeDelta(original, target)

        expect(delta.scalarChanges).toHaveLength(1)
        expect(delta.scalarChanges[0].path).toBe('scene_setup.framing')
        expect(delta.scalarChanges[0].from).toBe(fromFraming)
        expect(delta.scalarChanges[0].to).toBe(toFraming)
        expect(delta.isEmpty).toBe(false)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * No-change: when original and target have identical enum fields (and equal
   * arrays and position), scalarChanges is empty and isEmpty is true.
   * (Requirement 9.5)
   */
  it('identical states produce no scalarChanges and isEmpty = true', () => {
    fc.assert(
      fc.property(angleArb, lightingArb, framingArb, (angle, lighting, framing) => {
        const state = makeState(angle, lighting, framing)
        const delta = computeDelta(state, state)

        expect(delta.scalarChanges).toHaveLength(0)
        expect(delta.isEmpty).toBe(true)
      }),
      { numRuns: 200 },
    )
  })
})
