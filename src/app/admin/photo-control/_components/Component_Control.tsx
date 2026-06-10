'use client'

/**
 * Component_Control — Add/remove garnishes and sides
 *
 * Renders one removable entry per garnish and per side, and provides an input
 * to add new entries. Each remove action filters the named string from the
 * target array; each add action appends the new string.
 *
 * Controls are disabled until hydration completes (when `disabled` is true).
 *
 * Requirements: 1.5, 4.4, 4.5, 4.7, 8.1, 8.2, 8.3
 */

import { useState } from 'react'

export interface ComponentControlProps {
  /** Current garnish strings. */
  garnishes: string[]
  /** Current side strings. */
  sides: string[]
  /** Called when the garnishes array changes. */
  onGarnishesChange: (garnishes: string[]) => void
  /** Called when the sides array changes. */
  onSidesChange: (sides: string[]) => void
  /** When true, all controls are disabled (before hydration or during mutation). */
  disabled?: boolean
}

interface ComponentListProps {
  label: string
  items: string[]
  onRemove: (item: string) => void
  onAdd: (item: string) => void
  disabled: boolean
  addPlaceholder: string
  addAriaLabel: string
}

function ComponentList({
  label,
  items,
  onRemove,
  onAdd,
  disabled,
  addPlaceholder,
  addAriaLabel,
}: ComponentListProps) {
  const [inputValue, setInputValue] = useState('')

  const handleAdd = () => {
    const trimmed = inputValue.trim()
    if (trimmed.length === 0) return
    onAdd(trimmed)
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-gray-700">{label}</p>

      {/* Existing items */}
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 italic mb-2">None</p>
      ) : (
        <ul className="mb-2 space-y-1" aria-label={`${label} list`}>
          {items.map((item) => (
            <li
              key={item}
              className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5"
            >
              <span className="text-sm text-gray-800">{item}</span>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                disabled={disabled}
                onClick={() => onRemove(item)}
                className={[
                  'ml-2 text-xs text-red-600 hover:text-red-800 focus:outline-none focus:underline',
                  disabled && 'cursor-not-allowed opacity-50',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add new item */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={addPlaceholder}
          disabled={disabled}
          aria-label={addAriaLabel}
          className={[
            'flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            disabled && 'cursor-not-allowed opacity-50 bg-gray-100',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        <button
          type="button"
          disabled={disabled || inputValue.trim().length === 0}
          onClick={handleAdd}
          aria-label={`Add ${label.toLowerCase()}`}
          className={[
            'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700',
            'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
            (disabled || inputValue.trim().length === 0) && 'cursor-not-allowed opacity-50',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          Add
        </button>
      </div>
    </div>
  )
}

export function Component_Control({
  garnishes,
  sides,
  onGarnishesChange,
  onSidesChange,
  disabled = false,
}: ComponentControlProps) {
  const handleRemoveGarnish = (item: string) => {
    onGarnishesChange(garnishes.filter((g) => g !== item))
  }

  const handleAddGarnish = (item: string) => {
    if (!garnishes.includes(item)) {
      onGarnishesChange([...garnishes, item])
    }
  }

  const handleRemoveSide = (item: string) => {
    onSidesChange(sides.filter((s) => s !== item))
  }

  const handleAddSide = (item: string) => {
    if (!sides.includes(item)) {
      onSidesChange([...sides, item])
    }
  }

  return (
    <div className="space-y-4">
      <ComponentList
        label="Garnishes"
        items={garnishes}
        onRemove={handleRemoveGarnish}
        onAdd={handleAddGarnish}
        disabled={disabled}
        addPlaceholder="e.g. lemon wedge"
        addAriaLabel="New garnish name"
      />
      <ComponentList
        label="Sides"
        items={sides}
        onRemove={handleRemoveSide}
        onAdd={handleAddSide}
        disabled={disabled}
        addPlaceholder="e.g. roasted potatoes"
        addAriaLabel="New side name"
      />
    </div>
  )
}
