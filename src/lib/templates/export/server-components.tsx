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
    <article className={`menu-tile ${tileConfig.padding} ${tileConfig.borderRadius} bg-white flex flex-col h-full`}>
      {/* Image Container - Always rendered to preserve grid effect */}
      <div className="tile-image mb-3 overflow-hidden rounded-lg bg-gray-100 flex-shrink-0" style={{ height: '120px' }}>
        {item.imageRef ? (
          <img src={item.imageRef} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            {getIconJSX('plate')}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="tile-content flex-1 flex flex-col">
        {/* Reserve space for name to allow 2 lines and prevent overlap */}
        <h3 className={`${tileConfig.textSize.name} font-semibold text-gray-900 mb-1 line-clamp-2 min-h-[2.8em]`}>
          {item.name}
        </h3>
        <span className={`${tileConfig.textSize.price} font-bold text-gray-900 mb-2`}>{formattedPrice}</span>

        {item.description && (
          <p className={`${tileConfig.textSize.description} text-gray-600 mt-auto line-clamp-3`}>
            {item.description}
          </p>
        )}
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

  // Render based on style type
  if (style === 'pattern' && content) {
    const patternStyle = getPatternCSS(content)
    return (
      <div 
        className={`filler-tile ${tileConfig.padding} ${tileConfig.borderRadius} bg-gray-50`} 
        style={{ 
          backgroundImage: patternStyle,
          backgroundSize: '20px 20px',
          backgroundRepeat: 'repeat',
          opacity: 0.7
        }} 
        aria-hidden="true" 
      />
    )
  }

  if (style === 'icon' && content) {
    return (
      <div className={`filler-tile ${tileConfig.padding} ${tileConfig.borderRadius} bg-gray-50 flex items-center justify-center`} style={{ opacity: 0.7 }} aria-hidden="true">
        {getIconJSX(content)}
      </div>
    )
  }

  // Default: solid color
  return (
    <div className={`filler-tile ${tileConfig.padding} ${tileConfig.borderRadius} bg-gray-100`} style={{ opacity: 0.7 }} aria-hidden="true" />
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

/**
 * Get CSS pattern for filler tiles
 */
function getPatternCSS(pattern: string): string {
  const color = '#d1d5db'
  
  switch (pattern) {
    case 'dots':
      return `radial-gradient(circle, ${color} 2px, transparent 2px)`
    case 'stripes':
      return `repeating-linear-gradient(45deg, transparent, transparent 10px, ${color} 10px, ${color} 12px)`
    case 'grid':
      return `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`
    case 'waves':
      return `repeating-linear-gradient(0deg, transparent, transparent 8px, ${color} 8px, ${color} 9px)`
    case 'chevron':
      return `repeating-linear-gradient(45deg, ${color} 0px, ${color} 2px, transparent 2px, transparent 10px)`
    default:
      return `radial-gradient(circle, ${color} 2px, transparent 2px)`
  }
}

/**
 * Get JSX icon element for filler tiles
 */
function getIconJSX(icon: string): React.ReactElement {
  const color = '#d1d5db'
  const size = 32
  
  switch (icon) {
    case 'utensils':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 002-2V2M7 2v20M21 15V2v0a2 2 0 00-2 2v9"/>
        </svg>
      )
    case 'coffee':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
        </svg>
      )
    case 'wine-glass':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 22h8M12 15v7M12 15c3 0 5-2 5-5V3H7v7c0 3 2 5 5 5z"/>
        </svg>
      )
    case 'leaf':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
        </svg>
      )
    case 'star':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      )
    case 'heart':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      )
    case 'chef-hat':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 13.87A4 4 0 017.41 6a5.11
 5.11 0 011.05-1.54 5 5 0 017.08 0A5.11 5.11 0 0116.59 6 4 4 0 0118 13.87V21H6zM6 17h12"/>
        </svg>
      )
    case 'plate':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="6"/>
        </svg>
      )
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="6"/>
        </svg>
      )
  }
}