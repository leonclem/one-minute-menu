/**
 * Bug-condition exploration for Property 6: Faithful, Semantic,
 * Non-Contradictory Scene Descriptor.
 *
 * These assertions intentionally run before Group B's descriptor redesign. The
 * expected failures document the legacy `compress()` counterexamples; they are
 * not production-code fixes.
 *
 * **Validates: Requirements 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.20**
 */

import fc from 'fast-check'
import { composePrompt } from '../prompt-composer'
import {
  ANGLE_VALUES,
  FRAMING_VALUES,
  SPIN_VALUES,
  type MinimalSchema,
} from '../minimal-schema'

type JsonObject = Record<string, unknown>
type DescriptorPayload = {
  json: JsonObject
  current: JsonObject
  target: JsonObject
}

type StagedPath =
  | 'scene_setup.angle'
  | 'scene_setup.framing'
  | 'scene_setup.lighting'
  | 'scene_setup.spin'
  | 'canvas.background_style'
  | 'canvas.surface_style'

const DB_STYLE_KEYS = [
  'studio',
  'studio-yellow',
  'dark-slate',
  'bright-and-airy',
  'golden-hour',
] as const

const stagedPaths: readonly StagedPath[] = [
  'scene_setup.angle',
  'scene_setup.framing',
  'scene_setup.lighting',
  'scene_setup.spin',
  'canvas.background_style',
  'canvas.surface_style',
]

const freeTextArb = fc
  .string({ minLength: 1, maxLength: 140 })
  .filter((value) => value.trim().length > 0)

const styleKeyArb = fc.constantFrom(...DB_STYLE_KEYS)

const minimalSchemaArb: fc.Arbitrary<MinimalSchema> = fc.record({
  scene_setup: fc.record({
    angle: fc.constantFrom(...ANGLE_VALUES),
    framing: fc.constantFrom(...FRAMING_VALUES),
    lighting: fc.oneof(styleKeyArb, freeTextArb),
    spin: fc.constantFrom(...SPIN_VALUES),
  }),
  canvas: fc.record({
    background: freeTextArb,
    background_style: fc.oneof(fc.constant(''), styleKeyArb),
    surface_style: fc.oneof(fc.constant(''), styleKeyArb),
    main_vessel: freeTextArb,
  }),
  food_components: fc.record({
    main_item: freeTextArb,
    garnishes: fc.array(freeTextArb, { maxLength: 4 }),
    sides: fc.array(freeTextArb, { maxLength: 4 }),
  }),
})

const directiveArb = freeTextArb

function cloneSchema(schema: MinimalSchema): MinimalSchema {
  return JSON.parse(JSON.stringify(schema)) as MinimalSchema
}

function setPath(schema: MinimalSchema, path: StagedPath, value: string): void {
  const [section, field] = path.split('.') as ['scene_setup' | 'canvas', string]
  ;(schema[section] as Record<string, unknown>)[field] = value
}

function stagedPairArb(): fc.Arbitrary<{
  original: MinimalSchema
  target: MinimalSchema
  staged: StagedPath[]
  targetValues: string[]
}> {
  return fc
    .record({ original: minimalSchemaArb, staged: fc.subarray(stagedPaths, { minLength: 1 }) })
    .map(({ original, staged }) => {
      const normalizedOriginal = cloneSchema(original)
      const target = cloneSchema(original)
      const targetValues = staged.map((path) => `target-value-${path.replace('.', '-')}`)

      staged.forEach((path, index) => {
        setPath(normalizedOriginal, path, `current-value-${path.replace('.', '-')}`)
        setPath(target, path, targetValues[index])
      })

      return { original: normalizedOriginal, target, staged, targetValues }
    })
}

function extractLineJson(prompt: string, label: 'Original' | 'Target'): JsonObject | null {
  const match = prompt.match(new RegExp(`^${label}:\\s*(\\{.*\\})$`, 'm'))
  if (!match) return null

  try {
    return JSON.parse(match[1]) as JsonObject
  } catch {
    return null
  }
}

/** Parse the future pretty-printed descriptor, falling back to today's anchors. */
function extractPayload(prompt: string): DescriptorPayload {
  const original = extractLineJson(prompt, 'Original')
  const target = extractLineJson(prompt, 'Target')
  if (original && target) {
    return { json: { current: original, target }, current: original, target }
  }

  for (let start = 0; start < prompt.length; start += 1) {
    if (prompt[start] !== '{') continue
    let depth = 0
    let inString = false
    let escaped = false

    for (let end = start; end < prompt.length; end += 1) {
      const character = prompt[end]
      if (inString) {
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === '"') inString = false
        continue
      }
      if (character === '"') inString = true
      else if (character === '{') depth += 1
      else if (character === '}') {
        depth -= 1
        if (depth === 0) {
          try {
            const parsed = JSON.parse(prompt.slice(start, end + 1)) as JsonObject
            if (parsed.subject && parsed.target) {
              return {
                json: parsed,
                current: (parsed.current as JsonObject) || {},
                target: parsed.target as JsonObject,
              }
            }
          } catch {
            // Continue looking for the next balanced object.
          }
          break
        }
      }
    }
  }

  return { json: {}, current: {}, target: {} }
}

