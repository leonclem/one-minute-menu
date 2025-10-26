/**
 * TextOnlyLayout Component
 * 
 * Renders a traditional text-based menu layout without images.
 * Uses line-based structure with aligned prices for a classic menu appearance.
 * 
 * Features:
 * - Clean, minimalist design
 * - Price alignment with leader dots or spacing
 * - Semantic HTML with proper heading hierarchy
 * - Responsive typography
 * - Print-optimized layout
 */

'use client'

import React from 'react'
import type { LayoutMenuData, LayoutPreset } from '@/lib/templates/types'

// ============================================================================
// Component Props
// ============================================================================

export interface TextOnlyLayoutProps {
  /** Normalized menu data */
  data: LayoutMenuData
  /** Layout preset (should be text-only preset) */
  preset: LayoutPreset
  /** Optional CSS class name */
  className?: string
  /** Whether to show leader dots between name and price */
  showLeaderDots?: boolean
  /** Optional theme color overrides */
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
 * TextOnlyLayout renders a traditional text-based menu
 */
export default function TextOnlyLayout({
  data,
  preset,
  className = '',
  showLeaderDots = false,
  themeColors
}: TextOnlyLayoutProps) {
  const { tileConfig } = preset
  const textColor = themeColors?.text || '#111827'
  const accentColor = themeColors?.accent || '#6b7280'

  return (
    <main
      className={`text-only-layout ${className}`}
      aria-label={`${data.metadata.title} menu`}
    >
      {/* Menu Title */}
      <header className="menu-header mb-8 text-center">
        <h1
          className="text-4xl font-bold"
          style={{ color: textColor }}
        >
          {data.metadata.title}
        </h1>
      </header>

      {/* Navigation for sections (skip links) */}
      <nav aria-label="Menu sections" className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:top-0 focus-within:left-0 focus-within:z-50 focus-within:bg-white focus-within:p-4 focus-within:shadow-lg">
        <ul className="space-y-2">
          {data.sections.map((section, sectionIndex) => (
            <li key={`nav-${sectionIndex}`}>
              <a 
                href={`#text-section-${sectionIndex}`}
                className="underline focus:outline-none focus:ring-2 focus:ring-offset-2 rounded px-2 py-1"
                style={{ color: accentColor }}
              >
                Skip to {section.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sections */}
      {data.sections.map((section, sectionIndex) => (
        <section
          key={`section-${sectionIndex}`}
          id={`text-section-${sectionIndex}`}
          className={`menu-section ${preset.gridConfig.sectionSpacing}`}
          aria-labelledby={`text-section-heading-${sectionIndex}`}
        >
          {/* Section Header */}
          <h2
            id={`text-section-heading-${sectionIndex}`}
            className="text-2xl font-semibold mb-4 pb-2 border-b-2"
            style={{
              color: textColor,
              borderColor: accentColor
            }}
          >
            {section.name}
          </h2>

          {/* Items List */}
          <ul className="space-y-3" role="list">
            {section.items.map((item, itemIndex) => (
              <li
                key={`item-${sectionIndex}-${itemIndex}`}
                className={tileConfig.padding}
                role="listitem"
              >
                {showLeaderDots ? (
                  <TextOnlyItemWithDots
                    name={item.name}
                    price={item.price}
                    description={item.description}
                    currency={data.metadata.currency}
                    textSize={tileConfig.textSize}
                    textColor={textColor}
                    accentColor={accentColor}
                  />
                ) : (
                  <TextOnlyItemSimple
                    name={item.name}
                    price={item.price}
                    description={item.description}
                    currency={data.metadata.currency}
                    textSize={tileConfig.textSize}
                    textColor={textColor}
                    accentColor={accentColor}
                  />
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
// Item Rendering Components
// ============================================================================

interface TextOnlyItemProps {
  name: string
  price: number
  description?: string
  currency: string
  textSize: LayoutPreset['tileConfig']['textSize']
  textColor: string
  accentColor: string
}

/**
 * Simple text-only item with name and price on same line
 */
function TextOnlyItemSimple({
  name,
  price,
  description,
  currency,
  textSize,
  textColor,
  accentColor
}: TextOnlyItemProps) {
  const formattedPrice = formatPrice(price, currency)

  return (
    <div>
      {/* Name and Price Row */}
      <div className="flex justify-between items-baseline gap-4">
        <h3
          className={`${textSize.name} font-semibold flex-1`}
          style={{ color: textColor }}
        >
          {name}
        </h3>
        <span
          className={`${textSize.price} font-bold whitespace-nowrap`}
          style={{ color: textColor }}
        >
          {formattedPrice}
        </span>
      </div>

      {/* Description */}
      {description && (
        <p
          className={`${textSize.description} mt-1`}
          style={{ color: accentColor }}
        >
          {description}
        </p>
      )}
    </div>
  )
}

/**
 * Text-only item with leader dots between name and price
 */
function TextOnlyItemWithDots({
  name,
  price,
  description,
  currency,
  textSize,
  textColor,
  accentColor
}: TextOnlyItemProps) {
  const formattedPrice = formatPrice(price, currency)

  return (
    <div>
      {/* Name and Price Row with Leader Dots */}
      <div className="flex items-baseline gap-2">
        <h3
          className={`${textSize.name} font-semibold`}
          style={{ color: textColor }}
        >
          {name}
        </h3>
        <div
          className="flex-1 border-b border-dotted"
          style={{ borderColor: accentColor }}
          aria-hidden="true"
        />
        <span
          className={`${textSize.price} font-bold whitespace-nowrap`}
          style={{ color: textColor }}
        >
          {formattedPrice}
        </span>
      </div>

      {/* Description */}
      {description && (
        <p
          className={`${textSize.description} mt-1`}
          style={{ color: accentColor }}
        >
          {description}
        </p>
      )}
    </div>
  )
}

// ============================================================================
// Compact Text-Only Layout
// ============================================================================

export interface CompactTextOnlyLayoutProps {
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

/**
 * Compact text-only layout with minimal spacing
 * Ideal for print menus or space-constrained displays
 */
export function CompactTextOnlyLayout({
  data,
  preset,
  className = '',
  themeColors
}: CompactTextOnlyLayoutProps) {
  const { tileConfig } = preset
  const textColor = themeColors?.text || '#111827'
  const accentColor = themeColors?.accent || '#6b7280'

  return (
    <div
      className={`compact-text-only-layout ${className}`}
      role="main"
      aria-label={data.metadata.title}
    >
      {/* Menu Title */}
      <header className="menu-header mb-6 text-center">
        <h1
          className="text-3xl font-bold"
          style={{ color: textColor }}
        >
          {data.metadata.title}
        </h1>
      </header>

      {/* Sections */}
      {data.sections.map((section, sectionIndex) => (
        <section
          key={`section-${sectionIndex}`}
          className="menu-section mb-4"
          aria-labelledby={`section-heading-${sectionIndex}`}
        >
          {/* Section Header */}
          <h2
            id={`section-heading-${sectionIndex}`}
            className="text-xl font-semibold mb-2"
            style={{ color: textColor }}
          >
            {section.name}
          </h2>

          {/* Items List */}
          <ul className="space-y-1" role="list">
            {section.items.map((item, itemIndex) => (
              <li
                key={`item-${sectionIndex}-${itemIndex}`}
                className="flex justify-between items-baseline gap-4 py-1"
                role="listitem"
              >
                <span
                  className={`${tileConfig.textSize.name} flex-1`}
                  style={{ color: textColor }}
                >
                  {item.name}
                </span>
                <span
                  className={`${tileConfig.textSize.price} font-semibold whitespace-nowrap`}
                  style={{ color: textColor }}
                >
                  {formatPrice(item.price, data.metadata.currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// ============================================================================
// Two-Column Text-Only Layout
// ============================================================================

export interface TwoColumnTextOnlyLayoutProps {
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

/**
 * Two-column text-only layout for wider displays
 * Automatically splits sections across columns
 */
export function TwoColumnTextOnlyLayout({
  data,
  preset,
  className = '',
  themeColors
}: TwoColumnTextOnlyLayoutProps) {
  const { tileConfig } = preset
  const textColor = themeColors?.text || '#111827'
  const accentColor = themeColors?.accent || '#6b7280'

  // Split sections into two columns
  const midpoint = Math.ceil(data.sections.length / 2)
  const leftSections = data.sections.slice(0, midpoint)
  const rightSections = data.sections.slice(midpoint)

  return (
    <div
      className={`two-column-text-only-layout ${className}`}
      role="main"
      aria-label={data.metadata.title}
    >
      {/* Menu Title */}
      <header className="menu-header mb-8 text-center">
        <h1
          className="text-4xl font-bold"
          style={{ color: textColor }}
        >
          {data.metadata.title}
        </h1>
      </header>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div>
          {leftSections.map((section, sectionIndex) => (
            <section
              key={`left-section-${sectionIndex}`}
              className={`menu-section ${preset.gridConfig.sectionSpacing}`}
              aria-labelledby={`left-section-heading-${sectionIndex}`}
            >
              <h2
                id={`left-section-heading-${sectionIndex}`}
                className="text-2xl font-semibold mb-4 pb-2 border-b-2"
                style={{
                  color: textColor,
                  borderColor: accentColor
                }}
              >
                {section.name}
              </h2>

              <ul className="space-y-3" role="list">
                {section.items.map((item, itemIndex) => (
                  <li
                    key={`left-item-${sectionIndex}-${itemIndex}`}
                    className={tileConfig.padding}
                    role="listitem"
                  >
                    <div className="flex justify-between items-baseline gap-4">
                      <h3
                        className={`${tileConfig.textSize.name} font-semibold flex-1`}
                        style={{ color: textColor }}
                      >
                        {item.name}
                      </h3>
                      <span
                        className={`${tileConfig.textSize.price} font-bold whitespace-nowrap`}
                        style={{ color: textColor }}
                      >
                        {formatPrice(item.price, data.metadata.currency)}
                      </span>
                    </div>
                    {item.description && (
                      <p
                        className={`${tileConfig.textSize.description} mt-1`}
                        style={{ color: accentColor }}
                      >
                        {item.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Right Column */}
        <div>
          {rightSections.map((section, sectionIndex) => (
            <section
              key={`right-section-${sectionIndex}`}
              className={`menu-section ${preset.gridConfig.sectionSpacing}`}
              aria-labelledby={`right-section-heading-${sectionIndex}`}
            >
              <h2
                id={`right-section-heading-${sectionIndex}`}
                className="text-2xl font-semibold mb-4 pb-2 border-b-2"
                style={{
                  color: textColor,
                  borderColor: accentColor
                }}
              >
                {section.name}
              </h2>

              <ul className="space-y-3" role="list">
                {section.items.map((item, itemIndex) => (
                  <li
                    key={`right-item-${sectionIndex}-${itemIndex}`}
                    className={tileConfig.padding}
                    role="listitem"
                  >
                    <div className="flex justify-between items-baseline gap-4">
                      <h3
                        className={`${tileConfig.textSize.name} font-semibold flex-1`}
                        style={{ color: textColor }}
                      >
                        {item.name}
                      </h3>
                      <span
                        className={`${tileConfig.textSize.price} font-bold whitespace-nowrap`}
                        style={{ color: textColor }}
                      >
                        {formatPrice(item.price, data.metadata.currency)}
                      </span>
                    </div>
                    {item.description && (
                      <p
                        className={`${tileConfig.textSize.description} mt-1`}
                        style={{ color: accentColor }}
                      >
                        {item.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format price with currency symbol
 */
function formatPrice(price: number, currency: string): string {
  const currencySymbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'AUD': 'A$',
    'CAD': 'C$'
  }

  const symbol = currencySymbols[currency.toUpperCase()] || currency
  const formatted = price.toFixed(2)

  if (currency.toUpperCase() === 'EUR') {
    return `${formatted}${symbol}`
  }

  return `${symbol}${formatted}`
}
