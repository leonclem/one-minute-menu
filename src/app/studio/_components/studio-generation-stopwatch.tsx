'use client'

import { useEffect, useState } from 'react'

/** Elapsed time as a two-digit digital clock, `mm:ss`. */
export function formatStopwatch(elapsedMs: number): string {
  const safe = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0
  const totalSeconds = Math.floor(safe / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function stopwatchLabel(elapsedMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const minuteWord = minutes === 1 ? 'minute' : 'minutes'
  const secondWord = seconds === 1 ? 'second' : 'seconds'
  return `${minutes} ${minuteWord} ${seconds} ${secondWord}`
}

/** Segment order: a, b, c, d, e, f, g. */
const SEGMENT_FLAGS: Record<string, readonly boolean[]> = {
  '0': [true, true, true, true, true, true, false],
  '1': [false, true, true, false, false, false, false],
  '2': [true, true, false, true, true, false, true],
  '3': [true, true, true, true, false, false, true],
  '4': [false, true, true, false, false, true, true],
  '5': [true, false, true, true, false, true, true],
  '6': [true, false, true, true, true, true, true],
  '7': [true, true, true, false, false, false, false],
  '8': [true, true, true, true, true, true, true],
  '9': [true, true, true, true, false, true, true],
}

const SEGMENT_SHAPES = [
  { x: 2.2, y: 0.6, width: 7.6, height: 2 },
  { x: 9.2, y: 2.2, width: 2, height: 7.4 },
  { x: 9.2, y: 12.2, width: 2, height: 7.4 },
  { x: 2.2, y: 19.2, width: 7.6, height: 2 },
  { x: 0.6, y: 12.2, width: 2, height: 7.4 },
  { x: 0.6, y: 2.2, width: 2, height: 7.4 },
  { x: 2.2, y: 10, width: 7.6, height: 2 },
] as const

const LIT = '#5fd3da'
const DIM = 'rgba(95, 211, 218, 0.16)'

function Digit({ char }: { char: string }) {
  const flags = SEGMENT_FLAGS[char] ?? SEGMENT_FLAGS['0']
  return (
    <svg viewBox="0 0 12 22" className="h-[1.35rem] w-[0.78rem] overflow-visible" aria-hidden>
      {SEGMENT_SHAPES.map((shape, index) => {
        const on = flags[index] === true
        return (
          <rect
            key={index}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rx={1}
            fill={on ? LIT : DIM}
            style={on ? { filter: 'drop-shadow(0 0 2px #01b3bf)' } : undefined}
          />
        )
      })}
    </svg>
  )
}

function Colon({ on }: { on: boolean }) {
  const fill = on ? LIT : DIM
  return (
    <svg viewBox="0 0 6 22" className="h-[1.35rem] w-2 overflow-visible" aria-hidden>
      <circle
        cx="3"
        cy="7"
        r="1.25"
        fill={fill}
        style={on ? { filter: 'drop-shadow(0 0 2px #01b3bf)' } : undefined}
      />
      <circle
        cx="3"
        cy="15"
        r="1.25"
        fill={fill}
        style={on ? { filter: 'drop-shadow(0 0 2px #01b3bf)' } : undefined}
      />
    </svg>
  )
}

interface StudioGenerationStopwatchProps {
  /** Starts at zero when this becomes true, and hides when it becomes false. */
  active: boolean
  className?: string
}

export function StudioGenerationStopwatch({
  active,
  className = '',
}: StudioGenerationStopwatchProps) {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!active) {
      setElapsedMs(0)
      return
    }
    const startedAt = Date.now()
    setElapsedMs(0)
    const interval = window.setInterval(() => {
      const next = Date.now() - startedAt
      setElapsedMs((current) =>
        Math.floor(next / 1000) === Math.floor(current / 1000) ? current : next
      )
    }, 250)
    return () => window.clearInterval(interval)
  }, [active])

  if (!active) return null

  const formatted = formatStopwatch(elapsedMs)
  const colonOn = Math.floor(elapsedMs / 1000) % 2 === 0

  return (
    <div
      role="timer"
      aria-label={`Generation time ${stopwatchLabel(elapsedMs)}`}
      data-testid="studio-generation-stopwatch"
      className={`pointer-events-none inline-flex items-center gap-0.5 rounded-md border border-[#01b3bf]/40 bg-[#041416]/80 px-2 py-1 shadow-[0_0_14px_rgba(1,179,191,0.35)] ${className}`.trim()}
    >
      <span className="sr-only">{formatted}</span>
      {formatted
        .split('')
        .map((char, index) =>
          char === ':' ? (
            <Colon key={`${char}-${index}`} on={colonOn} />
          ) : (
            <Digit key={`${char}-${index}`} char={char} />
          )
        )}
    </div>
  )
}
