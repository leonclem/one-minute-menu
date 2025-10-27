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
import { getSuggestedTextColor } from '@/lib/templates/contrast-validator'
import {
  getResponsiveSizes,
  shouldPrioritizeImage,
  getLoadingStrategy,
  getOptimalQuality,
  generateInlineBlurDataURL
} from '@/lib/templates/next-image-config'

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
  /** Item index in grid (for priority loading) */
  index?: number
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
  index = 0,
  themeColors
}: MenuTileProps) {
  const { tileConfig, metadataMode } = preset
  const hasImage = Boolean(item.imageRef)

  // Format price with currency
  const formattedPrice = formatPrice(item.price, currency)

  // Determine image loading strategy
  const isPriority = shouldPrioritizeImage(item.featured, index, context)
  const loadingStrategy = getLoadingStrategy(isPriority)
  const imageQuality = getOptimalQuality(context, 'webp')
  const imageSizes = getResponsiveSizes(context, preset.gridConfig.columns[context])
  const blurDataURL = generateInlineBlurDataURL(themeColors?.secondary)

  return (
    <article
      className={`menu-tile relative overflow-hidden ${tileConfig.borderRadius} bg-gray-100 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2`}
      style={{
        aspectRatio: tileConfig.aspectRatio
      }}
      tabIndex={0}
      aria-label={`${item.name}, ${formattedPrice}${item.description ? `, ${item.description}` : ''}`}
    >
      {/* Image or Fallback */}
      {hasImage ? (
        <div className="relative w-full h-full bg-gray-200">
          <Image
            src={item.imageRef!}
            alt={item.name}
            fill
            className="object-cover transition-opacity duration-300"
            sizes={imageSizes}
            priority={isPriority}
            loading={loadingStrategy}
            quality={imageQuality}
            placeholder="blur"
            blurDataURL={blurDataURL}
            onLoadingComplete={(img) => {
              img.classList.add('opacity-100')
            }}
            style={{
              opacity: 0
            }}
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

type FallbackStyle = 'color' | 'icon' | 'text-only'

/**
 * Fallback rendering for items without images
 * Supports three modes: solid color, icon, or text-only
 */
function ImageFallback({
  name,
  price,
  description,
  tileConfig,
  themeColors
}: ImageFallbackProps) {
  // Determine fallback style based on item characteristics
  const fallbackStyle = determineFallbackStyle(name, description)

  switch (fallbackStyle) {
    case 'icon':
      return (
        <IconFallback
          name={name}
          price={price}
          description={description}
          tileConfig={tileConfig}
          themeColors={themeColors}
        />
      )
    case 'text-only':
      return (
        <TextOnlyFallback
          name={name}
          price={price}
          description={description}
          tileConfig={tileConfig}
          themeColors={themeColors}
        />
      )
    case 'color':
    default:
      return (
        <ColorFallback
          name={name}
          price={price}
          description={description}
          tileConfig={tileConfig}
          themeColors={themeColors}
        />
      )
  }
}

/**
 * Solid color fallback with text overlay
 */
function ColorFallback({
  name,
  price,
  description,
  tileConfig,
  themeColors
}: ImageFallbackProps) {
  const backgroundColor = themeColors?.secondary || '#e5e7eb'
  const preferredTextColor = themeColors?.text || '#111827'
  
  // Ensure text color meets WCAG AA contrast requirements
  const textColor = getSuggestedTextColor(backgroundColor, preferredTextColor)

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

/**
 * Icon-based fallback with decorative food icon
 */
function IconFallback({
  name,
  price,
  description,
  tileConfig,
  themeColors
}: ImageFallbackProps) {
  const backgroundColor = themeColors?.background || '#f9fafb'
  const iconColor = themeColors?.accent || '#9ca3af'
  const preferredTextColor = themeColors?.text || '#111827'
  
  // Ensure text color meets WCAG AA contrast requirements
  const textColor = getSuggestedTextColor(backgroundColor, preferredTextColor)

  // Select icon based on item name keywords
  const icon = selectIconForItem(name)

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center ${tileConfig.padding}`}
      style={{
        backgroundColor
      }}
    >
      {/* Icon */}
      <div
        className="mb-3"
        style={{ color: iconColor }}
        aria-hidden="true"
      >
        {icon}
      </div>

      {/* Text content */}
      <h3
        className={`${tileConfig.textSize.name} font-semibold text-center`}
        style={{ color: textColor }}
      >
        {name}
      </h3>
      <p
        className={`${tileConfig.textSize.price} font-bold mt-1`}
        style={{ color: textColor }}
      >
        {price}
      </p>
      {description && (
        <p
          className={`${tileConfig.textSize.description} mt-1 text-center opacity-80`}
          style={{ color: textColor }}
        >
          {description}
        </p>
      )}
    </div>
  )
}

/**
 * Text-only fallback with minimal styling
 */
function TextOnlyFallback({
  name,
  price,
  description,
  tileConfig,
  themeColors
}: ImageFallbackProps) {
  const backgroundColor = themeColors?.background || '#ffffff'
  const preferredTextColor = themeColors?.text || '#111827'
  const borderColor = themeColors?.secondary || '#e5e7eb'
  
  // Ensure text color meets WCAG AA contrast requirements
  const textColor = getSuggestedTextColor(backgroundColor, preferredTextColor)

  return (
    <div
      className={`w-full h-full flex flex-col justify-center ${tileConfig.padding} border-2`}
      style={{
        backgroundColor,
        borderColor
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
          className={`${tileConfig.textSize.description} mt-2 opacity-70`}
          style={{ color: textColor }}
        >
          {description}
        </p>
      )}
    </div>
  )
}

/**
 * Determine which fallback style to use based on item characteristics
 */
function determineFallbackStyle(name: string, description?: string): FallbackStyle {
  // Use icon fallback if name contains food-related keywords
  const foodKeywords = [
    'burger', 'pizza', 'pasta', 'salad', 'soup', 'sandwich',
    'steak', 'chicken', 'fish', 'dessert', 'cake', 'coffee',
    'tea', 'drink', 'cocktail', 'wine', 'beer'
  ]
  
  const nameLower = name.toLowerCase()
  const hasKeyword = foodKeywords.some(keyword => nameLower.includes(keyword))
  
  if (hasKeyword) {
    return 'icon'
  }

  // Use text-only for items with long descriptions
  if (description && description.length > 50) {
    return 'text-only'
  }

  // Default to color fallback
  return 'color'
}

/**
 * Select appropriate icon SVG based on item name
 */
function selectIconForItem(name: string): React.ReactNode {
  const nameLower = name.toLowerCase()

  // Drinks
  if (nameLower.includes('coffee') || nameLower.includes('espresso')) {
    return <CoffeeIcon />
  }
  if (nameLower.includes('cocktail') || nameLower.includes('drink') || nameLower.includes('wine') || nameLower.includes('beer')) {
    return <DrinkIcon />
  }

  // Desserts
  if (nameLower.includes('cake') || nameLower.includes('dessert') || nameLower.includes('ice cream')) {
    return <DessertIcon />
  }

  // Main dishes
  if (nameLower.includes('burger') || nameLower.includes('sandwich')) {
    return <BurgerIcon />
  }
  if (nameLower.includes('pizza')) {
    return <PizzaIcon />
  }
  if (nameLower.includes('salad')) {
    return <SaladIcon />
  }

  // Default food icon
  return <FoodIcon />
}

// ============================================================================
// Icon Components (Simple SVG Icons)
// ============================================================================

function FoodIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

function CoffeeIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  )
}

function DrinkIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 2v2.343M14 2v2.343M8.5 2h7M7 8l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" />
      <path d="M7 8h10" />
    </svg>
  )
}

function DessertIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
      <path d="M4 16h16" />
      <path d="M12 11V7" />
      <path d="M12 7c1.5-1.5 3-2 4.5-2s3 .5 3 2-1.5 2-3 2-3-.5-3-2z" />
    </svg>
  )
}

function BurgerIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 11h18M3 15h18" />
      <path d="M4 11c0-2 1-4 4-5s6-1 8 0 4 3 4 5" />
      <path d="M4 15c0 2 1 4 4 5s6 1 8 0 4-3 4-5" />
    </svg>
  )
}

function PizzaIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a10 10 0 0 1 10 10l-10 10L2 12A10 10 0 0 1 12 2z" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="12" cy="10" r="1" fill="currentColor" />
      <circle cx="9" cy="13" r="1" fill="currentColor" />
    </svg>
  )
}

function SaladIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 21h10" />
      <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9z" />
      <path d="M7.5 12 11 8M16.5 12 13 8" />
      <path d="M12 12V3" />
    </svg>
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


