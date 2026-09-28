'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { HERO_DEMO_DISHES } from './dishes'
import {
  applyAdvance,
  cuesForManualStep,
  cuesForStep,
  cuesResumingScenarios,
  entrySnapshot,
  reducedSnapshot,
  RESUME_MS,
  settledSnapshot,
  sliderFromClientX,
  nudgeSlider,
  type DemoCue,
  type HeroDemoSnapshot,
  type HeroStep,
} from './timeline'

const DISH_COUNT = HERO_DEMO_DISHES.length

export function useHeroDemoPlayer() {
  const [snap, setSnap] = useState<HeroDemoSnapshot>(() => entrySnapshot(0, 0))
  const [reduced, setReduced] = useState(false)
  const [barMode, setBarMode] = useState<'auto' | 'full'>('auto')
  const [runSerial, setRunSerial] = useState(0)
  const [scale, setScale] = useState(1)

  const snapRef = useRef(snap)
  const reducedRef = useRef(false)
  const inViewRef = useRef(true)
  const pageVisibleRef = useRef(true)
  const visibleRef = useRef(true)
  const timers = useRef<number[]>([])
  const activeCues = useRef<DemoCue[] | null>(null)
  const dragging = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const beginAutoRef = useRef<(snapshot: HeroDemoSnapshot) => void>(() => {})
  const armRef = useRef<(cues: DemoCue[]) => void>(() => {})

  beginAutoRef.current = (snapshot) => {
    snapRef.current = snapshot
    setSnap(snapshot)
    setBarMode('auto')
    setRunSerial((value) => value + 1)
    armRef.current(cuesForStep(snapshot.step))
  }

  armRef.current = (cues) => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
    activeCues.current = cues
    if (reducedRef.current || !visibleRef.current) return
    for (const cue of cues) {
      const id = window.setTimeout(() => {
        if (cue.patch) {
          const next = { ...snapRef.current, ...cue.patch }
          snapRef.current = next
          setSnap(next)
        }
        if (cue.advance === 'step' || cue.advance === 'dish') {
          beginAutoRef.current(
            applyAdvance(snapRef.current, cue.advance === 'dish' ? 'dish' : 'step', DISH_COUNT),
          )
        } else if (cue.advance === 'step-3') {
          beginAutoRef.current(entrySnapshot(2, snapRef.current.dishIndex))
        } else if (cue.advance === 'scenarios') {
          setBarMode('auto')
          setRunSerial((value) => value + 1)
          armRef.current(cuesResumingScenarios(snapRef.current.scenario))
        }
      }, cue.at)
      timers.current.push(id)
    }
  }

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }

  const syncVisibility = () => {
    const on = inViewRef.current && pageVisibleRef.current
    if (visibleRef.current === on) return
    visibleRef.current = on
    if (!on) {
      clearTimers()
      return
    }
    if (reducedRef.current || dragging.current || !activeCues.current) return
    armRef.current(activeCues.current)
  }

  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    reducedRef.current = reduce
    setReduced(reduce)
    pageVisibleRef.current = document.visibilityState !== 'hidden'
    visibleRef.current = pageVisibleRef.current
    if (reduce) {
      const next = reducedSnapshot(0)
      snapRef.current = next
      setSnap(next)
      setBarMode('full')
      return
    }
    beginAutoRef.current(entrySnapshot(0, 0))
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      timers.current = []
    }
  }, [])

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame || typeof ResizeObserver !== 'function') return
    const measure = () => {
      const width = frame.clientWidth
      setScale(width > 0 ? Math.min(1, width / 560) : 1)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver !== 'function') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = Boolean(entry?.isIntersecting)
        syncVisibility()
      },
      { threshold: 0.05 },
    )
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const onVisibility = () => {
      pageVisibleRef.current = document.visibilityState !== 'hidden'
      syncVisibility()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const jumpToStep = (step: HeroStep) => {
    clearTimers()
    if (reducedRef.current) {
      const next = settledSnapshot(step, snapRef.current.dishIndex, 0)
      snapRef.current = next
      setSnap(next)
      setBarMode('full')
      return
    }
    const next = entrySnapshot(step, snapRef.current.dishIndex)
    snapRef.current = next
    setSnap(next)
    setBarMode('full')
    setRunSerial((value) => value + 1)
    armRef.current(cuesForManualStep(step))
  }

  const selectScenario = (scenario: number) => {
    clearTimers()
    const next = { ...snapRef.current, step: 2 as const, scenario, rowsLit: 4, gen: 'done' as const }
    snapRef.current = next
    setSnap(next)
    setBarMode('full')
    if (reducedRef.current) return
    armRef.current([{ at: RESUME_MS, advance: 'scenarios' }])
  }

  const dragTo = (clientX: number, rect: DOMRect) => {
    dragging.current = true
    clearTimers()
    activeCues.current = null
    const next = {
      ...snapRef.current,
      step: 1 as const,
      sliderPos: sliderFromClientX(clientX, rect.left, rect.width),
      sliderTransition: false,
      rowsLit: 4,
      gen: 'done' as const,
    }
    snapRef.current = next
    setSnap(next)
    setBarMode('full')
  }

  const endDrag = () => {
    if (!dragging.current) return
    dragging.current = false
    if (reducedRef.current) return
    armRef.current([{ at: RESUME_MS, advance: 'step-3' }])
  }

  const nudge = (direction: -1 | 1) => {
    clearTimers()
    const next = {
      ...snapRef.current,
      step: 1 as const,
      sliderPos: nudgeSlider(snapRef.current.sliderPos, direction),
      sliderTransition: false,
      rowsLit: 4,
      gen: 'done' as const,
    }
    snapRef.current = next
    setSnap(next)
    setBarMode('full')
    if (reducedRef.current) return
    armRef.current([{ at: RESUME_MS, advance: 'step-3' }])
  }

  return {
    snap,
    reduced,
    barMode,
    runSerial,
    scale,
    rootRef,
    frameRef,
    jumpToStep,
    selectScenario,
    dragTo,
    endDrag,
    nudge,
  }
}
