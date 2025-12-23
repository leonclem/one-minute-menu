/**
 * V2 Layout Renderer - Shared Rendering Primitives
 * 
 * This module provides shared rendering utilities and interfaces for both
 * web preview and PDF export of LayoutDocumentV2 outputs.
 * 
 * Key Design Decisions:
 * - Coordinates are content-box relative (margins applied once at wrapper level)
 * - Typography tokens shared between web and PDF for consistency
 * - Scale factor is deterministic (points to CSS pixels)
 */

import type { 
  LayoutDocumentV2, 
  TileInstanceV2, 
  TileContentV2,
  ItemContentV2,
  SectionHeaderContentV2,
  LogoContentV2,
  TitleContentV2,
  FillerContentV2,
  ItemIndicatorsV2,
  DietaryIndicator
} from './engine-types-v2'

// ============================================================================
// Render Options Interface
// ============================================================================

export interface RenderOptionsV2 {
  /** Scale factor from points to pixels (e.g., 1.0 = 1pt = 1px) */
  scale: number
  /** Show grid overlay for debugging */
  showGridOverlay: boolean
  /** Show region boundary rectangles */
  showRegionBounds: boolean
  /** Show tile IDs and coordinates */
  showTileIds: boolean
  /** Show debug information */
  showDebugInfo?: boolean
  /** Whether we are rendering for export (PDF/Image) */
  isExport?: boolean
}

// ============================================================================
// Typography Tokens (Shared between Web and PDF)
// ============================================================================

export const TYPOGRAPHY_TOKENS_V2 = {
  fontFamily: {
    primary: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fallback: 'Arial, sans-serif'
  },
  fontSize: {
    xxxs: 6,   // 6pt
    xxs: 7,    // 7pt
    xs: 10,    // 10pt
    xsm: 9,    // 9pt (Reduced from 11pt)
    sm: 12,    // 12pt
    base: 14,  // 14pt
    lg: 16,    // 16pt
    xl: 18,    // 18pt
    '2xl': 20, // 20pt
    '3xl': 24, // 24pt
    '4xl': 28  // 28pt
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6
  }
} as const

// ============================================================================
// Color Tokens (Shared between Web and PDF)
// ============================================================================

export const COLOR_TOKENS_V2 = {
  text: {
    primary: '#111827',    // gray-900
    secondary: '#6B7280',  // gray-500
    muted: '#9CA3AF'       // gray-400
  },
  background: {
    white: '#FFFFFF',
    gray50: '#F9FAFB',
    gray100: '#F3F4F6'
  },
  border: {
    light: '#E5E7EB',      // gray-200
    medium: '#D1D5DB'      // gray-300
  },
  indicator: {
    vegetarian: '#10B981', // emerald-500
    vegan: '#059669',      // emerald-600
    halal: '#3B82F6',      // blue-500
    kosher: '#6366F1',     // indigo-500
    glutenFree: '#F59E0B', // amber-500
    spice: '#EF4444'       // red-500
  }
} as const

// ============================================================================
// Shared Rendering Primitives
// ============================================================================

/**
 * Render tile content based on tile type and content
 * This function provides the core content rendering logic shared between
 * web and PDF renderers.
 */
export function renderTileContent(
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const { content, type } = tile

  switch (type) {
    case 'LOGO':
      return renderLogoContent(content as LogoContentV2, tile, options)
    
    case 'TITLE':
      return renderTitleContent(content as TitleContentV2, tile, options)
    
    case 'SECTION_HEADER':
      return renderSectionHeaderContent(content as SectionHeaderContentV2, tile, options)
    
    case 'ITEM_CARD':
    case 'ITEM_TEXT_ROW':
      return renderItemContent(content as ItemContentV2, tile, options)
    
    case 'FILLER':
      return renderFillerContent(content as FillerContentV2, tile, options)
    
    case 'TEXT_BLOCK':
      return renderTextBlockContent(content as any, tile, options)
    
    default:
      return {
        elements: [],
        debugInfo: `Unknown tile type: ${type}`
      }
  }
}

// ============================================================================
// Tile Content Render Data Interface
// ============================================================================

export interface TileRenderData {
  elements: RenderElement[]
  debugInfo?: string
}

export interface RenderElement {
  type: 'text' | 'image' | 'indicator' | 'background'
  x: number
  y: number
  width?: number
  height?: number
  content: string
  style: RenderStyle
}

export interface RenderStyle {
  fontSize?: number
  fontWeight?: number
  lineHeight?: number
  maxLines?: number
  color?: string
  backgroundColor?: string
  textAlign?: 'left' | 'center' | 'right'
  opacity?: number
  borderRadius?: number
}

// ============================================================================
// Content Rendering Functions
// ============================================================================

function renderLogoContent(
  content: LogoContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = []

  if (content.imageUrl) {
    elements.push({
      type: 'image',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: content.imageUrl,
      style: {
        backgroundColor: COLOR_TOKENS_V2.background.white
      }
    })
  } else {
    // Fallback text logo
    elements.push({
      type: 'text',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: content.venueName || 'Logo',
      style: {
        fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xl,
        fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
        color: COLOR_TOKENS_V2.text.primary,
        textAlign: 'center'
      }
    })
  }

  return { elements }
}

