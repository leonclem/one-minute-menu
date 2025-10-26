/**
 * MenuTile Component
 * 
 * Renders an individual menu item tile with image, name, price, and optional description.
 * Supports both overlay and adjacent metadata modes.
 * 
 * Features:
 * - Next.js Image component for optimized image loading
 * - Configurable aspect ratio and styling from preset
 * - Metadata overlay with semi-transparent background
 * - Fallback rendering for missing images
 * - Accessible markup with semantic HTML
 */

'use client'

import React from 'react'
import Image from 'next/image'
import type { LayoutItem, LayoutPreset, OutputContext } from '@/lib/templates/types'
import MetadataOverlay from './MetadataOverlay'

// ============================================================================
// Component Props
// ============================================================================

export interface MenuTileProps {
  /** Menu item data */
  item: LayoutItem
  /** Layout preset configuration */
  preset: LayoutPreset
  /** Output context */
  context: OutputContext
  /** Currency symbol or code */
  currency: string
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
 * MenuTile renders a single menu item with image and metadata
 */
export default function MenuTile({
  item,
  preset,
  context,
  currency,
  themeColors
}: MenuTileProps) {
  const { tileConfig, metadataMode } = preset
  const hasImage = Boolean(item.imageRef)

  // Format price with currency
  const formattedPrice = formatPrice(item.price, currency)

  return (
    <article
      className={`menu-tile relative overflow-hidden ${tileConfig.borderRadius} bg-gray-100`}
      style={{
        aspectRatio: tileConfig.aspectRatio
      }}
      role="listitem"
      aria-label={`${item.name}, ${formattedPrice}`}
    >
      {/* Image or Fallback */}
      {hasImage ? (
        <div className="relative w-full h-full">
          <Image
            src={item.imageRef!}
            alt={item.name}
            fill
            className="object-cover"
            sizes={getSizesForContext(context)}
            priority={item.featured}
          />

          {/* Metadata Overlay (if overlay mode) */}
          {metadataMode === 'overlay' && (
            <MetadataOverlay
              name={item.name}
              price={formattedPrice}
              description={item.description}
              textSize={tileConfig.textSize}
              themeColors={themeColors}
            />
          )}
        </div>
      ) : (
        <ImageFallback
          name={item.name}
          price={formattedPrice}
          description={item.description}
          tileConfig={tileConfig}
          themeColors={themeColors}
        />
      )}

      {/* Adjacent Metadata (if adjacent mode and has image) */}
      {metadataMode === 'adjacent' && hasImage && (
        <div className={`${tileConfig.padding} bg-white`}>
          <h3 className={`${tileConfig.textSize.name} font-semibold text-gray-900`}>
            {item.name}
          </h3>
          <p className={`${tileConfig.textSize.price} font-bold text-gray-700 mt-1`}>
            {formattedPrice}
          </p>
          {item.description && (
            <p className={`${tileConfig.textSize.description} text-gray-600 mt-1`}>
              {item.description}
            </p>
          )}
        </div>
      )}
    </article>
  )
}

// ============================================================================
// Image Fallback Component
// ============================================================================

interface ImageFallbackProps {
  name: string
  price: string
  description?: string
  tileConfig: LayoutPreset['tileConfig']
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
}

/**
 * Fallback rendering for items without images
 * Displays a solid color tile with text content
 */
function ImageFallback({
  name,
  price,
  description,
  tileConfig,
  themeColors
}: ImageFallbackProps) {
  const backgroundColor = themeColors?.background || '#f3f4f6'
  const textColor = themeColors?.text || '#111827'

  return (
    <div
      className={`w-full h-full flex flex-col justify-center ${tileConfig.padding}`}
      style={{
        backgroundColor
      }}
    >
      <h3
        className={`${tileConfig.textSize.name} font-semibold`}
        style={{ color: textColor }}
      >
        {name}
      </h3>
      <p
        className={`${tileConfig.textSize.price} font-bold mt-2`}
        style={{ color: textColor }}
      >
        {price}
      </p>
      {description && (
        <p
          className={`${tileConfig.textSize.description} mt-2 opacity-80`}
          style={{ color: textColor }}
        >
          {description}
        </p>
      )}
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
  // Handle common currency symbols
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

  // Format with 2 decimal places
  const formatted = price.toFixed(2)

  // Place symbol before or after based on currency
  if (currency.toUpperCase() === 'EUR') {
    return `${formatted}${symbol}`
  }

  return `${symbol}${formatted}`
}

/**
 * Get responsive image sizes attribute based on output context
 */
function getSizesForContext(context: OutputContext): string {
  switch (context) {
    case 'mobile':
      return '(max-width: 640px) 50vw, 33vw'
    case 'tablet':
      return '(max-width: 1024px) 33vw, 25vw'
    case 'desktop':
      return '(max-width: 1280px) 25vw, 20vw'
    case 'print':
      return '300px'
    default:
      return '25vw'
  }
}
