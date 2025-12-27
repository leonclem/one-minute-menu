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
  DietaryIndicator,
  TileStyleV2
} from './engine-types-v2'

// ============================================================================
// Render Options Interface
// ============================================================================

export interface RenderOptionsV2 {
  /** Scale factor from points to pixels (e.g., 1.0 = 1pt = 1px) */
  scale: number
  /** Color palette to use */
  palette?: ColorPaletteV2
  /** Enable textured backgrounds for supported palettes */
  texturesEnabled?: boolean
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
// Font Sets for Template Styling
// ============================================================================

/** Font set definition for template styling */
export interface FontSetV2 {
  id: string
  name: string
  primary: string
  fallback: string
  googleFonts: string
  description: string
}

/** Predefined font sets for menu design */
export const FONT_SETS_V2: FontSetV2[] = [
  {
    id: 'modern-sans',
    name: 'Modern Sans',
    primary: 'Inter',
    fallback: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    googleFonts: 'Inter:wght@400;500;600;700',
    description: 'Clean, modern, highly readable - perfect for contemporary dining'
  },
  {
    id: 'elegant-serif',
    name: 'Elegant Serif',
    primary: 'Playfair Display',
    fallback: 'Georgia, "Times New Roman", serif',
    googleFonts: 'Playfair+Display:wght@400;500;600;700',
    description: 'Sophisticated, upscale, editorial - ideal for fine dining'
  },
  {
    id: 'friendly-rounded',
    name: 'Friendly Rounded',
    primary: 'Nunito Sans',
    fallback: 'system-ui, -apple-system, sans-serif',
    googleFonts: 'Nunito+Sans:wght@400;500;600;700',
    description: 'Approachable, warm, friendly - great for cafes and family restaurants'
  },
  {
    id: 'classic-professional',
    name: 'Classic Professional',
    primary: 'Source Sans Pro',
    fallback: 'system-ui, -apple-system, sans-serif',
    googleFonts: 'Source+Sans+Pro:wght@400;500;600;700',
    description: 'Professional, trustworthy, versatile - perfect for business dining'
  },
  {
    id: 'distinctive-sans',
    name: 'Distinctive Sans',
    primary: 'Poppins',
    fallback: 'system-ui, -apple-system, sans-serif',
    googleFonts: 'Poppins:wght@400;500;600;700',
    description: 'Modern, geometric, distinctive - ideal for trendy establishments'
  }
]

export const DEFAULT_FONT_SET_V2 = FONT_SETS_V2[0] // modern-sans

/** Get font set by ID */
export function getFontSet(fontSetId: string): FontSetV2 {
  return FONT_SETS_V2.find(set => set.id === fontSetId) || DEFAULT_FONT_SET_V2
}

/** Get font family string for a font set */
export function getFontFamily(fontSetId: string): string {
  const fontSet = getFontSet(fontSetId)
  return `"${fontSet.primary}", ${fontSet.fallback}`
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

/** Font size type for template styling */
export type FontSizeV2 = keyof typeof TYPOGRAPHY_TOKENS_V2.fontSize

/** Font weight type for template styling */
export type FontWeightV2 = keyof typeof TYPOGRAPHY_TOKENS_V2.fontWeight

/** Text alignment type for template styling */
export type TextAlignV2 = 'left' | 'center' | 'right'

/** Line height type for template styling */
export type LineHeightV2 = keyof typeof TYPOGRAPHY_TOKENS_V2.lineHeight

// ============================================================================
// Color Tokens and Palettes (Shared between Web and PDF)
// ============================================================================

/** Color palette definition for V2 */
export interface ColorPaletteV2 {
  id: string
  name: string
  colors: {
    background: string
    menuTitle: string
    sectionHeader: string
    itemTitle: string
    itemPrice: string
    itemDescription: string
    itemIndicators: {
      background: string
    }
    border: {
      light: string
      medium: string
    }
    textMuted: string
  }
}

/** Standard Color Tokens (Legacy/Default) */
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

/** Predefined Color Palettes */
export const PALETTES_V2: ColorPaletteV2[] = [
  {
    id: 'clean-modern',
    name: 'Clean Modern',
    colors: {
      background: '#FFFFFF',
      menuTitle: '#111827',
      sectionHeader: '#111827',
      itemTitle: '#111827',
      itemPrice: '#111827',
      itemDescription: '#6B7280',
      itemIndicators: {
        background: '#FFFFFF'
      },
      border: {
        light: '#E5E7EB',
        medium: '#D1D5DB'
      },
      textMuted: '#9CA3AF'
    }
  },
  {
    id: 'elegant-cream',
    name: 'Elegant Cream',
    colors: {
      background: '#FDFCF0', // Warm cream
      menuTitle: '#2C2C2C',
      sectionHeader: '#2C2C2C',
      itemTitle: '#2C2C2C',
      itemPrice: '#8B6B23', // Muted gold/bronze
      itemDescription: '#555555',
      itemIndicators: {
        background: '#FDFCF0'
      },
      border: {
        light: '#E8E4C9',
        medium: '#D4CFA3'
      },
      textMuted: '#8E8E8E'
    }
  },
  {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    colors: {
      background: '#1A1A1A', // Dark charcoal
      menuTitle: '#D4AF37', // Gold
      sectionHeader: '#D4AF37',
      itemTitle: '#FFFFFF',
      itemPrice: '#D4AF37',
      itemDescription: '#A0A0A0',
      itemIndicators: {
        background: '#1A1A1A'
      },
      border: {
        light: '#333333',
        medium: '#444444'
      },
      textMuted: '#666666'
    }
  }
]

export const DEFAULT_PALETTE_V2 = PALETTES_V2[0]

// ============================================================================
// Shared Rendering Primitives
// ============================================================================

/** Get active color palette from options or default */
function getPalette(options: RenderOptionsV2): ColorPaletteV2 {
  return options.palette || DEFAULT_PALETTE_V2
}

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
  fontFamily?: string
  lineHeight?: number
  maxLines?: number
  color?: string
  backgroundColor?: string
  textAlign?: 'left' | 'center' | 'right'
  opacity?: number
  borderRadius?: number
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  objectPosition?: string
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
  const palette = getPalette(options)

  if (content.imageUrl) {
    elements.push({
      type: 'image',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: content.imageUrl,
      style: {
        objectFit: 'contain',
        objectPosition: 'center'
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
        color: palette.colors.menuTitle,
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
  const palette = getPalette(options)
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
        color: palette.colors.menuTitle,
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
  const palette = getPalette(options)
  const elements: RenderElement[] = []
  
  // Get tile styling from template (passed through tile.style)
  const tileStyle = (tile as any).style as TileStyleV2 | undefined
  
  // Apply typography styling
  const fontSet = tileStyle?.typography?.fontSet || 'modern-sans'
  const fontSize = tileStyle?.typography?.fontSize || '2xl'
  const fontWeight = tileStyle?.typography?.fontWeight || 'semibold'
  const textAlign = tileStyle?.typography?.textAlign || 'left'
  const lineHeight = tileStyle?.typography?.lineHeight || 'normal'
  
  // Apply spacing styling
  const paddingLeft = tileStyle?.spacing?.paddingLeft || 8
  const paddingTop = tileStyle?.spacing?.paddingTop || 0
  
  // Get font family from font set
  const fontFamily = getFontFamily(fontSet)
  
  // Add background if specified
  if (tileStyle?.background?.color) {
    elements.push({
      type: 'background',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: '',
      style: {
        backgroundColor: tileStyle.background.color,
        borderRadius: tileStyle.background.borderRadius || 0
      }
    })
  }
  
  // Add borders if specified
  if (tileStyle?.border?.width && tileStyle?.border?.color) {
    const borderWidth = tileStyle.border.width
    const borderColor = tileStyle.border.color
    const borderStyle = tileStyle.border.style || 'solid'
    const sides = tileStyle.border.sides || ['top', 'bottom', 'left', 'right']
    
    // Create border elements for each specified side
    sides.forEach((side: string) => {
      let borderElement: RenderElement
      
      switch (side) {
        case 'top':
          borderElement = {
            type: 'background',
            x: 0,
            y: 0,
            width: tile.width,
            height: borderWidth,
            content: '',
            style: { backgroundColor: borderColor }
          }
          break
        case 'bottom':
          borderElement = {
            type: 'background',
            x: 0,
            y: tile.height - borderWidth,
            width: tile.width,
            height: borderWidth,
            content: '',
            style: { backgroundColor: borderColor }
          }
          break
        case 'left':
          borderElement = {
            type: 'background',
            x: 0,
            y: 0,
            width: borderWidth,
            height: tile.height,
            content: '',
            style: { backgroundColor: borderColor }
          }
          break
        case 'right':
          borderElement = {
            type: 'background',
            x: tile.width - borderWidth,
            y: 0,
            width: borderWidth,
            height: tile.height,
            content: '',
            style: { backgroundColor: borderColor }
          }
          break
        default:
          // Skip unknown sides
          return
      }
      
      elements.push(borderElement)
    })
  }
  
  // Add text element
  elements.push({
    type: 'text',
    x: paddingLeft,
    y: paddingTop || tile.height / 2,
    content: content.label,
    style: {
      fontSize: TYPOGRAPHY_TOKENS_V2.fontSize[fontSize as FontSizeV2] || TYPOGRAPHY_TOKENS_V2.fontSize['2xl'],
      fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight[fontWeight as FontWeightV2] || TYPOGRAPHY_TOKENS_V2.fontWeight.semibold,
      lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight[lineHeight as LineHeightV2] || TYPOGRAPHY_TOKENS_V2.lineHeight.normal,
      color: palette.colors.sectionHeader,
      textAlign: textAlign as TextAlignV2,
      fontFamily
    }
  })

  return { elements }
}

function renderItemContent(
  content: ItemContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = []
  const palette = getPalette(options)
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
          borderRadius: 4,
          objectFit: 'cover'
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
          backgroundColor: palette.colors.border.light,
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
        tile.width - (padding * 2) - 8,
        palette
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
      color: palette.colors.itemTitle,
      textAlign: 'left'
    }
  })

  // Increment Y by 2.0 lines of name height to reserve space for multi-line titles 
  // and prevent overlap with the description row below.
  currentY += (nameLineHeight * 2.0)

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
        color: palette.colors.itemDescription,
        textAlign: 'left'
      }
    })
    // Reserve space for the full description height (3 lines) plus spacing
    currentY += descHeight + 4
  }

  // Price (positioned after description)
  const priceText = `£${content.price.toFixed(2)}`
  const priceFontSize = TYPOGRAPHY_TOKENS_V2.fontSize.xxxs // 6pt (50% reduction from 12pt)
  elements.push({
    type: 'text',
    x: padding,
    y: currentY,
    width: tile.width - (padding * 2),
    height: priceFontSize * baseLineHeight,
    content: priceText,
    style: {
      fontSize: priceFontSize,
      fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
      lineHeight: baseLineHeight,
      maxLines: 1,
      color: palette.colors.itemPrice,
      textAlign: 'left'
    }
  })

  currentY += (priceFontSize * baseLineHeight) + 4

  // Indicators fallback (if not already rendered overlayed on image)
  if (content.indicators && !(content.type === 'ITEM_CARD' && content.showImage)) {
    const indicatorElements = renderIndicators(
      content.indicators,
      padding,
      currentY,
      tile.width - (padding * 2),
      palette
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
  const palette = getPalette(options)

  // Simple background filler for MVP
  elements.push({
    type: 'background',
    x: 0,
    y: 0,
    width: tile.width,
    height: tile.height,
    content: '',
    style: {
      backgroundColor: palette.colors.border.light,
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
        color: palette.colors.textMuted,
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
  const palette = getPalette(options)
  // Placeholder for future TEXT_BLOCK implementation
  return {
    elements: [{
      type: 'text',
      x: 8,
      y: tile.height / 2,
      content: content.text || 'Text Block',
      style: {
        fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.base,
        color: palette.colors.itemTitle,
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
  maxWidth: number,
  palette: ColorPaletteV2
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
        backgroundColor: palette.colors.itemIndicators.background,
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