/**
 * Property-Based Tests for the Directive_Generator — Directive Content per Change Type
 *
 * Feature: photo-control, Property 10: Directive content per change type
 *
 * Property 10 (Directive content per change type): For any non-empty delta, the
 * generated directive contains the change-appropriate instruction:
 *  - Angle change (Req 5.3): directive mentions the new angle value and
 *    perspective change.
 *  - Lighting low-key → bright-and-airy (Req 6.3): directive mentions "bright",
 *    "airy", "high-key" or "diffused" light, and removal of shadows.
 *  - Lighting bright-and-airy → low-key (Req 6.4): directive mentions "low-key",
 *    "shadow", "darker".
 *  - Position change (Req 7.3): directive mentions direction of movement and
 *    negative space.
 *  - Array removal (Req 8.4): directive mentions the removed item name and
 *    "remove" or "fill".
 *  - Array addition (Req 8.5): directive mentions the added item name and "add".
 *  - Single-attribute change (Req 11.3): directive contains
 *    "leave all other attributes unchanged" (or similar).
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property (configured at 150)
 *
 * Validates: Requirements 5.3, 6.3, 6.4, 7.3, 8.4, 8.5, 11.3
 */

import fc from 'fast-check'
import { generateDirective } from '../directive-generator'
import { computeDelta } from '../state-delta'
import {
  ANGLE_VALUES,
  LIGHTING_VALUES,
  FRAMING_VALUES,
  CENTER,
  POSITION_STEP,
  type AbstractCoordinate,
  type EditorState,
  type MinimalSchema,
} from '../minimal-schema'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map an angle enum value to the keywords that should appear in the directive.
 * Mirrors the `angleLabel()` function in directive-generator.ts.
 */
function angleKeywords(angle: string): string[] {
  switch (angle) {
    case 'top-down':
      return ['top-down', 'overhead']
    case '45-degree':
      return ['45-degree']
    case 'eye-level':
      return ['eye-level']
    case 'macro-close-up':
      return ['macro', 'close-up']
    default:
      return [angle]
  }
}

/** Build a minimal but valid EditorState with explicit field values. */
function makeState(
  overrides: Partial<{
    angle: (typeof ANGLE_VALUES)[number]
    lighting: (typeof LIGHTING_VALUES)[number]
    framing: (typeof FRAMING_VALUES)[number]
    garnishes: string[]
    sides: string[]
    mainItem: string
    position: AbstractCoordinate
  }> = {},
): EditorState {
  const schema: MinimalSchema = {
    scene_setup: {
      angle: overrides.angle ?? '45-degree',
      framing: overrides.framing ?? 'close-up',
      lighting: overrides.lighting ?? 'low-key',
    },
    canvas: {
      background: 'white marble',
      main_vessel: 'ceramic plate',
    },
    food_components: {
      main_item: overrides.mainItem ?? 'grilled salmon',
      garnishes: overrides.garnishes ?? [],
      sides: overrides.sides ?? [],
    },
  }
  return { schema, position: overrides.position ?? { ...CENTER } }
}

/** Case-insensitive substring check. */
function containsCI(text: string, substring: string): boolean {
  return text.toLowerCase().includes(substring.toLowerCase())
}

// ── Arbitraries ──────────────────────────────────────────────────────────────

const angleArb = fc.constantFrom(...ANGLE_VALUES)
const lightingArb = fc.constantFrom(...LIGHTING_VALUES)
const framingArb = fc.constantFrom(...FRAMING_VALUES)

/** A non-empty printable string suitable for a food component name. */
const componentNameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 20 })

/**
 * An arbitrary AbstractCoordinate within the valid [-1, 1] range.
 */
const coordArb: fc.Arbitrary<AbstractCoordinate> = fc.record({
  x: fc.double({ min: -1, max: 1, noNaN: true }),
  y: fc.double({ min: -1, max: 1, noNaN: true }),
})

/**
 * A pair of distinct angle values (from ≠ to).
 */
const angleChangePairArb: fc.Arbitrary<{
  from: (typeof ANGLE_VALUES)[number]
  to: (typeof ANGLE_VALUES)[number]
}> = fc
  .tuple(angleArb, angleArb)
  .filter(([from, to]) => from !== to)
  .map(([from, to]) => ({ from, to }))

/**
 * A pair of coordinates that differ in at least one component (position change).
 */
