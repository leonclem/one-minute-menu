/**
 * Server-Side Layout Components for HTML Export
 * 
 * These are server-only versions of the layout components without 'use client' directive.
 * Used exclusively for server-side rendering with renderToString in HTML exports.
 */

import React from 'react'
import type { LayoutMenuData, LayoutPreset, OutputContext, GridLayout } from '@/lib/templates/types'
import { generateGridLayout } from '@/lib/templates/grid-generator'
import { insertFillerTiles } from '@/lib/templates/filler-tiles'
import { isItemTile, isFillerTile } from '@/lib/templates/types'

// ============================================================================
// Server-Side Grid Menu Layout
// ============================================================================

export interface ServerGridMenuLayoutProps {
  data: LayoutMenuData
  preset: LayoutPreset
  context: OutputContext
  className?: string
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
}

export function ServerGridMenuLayout({
  data,
  preset,
  context,
  className = '',
  themeColors
}: ServerGridMenuLayoutProps) {
  // Generate grid layout with positioned tiles
  const baseLayout = generateGridLayout(data, preset, context)
  const layout: GridLayout = insertFillerTiles(baseLayout)

  // Get column count for current context
  const columns = preset.gridConfig.columns[context]
  const gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`

  return (
    <main className={`menu-layout ${className}`} aria-label={`${data.metadata.title} menu`}>
      {/* Menu Title */}
      <header className="menu-header mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{data.metadata.title}</h1>
      </header>

      {/* Sections */}
      {layout.sections.map((section, sectionIndex) => (
        <section
          key={`section-${sectionIndex}`}
          id={`section-${sectionIndex}`}
          className={`menu-section ${preset.gridConfig.sectionSpacing}`}
          aria-labelledby={`section-heading-${sectionIndex}`}
        >
          {/* Section Header */}
          <h2 id={`section-heading-${sectionIndex}`} className="text-2xl font-semibold text-gray-800 mb-4">
            {section.name}
          </h2>

          {/* Grid Container */}
          <ul
            className={`grid ${preset.gridConfig.gap}`}
            style={{ gridTemplateColumns }}
            role="list"
            aria-label={`${section.name} items`}
          >
            {/* Render Tiles */}
            {section.tiles.map((tile, tileIndex) => {
              const key = `tile-${sectionIndex}-${tileIndex}`

              if (isItemTile(tile)) {
                return (
                  <li key={key} role="listitem">
                    <ServerMenuTile
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
                    <ServerFillerTile style={tile.style} content={tile.content} preset={preset} themeColors={themeColors} />
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
// Server-Side Menu Tile
// ============================================================================

interface ServerMenuTileProps {
  item: any
  preset: LayoutPreset
  context: OutputContext
  currency: string
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
}

function ServerMenuTile({ item, preset, currency, themeColors }: ServerMenuTileProps) {
  const { tileConfig } = preset
  const formattedPrice = formatPrice(item.price, currency)

  return (
    <article className={`menu-tile ${tileConfig.padding} ${tileConfig.borderRadius} bg-white`}>
      {/* Image */}
      {item.imageRef && (
        <div className="tile-image mb-3 overflow-hidden rounded-lg">
          <img src={item.imageRef} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}

      {/* Content */}
      <div className="tile-content">
        <div className="flex justify-between items-baseline gap-2 mb-1">
          <h3 className={`${tileConfig.textSize.name} font-semibold text-gray-900 flex-1`}>{item.name}</h3>
          <span className={`${tileConfig.textSize.price} font-bold text-gray-900 whitespace-nowrap`}>{formattedPrice}</span>
        </div>

        {item.description && <p className={`${tileConfig.textSize.description} text-gray-600 mt-1`}>{item.description}</p>}
      </div>
    </article>
  )
}

// ============================================================================
// Server-Side Filler Tile
// ============================================================================

interface ServerFillerTileProps {
  style: string
  content?: string
  preset: LayoutPreset
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
}

function ServerFillerTile({ style, content, preset }: ServerFillerTileProps) {
  const { tileConfig } = preset

  return (
    <div className={`filler-tile ${tileConfig.padding} ${tileConfig.borderRadius} bg-gray-100 opacity-70`} aria-hidden="true">
      {content && <span className="text-gray-400 text-sm">{content}</span>}
    </div>
  )
}

// ============================================================================
// Server-Side Text-Only Layout
// ============================================================================

export interface ServerTextOnlyLayoutProps {
  data: LayoutMenuData
  preset: LayoutPreset
  className?: string
  showLeaderDots?: boolean
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
}

export function ServerTextOnlyLayout({ data, preset, className = '', showLeaderDots = false, themeColors }: ServerTextOnlyLayoutProps) {
  const { tileConfig } = preset
  const textColor = themeColors?.text || '#111827'
  const accentColor = themeColors?.accent || '#6b7280'

  return (
    <main className={`text-only-layout ${className}`} aria-label={`${data.metadata.title} menu`}>
      {/* Menu Title */}
      <header className="menu-header mb-8 text-center">
        <h1 className="text-4xl font-bold" style={{ color: textColor }}>
          {data.metadata.title}
        </h1>
      </header>

      {/* Sections */}
      {data.sections.map((section, sectionIndex) => (
        <section
          key={`section-${sectionIndex}`}
          id={`text-section-${sectionIndex}`}
          className={`menu-section ${preset.gridConfig.sectionSpacing}`}
          aria-labelledby={`text-section-heading-${sectionIndex}`}
        >
          {/* Section Header */}
          <h2 id={`text-section-heading-${sectionIndex}`} className="text-2xl font-semibold mb-4 pb-2 border-b-2" style={{ color: textColor, borderColor: accentColor }}>
            {section.name}
          </h2>

          {/* Items List */}
          <ul className="space-y-3" role="list">
            {section.items.map((item, itemIndex) => (
              <li key={`item-${sectionIndex}-${itemIndex}`} className={tileConfig.padding} role="listitem">
                {showLeaderDots ? (
                  <div>
                    <div className="flex items-baseline gap-2">
                      <h3 className={`${tileConfig.textSize.name} font-semibold`} style={{ color: textColor }}>
                        {item.name}
                      </h3>
                      <div className="flex-1 border-b border-dotted" style={{ borderColor: accentColor }} aria-hidden="true" />
                      <span className={`${tileConfig.textSize.price} font-bold whitespace-nowrap`} style={{ color: textColor }}>
                        {formatPrice(item.price, data.metadata.currency)}
                      </span>
                    </div>
                    {item.description && (
                      <p className={`${tileConfig.textSize.description} mt-1`} style={{ color: accentColor }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-baseline gap-4">
                      <h3 className={`${tileConfig.textSize.name} font-semibold flex-1`} style={{ color: textColor }}>
                        {item.name}
                      </h3>
                      <span className={`${tileConfig.textSize.price} font-bold whitespace-nowrap`} style={{ color: textColor }}>
                        {formatPrice(item.price, data.metadata.currency)}
                      </span>
                    </div>
                    {item.description && (
                      <p className={`${tileConfig.textSize.description} mt-1`} style={{ color: accentColor }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatPrice(price: number, currency: string): string {
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
    AUD: 'A$',
    CAD: 'C$'
  }

  const symbol = currencySymbols[currency.toUpperCase()] || currency
  const formatted = price.toFixed(2)

  if (currency.toUpperCase() === 'EUR') {
    return `${formatted}${symbol}`
  }

  return `${symbol}${formatted}`
}
