'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { cn } from '@/lib/utils'
import type { ImageModeV2 } from '@/lib/templates/v2/engine-types-v2'

interface ImageModeOption {
  value: ImageModeV2
  label: string
  description: string
}

const IMAGE_MODE_OPTIONS: ImageModeOption[] = [
  {
    value: 'none',
    label: 'None',
    description: 'Text only, no images'
  },
  {
    value: 'compact-rect',
    label: 'Compact (rectangular)',
    description: 'Smaller image, preserves aspect ratio'
  },
  {
    value: 'compact-circle',
    label: 'Compact (circular)',
    description: 'Square crop with circular border'
  },
  {
    value: 'stretch',
    label: 'Stretch fit',
    description: 'Image fills tile width (default)'
  },
  {
    value: 'background',
    label: 'Background',
    description: 'Full-tile image with text overlay'
  }
]

interface ImageModeDropdownProps {
  value: ImageModeV2
  onChange: (mode: ImageModeV2) => void
  className?: string
  /** Optional: use neutral/gray styling for admin (Layout Lab) vs primary for template page */
  variant?: 'primary' | 'neutral'
  /** When false, only show labels (no description under each option). Default true. */
  showDescription?: boolean
}

export function ImageModeDropdown({
  value,
  onChange,
  className,
  variant = 'primary',
  showDescription = true
}: ImageModeDropdownProps) {
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const triggerId = useId()

  const selected = IMAGE_MODE_OPTIONS.find(o => o.value === value) ?? IMAGE_MODE_OPTIONS[3] // Default to 'stretch' (index 3 after adding 'none')

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
        setFocusedIndex(i => (i + 1) % IMAGE_MODE_OPTIONS.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex(i => (i - 1 + IMAGE_MODE_OPTIONS.length) % IMAGE_MODE_OPTIONS.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const option = IMAGE_MODE_OPTIONS[focusedIndex]
        if (option) {
          onChange(option.value)
          setOpen(false)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, focusedIndex, onChange])

  // When opening, sync focused index to selected and focus the list for keyboard
  useEffect(() => {
    if (open) {
      const idx = IMAGE_MODE_OPTIONS.findIndex(o => o.value === value)
      setFocusedIndex(idx >= 0 ? idx : 3) // Default to 'stretch' index (3 after adding 'none')
      listRef.current?.focus()
    }
  }, [open, value])

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
        <div className="flex-1">
          <div className={cn(
            'font-medium',
            variant === 'primary' ? 'text-sm text-ux-text' : 'text-sm text-gray-900'
          )}>
            {selected.label}
          </div>
          {showDescription && (
            <div className={cn(
              'text-xs mt-0.5',
              variant === 'primary' ? 'text-ux-text/60' : 'text-gray-500'
            )}>
              {selected.description}
            </div>
          )}
        </div>
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
          aria-activedescendant={IMAGE_MODE_OPTIONS[focusedIndex] ? `option-${IMAGE_MODE_OPTIONS[focusedIndex].value}` : undefined}
          tabIndex={0}
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg border-2 py-1 shadow-lg',
            variant === 'primary'
              ? 'border-neutral-200 bg-white'
              : 'border-gray-200 bg-white'
          )}
        >
          {IMAGE_MODE_OPTIONS.map((option, index) => {
            const isSelected = option.value === value
            const isFocused = index === focusedIndex
            return (
              <li
                key={option.value}
                id={`option-${option.value}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                className={cn(
                  'flex cursor-pointer flex-col px-3 py-2.5 transition-colors',
                  isSelected && selectedOptionClass,
                  isFocused && !isSelected && (variant === 'primary' ? 'bg-neutral-50' : 'bg-gray-50'),
                  variant === 'primary' ? 'text-ux-text' : 'text-gray-900'
                )}
              >
                <span className="font-medium text-sm">{option.label}</span>
                {showDescription && (
                  <span className={cn(
                    'text-xs mt-0.5',
                    variant === 'primary' ? 'text-ux-text/60' : 'text-gray-500'
                  )}>
                    {option.description}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
