import { HERO_DEMO_DISHES } from './dishes'
import {
  applyAdvance,
  clampSlider,
  cuesForManualStep,
  cuesForStep,
  cuesResumingScenarios,
  entrySnapshot,
  nudgeSlider,
  RESUME_MS,
  sliderFromClientX,
  STEP_MS,
} from './timeline'

describe('hero demo timeline', () => {
  it('walks upload, then enhance, then the four publish scenarios', () => {
    expect(cuesForStep(0).map((cue) => cue.at)).toEqual([0, 60, 1700, STEP_MS[0]])
    expect(cuesForStep(1).at(-1)).toEqual({ at: STEP_MS[1], advance: 'step' })
    expect(cuesForStep(2).filter((cue) => cue.patch?.scenario !== undefined).map((cue) => cue.patch?.scenario)).toEqual([
      0, 1, 2, 3,
    ])
    expect(cuesForStep(2).at(-1)?.advance).toBe('dish')
  })

  it('switches dish after publish and keeps the dish when the step advances', () => {
    const upload = entrySnapshot(0, 0)
    const enhance = applyAdvance(upload, 'step', 2)
    expect(enhance).toMatchObject({ step: 1, dishIndex: 0, sliderPos: 86, sliderTransition: false })

    const publish = applyAdvance(enhance, 'step', 2)
    expect(publish.step).toBe(2)

    const nextDish = applyAdvance(publish, 'dish', 2)
    expect(nextDish).toMatchObject({ step: 0, dishIndex: 1, dropped: false })

    const wrapped = applyAdvance(entrySnapshot(0, 1), 'dish', 2)
    expect(wrapped.dishIndex).toBe(0)
  })

  it('resumes publish from the scenario after the one that was chosen', () => {
    expect(cuesResumingScenarios(1).map((cue) => cue.patch?.scenario ?? cue.advance)).toEqual([
      2, 3, 'dish',
    ])
    expect(cuesResumingScenarios(3)).toEqual([{ at: 0, advance: 'dish' }])
  })

  it('holds a clicked step, then continues after the resume delay', () => {
    const cues = cuesForManualStep(1)
    const rowCues = cues.filter((cue) => (cue.patch?.rowsLit ?? 0) > 0)
    const doneAt = cues.find((cue) => cue.patch?.gen === 'done')?.at ?? 0
    const reveal = cues.find((cue) => cue.patch?.sliderPos === 16)
    expect(rowCues.every((cue) => cue.patch?.sliderPos === undefined)).toBe(true)
    expect(reveal && reveal.at > doneAt).toBe(true)
    expect(cues.at(-1)).toEqual({ at: RESUME_MS, advance: 'step' })
    expect(cuesForManualStep(2).filter((cue) => cue.patch?.scenario !== undefined)).toEqual([
      { at: 0, patch: { scenario: 0, step: 2 } },
    ])
  })

  it('clamps the compare slider and steps it by 5%', () => {
    expect(clampSlider(0)).toBe(3)
    expect(clampSlider(100)).toBe(97)
    expect(clampSlider(50)).toBe(50)
    expect(nudgeSlider(96, 1)).toBe(97)
    expect(nudgeSlider(4, -1)).toBe(3)
    expect(sliderFromClientX(25, 0, 100)).toBe(25)
    expect(sliderFromClientX(10, 0, 0)).toBe(50)
  })
})

describe('hero demo dishes', () => {
  it('uses banana bread instead of the cake mock, with Studio option names', () => {
    expect(HERO_DEMO_DISHES.map((dish) => dish.file)).toEqual(['banana-bread.jpg', 'massaman-curry.jpg'])
    expect(HERO_DEMO_DISHES[0].images.slider).toContain('/banana-bread/hot.png')
    expect(HERO_DEMO_DISHES[1].images.og).toContain('/massaman-curry/OG.jpg')

    const labels = HERO_DEMO_DISHES.flatMap((dish) => dish.scene.map((row) => row[1]))
    expect(labels).toEqual(
      expect.arrayContaining(['Soft Natural', 'Dark Stone', 'Overhead', 'Golden Hour', 'Hot Pink', 'Raw Concrete', 'Angled']),
    )
    expect(labels).not.toContain('Warm Studio')
    expect(labels).not.toContain('Dark Slate')
    expect(labels).not.toContain('Three-Quarter')
  })
})
