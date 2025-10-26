/**
 * GridMenuLayout Component
 * 
 * Main container component for rendering responsive grid-based menu layouts.
 * Accepts menu data, preset configuration, and output context to generate
 * a CSS Grid layout with positioned tiles.
 * 
 * Features:
 * - Responsive CSS Grid with breakpoint-specific column counts
 * - Section headers with semantic HTML
 * - Tile rendering with MenuTile component
 * - Filler tile support for dead space
 * - Accessibility-compliant structure
 */

'use client'

import React from 'react'
import type { LayoutMenuData, LayoutPreset, OutputContext, GridLayout } from '@/lib/templates/types'
import { generateGridLayout } from '@/lib/templates/grid-generator'
import { insertFillerTiles } from '@/lib/templates/filler-tiles'
import { isItemTile, isFillerTile } from '@/lib/templates/types'
import MenuTile from './MenuTile'
import FillerTile from './FillerTile'

// ============================================================================
// Component Props
// ============================================================================

export interface GridMenuLayoutProps {
  /** Normalized menu data */
  data: LayoutMenuData
  /** Selected layout preset */
  preset: LayoutPreset
  /** Target output context */
  context: OutputContext
  /** Optional CSS class name */
  className?: string
  /** Optional theme overrides */
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * GridMenuLayout renders a complete menu layout with sections and tiles
 */
export default function GridMenuLayout({
  data,
  preset,
  context,
  className = '',
  themeColors
}: GridMenuLayoutProps) {
  // Generate grid layout with positioned tiles
  const layout: GridLayout = React.useMemo(() => {
    const baseLayout = generateGridLayout(data, preset, context)
    // Insert filler tiles for dead space
    return insertFillerTiles(baseLayout)
  }, [data, preset, context])

  // Get column count for current context
  const columns = preset.gridConfig.columns[context]

  // Build grid template columns CSS
  const gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`

  // Announce layout changes to screen readers
  const [announcement, setAnnouncement] = React.useState('')

  React.useEffect(() => {
    const totalItems = layout.sections.reduce((sum, s) => sum + s.tiles.filter(t => t.type === 'item').length, 0)
    setAnnouncement(`Menu loaded with ${layout.sections.length} sections and ${totalItems} items`)
  }, [layout])

  return (
    <main 
      className={`menu-layout ${className}`}
      aria-label={`${data.metadata.title} menu`}
    >
      {/* Screen reader announcement for layout changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Menu Title */}
      <header className="menu-header mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {data.metadata.title}
        </h1>
      </header>

      {/* Navigation for sections (skip links) */}
      <nav aria-label="Menu sections" className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:top-0 focus-within:left-0 focus-within:z-50 focus-within:bg-white focus-within:p-4 focus-within:shadow-lg">
        <ul className="space-y-2">
          {layout.sections.map((section, sectionIndex) => (
            <li key={`nav-${sectionIndex}`}>
              <a 
                href={`#section-${sectionIndex}`}
                className="text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
              >
                Skip to {section.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sections */}
      {layout.sections.map((section, sectionIndex) => (
        <section
          key={`section-${sectionIndex}`}
          id={`section-${sectionIndex}`}
          className={`menu-section ${preset.gridConfig.sectionSpacing}`}
          aria-labelledby={`section-heading-${sectionIndex}`}
        >
          {/* Section Header */}
          <h2
            id={`section-heading-${sectionIndex}`}
            className="text-2xl font-semibold text-gray-800 mb-4"
          >
            {section.name}
          </h2>

          {/* Grid Container */}
          <ul
            className={`grid ${preset.gridConfig.gap}`}
            style={{
              gridTemplateColumns
            }}
            role="list"
            aria-label={`${section.name} items`}
          >
            {/* Render Tiles */}
            {section.tiles.map((tile, tileIndex) => {
              const key = `tile-${sectionIndex}-${tileIndex}`

              if (isItemTile(tile)) {
                return (
                  <li key={key} role="listitem">
                    <MenuTile
                      item={tile.item}
                      preset={preset}
                      context={context}
                      currency={data.metadata.currency}
                      themeColors={themeColors}
                    />
                  </li>
                )
              }

              if (isFillerTile(tile)) {
                return (
                  <li key={key} role="presentation" aria-hidden="true">
                    <FillerTile
                      style={tile.style}
                      content={tile.content}
                      preset={preset}
                      themeColors={themeColors}
                    />
                  </li>
                )
              }

              return null
            })}
          </ul>
        </section>
      ))}
    </main>
  )
}

// ============================================================================
// Responsive Wrapper Component
// ============================================================================

/**
 * ResponsiveGridMenuLayout automatically adjusts context based on viewport width
 * This component uses CSS media queries and client-side detection
 */
export interface ResponsiveGridMenuLayoutProps {
  data: LayoutMenuData
  preset: LayoutPreset
  className?: string
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
}

export function ResponsiveGridMenuLayout({
  data,
  preset,
  className,
  themeColors
}: ResponsiveGridMenuLayoutProps) {
  const [context, setContext] = React.useState<OutputContext>('desktop')

  React.useEffect(() => {
    const updateContext = () => {
      const width = window.innerWidth

      if (width < 640) {
        setContext('mobile')
      } else if (width < 1024) {
        setContext('tablet')
      } else {
        setContext('desktop')
      }
    }

    // Set initial context
    updateContext()

    // Listen for resize events
    window.addEventListener('resize', updateContext)

    return () => {
      window.removeEventListener('resize', updateContext)
    }
  }, [])

  return (
    <GridMenuLayout
      data={data}
      preset={preset}
      context={context}
      className={className}
      themeColors={themeColors}
    />
  )
}
