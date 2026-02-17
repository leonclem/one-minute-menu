'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { cn } from '@/lib/utils'

export interface TemplateOption {
  id: string
  name: string
  description: string
}

interface TemplateDropdownProps {
  templates: TemplateOption[]
  value: string
  onChange: (templateId: string) => void
  onSelectTemplate?: (templateId: string) => void
  className?: string
  variant?: 'primary' | 'neutral'
}

export function TemplateDropdown({
  templates,
  value,
  onChange,
  onSelectTemplate,
  className,
  variant = 'primary'
}: TemplateDropdownProps) {
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const triggerId = useId()

  const selected = templates.find(t => t.id === value) ?? templates[0]

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

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex(i => (i + 1) % templates.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex(i => (i - 1 + templates.length) % templates.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const t = templates[focusedIndex]
        if (t) {
          onChange(t.id)
          onSelectTemplate?.(t.id)
          setOpen(false)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, templates, focusedIndex, onChange, onSelectTemplate])

  useEffect(() => {
    if (open) {
      const idx = templates.findIndex(t => t.id === value)
      setFocusedIndex(idx >= 0 ? idx : 0)
      listRef.current?.focus()
    }
  }, [open, value, templates])

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
          'flex w-full flex-col items-start gap-0.5 rounded-lg border-2 bg-white px-3 py-2.5 text-left transition-all',
          borderClass
        )}
      >
        <span className={cn(
          'font-bold',
          variant === 'primary' ? 'text-ux-text' : 'text-gray-900'
        )}>
          {selected.name}
        </span>
        <span className={cn(
          'text-xs',
          variant === 'primary' ? 'text-ux-text-secondary' : 'text-gray-500'
        )}>
          {selected.description}
        </span>
        <svg
          className={cn('absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 shrink-0 transition-transform', open && 'rotate-180')}
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
          aria-activedescendant={templates[focusedIndex] ? `option-${templates[focusedIndex].id}` : undefined}
          tabIndex={0}
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg border-2 py-1 shadow-lg',
            variant === 'primary'
              ? 'border-neutral-200 bg-white'
              : 'border-gray-200 bg-white'
          )}
        >
          {templates.map((t, index) => {
            const isSelected = t.id === value
            const isFocused = index === focusedIndex
            return (
              <li
                key={t.id}
                id={`option-${t.id}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => {
                  onChange(t.id)
                  onSelectTemplate?.(t.id)
                  setOpen(false)
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                className={cn(
                  'flex cursor-pointer flex-col gap-0.5 px-3 py-2.5 transition-colors',
                  isSelected && selectedOptionClass,
                  isFocused && !isSelected && (variant === 'primary' ? 'bg-neutral-50' : 'bg-gray-50'),
                  variant === 'primary' ? 'text-ux-text' : 'text-gray-900'
                )}
              >
                <span className="font-bold text-sm">{t.name}</span>
                <span className={cn(
                  'text-xs',
                  variant === 'primary' ? 'text-ux-text-secondary' : 'text-gray-500'
                )}>
                  {t.description}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
