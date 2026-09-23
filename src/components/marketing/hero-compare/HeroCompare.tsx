'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { HERO_COMPARE_START, nextHeroCompareCursor, type HeroCompareCursor } from './cycle'
import { HERO_COMPARE_DISHES, type HeroCompareFit } from './dishes'

const INTRO_MS = [700, 1600, 2500, 3300] as const
const AUTOPLAY_MS = 3400
const POSITION_MIN = 8
const POSITION_MAX = 92

function clampPosition(value: number) {
  return Math.min(POSITION_MAX, Math.max(POSITION_MIN, value))
}

function photoClass(fit: HeroCompareFit) {
  return fit === 'contain'
    ? 'object-contain object-center'
    : 'object-cover object-center'
}

type HeroCompareProps = {
  /** Homepage size, or a slightly smaller frame for embedding in an article. */
  size?: 'default' | 'compact'
  /** `onDark` matches the homepage. `onLight` is for a white article card. */
  tone?: 'onDark' | 'onLight'
}

export default function HeroCompare({ size = 'default', tone = 'onDark' }: HeroCompareProps = {}) {
  const [cursor, setCursor] = useState<HeroCompareCursor>(HERO_COMPARE_START)
  const [position, setPosition] = useState(50)
  const [motionAllowed, setMotionAllowed] = useState(false)
  const [introCancelled, setIntroCancelled] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dragging, setDragging] = useState(false)

  const dish = HERO_COMPARE_DISHES[cursor.dishIndex] ?? HERO_COMPARE_DISHES[0]
  const variant = dish.variants[cursor.variantIndex] ?? dish.variants[0]
  const paused = hovered || focused || dragging
  const slide = dragging ? 'none' : 'clip-path 700ms ease-in-out'

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    setMotionAllowed(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    if (!motionAllowed) return
    if (introCancelled) {
      setIntroDone(true)
      return
    }

    const timers = [
      window.setTimeout(() => setPosition(70), INTRO_MS[0]),
      window.setTimeout(() => setPosition(30), INTRO_MS[1]),
      window.setTimeout(() => setPosition(50), INTRO_MS[2]),
      window.setTimeout(() => setIntroDone(true), INTRO_MS[3]),
    ]
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [motionAllowed, introCancelled])

  useEffect(() => {
    if (!motionAllowed || !introDone || paused) return
    const timer = window.setInterval(() => {
      setCursor((current) => nextHeroCompareCursor(HERO_COMPARE_DISHES, current))
    }, AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [motionAllowed, introDone, paused])

  const selectDish = (dishIndex: number) => {
    setIntroCancelled(true)
    setCursor({ dishIndex, variantIndex: 0, phase: 'stepping' })
  }

  const selectVariant = (variantIndex: number) => {
    setIntroCancelled(true)
    setCursor((current) => ({ ...current, variantIndex, phase: 'stepping' }))
  }

  const positionFromClientX = (clientX: number, frame: HTMLDivElement) => {
    const rect = frame.getBoundingClientRect()
    if (rect.width <= 0) return 50
    return clampPosition(((clientX - rect.left) / rect.width) * 100)
  }

  return (
    <div
      className={size === 'compact' ? 'w-full max-w-[22rem]' : 'w-full max-w-[26rem]'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <div className="mb-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Dishes">
        {HERO_COMPARE_DISHES.map((item, index) => {
          const selected = index === cursor.dishIndex
          return (
            <button
              key={item.name}
              type="button"
              aria-pressed={selected}
              onClick={() => selectDish(index)}
              className={
                selected
                  ? 'rounded-full bg-[#01b3bf] px-3.5 py-1.5 text-sm font-semibold text-[#03272a]'
                  : tone === 'onLight'
                    ? 'rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200'
                    : 'rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white/80 hover:bg-white/15'
              }
            >
              {item.name}
            </button>
          )
        })}
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label={`Compare your photo of ${dish.name} with ${variant.label}`}
        aria-valuemin={POSITION_MIN}
        aria-valuemax={POSITION_MAX}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${Math.round(position)} percent your photo, ${Math.round(100 - position)} percent ${variant.label}`}
        className="relative aspect-square touch-none select-none overflow-hidden rounded-2xl bg-[#141210] shadow-2xl"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          setDragging(true)
          setIntroCancelled(true)
          setPosition(positionFromClientX(event.clientX, event.currentTarget))
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
          setPosition(positionFromClientX(event.clientX, event.currentTarget))
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 15 : 5
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            setIntroCancelled(true)
            setPosition((current) => clampPosition(current - step))
          } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            setIntroCancelled(true)
            setPosition((current) => clampPosition(current + step))
          }
        }}
      >
        <CompareStill
          src={variant.src}
          fit={dish.fit}
          priority={cursor.dishIndex === 0 && cursor.variantIndex === 0}
        />
        <CompareStill
          src={dish.originalSrc}
          fit={dish.fit}
          priority={cursor.dishIndex === 0}
          clipRight={100 - position}
          transition={slide}
        />

        <span className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
          Your photo
        </span>
        <span className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-full bg-[#01b3bf] px-2.5 py-1 text-xs font-semibold text-[#03272a]">
          {variant.label}
        </span>
        <span className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white">
          Drag to compare
        </span>

        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-[#f5d90a]"
          style={{ left: `${position}%`, transition: dragging ? 'none' : 'left 700ms ease-in-out' }}
        >
          <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#f5d90a] bg-black text-white">
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-3" role="group" aria-label={`${dish.name} variants`}>
        {dish.variants.map((item, index) => {
          const selected = index === cursor.variantIndex
          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={selected}
              onClick={() => selectVariant(index)}
              className={
                size === 'compact'
                  ? 'flex w-14 flex-col items-center gap-1.5'
                  : 'flex w-16 flex-col items-center gap-1.5'
              }
            >
              <span
                className={
                  selected
                    ? `relative block overflow-hidden rounded-xl ring-2 ring-[#f5d90a] ${size === 'compact' ? 'h-12 w-12' : 'h-14 w-14'}`
                    : `relative block overflow-hidden rounded-xl opacity-80 ${size === 'compact' ? 'h-12 w-12' : 'h-14 w-14'} ${tone === 'onLight' ? 'ring-1 ring-gray-300' : 'ring-1 ring-white/15'}`
                }
              >
                <Image
                  src={item.src}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover object-center"
                />
              </span>
              <span
                className={
                  selected
                    ? tone === 'onLight'
                      ? 'text-xs font-semibold text-gray-900'
                      : 'text-xs font-semibold text-white'
                    : tone === 'onLight'
                      ? 'text-xs text-gray-500'
                      : 'text-xs text-white/70'
                }
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CompareStill({
  src,
  fit,
  priority = false,
  clipRight,
  transition,
}: {
  src: string
  fit: HeroCompareFit
  priority?: boolean
  clipRight?: number
  transition?: string
}) {
  return (
    <div
      className="absolute inset-0"
      style={
        clipRight === undefined
          ? undefined
          : { clipPath: `inset(0 ${clipRight}% 0 0)`, transition }
      }
    >
      {fit === 'contain' ? (
        <Image
          key={`${src}-fill`}
          src={src}
          alt=""
          fill
          sizes="(min-width: 1024px) 416px, 90vw"
          className="scale-110 object-cover object-center blur-2xl"
        />
      ) : null}
      <Image
        key={src}
        src={src}
        alt=""
        fill
        priority={priority}
        sizes="(min-width: 1024px) 416px, 90vw"
        draggable={false}
        className={photoClass(fit)}
      />
    </div>
  )
}
