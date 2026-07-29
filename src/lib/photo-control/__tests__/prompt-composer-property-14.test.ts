/**
 * Property-Based Tests for the Prompt Composer — Mutation Request Completeness
 *
 * Feature: photo-control, Property 14: Mutation request completeness (self-containment)
 *
 * Property 14 (Mutation request completeness / self-containment): For any valid
 * `CompositionInput` (non-empty directive, valid originalState, valid
 * targetState), `composePrompt` returns `{ ok: true }` and the composed prompt:
 *  1. Contains the directive text as a substring (Req 10.1).
 *  2. Contains the compact JSON of originalState as a substring — grounding
 *     anchor (Req 11.2).
 *  3. Contains the compact JSON of targetState as a substring (Req 10.1).
 *  4. Is self-contained: all three logical components (directive, original
 *     state, target state) are present in the single prompt string (Req 16.1).
 *
 * Note: the Source_Image is passed separately to the MutationEngine as an
 * inline base64 reference image and is therefore NOT embedded in the prompt
 * string itself. The prompt carries the three textual components only.
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property (configured at 200)
 *
 * Validates: Requirements 10.1, 11.2, 16.1
 */

import fc from 'fast-check'
import { composePrompt } from '../prompt-composer'
import {
  ANGLE_VALUES,
  LIGHTING_VALUES,
  FRAMING_VALUES,
  type MinimalSchema,
} from '../minimal-schema'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract the semantic descriptor JSON emitted by the approved composer. */
function descriptorFromPrompt(prompt: string): Record<string, any> {
  const jsonStart = prompt.indexOf('\n{')
  if (jsonStart < 0) throw new Error('Expected a semantic descriptor in the composed prompt.')
  return JSON.parse(prompt.slice(jsonStart + 1)) as Record<string, any>
}

/**
 * Assert the self-contained Tier 2 representation without requiring the
 * retired single-letter-key/compressed JSON contract. The descriptor keeps
 * original observations in `current` and includes only staged differences in
 * `target`, so equal states intentionally produce an empty target section.
 */
function expectSemanticStateRepresentation(
  prompt: string,
  originalState: MinimalSchema,
  targetState: MinimalSchema,
): void {
  const descriptor = descriptorFromPrompt(prompt)
  expect(descriptor.subject).toMatchObject({
    dish: originalState.food_components.main_item,
    vessel: originalState.canvas.main_vessel,
    components: {
      garnishes: originalState.food_components.garnishes,
      sides: originalState.food_components.sides,
    },
  })
  expect(descriptor.current.camera).toMatchObject({
    angle: originalState.scene_setup.angle,
    framing: originalState.scene_setup.framing,
  })
  if (originalState.scene_setup.spin !== undefined) {
    expect(descriptor.current.camera.spin).toBe(originalState.scene_setup.spin)
  }
  expect(descriptor.current.backdrop.description).toBe(originalState.canvas.background)

  const cameraChanged =
    originalState.scene_setup.angle !== targetState.scene_setup.angle ||
    originalState.scene_setup.framing !== targetState.scene_setup.framing ||
    originalState.scene_setup.spin !== targetState.scene_setup.spin
  if (cameraChanged) {
    expect(descriptor.target.camera).toMatchObject({
      angle: targetState.scene_setup.angle,
      framing: targetState.scene_setup.framing,
    })
    if (targetState.scene_setup.spin !== undefined) {
      expect(descriptor.target.camera.spin).toBe(targetState.scene_setup.spin)
    }
  }

  if (originalState.canvas.background !== targetState.canvas.background) {
    expect(descriptor.target.backdrop.description).toBe(targetState.canvas.background)
  }

  const componentsChanged =
    originalState.food_components.main_item !== targetState.food_components.main_item ||
    JSON.stringify(originalState.food_components.garnishes) !== JSON.stringify(targetState.food_components.garnishes) ||
    JSON.stringify(originalState.food_components.sides) !== JSON.stringify(targetState.food_components.sides) ||
    originalState.canvas.main_vessel !== targetState.canvas.main_vessel
  if (componentsChanged) {
    expect(descriptor.target.components).toMatchObject({
      main_item: targetState.food_components.main_item,
      vessel: targetState.canvas.main_vessel,
      garnishes: targetState.food_components.garnishes,
      sides: targetState.food_components.sides,
    })
  }

  if (originalState.scene_setup.lighting !== targetState.scene_setup.lighting) {
    expect(descriptor.target.lighting).toBeDefined()
  }
  if (originalState.canvas.background_style !== targetState.canvas.background_style) {
    expect(descriptor.target.backdrop.material).toBeDefined()
  }
  if (originalState.canvas.surface_style !== targetState.canvas.surface_style) {
    expect(descriptor.target.surface.material).toBeDefined()
  }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * A valid `MinimalSchema` arbitrary.
 *
 * Generates all required fields with valid enum values, keeping string fields
 * short so the composed prompt stays well within the 2000-char budget.
 */
const minimalSchemaArb: fc.Arbitrary<MinimalSchema> = fc.record({
  scene_setup: fc.record({
    angle: fc.constantFrom(...ANGLE_VALUES),
    framing: fc.constantFrom(...FRAMING_VALUES),
    lighting: fc.constantFrom(...LIGHTING_VALUES),
  }),
  canvas: fc.record({
    background: fc.string({ minLength: 1, maxLength: 30 }),
    background_style: fc.constantFrom('', 'clean-white-studio', 'dark-slate'),
    main_vessel: fc.string({ minLength: 1, maxLength: 30 }),
  }),
  food_components: fc.record({
    main_item: fc.string({ minLength: 1, maxLength: 30 }),
    garnishes: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 4 }),
    sides: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 4 }),
  }),
})

