import { composePrompt, type CompositionResult } from '../prompt-composer'
import type { SceneDescriptor } from '../scene-descriptor'

const descriptor: SceneDescriptor = {
  task: 'edit',
  subject: {
    reference: 'Image A',
    dish: 'A full-length dish description that must remain complete.',
    vessel: 'white ceramic platter',
    locked: ['dish identity', 'vessel', 'framing', 'colours and textures'],
  },
  camera: { angle: '45-degree', framing: 'close-up', spin: '0' },
  current: {
    lighting: { quality: 'observed soft window light' },
  },
  target: {
    lighting: {
      quality: 'clean commercial studio light',
      temperature: 'neutral',
      shadows: 'soft',
      falloff: 'gradual',
    },
    surface: {
      material: 'dark slate stone',
      finish: 'honed matte',
      colour: '#2E3338',
    },
  },
  output: { style: 'photorealistic', framing: 'full shot, no cropping' },
}

function successful(result: CompositionResult): string {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error)
  return result.prompt
}

describe('composePrompt', () => {
  it('wraps the pretty-printed semantic descriptor in constrained-edit framing', () => {
    const prompt = successful(
      composePrompt({
        directive: 'Apply the staged lighting and surface changes only.',
        descriptor,
      }),
    )

    expect(prompt).toContain('Constrained edit:')
    expect(prompt).toContain('change only what "target" names')
    expect(prompt).toContain('keep everything else exactly as-is')
    expect(prompt).toContain('preserve the original composition')
    expect(prompt).toContain('Semantic negative prompt')
    expect(prompt).toContain('pixel-faithful')
    expect(prompt).toContain('  "subject": {')
    expect(prompt).toContain('"A full-length dish description that must remain complete."')
    expect(prompt).not.toContain('CRITICAL: CHANGE PERSPECTIVE TO SIDE-VIEW')
    expect(prompt).not.toContain('Camera specification:')
    expect(prompt).not.toContain('negative_constraints')
    expect(prompt.length).toBeLessThan(2492)
  })

  it('accepts the legacy state-pair call shape while emitting semantic JSON', () => {
    const state = {
      scene_setup: {
        angle: 'eye-level' as const,
        framing: 'medium' as const,
        lighting: 'studio',
        spin: '0' as const,
      },
      canvas: {
        background: 'A complete background description with no truncation.',
        background_style: '',
        surface_style: '',
        main_vessel: 'ceramic plate',
      },
      food_components: {
        main_item: 'plated noodles',
        garnishes: ['spring onion'],
        sides: ['chilli sauce'],
      },
    }

    const prompt = successful(
      composePrompt({
        directive: 'Preserve the source composition while applying the requested edit.',
        originalState: state,
        targetState: state,
      }),
    )

    expect(prompt).toContain('"task": "edit"')
    expect(prompt).toContain('"dish"')
    expect(prompt).toContain('plated noodles')
    expect(prompt).not.toContain('CRITICAL: CHANGE PERSPECTIVE TO SIDE-VIEW')
  })

  it('preserves the composition failure contract for invalid inputs and over-budget payloads', () => {
    const missing = composePrompt({ directive: 'edit', descriptor: null as unknown as SceneDescriptor })
    expect(missing).toEqual({
      ok: false,
      error: 'Composition failure: descriptor is missing or not an object.',
      code: 'COMPOSITION_FAILURE',
    })

    const oversized = composePrompt({
      directive: 'x'.repeat(2300),
      descriptor,
    })
    expect(oversized.ok).toBe(false)
    if (!oversized.ok) expect(oversized.code).toBe('COMPOSITION_FAILURE')
  })
})
