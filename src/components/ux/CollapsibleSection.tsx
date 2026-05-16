'use client'

import { useState, KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  title: string
  defaultExpanded?: boolean
  children: React.ReactNode
  className?: string
  isExpanded?: boolean
  onExpand?: (expanded: boolean) => void
  /** Optional badge shown next to the title — use for warnings or status indicators */
  badge?: React.ReactNode
  /** Optional icon shown before the title */
  icon?: React.ReactNode
}

export function CollapsibleSection({
  title,
  defaultExpanded = true,
  children,
  className,
  isExpanded: controlledExpanded,
  onExpand,
  badge,
  icon,
}: CollapsibleSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded

  const toggle = () => {
    if (controlledExpanded !== undefined) {
      onExpand?.(!isExpanded)
    } else {
      setInternalExpanded((prev) => !prev)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
  }

  return (
    <div className={cn('w-full', className)}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center justify-between cursor-pointer select-none rounded px-3 py-2 transition-colors',
          isExpanded
            ? 'bg-neutral-100 rounded-b-none'
            : 'hover:bg-ux-surface-hover'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-ux-primary shrink-0 flex items-center">{icon}</span>}
          <h4 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">
            {title}
          </h4>
          {badge}
        </div>
        <span className="text-ux-text-secondary text-base leading-none font-bold w-4 text-center shrink-0">
          {isExpanded ? '−' : '+'}
        </span>
      </div>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className={cn(
          'px-3 py-3 rounded-b',
          isExpanded ? 'bg-neutral-100' : 'hidden'
        )}>
          {children}
        </div>
      </div>
    </div>
  )
}