function walkValues(value: unknown, visit: (value: unknown) => void): void {
  visit(value)
  if (Array.isArray(value)) {
    value.forEach((item) => walkValues(item, visit))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => walkValues(item, visit))
  }
}

function containsExactValue(root: unknown, expected: string): boolean {
  let found = false
  walkValues(root, (value) => {
    if (value === expected) found = true
  })
  return found
}

function collectKeys(root: unknown): string[] {
  const keys: string[] = []
  if (Array.isArray(root)) {
    root.forEach((item) => keys.push(...collectKeys(item)))
  } else if (root && typeof root === 'object') {
    for (const [key, value] of Object.entries(root)) {
      keys.push(key, ...collectKeys(value))
    }
  }
  return keys
}

function extractedStrings(schema: MinimalSchema): string[] {
  return [
    schema.canvas.background,
    schema.canvas.main_vessel,
    schema.food_components.main_item,
    ...schema.food_components.garnishes,
    ...schema.food_components.sides,
  ].filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
}

function sectionName(path: StagedPath): string {
  if (path.startsWith('scene_setup.lighting')) return 'lighting'
  if (path.startsWith('canvas.background_style')) return 'backdrop'
  if (path.startsWith('canvas.surface_style')) return 'surface'
  return 'camera'
}

function findObject(root: unknown, name: string): JsonObject | undefined {
  if (root && typeof root === 'object' && !Array.isArray(root)) {
    const direct = (root as JsonObject)[name]
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct as JsonObject
    for (const value of Object.values(root)) {
      const nested = findObject(value, name)
      if (nested) return nested
    }
  } else if (Array.isArray(root)) {
    for (const value of root) {
      const nested = findObject(value, name)
      if (nested) return nested
    }
  }
  return undefined
}

function occurrenceCount(text: string, phrase: string): number {
  return text.split(phrase).length - 1
}

function jsonShare(prompt: string, payload: DescriptorPayload): number {
  const serializedDescriptor = JSON.stringify(payload.json).length
  return serializedDescriptor / prompt.length
}

function compose(input: { directive: string; originalState: MinimalSchema; targetState: MinimalSchema }): {
  prompt: string
  payload: DescriptorPayload
} {
  const result = composePrompt(input)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error)
  return { prompt: result.prompt, payload: extractPayload(result.prompt) }
}

