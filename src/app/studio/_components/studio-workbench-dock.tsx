'use client'

import { useCallback, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { GripHorizontal } from 'lucide-react'

const DOCK_MARGIN = 12
const NUDGE = 16

export function clampDockPosition({
  left,
  top,
  dockWidth,
  dockHeight,
  boundsWidth,
  boundsHeight,
  margin = DOCK_MARGIN,
}: {
  left: number
  top: number
  dockWidth: number
  dockHeight: number
  boundsWidth: number
  boundsHeight: number
  margin?: number
}): { left: number; top: number } {
  const maxLeft = Math.max(margin, boundsWidth - dockWidth - margin)
  const maxTop = Math.max(margin, boundsHeight - dockHeight - margin)
  return {
    left: Math.min(Math.max(left, margin), maxLeft),
    top: Math.min(Math.max(top, margin), maxTop),
  }
}

function isDockControl(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('button:not([data-dock-handle]), a, input, textarea, select'))
}

interface StudioWorkbenchDockProps {
  children: ReactNode
}

export function StudioWorkbenchDock({ children }: StudioWorkbenchDockProps) {
  const boundsRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origin: { left: number; top: number }
  } | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const readPos = useCallback((): { left: number; top: number } | null => {
    const bounds = boundsRef.current?.getBoundingClientRect()
    const dock = dockRef.current?.getBoundingClientRect()
    if (!bounds || !dock) return null
    return { left: dock.left - bounds.left, top: dock.top - bounds.top }
  }, [])

  const applyPos = useCallback(
    (next: { left: number; top: number }) => {
      const bounds = boundsRef.current?.getBoundingClientRect()
      const dock = dockRef.current?.getBoundingClientRect()
      if (!bounds || !dock) {
        setPos(next)
        return
      }
      setPos(
        clampDockPosition({
          ...next,
          dockWidth: dock.width,
          dockHeight: dock.height,
          boundsWidth: bounds.width,
          boundsHeight: bounds.height,
        }),
      )
    },
    [],
  )

  const beginDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch' && event.button !== 0) return
    if (isDockControl(event.target)) return
    const origin = pos ?? readPos()
    if (!origin) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin,
    }
    if (!pos) setPos(origin)
    setDragging(true)
  }

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const gesture = dragRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    applyPos({
      left: gesture.origin.left + (event.clientX - gesture.startX),
      top: gesture.origin.top + (event.clientY - gesture.startY),
    })
  }

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
  }

  const nudge = (dx: number, dy: number) => {
    const origin = pos ?? readPos()
    if (!origin) return
    applyPos({ left: origin.left + dx, top: origin.top + dy })
  }

  return (
    <div ref={boundsRef} className="pointer-events-none absolute inset-0 z-20" data-testid="studio-workbench-dock-bounds">
      <div
        ref={dockRef}
        data-testid="studio-workbench-dock"
        className={[
          'pointer-events-auto absolute w-max max-w-[min(calc(100%-1.5rem),36rem)] touch-none',
          pos ? 'left-0 top-0' : 'bottom-16 left-1/2 -translate-x-1/2 sm:bottom-[4.5rem]',
          dragging ? 'cursor-grabbing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={pos ? { left: pos.left, top: pos.top, transform: 'none' } : undefined}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <button
          type="button"
          data-dock-handle
          aria-label="Move panel"
          aria-grabbed={dragging}
          title="Drag to move"
          className="mb-1 flex h-6 min-h-0 w-full min-w-0 cursor-grab items-center justify-center rounded-[9px] border border-white/14 bg-[rgba(12,20,22,0.82)] text-white/70 backdrop-blur-md active:cursor-grabbing"
          onKeyDown={(event) => {
            const step = event.shiftKey ? NUDGE * 2 : NUDGE
            if (event.key === 'ArrowLeft') nudge(-step, 0)
            else if (event.key === 'ArrowRight') nudge(step, 0)
            else if (event.key === 'ArrowUp') nudge(0, -step)
            else if (event.key === 'ArrowDown') nudge(0, step)
            else return
            event.preventDefault()
          }}
        >
          <GripHorizontal className="h-4 w-4" aria-hidden strokeWidth={2.25} />
        </button>
        {children}
      </div>
    </div>
  )
}
