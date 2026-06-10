/**
 * Property-Based Tests for Array-Diff Correctness
 *
 * Feature: photo-control, Property 5: Array-diff correctness
 *
 * Property 5 (Array-diff correctness): For any pair of `food_components` array
 * states `(original, target)` for garnishes and sides, the set of "added"
 * members computed by the `State_Delta_Engine` equals `target \ original` and
 * the set of "removed" members equals `original \ target`.
 *
 * Additional sub-properties verified:
 *  - Reordering the same members produces an empty diff (no added, no removed).
 *  - Duplicates in input arrays are collapsed (set semantics).
 *  - `applyDelta` with the computed diff reconstructs the target's component
 *    set from the original.
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property (configured at 200+)
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 9.2
 */

import fc from 'fast-check'
import { computeDelta, applyDelta } from '../state-delta'
import {
  type EditorState,
  type MinimalSchema,
  ANGLE_VALUES,
  FRAMING_VALUES,
  LIGHTING_VALUES,
  CENTER,
} from '../minimal-schema'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal but valid `EditorState` with the given garnishes and sides.
 * All other fields are fixed so that only the array fields vary between states.
 */
function makeState(garnishes: string[], sides: string[]): EditorState {
  const schema: MinimalSchema = {
    scene_setup: {
      angle: ANGLE_VALUES[0],
      framing: FRAMING_VALUES[0],
      lighting: LIGHTING_VALUES[0],
    },
    canvas: {
      background: 'white marble',
      main_vessel: 'ceramic plate',
    },
    food_components: {
      main_item: 'grilled salmon',
      garnishes,
      sides,
    },
  }
  return { schema, position: CENTER }
}

/**
 * Collapse an array to its set of distinct members (first-seen order), matching
 * the set semantics the engine applies to inputs.
 */
function toSet(arr: string[]): Set<string> {
  return new Set(arr)
}

// ── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * A realistic food-item string: short, printable, no control characters.
 * Arbitrary strings are also fine per the task spec, but food-like strings
 * make shrunk counterexamples easier to read.
 */
const foodItemArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(
    'parsley',
    'lemon wedge',
    'chive',
    'basil',
    'mint',
    'cilantro',
    'dill',
    'thyme',
    'rosemary',
    'rice',
    'salad',
    'fries',
    'coleslaw',
    'bread',
    'soup',
    'mashed potatoes',
    'steamed broccoli',
    'roasted carrots',
  ),
  // Arbitrary strings to cover the full input space.
  fc.string({ minLength: 1, maxLength: 20 }),
)

/**
 * An array of food items, possibly containing duplicates (to exercise set
 * semantics / duplicate-collapsing behaviour).
 */
const foodArrayArb: fc.Arbitrary<string[]> = fc.array(foodItemArb, {
  minLength: 0,
  maxLength: 8,
})

/**
 * A pair of food arrays `(original, target)` with independent content.
 */
const arrayPairArb: fc.Arbitrary<{ original: string[]; target: string[] }> = fc.record({
  original: foodArrayArb,
  target: foodArrayArb,
})

// ── Property 5: Array-diff correctness ───────────────────────────────────────

