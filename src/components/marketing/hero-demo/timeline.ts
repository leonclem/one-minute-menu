export const STEP_MS = [2600, 5200, 8800] as const
export const SCENARIO_MS = 2200
export const RESUME_MS = 7000
export const SLIDER_MIN = 3
export const SLIDER_MAX = 97

export type HeroStep = 0 | 1 | 2
export type GenState = 'idle' | 'generating' | 'done'
export type DemoAdvance = 'step' | 'dish' | 'step-3' | 'scenarios'

export type HeroDemoSnapshot = {
  dishIndex: number
  step: HeroStep
  scenario: number
  dropped: boolean
  uploaded: boolean
  sliderPos: number
  sliderTransition: boolean
  rowsLit: number
  gen: GenState
}

export type DemoPatch = Partial<HeroDemoSnapshot>

export type DemoCue = {
  at: number
  patch?: DemoPatch
  advance?: DemoAdvance
}

export function entrySnapshot(step: HeroStep, dishIndex: number): HeroDemoSnapshot {
  return {
    dishIndex,
    step,
    scenario: 0,
    dropped: step !== 0,
    uploaded: step !== 0,
    sliderPos: step === 1 ? 86 : 50,
    sliderTransition: false,
    rowsLit: step === 2 ? 4 : 0,
    gen: step === 2 ? 'done' : 'idle',
  }
}

/** Reduced motion lands on the compare, already settled, with no autoplay. */
export function reducedSnapshot(dishIndex = 0): HeroDemoSnapshot {
  return {
    dishIndex,
    step: 1,
    scenario: 0,
    dropped: true,
    uploaded: true,
    sliderPos: 50,
    sliderTransition: false,
    rowsLit: 4,
    gen: 'done',
  }
}

export function settledSnapshot(step: HeroStep, dishIndex: number, scenario = 0): HeroDemoSnapshot {
  return {
    dishIndex,
    step,
    scenario,
    dropped: true,
    uploaded: true,
    sliderPos: 50,
    sliderTransition: false,
    rowsLit: 4,
    gen: step === 0 ? 'idle' : 'done',
  }
}

export function cuesForStep(step: HeroStep): DemoCue[] {
  if (step === 0) {
    return [
      { at: 0, patch: { dropped: false, uploaded: false, step: 0 } },
      { at: 60, patch: { dropped: true } },
      { at: 1700, patch: { uploaded: true } },
      { at: STEP_MS[0], advance: 'step' },
    ]
  }
  if (step === 1) {
    return [
      {
        at: 0,
        patch: { sliderPos: 86, sliderTransition: false, rowsLit: 0, gen: 'idle', step: 1 },
      },
      { at: 300, patch: { rowsLit: 1 } },
      { at: 650, patch: { rowsLit: 2 } },
      { at: 1000, patch: { rowsLit: 3 } },
      { at: 1350, patch: { rowsLit: 4 } },
      { at: 1750, patch: { gen: 'generating' } },
      { at: 2300, patch: { gen: 'done' } },
      { at: 2520, patch: { sliderTransition: true } },
      { at: 2680, patch: { sliderPos: 16 } },
      { at: STEP_MS[1], advance: 'step' },
    ]
  }
  return [
    { at: 0, patch: { scenario: 0, step: 2 } },
    { at: SCENARIO_MS, patch: { scenario: 1 } },
    { at: SCENARIO_MS * 2, patch: { scenario: 2 } },
    { at: SCENARIO_MS * 3, patch: { scenario: 3 } },
    { at: STEP_MS[2], advance: 'dish' },
  ]
}

/** Play the step's entrance, then move on after the manual-resume idle time. */
export function cuesForManualStep(step: HeroStep): DemoCue[] {
  const visual = cuesForStep(step).filter((cue) => !cue.advance && (step !== 2 || cue.at === 0))
  return [...visual, { at: RESUME_MS, advance: 'step' }]
}

/** After a format chip, continue publish from the following scenario. */
export function cuesResumingScenarios(current: number): DemoCue[] {
  const next = (current + 1) % 4
  if (next === 0) return [{ at: 0, advance: 'dish' }]

  const cues: DemoCue[] = [{ at: 0, patch: { scenario: next, step: 2 } }]
  let at = SCENARIO_MS
  for (let scenario = next + 1; scenario < 4; scenario += 1) {
    cues.push({ at, patch: { scenario } })
    at += SCENARIO_MS
  }
  cues.push({ at, advance: 'dish' })
  return cues
}

export function applyAdvance(
  snapshot: HeroDemoSnapshot,
  kind: 'step' | 'dish',
  dishCount: number,
): HeroDemoSnapshot {
  const nextStep = ((snapshot.step + 1) % 3) as HeroStep
  if (kind === 'dish' || nextStep === 0) {
    return entrySnapshot(0, (snapshot.dishIndex + 1) % dishCount)
  }
  return entrySnapshot(nextStep, snapshot.dishIndex)
}

export function clampSlider(value: number): number {
  return Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, value))
}

export function sliderFromClientX(clientX: number, left: number, width: number): number {
  if (width <= 0) return 50
  return clampSlider(((clientX - left) / width) * 100)
}

export function nudgeSlider(pos: number, direction: -1 | 1): number {
  return clampSlider(pos + direction * 5)
}

export function layerPlace(active: number, index: number): 'active' | 'past' | 'future' {
  if (index === active) return 'active'
  if (index < active) return 'past'
  return 'future'
}
