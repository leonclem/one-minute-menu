import { HERO_DEMO_DISHES } from './dishes'
import {
  applyAdvance,
  clampSlider,
  cuesForManualStep,
  cuesForStep,
  entrySnapshot,
  nudgeSlider,
  RESUME_MS,
  sliderFromClientX,
  STEP_MS,
} from './timeline'

describe('hero demo timeline', () => {
  it('walks upload, then enhance, then one publish placement', () => {
    expect(cuesForStep(0).map((cue) => cue.at)).toEqual([0, 60, 1700, STEP_MS[0]])
    expect(cuesForStep(1).at(-1)).toEqual({ at: STEP_MS[1], advance: 'step' })
    expect(cuesForStep(2)).toEqual([
      { at: 0, patch: { step: 2 } },
      { at: STEP_MS[2], advance: 'dish' },
    ])
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

  it('holds a clicked step, then continues after the resume delay', () => {
    const cues = cuesForManualStep(1)
    const rowCues = cues.filter((cue) => (cue.patch?.rowsLit ?? 0) > 0)
    const doneAt = cues.find((cue) => cue.patch?.gen === 'done')?.at ?? 0
    const reveal = cues.find((cue) => cue.patch?.sliderPos === 16)
    expect(rowCues.every((cue) => cue.patch?.sliderPos === undefined)).toBe(true)
    expect(reveal && reveal.at > doneAt).toBe(true)
    expect(cues.at(-1)).toEqual({ at: RESUME_MS, advance: 'step' })
    expect(cuesForManualStep(2)[0]).toEqual({ at: 0, patch: { step: 2 } })
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
  it('uses the five homepage dishes, with Studio option names', () => {
    expect(HERO_DEMO_DISHES.map((dish) => dish.file)).toEqual([
      'acai-bowl.png',
      'pastrami-sandwich.jpg',
      'chicken-thighs.jpg',
      'pizza.jpg',
      'chocolate-tart.webp',
    ])
    expect(HERO_DEMO_DISHES[0].images.og).toBe('/marketing/hero-compare/acai/acai-bowl-OG.png')
    expect(HERO_DEMO_DISHES[0].images.slider).toBe('/marketing/hero-compare/acai/acai-bowl-enhanced.jpg')
    expect(HERO_DEMO_DISHES[0].settingSrc).toBe('/marketing/hero-compare/acai/acai-delivery-app.png')
    expect(HERO_DEMO_DISHES[1].images.og).toBe('/marketing/hero-compare/pastrami-sandwich/pastrami-sandwich-OG.jpg')
    expect(HERO_DEMO_DISHES[1].images.slider).toBe(
      '/marketing/hero-compare/pastrami-sandwich/pastrami-sandwich-enhanced.jpg',
    )
    expect(HERO_DEMO_DISHES[1].settingSrc).toBe(
      '/marketing/hero-compare/pastrami-sandwich/pastrami-sandwich-screen-menu.png',
    )
    expect(HERO_DEMO_DISHES[2].images.slider).toBe(
      '/marketing/hero-compare/chicken-thighs/chicken-thighs-enhanced.jpg',
    )
    expect(HERO_DEMO_DISHES[2].settingSrc).toBe(
      '/marketing/hero-compare/chicken-thighs/chicken-thighs-social-media.png',
    )
    expect(HERO_DEMO_DISHES[3].images.slider).toBe('/marketing/hero-compare/pizza/pizz-enhanced.jpg')
    expect(HERO_DEMO_DISHES[3].settingSrc).toBe('/marketing/hero-compare/pizza/pizza-website.png')
    expect(HERO_DEMO_DISHES[4].images.og).toBe(
      '/marketing/hero-compare/chocolate tart/chocolate-tart-OG.webp',
    )
    expect(HERO_DEMO_DISHES[4].settingSrc).toBe(
      '/marketing/hero-compare/chocolate tart/chocolate-tart-magazine.png',
    )

    const labels = HERO_DEMO_DISHES.flatMap((dish) => dish.scene.map((row) => row[1]))
    expect(labels).toEqual(
      expect.arrayContaining([
        'Raw Concrete',
        'Bright & Clean',
        'Square white plate',
        'Terracotta',
        'Dark & Moody',
        'Natural Linen',
        'Wooden board',
        'White Marble',
        'Slate',
        'Sage Green',
        'Soft Natural',
      ]),
    )
    expect(labels).not.toContain('Hot Pink')
    expect(labels).not.toContain('Golden Hour')
  })
})