describe('Feature: photo-control, Property 5: Array-diff correctness', () => {
  /**
   * Core set-difference property for garnishes.
   *
   * For any (original, target) pair:
   *  - `added`   = members in target's set but not in original's set
   *  - `removed` = members in original's set but not in target's set
   *
   * (Requirements 8.1, 8.3, 9.2)
   */
  it('garnishes diff: added = target \\ original, removed = original \\ target', () => {
    fc.assert(
      fc.property(arrayPairArb, ({ original, target }) => {
        const origState = makeState(original, [])
        const tgtState = makeState(target, [])

        const delta = computeDelta(origState, tgtState)
        const { added, removed } = delta.arrays.garnishes

        const originalSet = toSet(original)
        const targetSet = toSet(target)

        // added = target \ original
        const expectedAdded = new Set([...targetSet].filter((x) => !originalSet.has(x)))
        expect(new Set(added)).toEqual(expectedAdded)

        // removed = original \ target
        const expectedRemoved = new Set([...originalSet].filter((x) => !targetSet.has(x)))
        expect(new Set(removed)).toEqual(expectedRemoved)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Core set-difference property for sides.
   *
   * (Requirements 8.2, 8.3, 9.2)
   */
  it('sides diff: added = target \\ original, removed = original \\ target', () => {
    fc.assert(
      fc.property(arrayPairArb, ({ original, target }) => {
        const origState = makeState([], original)
        const tgtState = makeState([], target)

        const delta = computeDelta(origState, tgtState)
        const { added, removed } = delta.arrays.sides

        const originalSet = toSet(original)
        const targetSet = toSet(target)

        // added = target \ original
        const expectedAdded = new Set([...targetSet].filter((x) => !originalSet.has(x)))
        expect(new Set(added)).toEqual(expectedAdded)

        // removed = original \ target
        const expectedRemoved = new Set([...originalSet].filter((x) => !targetSet.has(x)))
        expect(new Set(removed)).toEqual(expectedRemoved)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Reordering the same members produces an empty diff.
   *
   * If `target` is a permutation of `original` (same set of distinct members),
   * both `added` and `removed` must be empty for both garnishes and sides.
   * (Requirement 9.2 — set semantics; reordering is not a change)
   */
  it('reordering the same members produces an empty diff (no added, no removed)', () => {
    fc.assert(
      fc.property(
        foodArrayArb,
        fc.array(fc.integer({ min: 0, max: 0xffff }), { minLength: 0, maxLength: 8 }),
        (original, shuffleSeeds) => {
          // Build a permutation of `original` using the shuffle seeds.
          const permuted = [...original]
          for (let i = permuted.length - 1; i > 0; i--) {
            const j = shuffleSeeds[i % shuffleSeeds.length] ?? 0
            const swapIdx = j % (i + 1)
            ;[permuted[i], permuted[swapIdx]] = [permuted[swapIdx], permuted[i]]
          }

          const origState = makeState(original, original)
          const tgtState = makeState(permuted, permuted)

          const delta = computeDelta(origState, tgtState)

          expect(delta.arrays.garnishes.added).toHaveLength(0)
          expect(delta.arrays.garnishes.removed).toHaveLength(0)
          expect(delta.arrays.sides.added).toHaveLength(0)
          expect(delta.arrays.sides.removed).toHaveLength(0)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Duplicates in input arrays are collapsed (set semantics).
   *
   * An array with repeated members is treated identically to the same array
   * with duplicates removed. The diff result must be the same whether or not
   * the inputs contain duplicates.
   * (Requirement 9.2 — set semantics)
   */
  it('duplicates in input arrays are collapsed to set semantics', () => {
    fc.assert(
      fc.property(
        fc.array(foodItemArb, { minLength: 1, maxLength: 6 }),
        fc.array(foodItemArb, { minLength: 1, maxLength: 6 }),
        fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 6 }),
        fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 6 }),
        (originalBase, targetBase, origRepeat, tgtRepeat) => {
          // Build arrays with duplicates by repeating each element.
          const withDuplicates = (base: string[], repeats: number[]) =>
            base.flatMap((item, i) => Array(repeats[i % repeats.length]).fill(item) as string[])

          const originalDup = withDuplicates(originalBase, origRepeat)
          const targetDup = withDuplicates(targetBase, tgtRepeat)

          // Deduplicated versions (set semantics applied manually).
          const originalDedup = [...new Set(originalDup)]
          const targetDedup = [...new Set(targetDup)]

          const deltaWithDup = computeDelta(
            makeState(originalDup, originalDup),
            makeState(targetDup, targetDup),
          )
          const deltaDedup = computeDelta(
            makeState(originalDedup, originalDedup),
            makeState(targetDedup, targetDedup),
          )

          // The set of added/removed members must be identical regardless of
          // whether the inputs contained duplicates.
          expect(new Set(deltaWithDup.arrays.garnishes.added)).toEqual(
            new Set(deltaDedup.arrays.garnishes.added),
          )
          expect(new Set(deltaWithDup.arrays.garnishes.removed)).toEqual(
            new Set(deltaDedup.arrays.garnishes.removed),
          )
          expect(new Set(deltaWithDup.arrays.sides.added)).toEqual(
            new Set(deltaDedup.arrays.sides.added),
          )
          expect(new Set(deltaWithDup.arrays.sides.removed)).toEqual(
            new Set(deltaDedup.arrays.sides.removed),
          )
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * `applyDelta` reconstructs the target's component set from the original.
   *
   * For any (original, target) pair, applying the computed delta to `original`
   * must yield a state whose garnishes and sides have the same SET of members
   * as `target` (order may differ; duplicates are collapsed).
   * (Requirements 9.2, 9.4)
   */
  it('applyDelta reconstructs the target component set from the original', () => {
    fc.assert(
      fc.property(
        fc.record({
          origGarnishes: foodArrayArb,
          origSides: foodArrayArb,
          tgtGarnishes: foodArrayArb,
          tgtSides: foodArrayArb,
        }),
        ({ origGarnishes, origSides, tgtGarnishes, tgtSides }) => {
          const origState = makeState(origGarnishes, origSides)
          const tgtState = makeState(tgtGarnishes, tgtSides)

          const delta = computeDelta(origState, tgtState)
          const reconstructed = applyDelta(origState, delta)

          // The reconstructed state's component sets must equal the target's sets.
          expect(toSet(reconstructed.schema.food_components.garnishes)).toEqual(
            toSet(tgtGarnishes),
          )
          expect(toSet(reconstructed.schema.food_components.sides)).toEqual(
            toSet(tgtSides),
          )
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * No-op: identical arrays produce an empty diff.
   *
   * When original and target arrays are the same, both `added` and `removed`
   * must be empty and `isEmpty` must be true (assuming no other changes).
   * (Requirement 9.5)
   */
  it('identical arrays produce an empty diff with isEmpty = true', () => {
    fc.assert(
      fc.property(foodArrayArb, (arr) => {
        const state = makeState(arr, arr)
        const delta = computeDelta(state, state)

        expect(delta.arrays.garnishes.added).toHaveLength(0)
        expect(delta.arrays.garnishes.removed).toHaveLength(0)
        expect(delta.arrays.sides.added).toHaveLength(0)
        expect(delta.arrays.sides.removed).toHaveLength(0)
        expect(delta.isEmpty).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * No member appears in both `added` and `removed` simultaneously.
   *
   * The set-difference semantics guarantee that `added` and `removed` are
   * disjoint: a member cannot be both added and removed in the same diff.
   * (Requirement 9.2)
   */
  it('added and removed are always disjoint sets', () => {
    fc.assert(
      fc.property(arrayPairArb, ({ original, target }) => {
        const delta = computeDelta(makeState(original, []), makeState(target, []))
        const addedSet = new Set(delta.arrays.garnishes.added)
        for (const item of delta.arrays.garnishes.removed) {
          expect(addedSet.has(item)).toBe(false)
        }

        const delta2 = computeDelta(makeState([], original), makeState([], target))
        const addedSet2 = new Set(delta2.arrays.sides.added)
        for (const item of delta2.arrays.sides.removed) {
          expect(addedSet2.has(item)).toBe(false)
        }
      }),
      { numRuns: 200 },
    )
  })
})
