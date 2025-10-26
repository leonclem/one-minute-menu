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

  return (
    <div 
      className={`menu-layout ${className}`}
      role="main"
      aria-label={data.metadata.title}
    >
      {/* Menu Title */}
      <header className="menu-header mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {data.metadata.title}
        </h1>
      </header>

      {/* Sections */}
      {layout.sections.map((section, sectionIndex) => (
        <section
          key={`section-${sectionIndex}`}
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
          <div
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
                  <MenuTile
                    key={key}
                    item={tile.item}
                    preset={preset}
                    context={context}
                    currency={data.metadata.currency}
                    themeColors={themeColors}
                  />
                )
              }

              if (isFillerTile(tile)) {
                return (
                  <FillerTile
                    key={key}
                    style={tile.style}
                    content={tile.content}
                    preset={preset}
                    themeColors={themeColors}
                  />
                )
              }

              return null
            })}
          </div>
        </section>
      ))}
    </div>
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