function renderTitleContent(
  content: TitleContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = [
    {
      type: 'text',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: content.menuName,
      style: {
        fontSize: TYPOGRAPHY_TOKENS_V2.fontSize['3xl'],
        fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
        color: COLOR_TOKENS_V2.text.primary,
        textAlign: 'center'
      }
    }
  ]

  return { elements }
}

function renderSectionHeaderContent(
  content: SectionHeaderContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = [
    // Background frame
    {
      type: 'background',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: '',
      style: {
        backgroundColor: COLOR_TOKENS_V2.background.gray50,
        borderRadius: 4
      }
    },
    {
      type: 'text',
      x: 8, // Left padding
      y: tile.height / 2,
      content: content.label,
      style: {
        fontSize: TYPOGRAPHY_TOKENS_V2.fontSize['2xl'],
        fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.semibold,
        color: COLOR_TOKENS_V2.text.primary,
        textAlign: 'left'
      }
    }
  ]

  return { elements }
}

function renderItemContent(
  content: ItemContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = []
  const padding = 8
  let currentY = padding

  const baseLineHeight = TYPOGRAPHY_TOKENS_V2.lineHeight.tight
  const descLineHeight = TYPOGRAPHY_TOKENS_V2.lineHeight.normal

  // Item image (for ITEM_CARD)
  if (content.type === 'ITEM_CARD' && content.showImage) {
    const imageHeight = 60 // Reduced from 70 to give more space for description
    if (content.imageUrl) {
      elements.push({
        type: 'image',
        x: padding,
        y: currentY,
        width: tile.width - (padding * 2),
        height: imageHeight,
        content: content.imageUrl,
        style: {
          borderRadius: 4
        }
      })
    } else {
      // Placeholder for missing image to preserve grid effect
      elements.push({
        type: 'background',
        x: padding,
        y: currentY,
        width: tile.width - (padding * 2),
        height: imageHeight,
        content: '',
        style: {
          backgroundColor: COLOR_TOKENS_V2.background.gray100,
          borderRadius: 4
        }
      })
    }

    // Overlay indicators on the image
    if (content.indicators) {
      const indicatorElements = renderIndicators(
        content.indicators,
        padding + 4,
        currentY + 4,
        tile.width - (padding * 2) - 8
      )
      elements.push(...indicatorElements)
    }

    currentY += imageHeight + 8
  }

  // Item name (now with more space)
  const nameWidth = tile.width - (padding * 2)
  const nameFontSize = TYPOGRAPHY_TOKENS_V2.fontSize.xsm // Reduced to xsm (11pt) for better fit
  const nameMaxLines = 3 // Still allow 3 lines for very long names
  const nameLineHeight = nameFontSize * baseLineHeight

  elements.push({
    type: 'text',
    x: padding,
    y: currentY,
    width: nameWidth,
    height: nameLineHeight * nameMaxLines,
    content: content.name,
    style: {
      fontSize: nameFontSize,
      fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.semibold,
      lineHeight: baseLineHeight,
      maxLines: nameMaxLines,
      color: COLOR_TOKENS_V2.text.primary,
      textAlign: 'left'
    }
  })

  // Increment Y by 2.0 lines of name height to reserve space for multi-line titles 
  // and prevent overlap with the price row below.
  currentY += (nameLineHeight * 2.0)

  // Price (on its own row below name)
  const priceText = `£${content.price.toFixed(2)}`
  const priceFontSize = TYPOGRAPHY_TOKENS_V2.fontSize.xxxs // 6pt (50% reduction from 12pt)
  elements.push({
    type: 'text',
    x: padding,
    y: currentY,
    width: 60,
    height: priceFontSize * baseLineHeight,
    content: priceText,
    style: {
      fontSize: priceFontSize,
      fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
      lineHeight: baseLineHeight,
      maxLines: 1,
      color: COLOR_TOKENS_V2.text.primary,
      textAlign: 'left'
    }
  })

  currentY += (priceFontSize * baseLineHeight) + 4

  // Description
  if (content.description) {
    const descMaxLines = 3
    const descFontSize = TYPOGRAPHY_TOKENS_V2.fontSize.xxs // 7pt (30% reduction from 10pt)
    const descHeight = descFontSize * descLineHeight * descMaxLines
    
    elements.push({
      type: 'text',
      x: padding,
      y: currentY,
      width: tile.width - (padding * 2),
      height: descHeight,
      content: content.description,
      style: {
        fontSize: descFontSize,
        lineHeight: descLineHeight,
        maxLines: descMaxLines,
        color: COLOR_TOKENS_V2.text.secondary,
        textAlign: 'left'
      }
    })
    currentY += (descFontSize * descLineHeight * 2) + 4
  }

  // Indicators fallback (if not already rendered overlayed on image)
  if (content.indicators && !(content.type === 'ITEM_CARD' && content.showImage)) {
    const indicatorElements = renderIndicators(
      content.indicators,
      padding,
      currentY,
      tile.width - (padding * 2)
    )
    elements.push(...indicatorElements)
  }

  return { elements }
}

