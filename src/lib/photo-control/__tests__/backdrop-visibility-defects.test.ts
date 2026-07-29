/**
 * Bug-condition exploration for Property 9: No Unsatisfiable Backdrop
 * Instruction.
 *
 * This intentionally runs against the pre-Group-C behavior. The concrete
 * legacy directive below records the instruction that made a backdrop change
 * unsatisfiable for the Hainanese chicken rice source when no wall was visible.
 *
 * **Validates: Requirements 2.21, 3.17**
 */

import fc from 'fast-check'
import { buildSceneDescriptor, type SceneDescriptor } from '../scene-descriptor'
import { composePrompt } from '../prompt-composer'
import type { MinimalSchema, StateDelta } from '../minimal-schema'

type BackdropVisibility = boolean | undefined

const FORBIDDEN_BACKDROP_INSTRUCTION = 'Change only the vertical backdrop'

function schema(mainItem = 'Hainanese chicken rice', backgroundStyle = ''): MinimalSchema {
  return {
    scene_setup: {
      angle: 'top-down',
      framing: 'close-up',
      lighting: 'bright-and-airy',
      spin: '0',
    },
    canvas: {
      background: 'extracted tabletop with no visible vertical wall',
      background_style: backgroundStyle,
      surface_style: '',
      main_vessel: 'white oval platter',
    },
    food_components: {
      main_item: mainItem,
      garnishes: ['spring onion'],
      sides: ['chilli sauce'],
    },
  }
}

function backdropDelta(): StateDelta {
  return {
    scalarChanges: [
      { path: 'canvas.background_style', from: '', to: 'studio-yellow' },
    ],
    arrays: {
      garnishes: { added: [], removed: [] },
      sides: { added: [], removed: [] },
    },
    isEmpty: false,
  }
}

function composeBackdropPayload(
  visibility: BackdropVisibility,
  mainItem = 'Hainanese chicken rice',
): { descriptor: SceneDescriptor; prompt: string } {
  const original = schema(mainItem)
  const target = schema(mainItem, 'studio-yellow')
  const observations = visibility === undefined ? {} : { backdrop_visible: visibility }
  const descriptor = buildSceneDescriptor({
    original,
    target,
    delta: backdropDelta(),
    styles: {
      backdrop: {
        key: 'studio-yellow',
        descriptor: {
          material: 'vibrant, solid yellow studio backdrop',
          colour: '#F2C200',
          falloff: 'soft, professional studio lighting',
        },
        prompt_fragment:
          'Change only the vertical backdrop/wall behind the tabletop to a vibrant, solid yellow studio backdrop.',
      },
    },
    observations,
    labels: ['Image A'],
  })

  const composed = composePrompt({
    // Customer FOH sends a concise directive; the resolved descriptor carries
    // style attributes and must not reintroduce the seeded prompt fragment.
    directive: 'Apply the staged studio-yellow backdrop while preserving the source dish.',
    descriptor,
  })
  if (!composed.ok) throw new Error(composed.error)
  return { descriptor, prompt: composed.prompt }
}

const backdropVisibilityArb = fc.constantFrom<BackdropVisibility>(true, false, undefined)

describe('Studio backdrop visibility defects: Property 9', () => {
  /**
   * Property 9: a known-false backdrop observation must not leave the model
   * with the legacy replacement instruction. This is an exploration test:
   * failure on the unfixed implementation is expected evidence of the bug.
   */
  it('does not compose an unsatisfiable backdrop instruction for any visibility state', () => {
    fc.assert(
      fc.property(backdropVisibilityArb, (visibility) => {
        const payload = composeBackdropPayload(visibility)

        if (visibility === false) {
          // The direct payload seam is not UI-blocked, so the accepted branch
          // here is an explicit establish-backdrop target.
          expect(payload.prompt).not.toContain(FORBIDDEN_BACKDROP_INSTRUCTION)
          expect(payload.descriptor.target.backdrop?.mode).toBe('establish')
          return
        }

        // True and omitted visibility preserve the existing replacement path.
        expect(payload.descriptor.target.backdrop?.mode).toBe('replace')
      }),
      { numRuns: 30 },
    )
  })

  /**
   * Concrete counterexample required by the bugfix plan: studio-yellow staged
   * on the Hainanese chicken rice source while extraction reports no backdrop.
   */
  it('covers studio-yellow on Hainanese chicken rice with backdrop_visible false', () => {
    const payload = composeBackdropPayload(false, 'Hainanese chicken rice')

    expect(payload.prompt).not.toContain(FORBIDDEN_BACKDROP_INSTRUCTION)
    expect(payload.descriptor.target.backdrop).toEqual(
      expect.objectContaining({ mode: 'establish' }),
    )
  })

  /**
   * Requirement 3.17 preservation: omission is unknown, not false. Backdrop
   * tiles remain enabled by the caller and the descriptor keeps replace mode.
   */
  it('preserves replace behavior when backdrop visibility is omitted', () => {
    const payload = composeBackdropPayload(undefined)

    expect(payload.descriptor.target.backdrop?.mode).toBe('replace')
  })
})
