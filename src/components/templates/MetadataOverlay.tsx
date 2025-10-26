/**
 * MetadataOverlay Component
 * 
 * Renders menu item metadata (name, price, description) on top of an image tile
 * with a semi-transparent gradient background for legibility.
 * 
 * Features:
 * - Semi-transparent gradient background
 * - Readable contrast ratios (WCAG AA compliant)
 * - Configurable text sizes from preset
 * - Positioned at bottom of tile
 * - Smooth gradient fade for visual appeal
 */

'use client'

import React from 'react'
import type { LayoutPreset } from '@/lib/templates/types'

// ============================================================================
// Component Props
// ============================================================================

export interface MetadataOverlayProps {
  /** Item name */
  name: string
  /** Formatted price string */
  price: string
  /** Optional description */
  description?: string
  /** Text size configuration from preset */
  textSize: LayoutPreset['tileConfig']['textSize']
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
 * MetadataOverlay renders text information over an image with gradient background
 */
export default function MetadataOverlay({
  name,
  price,
  description,
  textSize,
  themeColors
}: MetadataOverlayProps) {
  // Text color (white for contrast on dark gradient)
  const textColor = themeColors?.text || '#ffffff'

  return (
    <div
      className="absolute inset-x-0 bottom-0 p-4"
      style={{
        background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 50%, rgba(0, 0, 0, 0) 100%)'
      }}
    >
      <div className="flex flex-col gap-1">
        {/* Item Name */}
        <h3
          className={`${textSize.name} font-semibold leading-tight`}
          style={{ color: textColor }}
        >
          {name}
        </h3>

        {/* Price */}
        <p
          className={`${textSize.price} font-bold`}
          style={{ color: textColor }}
        >
          {price}
        </p>

        {/* Description (if provided) */}
        {description && (
          <p
            className={`${textSize.description} leading-snug opacity-90 line-clamp-2`}
            style={{ color: textColor }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Alternative Overlay Styles
// ============================================================================

/**
 * LightMetadataOverlay - Alternative with light background
 * Useful for dark images where light text might not work well
 */
export interface LightMetadataOverlayProps {
  name: string
  price: string
  description?: string
  textSize: LayoutPreset['tileConfig']['textSize']
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
}

export function LightMetadataOverlay({
  name,
  price,
  description,
  textSize,
  themeColors
}: LightMetadataOverlayProps) {
  const textColor = themeColors?.text || '#111827'

  return (
    <div
      className="absolute inset-x-0 bottom-0 p-4"
      style={{
        background: 'linear-gradient(to top, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.8) 50%, rgba(255, 255, 255, 0) 100%)'
      }}
    >
      <div className="flex flex-col gap-1">
        <h3
          className={`${textSize.name} font-semibold leading-tight`}
          style={{ color: textColor }}
        >
          {name}
        </h3>

        <p
          className={`${textSize.price} font-bold`}
          style={{ color: textColor }}
        >
          {price}
        </p>

        {description && (
          <p
            className={`${textSize.description} leading-snug opacity-80 line-clamp-2`}
            style={{ color: textColor }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Solid Background Overlay
// ============================================================================

/**
 * SolidMetadataOverlay - Overlay with solid background (no gradient)
 * Maximum contrast for accessibility
 */
export interface SolidMetadataOverlayProps {
  name: string
  price: string
  description?: string
  textSize: LayoutPreset['tileConfig']['textSize']
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
}

export function SolidMetadataOverlay({
  name,
  price,
  description,
  textSize,
  themeColors
}: SolidMetadataOverlayProps) {
  const backgroundColor = themeColors?.background || 'rgba(0, 0, 0, 0.85)'
  const textColor = themeColors?.text || '#ffffff'

  return (
    <div
      className="absolute inset-x-0 bottom-0 p-4"
      style={{
        backgroundColor
      }}
    >
      <div className="flex flex-col gap-1">
        <h3
          className={`${textSize.name} font-semibold leading-tight`}
          style={{ color: textColor }}
        >
          {name}
        </h3>

        <p
          className={`${textSize.price} font-bold`}
          style={{ color: textColor }}
        >
          {price}
        </p>

        {description && (
          <p
            className={`${textSize.description} leading-snug line-clamp-2`}
            style={{ color: textColor }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate contrast ratio between text and background
 * Used for accessibility validation
 * 
 * @param textColor - Text color in hex format
 * @param backgroundColor - Background color in hex format
 * @returns Contrast ratio (1-21)
 */
export function calculateContrastRatio(textColor: string, backgroundColor: string): number {
  // Convert hex to RGB
  const textRgb = hexToRgb(textColor)
  const bgRgb = hexToRgb(backgroundColor)

  if (!textRgb || !bgRgb) {
    return 1 // Invalid colors, return minimum contrast
  }

  // Calculate relative luminance
  const textLuminance = getRelativeLuminance(textRgb)
  const bgLuminance = getRelativeLuminance(bgRgb)

  // Calculate contrast ratio
  const lighter = Math.max(textLuminance, bgLuminance)
  const darker = Math.min(textLuminance, bgLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null
}

/**
 * Calculate relative luminance for contrast ratio
 */
function getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const rsRGB = rgb.r / 255
  const gsRGB = rgb.g / 255
  const bsRGB = rgb.b / 255

  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4)
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4)
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4)

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Check if contrast ratio meets WCAG AA standard
 * 
 * @param contrastRatio - Calculated contrast ratio
 * @param isLargeText - Whether the text is large (18pt+ or 14pt+ bold)
 * @returns True if meets WCAG AA standard
 */
export function meetsWCAGAA(contrastRatio: number, isLargeText: boolean = false): boolean {
  const minimumRatio = isLargeText ? 3.0 : 4.5
  return contrastRatio >= minimumRatio
}

/**
 * Check if contrast ratio meets WCAG AAA standard
 * 
 * @param contrastRatio - Calculated contrast ratio
 * @param isLargeText - Whether the text is large (18pt+ or 14pt+ bold)
 * @returns True if meets WCAG AAA standard
 */
export function meetsWCAGAAA(contrastRatio: number, isLargeText: boolean = false): boolean {
  const minimumRatio = isLargeText ? 4.5 : 7.0
  return contrastRatio >= minimumRatio
}