const positionChangePairArb: fc.Arbitrary<{
  from: AbstractCoordinate
  to: AbstractCoordinate
}> = fc
  .tuple(coordArb, coordArb)
  .filter(([from, to]) => from.x !== to.x || from.y !== to.y)
  .map(([from, to]) => ({ from, to }))

// ── Property 10a: Angle change directive content (Req 5.3) ───────────────────

describe('Feature: photo-control, Property 10: Directive content per change type', () => {
  /**
   * Angle change (Requirement 5.3):
   * When scene_setup.angle changes, the directive must mention the new angle
   * value and instruct a perspective change.
   */
  it('angle change: directive mentions the new angle value and perspective change', () => {
    fc.assert(
      fc.property(angleChangePairArb, lightingArb, framingArb, ({ from, to }, lighting, framing) => {
        const original = makeState({ angle: from, lighting, framing })
        const target = makeState({ angle: to, lighting, framing })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        // Must mention the new angle value via its human-readable label keywords
        // (e.g. "top-down", "macro close-up", "eye-level", "45-degree")
        const keywords = angleKeywords(to)
        const mentionsAngle = keywords.some((kw) => containsCI(text, kw))
        expect(mentionsAngle).toBe(true)

        // Must mention a perspective change
        expect(containsCI(text, 'perspective') || containsCI(text, 'angle') || containsCI(text, 'camera')).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  // ── Property 10b: Lighting low-key → bright-and-airy (Req 6.3) ─────────────

  /**
   * Lighting low-key → bright-and-airy (Requirement 6.3):
   * The directive must mention "bright", "airy", "high-key" or "diffused" light,
   * and removal of shadows.
   */
  it('lighting low-key → bright-and-airy: directive mentions bright/airy/high-key/diffused and shadow removal', () => {
    fc.assert(
      fc.property(angleArb, framingArb, (angle, framing) => {
        const original = makeState({ angle, framing, lighting: 'low-key' })
        const target = makeState({ angle, framing, lighting: 'bright-and-airy' })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        // Must mention bright/airy/high-key or diffused
        const mentionsBrightOrAiry =
          containsCI(text, 'bright') ||
          containsCI(text, 'airy') ||
          containsCI(text, 'high-key') ||
          containsCI(text, 'diffused')
        expect(mentionsBrightOrAiry).toBe(true)

        // Must mention shadow removal
        expect(containsCI(text, 'shadow')).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  // ── Property 10c: Lighting bright-and-airy → low-key (Req 6.4) ─────────────

  /**
   * Lighting bright-and-airy → low-key (Requirement 6.4):
   * The directive must mention "low-key", "shadow", and "darker".
   */
  it('lighting bright-and-airy → low-key: directive mentions low-key, shadow, and darker', () => {
    fc.assert(
      fc.property(angleArb, framingArb, (angle, framing) => {
        const original = makeState({ angle, framing, lighting: 'bright-and-airy' })
        const target = makeState({ angle, framing, lighting: 'low-key' })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        expect(containsCI(text, 'low-key')).toBe(true)
        expect(containsCI(text, 'shadow')).toBe(true)
        expect(containsCI(text, 'darker') || containsCI(text, 'dark')).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  // ── Property 10d: Position change directive content (Req 7.3) ───────────────

  /**
   * Position change (Requirement 7.3):
   * The directive must mention direction of movement and negative space.
   */
  it('position change: directive mentions direction of movement and negative space', () => {
    fc.assert(
      fc.property(positionChangePairArb, angleArb, lightingArb, framingArb, ({ from, to }, angle, lighting, framing) => {
        const original = makeState({ angle, lighting, framing, position: from })
        const target = makeState({ angle, lighting, framing, position: to })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        // Must mention a direction or movement
        const mentionsDirection =
          containsCI(text, 'left') ||
          containsCI(text, 'right') ||
          containsCI(text, 'center') ||
          containsCI(text, 'translat') ||
          containsCI(text, 'direction')
        expect(mentionsDirection).toBe(true)

        // Must mention negative space
        expect(containsCI(text, 'negative space')).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  // ── Property 10e: Array removal directive content (Req 8.4) ─────────────────

  /**
   * Array removal — garnishes (Requirement 8.4):
   * The directive must mention the removed item name and "remove" or "fill".
   */
  it('garnish removal: directive mentions the removed item name and remove/fill', () => {
    fc.assert(
      fc.property(componentNameArb, angleArb, lightingArb, framingArb, (item, angle, lighting, framing) => {
        const original = makeState({ angle, lighting, framing, garnishes: [item] })
        const target = makeState({ angle, lighting, framing, garnishes: [] })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        // Must mention the removed item name
        expect(containsCI(text, item)).toBe(true)

        // Must mention "remove" or "fill"
        expect(containsCI(text, 'remove') || containsCI(text, 'fill')).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  /**
   * Array removal — sides (Requirement 8.4):
   * The directive must mention the removed item name and "remove" or "fill".
   */
  it('side removal: directive mentions the removed item name and remove/fill', () => {
    fc.assert(
      fc.property(componentNameArb, angleArb, lightingArb, framingArb, (item, angle, lighting, framing) => {
        const original = makeState({ angle, lighting, framing, sides: [item] })
        const target = makeState({ angle, lighting, framing, sides: [] })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        // Must mention the removed item name
        expect(containsCI(text, item)).toBe(true)

        // Must mention "remove" or "fill"
        expect(containsCI(text, 'remove') || containsCI(text, 'fill')).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  // ── Property 10f: Array addition directive content (Req 8.5) ────────────────

  /**
   * Array addition — garnishes (Requirement 8.5):
   * The directive must mention the added item name and "add".
   */
  it('garnish addition: directive mentions the added item name and add', () => {
    fc.assert(
      fc.property(componentNameArb, angleArb, lightingArb, framingArb, (item, angle, lighting, framing) => {
        const original = makeState({ angle, lighting, framing, garnishes: [] })
        const target = makeState({ angle, lighting, framing, garnishes: [item] })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        // Must mention the added item name
        expect(containsCI(text, item)).toBe(true)

        // Must mention "add"
        expect(containsCI(text, 'add')).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  /**
   * Array addition — sides (Requirement 8.5):
   * The directive must mention the added item name and "add".
   */
  it('side addition: directive mentions the added item name and add', () => {
    fc.assert(
      fc.property(componentNameArb, angleArb, lightingArb, framingArb, (item, angle, lighting, framing) => {
        const original = makeState({ angle, lighting, framing, sides: [] })
        const target = makeState({ angle, lighting, framing, sides: [item] })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        // Must mention the added item name
        expect(containsCI(text, item)).toBe(true)

        // Must mention "add"
        expect(containsCI(text, 'add')).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  // ── Property 10g: Single-attribute change includes "leave unchanged" (Req 11.3)

  /**
   * Single-attribute change — angle (Requirement 11.3):
   * When exactly one attribute changes, the directive must contain
   * "leave all other attributes unchanged" (or similar).
   */
  it('single angle change: directive contains "leave all other attributes unchanged"', () => {
    fc.assert(
      fc.property(angleChangePairArb, lightingArb, framingArb, ({ from, to }, lighting, framing) => {
        const original = makeState({ angle: from, lighting, framing })
        const target = makeState({ angle: to, lighting, framing })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        expect(
          containsCI(text, 'leave all other attributes unchanged') ||
          containsCI(text, 'leave all other') ||
          containsCI(text, 'unchanged'),
        ).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  /**
   * Single-attribute change — lighting (Requirement 11.3):
   * When exactly one attribute changes, the directive must contain
   * "leave all other attributes unchanged" (or similar).
   */
  it('single lighting change: directive contains "leave all other attributes unchanged"', () => {
    fc.assert(
      fc.property(angleArb, framingArb, (angle, framing) => {
        // Toggle between the two lighting values
        const original = makeState({ angle, framing, lighting: 'low-key' })
        const target = makeState({ angle, framing, lighting: 'bright-and-airy' })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        expect(
          containsCI(text, 'leave all other attributes unchanged') ||
          containsCI(text, 'leave all other') ||
          containsCI(text, 'unchanged'),
        ).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  /**
   * Single-attribute change — garnish removal (Requirement 11.3):
   * When exactly one item is removed, the directive must contain
   * "leave all other attributes unchanged" (or similar).
   */
  it('single garnish removal: directive contains "leave all other attributes unchanged"', () => {
    fc.assert(
      fc.property(componentNameArb, angleArb, lightingArb, framingArb, (item, angle, lighting, framing) => {
        const original = makeState({ angle, lighting, framing, garnishes: [item] })
        const target = makeState({ angle, lighting, framing, garnishes: [] })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        expect(
          containsCI(text, 'leave all other attributes unchanged') ||
          containsCI(text, 'leave all other') ||
          containsCI(text, 'unchanged'),
        ).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  /**
   * Single-attribute change — garnish addition (Requirement 11.3):
   * When exactly one item is added, the directive must contain
   * "leave all other attributes unchanged" (or similar).
   */
  it('single garnish addition: directive contains "leave all other attributes unchanged"', () => {
    fc.assert(
      fc.property(componentNameArb, angleArb, lightingArb, framingArb, (item, angle, lighting, framing) => {
        const original = makeState({ angle, lighting, framing, garnishes: [] })
        const target = makeState({ angle, lighting, framing, garnishes: [item] })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        expect(
          containsCI(text, 'leave all other attributes unchanged') ||
          containsCI(text, 'leave all other') ||
          containsCI(text, 'unchanged'),
        ).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  /**
   * Single-attribute change — position (Requirement 11.3):
   * When only the position changes, the directive must contain
   * "leave all other attributes unchanged" (or similar).
   */
  it('single position change: directive contains "leave all other attributes unchanged"', () => {
    fc.assert(
      fc.property(positionChangePairArb, angleArb, lightingArb, framingArb, ({ from, to }, angle, lighting, framing) => {
        const original = makeState({ angle, lighting, framing, position: from })
        const target = makeState({ angle, lighting, framing, position: to })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        expect(
          containsCI(text, 'leave all other attributes unchanged') ||
          containsCI(text, 'leave all other') ||
          containsCI(text, 'unchanged'),
        ).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  /**
   * Multi-attribute change does NOT include "leave all other attributes unchanged".
   *
   * When more than one attribute changes simultaneously, the "leave unchanged"
   * clause must NOT be appended (it is only for single-attribute changes per
   * Requirement 11.3).
   */
  it('multi-attribute change does NOT include "leave all other attributes unchanged"', () => {
    fc.assert(
      fc.property(
        angleChangePairArb,
        framingArb,
        componentNameArb,
        (anglePair, framing, item) => {
          // Change both angle AND add a garnish — two attribute changes
          const original = makeState({
            angle: anglePair.from,
            framing,
            lighting: 'low-key',
            garnishes: [],
          })
          const target = makeState({
            angle: anglePair.to,
            framing,
            lighting: 'low-key',
            garnishes: [item],
          })
          const delta = computeDelta(original, target)

          expect(delta.isEmpty).toBe(false)

          const directive = generateDirective(delta, original)
          expect(directive).not.toBeNull()
          const text = directive!

          // With 2+ changes, the "leave unchanged" clause must NOT appear
          expect(containsCI(text, 'leave all other attributes unchanged')).toBe(false)
        },
      ),
      { numRuns: 150 },
    )
  })

  /**
   * Discrete position-step changes produce correct directional content.
   *
   * Shift Left (x decreases) → directive mentions "left" and "right" (opposite).
   * Shift Right (x increases) → directive mentions "right" and "left" (opposite).
   * Center (x = 0) → directive mentions "center".
   */
  it('touch-position step left: directive mentions left direction and right negative space', () => {
    fc.assert(
      fc.property(angleArb, lightingArb, framingArb, (angle, lighting, framing) => {
        // Start from a position that can shift left (x > -1)
        const fromX = POSITION_STEP // 0.25, so shifting left gives 0.0
        const toX = fromX - POSITION_STEP // 0.0
        const original = makeState({ angle, lighting, framing, position: { x: fromX, y: 0 } })
        const target = makeState({ angle, lighting, framing, position: { x: toX, y: 0 } })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        expect(containsCI(text, 'left')).toBe(true)
        expect(containsCI(text, 'right')).toBe(true) // opposite side for negative space
        expect(containsCI(text, 'negative space')).toBe(true)
      }),
      { numRuns: 150 },
    )
  })

  it('touch-position step right: directive mentions right direction and left negative space', () => {
    fc.assert(
      fc.property(angleArb, lightingArb, framingArb, (angle, lighting, framing) => {
        // Start from a position that can shift right (x < 1)
        const fromX = -POSITION_STEP // -0.25, so shifting right gives 0.0
        const toX = fromX + POSITION_STEP // 0.0
        const original = makeState({ angle, lighting, framing, position: { x: fromX, y: 0 } })
        const target = makeState({ angle, lighting, framing, position: { x: toX, y: 0 } })
        const delta = computeDelta(original, target)

        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        const text = directive!

        expect(containsCI(text, 'right')).toBe(true)
        expect(containsCI(text, 'left')).toBe(true) // opposite side for negative space
        expect(containsCI(text, 'negative space')).toBe(true)
      }),
      { numRuns: 150 },
    )
  })
})
