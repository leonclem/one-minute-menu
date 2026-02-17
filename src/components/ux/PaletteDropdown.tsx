'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { cn } from '@/lib/utils'
import type { ColorPaletteV2 } from '@/lib/templates/v2/renderer-v2'

/**
 * Returns [background, middle, accent] colours for palette swatch display.
 * For Lunar Red & Gold the middle circle is red (border.medium); for others use itemTitle.
 */
export function getPaletteSwatchColors(palette: ColorPaletteV2): [string, string, string] {
  if (palette.id === 'lunar-red-gold') {
    return [
      palette.colors.background,
      palette.colors.border.medium,
      palette.colors.itemPrice
    ]
  }
  return [
    palette.colors.background,
    palette.colors.itemTitle,
    palette.colors.itemPrice
  ]
}

interface PaletteDropdownProps {
  palettes: ColorPaletteV2[]
  value: string
  onChange: (paletteId: string) => void
  className?: string
  /** Optional: use neutral/gray styling for admin (Layout Lab) vs primary for template page */
  variant?: 'primary' | 'neutral'
}

export function PaletteDropdown({
  palettes,
  value,
  onChange,
  className,
  variant = 'primary'
}: PaletteDropdownProps) {
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const triggerId = useId()

  const selected = palettes.find(p => p.id === value) ?? palettes[0]
  const selectedColors = getPaletteSwatchColors(selected)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Keyboard: Escape close, Arrow keys, Enter select
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex(i => (i + 1) % palettes.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex(i => (i - 1 + palettes.length) % palettes.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const p = palettes[focusedIndex]
        if (p) {
          onChange(p.id)
          setOpen(false)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, palettes, focusedIndex, onChange])

  // When opening, sync focused index to selected and focus the list for keyboard
  useEffect(() => {
    if (open) {
      const idx = palettes.findIndex(p => p.id === value)
      setFocusedIndex(idx >= 0 ? idx : 0)
      listRef.current?.focus()
    }
  }, [open, value, palettes])

  const borderClass = variant === 'primary'
    ? 'border-neutral-200 hover:border-neutral-300 focus-within:border-ux-primary focus-within:ring-2 focus-within:ring-ux-primary/20'
    : 'border-gray-200 hover:border-gray-300 focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-gray-200'
  const selectedOptionClass = variant === 'primary'
    ? 'bg-ux-primary/5 border-ux-primary'
    : 'bg-gray-100 border-gray-400'

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        id={triggerId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${triggerId} ${listId}`}
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border-2 bg-white px-3 py-2.5 text-left transition-all',
          borderClass
        )}
      >
        <div className="flex -space-x-1.5 shrink-0" aria-hidden>
          {selectedColors.map((color, i) => (
            <div
              key={i}
              className="h-5 w-5 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span className={cn(
          'min-w-0 flex-1 font-medium',
          variant === 'primary' ? 'text-sm text-ux-text' : 'text-sm text-gray-900'
        )}>
          {selected.name}
        </span>
        <svg
          className={cn('h-5 w-5 shrink-0 transition-transform', open && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-activedescendant={palettes[focusedIndex] ? `option-${palettes[focusedIndex].id}` : undefined}
          tabIndex={0}
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg border-2 py-1 shadow-lg',
            variant === 'primary'
              ? 'border-neutral-200 bg-white'
              : 'border-gray-200 bg-white'
          )}
        >
          {palettes.map((p, index) => {
            const colors = getPaletteSwatchColors(p)
            const isSelected = p.id === value
            const isFocused = index === focusedIndex
            return (
              <li
                key={p.id}
                id={`option-${p.id}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => {
                  onChange(p.id)
                  setOpen(false)
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors',
                  isSelected && selectedOptionClass,
                  isFocused && !isSelected && (variant === 'primary' ? 'bg-neutral-50' : 'bg-gray-50'),
                  variant === 'primary' ? 'text-ux-text' : 'text-gray-900'
                )}
              >
                <div className="flex -space-x-1.5 shrink-0" aria-hidden>
                  {colors.map((color, i) => (
                    <div
                      key={i}
                      className="h-5 w-5 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="min-w-0 flex-1 font-medium text-sm">{p.name}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
