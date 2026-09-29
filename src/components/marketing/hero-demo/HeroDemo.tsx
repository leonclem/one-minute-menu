'use client'

import type { PointerEvent as ReactPointerEvent } from 'react'
import { HERO_DEMO_SCENARIOS } from './dishes'
import { EnhanceLayer } from './EnhanceLayer'
import styles from './hero-demo.module.css'
import { PublishLayer } from './PublishLayer'
import { layerPlace, STEP_MS, type HeroStep } from './timeline'
import { UploadLayer } from './UploadLayer'
import { useHeroDemoPlayer } from './useHeroDemoPlayer'

const STEP_LABELS = ['Upload', 'Enhance', 'Publish anywhere'] as const
const CAPTIONS = [
  'Start with a real photo of your dish: sharp and well lit.',
  'Pick lighting, surface and angle. No prompts, no guesswork.',
] as const

export default function HeroDemo() {
  const player = useHeroDemoPlayer()
  const { snap, reduced, barMode, runSerial, scale } = player

  const onSliderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    player.dragTo(event.clientX, event.currentTarget.getBoundingClientRect())
  }

  const onSliderPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const captured = event.currentTarget.hasPointerCapture?.(event.pointerId) === true
    if (!captured && event.buttons === 0) return
    player.dragTo(event.clientX, event.currentTarget.getBoundingClientRect())
  }

  const onSliderKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      player.nudge(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      player.nudge(1)
    }
  }

  return (
    <div ref={player.rootRef} className={styles.demo} data-motion={reduced ? 'reduce' : 'ok'}>
      <div className={styles.tabs} role="tablist" aria-label="Demo steps">
        {STEP_LABELS.map((label, index) => {
          const step = index as HeroStep
          const active = snap.step === step
          const done = index < snap.step || (active && barMode === 'full')
          const upcoming = index > snap.step
          return (
            <button
              key={label}
              type="button"
              role="tab"
              id={`hero-demo-step-${step}`}
              aria-selected={active}
              aria-controls="hero-demo-stage"
              className={styles.tab}
              onClick={() => player.jumpToStep(step)}
            >
              <span
                key={active ? `${step}-${runSerial}` : label}
                className={`${styles.labelRow} ${active ? styles.labelOn : ''} ${
                  active && !reduced ? styles.bounce : ''
                }`}
              >
                <span className={`${styles.disc} ${upcoming ? styles.discOff : styles.discOn}`}>{index + 1}</span>
                {label}
              </span>
              <span className={styles.track}>
                <span
                  key={active && barMode === 'auto' ? `fill-${runSerial}` : `fill-${step}`}
                  className={`${styles.fill} ${
                    active && barMode === 'auto' ? styles.fillAuto : done ? styles.fillDone : ''
                  }`}
                  style={active && barMode === 'auto' ? { animationDuration: `${STEP_MS[step]}ms` } : undefined}
                />
              </span>
            </button>
          )
        })}
      </div>

      <div ref={player.frameRef} className={styles.stage} style={{ height: 420 * scale }}>
        <div
          id="hero-demo-stage"
          role="tabpanel"
          aria-labelledby={`hero-demo-step-${snap.step}`}
          className={styles.canvas}
          style={{ transform: `scale(${scale})` }}
        >
          <div className={styles.layer} data-place={layerPlace(snap.step, 0)} aria-hidden={snap.step !== 0}>
            <UploadLayer dishIndex={snap.dishIndex} dropped={snap.dropped} uploaded={snap.uploaded} />
          </div>
          <div className={styles.layer} data-place={layerPlace(snap.step, 1)} aria-hidden={snap.step !== 1}>
            <EnhanceLayer
              dishIndex={snap.dishIndex}
              sliderPos={snap.sliderPos}
              sliderTransition={snap.sliderTransition && !reduced}
              rowsLit={snap.rowsLit}
              gen={snap.gen}
              onPointerDown={onSliderPointerDown}
              onPointerMove={onSliderPointerMove}
              onPointerUp={() => player.endDrag()}
              onKeyDown={onSliderKeyDown}
            />
          </div>
          <div className={styles.layer} data-place={layerPlace(snap.step, 2)} aria-hidden={snap.step !== 2}>
            <PublishLayer dishIndex={snap.dishIndex} scenario={snap.scenario} />
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        {snap.step === 0 || snap.step === 1 ? (
          <p className={styles.caption}>{CAPTIONS[snap.step]}</p>
        ) : (
          <div className={styles.chips}>
            {HERO_DEMO_SCENARIOS.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={`${styles.chip} ${snap.scenario === index ? styles.chipOn : ''}`}
                aria-pressed={snap.scenario === index}
                onClick={() => player.selectScenario(index)}
              >
                {item.label}
                <span className={styles.fmt}>{item.fmt}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
