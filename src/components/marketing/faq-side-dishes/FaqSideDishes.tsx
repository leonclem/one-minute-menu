'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

const SIDES = [
  { src: '/marketing/salmon-cutout.png', side: 'left' as const },
  { src: '/marketing/chocolate-cake-cutout.png', side: 'right' as const },
]

/**
 * Decorative dishes that slide in from the edges when the parent section
 * enters view. Wide screens flank the questions. Narrow screens park a
 * smaller pair in the space below the list, clear of the cards.
 */
export function FaqSideDishes() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (motionQuery?.matches) {
      setReduceMotion(true)
      setVisible(true)
      return
    }

    const target = ref.current?.parentElement
    if (!target || typeof IntersectionObserver !== 'function') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { threshold: 0.05, rootMargin: '0px 0px 140px 0px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden="true">
      {SIDES.map((item) => {
        const offscreen = item.side === 'left' ? '-78%' : '78%'
        return (
          <Image
            key={item.src}
            src={item.src}
            alt=""
            width={1024}
            height={1024}
            sizes="(min-width: 1024px) 37rem, 11rem"
            data-side={item.side}
            className="absolute bottom-2 top-auto h-auto w-[min(40vw,11rem)] max-w-none [--dish-y:0%] [--dish-shift:0%] lg:bottom-auto lg:top-[58%] lg:w-[min(41vw,37rem)] lg:[--dish-y:-50%] lg:[--dish-shift:-24%] lg:data-[side=right]:[--dish-shift:24%]"
            style={{
              [item.side]: 0,
              opacity: visible ? 1 : 0,
              transform: `translateY(var(--dish-y)) translateX(${visible || reduceMotion ? 'var(--dish-shift)' : offscreen})`,
              transition: reduceMotion
                ? 'none'
                : `transform 420ms cubic-bezier(0.22, 1, 0.36, 1) ${item.side === 'right' ? '40ms' : '0ms'}, opacity 280ms ease-out`,
            }}
          />
        )
      })}
    </div>
  )
}
