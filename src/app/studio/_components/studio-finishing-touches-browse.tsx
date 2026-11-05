'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CakeSlice, Droplets, Leaf, Sprout, Utensils, type LucideIcon } from 'lucide-react'

import {
  browseGroupsForFamily,
  type FinishingTouchCatalogueItem,
  type FinishingTouchFamily,
} from '@/lib/studio/finishing-touches'

const GROUP_ICONS: Record<string, LucideIcon> = {
  herbs: Sprout,
  fresh: Leaf,
  pantry: Utensils,
  fruit: CakeSlice,
  finish: Droplets,
  crunch: Leaf,
}

interface StudioFinishingTouchesBrowseProps {
  open: boolean
  disabled: boolean
  atSelectionCap: boolean
  audience: FinishingTouchFamily
  selectedIds: readonly string[]
  onToggle: (id: string) => void
  onClose: () => void
}

export function StudioFinishingTouchesBrowse({
  open,
  disabled,
  atSelectionCap,
  audience,
  selectedIds,
  onToggle,
  onClose,
}: StudioFinishingTouchesBrowseProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const keepScrollInList = (event: WheelEvent) => {
      const scroller = listRef.current
      if (!scroller || !scroller.contains(event.target as Node)) {
        event.preventDefault()
        return
      }
      const atTop = scroller.scrollTop <= 0 && event.deltaY < 0
      const atBottom =
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1 &&
        event.deltaY > 0
      if (atTop || atBottom) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('wheel', keepScrollInList, { passive: false })
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('wheel', keepScrollInList)
    }
  }, [open, onClose])

  if (!open || !mounted) return null

  const groups = browseGroupsForFamily(audience)

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-none bg-black/40 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-garnish-browse-title"
        className="flex h-[min(36rem,calc(100dvh-2rem))] w-full max-w-md flex-col overflow-hidden rounded-[16px] border border-white/10 bg-[#0f1c1f] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
          <h3 id="studio-garnish-browse-title" className="text-base font-bold text-white">
            Garnishes
          </h3>
          <button
            type="button"
            className="text-sm font-semibold text-white/55 hover:text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div
          ref={listRef}
          data-testid="studio-garnish-browse-list"
          className="studio-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4"
        >
          {groups.map((group) => {
            if (group.items.length === 0) return null
            const Icon = GROUP_ICONS[group.id] ?? Leaf
            return (
              <section key={group.id} aria-label={group.label}>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/40">
                  <Icon className="h-3.5 w-3.5 text-[#5fd3da]" aria-hidden="true" />
                  {group.label}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <GarnishChip
                      key={item.id}
                      item={item}
                      selected={selectedIds.includes(item.id)}
                      disabled={disabled || (!selectedIds.includes(item.id) && atSelectionCap)}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function GarnishChip({
  item,
  selected,
  disabled,
  onToggle,
}: {
  item: FinishingTouchCatalogueItem
  selected: boolean
  disabled: boolean
  onToggle: (id: string) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${selected ? 'Remove' : 'Add'} ${item.name}`}
      disabled={disabled}
      onClick={() => onToggle(item.id)}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#01b3bf]/40',
        selected
          ? 'border-[#01b3bf] bg-[#01b3bf]/15 text-white ring-1 ring-[#01b3bf]'
          : 'border-white/[0.16] bg-white/[0.04] text-white/80 hover:border-[#01b3bf]/50',
        disabled && 'cursor-not-allowed opacity-50',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden="true" className="text-base font-bold leading-none text-[#5fd3da]">
        {selected ? '✓' : '+'}
      </span>
      <span>{item.name}</span>
    </button>
  )
}
