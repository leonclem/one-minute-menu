/**
 * FillerTile Component
 * 
 * Renders decorative filler tiles for empty grid spaces.
 * Supports solid colors, subtle patterns, and icons.
 * 
 * Features:
 * - Solid color fills with brand colors
 * - Subtle pattern backgrounds
 * - Icon display for visual interest
 * - Matches grid tile dimensions and spacing
 * - Non-interactive (decorative only)
 */

'use client'

import React from 'react'
import type { LayoutPreset, FillerTile as FillerTileType } from '@/lib/templates/types'

// ============================================================================
// Component Props
// ============================================================================

export interface FillerTileProps {
  /** Filler style type */
  style: FillerTileType['style']
  /** Optional content (icon name or pattern identifier) */
  content?: string
  /** Layout preset configuration */
  preset: LayoutPreset
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
 * FillerTile renders a decorative element for empty grid spaces
 */
export default function FillerTile({
  style,
  content,
  preset,
  themeColors
}: FillerTileProps) {
  const { tileConfig } = preset

  // Render based on style type
  switch (style) {
    case 'color':
      return (
        <ColorFillerTile
          tileConfig={tileConfig}
          themeColors={themeColors}
        />
      )

    case 'pattern':
      return (
        <PatternFillerTile
          pattern={content}
          tileConfig={tileConfig}
          themeColors={themeColors}
        />
      )

    case 'icon':
      return (
        <IconFillerTile
          icon={content}
          tileConfig={tileConfig}
          themeColors={themeColors}
        />
      )

    default:
      return (
        <ColorFillerTile
          tileConfig={tileConfig}
          themeColors={themeColors}
        />
      )
  }
}

// ============================================================================
// Color Filler Tile
// ============================================================================

interface ColorFillerTileProps {
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
 * Solid color filler tile
 */
function ColorFillerTile({ tileConfig, themeColors }: ColorFillerTileProps) {
  // Use theme colors or default to subtle gray
  const backgroundColor = themeColors?.accent || themeColors?.secondary || '#f9fafb'

  return (
    <div
      className={`filler-tile ${tileConfig.borderRadius}`}
      style={{
        aspectRatio: tileConfig.aspectRatio,
        backgroundColor
      }}
      role="presentation"
      aria-hidden="true"
    />
  )
}

// ============================================================================
// Pattern Filler Tile
// ============================================================================

interface PatternFillerTileProps {
  pattern?: string
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
 * Pattern-based filler tile with subtle background patterns
 */
function PatternFillerTile({ pattern, tileConfig, themeColors }: PatternFillerTileProps) {
  const backgroundColor = themeColors?.background || '#f9fafb'
  const patternColor = themeColors?.accent || '#e5e7eb'

  // Get pattern style based on pattern identifier
  const patternStyle = getPatternStyle(pattern, patternColor)

  return (
    <div
      className={`filler-tile ${tileConfig.borderRadius}`}
      style={{
        aspectRatio: tileConfig.aspectRatio,
        backgroundColor,
        backgroundImage: patternStyle
      }}
      role="presentation"
      aria-hidden="true"
    />
  )
}

// ============================================================================
// Icon Filler Tile
// ============================================================================

interface IconFillerTileProps {
  icon?: string
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
 * Icon-based filler tile with centered icon
 */
function IconFillerTile({ icon, tileConfig, themeColors }: IconFillerTileProps) {
  const backgroundColor = themeColors?.background || '#f9fafb'
  const iconColor = themeColors?.accent || '#d1d5db'

  return (
    <div
      className={`filler-tile ${tileConfig.borderRadius} flex items-center justify-center`}
      style={{
        aspectRatio: tileConfig.aspectRatio,
        backgroundColor
      }}
      role="presentation"
      aria-hidden="true"
    >
      {/* Icon rendering - using simple SVG shapes for now */}
      <IconSVG icon={icon} color={iconColor} />
    </div>
  )
}

// ============================================================================
// Helper Components
// ============================================================================

interface IconSVGProps {
  icon?: string
  color: string
}

/**
 * Render SVG icon based on icon identifier
 */
function IconSVG({ icon, color }: IconSVGProps) {
  const size = 48

  switch (icon) {
    case 'utensils':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
      )

    case 'coffee':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
          <line x1="6" y1="2" x2="6" y2="4" />
          <line x1="10" y1="2" x2="10" y2="4" />
          <line x1="14" y1="2" x2="14" y2="4" />
        </svg>
      )

    case 'chef-hat':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
          <line x1="6" y1="17" x2="18" y2="17" />
        </svg>
      )

    case 'star':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )

    default:
      // Default: simple circle
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get CSS background pattern style
 */
function getPatternStyle(pattern: string | undefined, color: string): string {
  switch (pattern) {
    case 'dots':
      return `radial-gradient(circle, ${color} 1px, transparent 1px)`

    case 'grid':
      return `
        linear-gradient(${color} 1px, transparent 1px),
        linear-gradient(90deg, ${color} 1px, transparent 1px)
      `

    case 'diagonal':
      return `repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        ${color} 10px,
        ${color} 11px
      )`

    case 'waves':
      return `repeating-linear-gradient(
        0deg,
        transparent,
        transparent 8px,
        ${color} 8px,
        ${color} 9px
      )`

    default:
      // Default: subtle dots
      return `radial-gradient(circle, ${color} 1px, transparent 1px)`
  }
}

/**
 * Get random filler style for variety
 * Can be used to add visual interest to multiple filler tiles
 */
export function getRandomFillerStyle(): FillerTileType['style'] {
  const styles: FillerTileType['style'][] = ['color', 'pattern', 'icon']
  return styles[Math.floor(Math.random() * styles.length)]
}

/**
 * Get random icon identifier
 */
export function getRandomIcon(): string {
  const icons = ['utensils', 'coffee', 'chef-hat', 'star']
  return icons[Math.floor(Math.random() * icons.length)]
}

/**
 * Get random pattern identifier
 */
export function getRandomPattern(): string {
  const patterns = ['dots', 'grid', 'diagonal', 'waves']
  return patterns[Math.floor(Math.random() * patterns.length)]
}
