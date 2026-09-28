'use client'

import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { HERO_DEMO_DISHES } from './dishes'
import { DishPhoto } from './DishPhoto'
import { SLIDER_MAX, SLIDER_MIN, type GenState } from './timeline'
import styles from './hero-demo.module.css'

function CompareArrow({ flip }: { flip?: boolean }) {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        fill="none"
        stroke="#ffd23f"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const GEN_LABEL: Record<GenState, string> = {
  idle: 'Generate · 1 credit',
  generating: 'Generating…',
  done: 'Done ✓',
}

export function EnhanceLayer({
  dishIndex,
  sliderPos,
  sliderTransition,
  rowsLit,
  gen,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
}: {
  dishIndex: number
  sliderPos: number
  sliderTransition: boolean
  rowsLit: number
  gen: GenState
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
}) {
  const dish = HERO_DEMO_DISHES[dishIndex] ?? HERO_DEMO_DISHES[0]
  const slide = sliderTransition ? styles.sliding : ''

  return (
    <div className={styles.enhance}>
      <div
        className={styles.slider}
        role="slider"
        tabIndex={0}
        aria-valuemin={SLIDER_MIN}
        aria-valuemax={SLIDER_MAX}
        aria-valuenow={Math.round(sliderPos)}
        aria-label="Compare original and enhanced photo"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <DishPhoto slot="slider" dishIndex={dishIndex} alt="" sizes="300px" />
        <div
          className={`${styles.clip} ${slide}`}
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <DishPhoto slot="og" dishIndex={dishIndex} alt={`Original photo of ${dish.dish}`} sizes="300px" />
        </div>
        <span className={styles.tag + ' ' + styles.tagBefore}>Your photo</span>
        <span className={styles.tag + ' ' + styles.tagAfter}>GridMenu</span>
        <div className={`${styles.divider} ${slide}`} style={{ left: `${sliderPos}%` }} />
        <div className={`${styles.handle} ${slide}`} style={{ left: `${sliderPos}%` }}>
          <CompareArrow flip />
          <CompareArrow />
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelTabs}>
          <span className={styles.panelTabOn}>Scene</span>
          <span className={styles.panelTabOff}>Exports</span>
        </div>
        <div className={styles.sceneRows}>
          {dish.scene.map(([label, value], index) => (
            <div
              key={label}
              className={`${styles.row} ${index === dish.scene.length - 1 ? styles.rowLast : ''} ${
                index < rowsLit ? styles.rowOn : ''
              }`}
              style={{ opacity: index < rowsLit ? 1 : 0.3 }}
            >
              <div className={styles.rowLabel}>{label}</div>
              <div className={styles.rowValue}>{value}</div>
            </div>
          ))}
        </div>
        <div className={`${styles.generate} ${gen === 'idle' ? '' : styles.generateHot}`} aria-hidden="true">
          {GEN_LABEL[gen]}
        </div>
      </div>
    </div>
  )
}