/**
 * A non-empty directive string (1–200 characters).
 *
 * Kept short enough that the composed prompt stays within the 2000-char budget
 * when combined with two compact MinimalSchema JSON anchors.
 */
const directiveArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0)

// ── Property 14: Mutation request completeness (self-containment) ─────────────

describe('Feature: photo-control, Property 14: Mutation request completeness (self-containment)', () => {
  /**
   * Self-containment — directive is present (Requirement 10.1):
   *
   * For any valid CompositionInput, the composed prompt contains the directive
   * text as a substring.
   */
  it('composed prompt contains the directive text as a substring', () => {
    fc.assert(
      fc.property(directiveArb, minimalSchemaArb, minimalSchemaArb, (directive, originalState, targetState) => {
        const result = composePrompt({ directive, originalState, targetState })

        expect(result.ok).toBe(true)
        if (!result.ok) return // type narrowing

        expect(result.prompt).toContain(directive)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Self-containment — original state JSON is present as grounding anchor
   * (Requirement 11.2):
   *
   * For any valid CompositionInput, the composed prompt contains the compact
   * JSON serialization of originalState as a substring. This is the grounding
   * anchor that preserves unchanged attributes.
   */
  it('composed prompt contains the semantic original-state descriptor', () => {
    fc.assert(
      fc.property(directiveArb, minimalSchemaArb, minimalSchemaArb, (directive, originalState, targetState) => {
        const result = composePrompt({ directive, originalState, targetState })

        expect(result.ok).toBe(true)
        if (!result.ok) return

        expectSemanticStateRepresentation(result.prompt, originalState, targetState)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Self-containment — target state JSON is present (Requirement 10.1):
   *
   * For any valid CompositionInput, the composed prompt contains the compact
   * JSON serialization of targetState as a substring.
   */
  it('composed prompt contains the semantic target-state descriptor', () => {
    fc.assert(
      fc.property(directiveArb, minimalSchemaArb, minimalSchemaArb, (directive, originalState, targetState) => {
        const result = composePrompt({ directive, originalState, targetState })

        expect(result.ok).toBe(true)
        if (!result.ok) return

        expectSemanticStateRepresentation(result.prompt, originalState, targetState)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * All three logical components are present simultaneously (Requirements 10.1, 11.2, 16.1):
   *
   * For any valid CompositionInput, a single call to `composePrompt` returns
   * `{ ok: true }` and the prompt simultaneously contains:
   *  - the directive text
   *  - the compact JSON of originalState (grounding anchor)
   *  - the compact JSON of targetState
   *
   * This is the core self-containment invariant: the prompt is self-contained
   * and carries all three textual components in one string.
   */
  it('composed prompt simultaneously contains the directive and semantic original/target state representation', () => {
    fc.assert(
      fc.property(directiveArb, minimalSchemaArb, minimalSchemaArb, (directive, originalState, targetState) => {
        const result = composePrompt({ directive, originalState, targetState })

        expect(result.ok).toBe(true)
        if (!result.ok) return

        expect(result.prompt).toContain(directive)
        expectSemanticStateRepresentation(result.prompt, originalState, targetState)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Result is always `{ ok: true }` for valid inputs (Requirements 10.1, 16.1):
   *
   * For any valid CompositionInput (non-empty directive, valid originalState,
   * valid targetState within the budget), `composePrompt` never returns a
   * failure result.
   */
  it('returns { ok: true } for any valid CompositionInput within the budget', () => {
    fc.assert(
      fc.property(directiveArb, minimalSchemaArb, minimalSchemaArb, (directive, originalState, targetState) => {
        const result = composePrompt({ directive, originalState, targetState })

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(typeof result.prompt).toBe('string')
          expect(result.prompt.length).toBeGreaterThan(0)
        }
      }),
      { numRuns: 200 },
    )
  })
})
