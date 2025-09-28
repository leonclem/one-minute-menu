'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  children: React.ReactNode
}

export default function PullToRefresh({ children }: Props) {
  const startY = useRef<number | null>(null)
  const [pulled, setPulled] = useState(0)
  const threshold = 70

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) return
      startY.current = e.touches[0].clientY
      setPulled(0)
    }
    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return
      const delta = e.touches[0].clientY - startY.current
      if (delta > 0) {
        e.preventDefault()
        setPulled(Math.min(delta, 120))
      }
    }
    async function onTouchEnd() {
      if (pulled >= threshold) {
        location.reload()
      }
      startY.current = null
      setPulled(0)
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart as any)
      window.removeEventListener('touchmove', onTouchMove as any)
      window.removeEventListener('touchend', onTouchEnd as any)
    }
  }, [pulled])

  return (
    <div style={{ transform: `translateY(${pulled}px)`, transition: pulled === 0 ? 'transform 200ms ease-out' : 'none' }}>
      {pulled > 0 && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex h-12 items-center justify-center text-xs text-gray-500">
          {pulled >= threshold ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}
      {children}
    </div>
  )
}