function renderFillerContent(
  content: FillerContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = []

  // Simple background filler for MVP
  elements.push({
    type: 'background',
    x: 0,
    y: 0,
    width: tile.width,
    height: tile.height,
    content: '',
    style: {
      backgroundColor: COLOR_TOKENS_V2.background.gray100,
      opacity: 0.7,
      borderRadius: 4
    }
  })

  // Optional icon or pattern based on filler style
  if (content.style === 'icon' && content.content) {
    elements.push({
      type: 'text',
      x: tile.width / 2,
      y: tile.height / 2,
      content: getFillerIcon(content.content),
      style: {
        fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xl,
        color: COLOR_TOKENS_V2.text.muted,
        textAlign: 'center',
        opacity: 0.5
      }
    })
  }

  return { elements }
}

function renderTextBlockContent(
  content: any,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  // Placeholder for future TEXT_BLOCK implementation
  return {
    elements: [{
      type: 'text',
      x: 8,
      y: tile.height / 2,
      content: content.text || 'Text Block',
      style: {
        fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.base,
        color: COLOR_TOKENS_V2.text.primary,
        textAlign: 'left'
      }
    }]
  }
}

// ============================================================================
// Indicator Rendering
// ============================================================================

function renderIndicators(
  indicators: ItemIndicatorsV2,
  x: number,
  y: number,
  maxWidth: number
): RenderElement[] {
  const elements: RenderElement[] = []
  let currentX = x
  const indicatorSize = 14
  const spacing = 4

  // Dietary indicators
  for (const dietary of indicators.dietary) {
    if (currentX + indicatorSize > x + maxWidth) break

    elements.push({
      type: 'indicator',
      x: currentX,
      y: y,
      width: indicatorSize,
      height: indicatorSize,
      content: getDietaryIcon(dietary),
      style: {
        fontSize: indicatorSize,
        maxLines: 1,
        color: getDietaryColor(dietary),
        backgroundColor: COLOR_TOKENS_V2.background.white,
        borderRadius: 2
      }
    })

    currentX += indicatorSize + spacing
  }

  // Spice level
  if (indicators.spiceLevel && indicators.spiceLevel > 0) {
    const spiceIcon = '🌶'.repeat(Math.min(indicators.spiceLevel, 3))
    if (currentX + (indicatorSize * spiceIcon.length) <= x + maxWidth) {
      elements.push({
        type: 'indicator',
        x: currentX,
        y: y,
        width: indicatorSize * spiceIcon.length,
        height: indicatorSize,
        content: spiceIcon,
        style: {
          fontSize: indicatorSize,
          maxLines: 1,
          color: COLOR_TOKENS_V2.indicator.spice
        }
      })
    }
  }

  return elements
}

function getDietaryIcon(dietary: DietaryIndicator): string {
  const icons: Record<DietaryIndicator, string> = {
    vegetarian: '🥬',
    vegan: '🌱',
    halal: '☪️',
    kosher: '✡️',
    'gluten-free': '🌾'
  }
  return icons[dietary] || 'V'
}

function getDietaryColor(dietary: DietaryIndicator): string {
  const colors: Record<DietaryIndicator, string> = {
    vegetarian: COLOR_TOKENS_V2.indicator.vegetarian,
    vegan: COLOR_TOKENS_V2.indicator.vegan,
    halal: COLOR_TOKENS_V2.indicator.halal,
    kosher: COLOR_TOKENS_V2.indicator.kosher,
    'gluten-free': COLOR_TOKENS_V2.indicator.glutenFree
  }
  return colors[dietary] || COLOR_TOKENS_V2.text.primary
}

function getFillerIcon(iconName: string): string {
  const icons: Record<string, string> = {
    utensils: '🍴',
    coffee: '☕',
    wine: '🍷',
    leaf: '🍃',
    star: '⭐',
    heart: '❤️'
  }
  return icons[iconName] || '●'
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate absolute position from content-box relative coordinates
 * Absolute position = pageMargins + region.y + tile.y
 */
export function calculateAbsolutePosition(
  tileX: number,
  tileY: number,
  regionY: number,
  pageMargins: { top: number; left: number }
): { x: number; y: number } {
  return {
    x: pageMargins.left + tileX,  // region.x is always 0 (content-box relative)
    y: pageMargins.top + regionY + tileY
  }
}

/**
 * Clamp text to fit within specified dimensions
 * Used for text truncation with ellipsis
 */
export function clampText(
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number = 1
): string {
  // Simplified text clamping - in real implementation would measure actual text width
  const avgCharWidth = fontSize * 0.6
  const charsPerLine = Math.floor(maxWidth / avgCharWidth)
  const maxChars = charsPerLine * maxLines

  if (text.length <= maxChars) {
    return text
  }

  return text.substring(0, maxChars - 3) + '...'
}

/**
 * Generate deterministic scale factor for consistent rendering
 */
export function getDefaultScale(): number {
  // 1 point = 1 pixel for web preview
  // This ensures consistent sizing between web and PDF
  return 1.0
}