describe('Studio scene descriptor defects: Property 6', () => {
  it('preserves every extracted free-text value in full for arbitrary MinimalSchema pairs', () => {
    fc.assert(
      fc.property(directiveArb, minimalSchemaArb, minimalSchemaArb, (directive, originalState, targetState) => {
        const { prompt, payload } = compose({ directive, originalState, targetState })

        for (const value of [...extractedStrings(originalState), ...extractedStrings(targetState)]) {
          expect({ value, presentInPayload: containsExactValue(payload.json, value), prompt }).toEqual({
            value,
            presentInPayload: true,
            prompt,
          })
        }
        expect(prompt).toContain(directive)
      }),
      { numRuns: 100 },
    )
  })

  it('includes the concrete 120-character background description without slicing', () => {
    const background = 'A pale limestone tabletop beside a sunlit window with a folded linen napkin and soft shadows across the entire scene.'.padEnd(120, 'x')
    expect(background).toHaveLength(120)

    const originalState: MinimalSchema = {
      scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'studio', spin: '0' },
      canvas: {
        background,
        background_style: 'studio-yellow',
        surface_style: 'dark-slate',
        main_vessel: 'white ceramic plate',
      },
      food_components: { main_item: 'rice bowl', garnishes: [], sides: [] },
    }

    const { payload } = compose({
      directive: 'Preserve the dish while changing only the staged surface.',
      originalState,
      targetState: cloneSchema(originalState),
    })

    expect(containsExactValue(payload.json, background)).toBe(true)
  })

  it('uses full semantic keys with no opaque abbreviations or key collisions', () => {
    fc.assert(
      fc.property(minimalSchemaArb, minimalSchemaArb, (originalState, targetState) => {
        const { payload } = compose({
          directive: 'Keep the original composition and apply the requested edit.',
          originalState,
          targetState,
        })
        const keys = collectKeys(payload.json)
        const opaqueKeys = keys.filter((key) =>
          new Set(['s', 'a', 'f', 'l', 'sp', 'c', 'b', 'bs', 'v', 'm', 'g', 'si']).has(key),
        )

        expect({ opaqueKeys, keys }).toEqual({ opaqueKeys: [], keys })
      }),
      { numRuns: 100 },
    )
  })

  it('never exposes internal database style keys as model-facing values', () => {
    fc.assert(
      fc.property(minimalSchemaArb, minimalSchemaArb, (originalState, targetState) => {
        const { payload } = compose({
          directive: 'Apply the selected studio styling while preserving the subject.',
          originalState,
          targetState,
        })
        const values: unknown[] = []
        walkValues(payload.json, (value) => values.push(value))

        for (const styleKey of DB_STYLE_KEYS) {
          expect({ styleKey, appearsAsValue: values.includes(styleKey), values }).toEqual({
            styleKey,
            appearsAsValue: false,
            values,
          })
        }
      }),
      { numRuns: 50 },
    )
  })

  it('places every arbitrary staged change under target and keeps it different from current', () => {
    fc.assert(
      fc.property(stagedPairArb(), ({ original, target, staged }) => {
        const { payload } = compose({
          directive: 'Change only the staged controls and keep every other attribute unchanged.',
          originalState: original,
          targetState: target,
        })

        for (const path of staged) {
          const section = sectionName(path)
          const targetSection = findObject(payload.target, section)
          const currentSection = findObject(payload.current, section)

          expect({ path, targetSection, currentSection }).toEqual({
            path,
            targetSection: expect.any(Object),
            currentSection: expect.any(Object),
          })
          expect(JSON.stringify(targetSection)).not.toBe(JSON.stringify(currentSection))
        }
      }),
      { numRuns: 100 },
    )
  })

  it('carries a surface-only staged change under target with a changed value', () => {
    const originalState: MinimalSchema = {
      scene_setup: { angle: 'top-down', framing: 'close-up', lighting: 'bright-and-airy', spin: '0' },
      canvas: {
        background: 'white studio background',
        background_style: '',
        surface_style: 'current-surface',
        main_vessel: 'ceramic bowl',
      },
      food_components: { main_item: 'noodles', garnishes: [], sides: [] },
    }
    const targetState = cloneSchema(originalState)
    targetState.canvas.surface_style = 'target-surface'
    const { payload } = compose({
      directive: 'Change only the tabletop surface.',
      originalState,
      targetState,
    })

    const currentSurface = findObject(payload.current, 'surface')
    const targetSurface = findObject(payload.target, 'surface')
    expect({ currentSurface, targetSurface }).toEqual({
      currentSurface: expect.any(Object),
      targetSurface: expect.any(Object),
    })
    expect(JSON.stringify(targetSurface)).not.toBe(JSON.stringify(currentSurface))
  })

  it('states identity constraints once and exposes a positive subject.locked field', () => {
    const directive = [
      ...Array(4).fill('Do not change the dish.'),
      ...Array(4).fill('Do not add props.'),
    ].join(' ')
    const identitySchema: MinimalSchema = {
      scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'studio', spin: '0' },
      canvas: {
        background: 'plain background',
        background_style: 'studio-yellow',
        surface_style: 'dark-slate',
        main_vessel: 'ceramic plate',
      },
      food_components: { main_item: 'plated dish', garnishes: [], sides: [] },
    }
    const { prompt, payload } = compose({
      directive,
      originalState: identitySchema,
      targetState: cloneSchema(identitySchema),
    })

    expect(occurrenceCount(prompt, 'Do not change the dish')).toBeLessThanOrEqual(1)
    expect(occurrenceCount(prompt, 'Do not add props')).toBeLessThanOrEqual(1)
    expect(findObject(payload.json, 'subject')).toHaveProperty('locked')
  })

  it('keeps the descriptor under the payload budget and makes JSON carry at least 80 percent', () => {
    const originalState: MinimalSchema = {
      scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'studio', spin: '0' },
      canvas: {
        background: 'A 120-character background description is preserved in the descriptor without slicing.'.padEnd(120, 'x'),
        background_style: 'studio-yellow',
        surface_style: 'dark-slate',
        main_vessel: 'hand-thrown ceramic serving bowl',
      },
      food_components: {
        main_item: 'Hainanese chicken rice with fragrant rice and sliced poached chicken',
        garnishes: ['cucumber ribbons', 'cilantro leaves'],
        sides: ['chilli sauce', 'ginger scallion sauce'],
      },
    }
    const directive = `${'Preserve the source photograph and perform only the requested constrained edit. '.repeat(35)}`
    const { prompt, payload } = compose({
      directive,
      originalState,
      targetState: cloneSchema(originalState),
    })

    expect(prompt.length).toBeLessThan(2492)
    expect(jsonShare(prompt, payload)).toBeGreaterThanOrEqual(0.8)
  })
})

// Expected unfixed counterexamples (recorded by the focused Jest run):
// - `compress()` slices free-text values at 50 characters (and 40/100 for other fields).
// - The opaque `f` key is used for framing and again for food_components.
// - `surface_style` is absent, so a surface-only Original/Target pair is identical.
// - The legacy style clauses/identity prose repeat each prohibition four times.
// - The prose-heavy 2,492-character request violates the budget and JSON-share target.
