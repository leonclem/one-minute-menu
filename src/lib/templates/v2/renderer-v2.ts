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
  TileStyleV2,
  TextBlockContentV2,
  FooterInfoContentV2,
  FeatureCardContentV2,
  DividerContentV2
} from './engine-types-v2'
import { formatCurrency } from '../../currency-formatter'

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
  /** Pre-fetched data URL for texture (used in export mode to avoid relative path issues) */
  textureDataURL?: string
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
  },
  {
    id: 'warm-earth',
    name: 'Warm Earth',
    colors: {
      background: '#F5F0E8',
      menuTitle: '#3E2C1C',
      sectionHeader: '#3E2C1C',
      itemTitle: '#3E2C1C',
      itemPrice: '#8B6914',
      itemDescription: '#6B5B4E',
      itemIndicators: {
        background: '#F5F0E8'
      },
      border: {
        light: '#E0D5C4',
        medium: '#C9BAA3'
      },
      textMuted: '#9A8B7A'
    }
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    colors: {
      background: '#F0F5F8',
      menuTitle: '#1B3A4B',
      sectionHeader: '#1B3A4B',
      itemTitle: '#1B3A4B',
      itemPrice: '#2E6B8A',
      itemDescription: '#5A7A8A',
      itemIndicators: {
        background: '#F0F5F8'
      },
      border: {
        light: '#D0DEE6',
        medium: '#B3C8D4'
      },
      textMuted: '#8A9FAB'
    }
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    colors: {
      background: '#F2F5F0',
      menuTitle: '#1C3318',
      sectionHeader: '#1C3318',
      itemTitle: '#1C3318',
      itemPrice: '#2D5A27',
      itemDescription: '#4E6B4A',
      itemIndicators: {
        background: '#F2F5F0'
      },
      border: {
        light: '#D4DED0',
        medium: '#B8C9B3'
      },
      textMuted: '#7E9478'
    }
  },
  {
    id: 'valentines-rose',
    name: 'Blush Rose',
    colors: {
      background: '#FFF0F3',
      menuTitle: '#8B1A4A',
      sectionHeader: '#8B1A4A',
      itemTitle: '#4A0E2B',
      itemPrice: '#C2185B',
      itemDescription: '#7A5060',
      itemIndicators: {
        background: '#FFF0F3'
      },
      border: {
        light: '#F5D0DA',
        medium: '#E8A8BA'
      },
      textMuted: '#B08090'
    }
  },
  {
    id: 'lunar-red-gold',
    name: 'Lunar Red & Gold',
    colors: {
      background: '#2B0A0A',
      menuTitle: '#D4A017',
      sectionHeader: '#D4A017',
      itemTitle: '#F5E6C8',
      itemPrice: '#D4A017',
      itemDescription: '#C4A882',
      itemIndicators: {
        background: '#2B0A0A'
      },
      border: {
        light: '#5C1A1A',
        medium: '#7A2E2E'
      },
      textMuted: '#8A6A5A'
    }
  }
]

export const DEFAULT_PALETTE_V2 = PALETTES_V2.find(p => p.id === 'midnight-gold')!

// ============================================================================
// Texture Registry
// ============================================================================

/** Configuration for a palette's background texture */
export interface TextureConfig {
  paletteId: string
  webCss: (textureUrl: string) => Record<string, string>
  webCssExport: (textureUrl: string) => Record<string, string>
  pdfTextureFile: string
  backgroundColor: string
}

/** Registry mapping palette IDs to their texture configurations */
export const TEXTURE_REGISTRY = new Map<string, TextureConfig>([
  ['midnight-gold', {
    paletteId: 'midnight-gold',
    webCss: (url: string) => ({
      backgroundColor: '#1A1A1A',
      backgroundImage: `linear-gradient(135deg, rgba(212, 175, 55, 0.03) 0%, transparent 50%, rgba(212, 175, 55, 0.02) 100%), url('${url}')`,
      backgroundSize: '100% 100%, cover',
      backgroundRepeat: 'no-repeat, no-repeat',
      backgroundPosition: 'center, center',
      backgroundBlendMode: 'overlay, normal',
    }),
    webCssExport: (url: string) => ({
      backgroundColor: '#1A1A1A',
      backgroundImage: `url('${url}')`,
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center, center',
      backgroundBlendMode: 'normal',
    }),
    pdfTextureFile: 'dark-paper-2.png',
    backgroundColor: '#1A1A1A',
  }],
  ['elegant-dark', {
    paletteId: 'elegant-dark',
    webCss: (url: string) => ({
      backgroundColor: '#0b0d11',
      backgroundImage: `url('${url}')`,
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
    }),
    webCssExport: (url: string) => ({
      backgroundColor: '#0b0d11',
      backgroundImage: `url('${url}')`,
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
    }),
    pdfTextureFile: 'dark-paper.png',
    backgroundColor: '#0b0d11',
  }],
  ['lunar-red-gold', {
    paletteId: 'lunar-red-gold',
    webCss: (url: string) => ({
      backgroundColor: '#2B0A0A',
      backgroundImage: `linear-gradient(135deg, rgba(212, 160, 23, 0.04) 0%, transparent 50%, rgba(212, 160, 23, 0.03) 100%), url('${url}')`,
      backgroundSize: '100% 100%, cover',
      backgroundRepeat: 'no-repeat, no-repeat',
      backgroundPosition: 'center, center',
      backgroundBlendMode: 'overlay, normal',
    }),
    webCssExport: (url: string) => ({
      backgroundColor: '#2B0A0A',
      backgroundImage: `url('${url}')`,
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center, center',
      backgroundBlendMode: 'normal',
    }),
    pdfTextureFile: 'dark-paper-2.png',
    backgroundColor: '#2B0A0A',
  }],
])

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
    
    case 'FEATURE_CARD':
      return renderFeatureCardContent(content as FeatureCardContentV2, tile, options)
    
    case 'FILLER':
      return renderFillerContent(content as FillerContentV2, tile, options)
    
    case 'TEXT_BLOCK':
      return renderTextBlockContent(content as TextBlockContentV2, tile, options)
    
    case 'FOOTER_INFO':
      return renderFooterInfoContent(content as FooterInfoContentV2, tile, options)
    
    case 'DECORATIVE_DIVIDER':
      return renderDividerContent(content as DividerContentV2, tile, options)
    
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
        objectPosition: 'center',
        backgroundColor: 'transparent'
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
  const textAlign = 'center' // Always center section headers for consistency
  const lineHeight = tileStyle?.typography?.lineHeight || 'normal'
  
  // Apply spacing styling - center horizontally
  const paddingLeft = 0 // No left padding when centered
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
  
  // Add text element - centered horizontally
  const textWidth = tile.width
  const textX = 0 // Full width, centered via textAlign
  elements.push({
    type: 'text',
    x: textX,
    y: paddingTop || tile.height / 2,
    width: textWidth,
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
    const imageWidth = tile.width - (padding * 2)
    
    // Compute how much vertical space text elements need below the image.
    // This mirrors the layout: name (2 lines) + optional desc + price + gaps.
    const nameReserve = (TYPOGRAPHY_TOKENS_V2.fontSize.xsm * baseLineHeight) * 2.0
    const descReserve = content.description
      ? (TYPOGRAPHY_TOKENS_V2.fontSize.xxs * descLineHeight * (tile.contentBudget?.descLines ?? 2)) + 4
      : 0
    const priceReserve = (TYPOGRAPHY_TOKENS_V2.fontSize.xxxs * baseLineHeight) + 4
    const textTotal = nameReserve + descReserve + priceReserve
    
    // Available height for image = tile height minus top padding, image-bottom gap, and text below
    const availableForImage = tile.height - padding - 8 - textTotal
    
    // Aim for ~4:3 aspect ratio where possible, but never exceed available space
    const ideal4by3 = imageWidth * 0.75
    const imageHeight = Math.max(40, Math.min(ideal4by3, availableForImage))
    
    const imageX = (tile.width - imageWidth) / 2 // Center horizontally
    
    if (content.imageUrl) {
      elements.push({
        type: 'image',
        x: imageX,
        y: currentY,
        width: imageWidth,
        height: imageHeight,
        content: content.imageUrl,
        style: {
          borderRadius: 4,
          objectFit: 'cover',
          objectPosition: 'center'
        }
      })
    } else {
      // Placeholder for missing image to preserve grid effect
      elements.push({
        type: 'background',
        x: imageX,
        y: currentY,
        width: imageWidth,
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
        imageX + 4,
        currentY + 4,
        imageWidth - 8,
        palette
      )
      elements.push(...indicatorElements)
    }

    currentY += imageHeight + 8
  }

  // Item name (now with more space) - centered horizontally
  const nameWidth = tile.width - (padding * 2)
  const nameFontSize = TYPOGRAPHY_TOKENS_V2.fontSize.xsm // Reduced to xsm (11pt) for better fit
  const nameMaxLines = tile.contentBudget?.nameLines ?? 3
  const nameLineHeight = nameFontSize * baseLineHeight
  const nameX = (tile.width - nameWidth) / 2 // Center horizontally

  elements.push({
    type: 'text',
    x: nameX,
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
      textAlign: 'center'
    }
  })

  // Increment Y by 2.0 lines of name height to reserve space for multi-line titles 
  // and prevent overlap with the description row below.
  currentY += (nameLineHeight * 2.0)

  // Description - centered horizontally
  if (content.description) {
    const descMaxLines = tile.contentBudget?.descLines ?? 3
    const descFontSize = TYPOGRAPHY_TOKENS_V2.fontSize.xxs // 7pt (30% reduction from 10pt)
    const descHeight = descFontSize * descLineHeight * descMaxLines
    const descWidth = tile.width - (padding * 2)
    const descX = (tile.width - descWidth) / 2 // Center horizontally
    
    elements.push({
      type: 'text',
      x: descX,
      y: currentY,
      width: descWidth,
      height: descHeight,
      content: content.description,
      style: {
        fontSize: descFontSize,
        lineHeight: descLineHeight,
        maxLines: descMaxLines,
        color: palette.colors.itemDescription,
        textAlign: 'center'
      }
    })
    // Reserve space for the full description height (3 lines) plus spacing
    currentY += descHeight + 4
  }

  // Price (positioned after description) - centered horizontally
  // Use Currency_Formatter for consistent formatting across all exports
  const currencyCode = content.currency || 'USD'
  const priceText = formatCurrency(content.price, currencyCode)
  const priceFontSize = TYPOGRAPHY_TOKENS_V2.fontSize.xxxs // 6pt (50% reduction from 12pt)
  const priceWidth = tile.width - (padding * 2)
  const priceX = (tile.width - priceWidth) / 2 // Center horizontally
  elements.push({
    type: 'text',
    x: priceX,
    y: currentY,
    width: priceWidth,
    height: priceFontSize * baseLineHeight,
    content: priceText,
    style: {
      fontSize: priceFontSize,
      fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
      lineHeight: baseLineHeight,
      maxLines: 1,
      color: palette.colors.itemPrice,
      textAlign: 'center'
    }
  })

  currentY += (priceFontSize * baseLineHeight) + 4

  // Indicators fallback (if not already rendered overlayed on image) - centered
  if (content.indicators && !(content.type === 'ITEM_CARD' && content.showImage)) {
    const indicatorWidth = tile.width - (padding * 2)
    const indicatorX = (tile.width - indicatorWidth) / 2 // Center horizontally
    const indicatorElements = renderIndicators(
      content.indicators,
      indicatorX,
      currentY,
      indicatorWidth,
      palette
    )
    elements.push(...indicatorElements)
  }

  return { elements }
}

/**
 * Render a FEATURE_CARD tile — a larger, visually distinct tile for featured menu items.
 * Uses bigger typography and more generous spacing than standard ITEM_CARD to
 * fill the multi-cell footprint (typically colSpan: 2, rowSpan: 3).
 */
function renderFeatureCardContent(
  content: FeatureCardContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = []
  const palette = getPalette(options)
  const padding = 12
  let currentY = padding

  const baseLineHeight = TYPOGRAPHY_TOKENS_V2.lineHeight.tight
  const descLineHeight = TYPOGRAPHY_TOKENS_V2.lineHeight.normal

  // Featured image (larger than standard ITEM_CARD) - centered
  if (content.showImage) {
    const imageHeight = tile.contentBudget?.imageBoxHeight ?? 100
    const imageWidth = tile.width - (padding * 2)
    const imageX = (tile.width - imageWidth) / 2 // Center horizontally
    
    if (content.imageUrl) {
      elements.push({
        type: 'image',
        x: imageX,
        y: currentY,
        width: imageWidth,
        height: imageHeight,
        content: content.imageUrl,
        style: {
          borderRadius: 6,
          objectFit: 'cover',
          objectPosition: 'center'
        }
      })
    } else {
      elements.push({
        type: 'background',
        x: imageX,
        y: currentY,
        width: imageWidth,
        height: imageHeight,
        content: '',
        style: {
          backgroundColor: palette.colors.border.light,
          borderRadius: 6
        }
      })
    }

    // Overlay indicators on the image
    if (content.indicators) {
      const indicatorElements = renderIndicators(
        content.indicators,
        imageX + 4,
        currentY + 4,
        imageWidth - 8,
        palette
      )
      elements.push(...indicatorElements)
    }

    currentY += imageHeight + 10
  }

  // Item name — larger font for featured prominence - centered
  const nameWidth = tile.width - (padding * 2)
  const nameFontSize = TYPOGRAPHY_TOKENS_V2.fontSize.sm
  const nameMaxLines = tile.contentBudget?.nameLines ?? 2
  const nameLineHeight = nameFontSize * baseLineHeight
  const nameX = (tile.width - nameWidth) / 2 // Center horizontally

  elements.push({
    type: 'text',
    x: nameX,
    y: currentY,
    width: nameWidth,
    height: nameLineHeight * nameMaxLines,
    content: content.name,
    style: {
      fontSize: nameFontSize,
      fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
      lineHeight: baseLineHeight,
      maxLines: nameMaxLines,
      color: palette.colors.itemTitle,
      textAlign: 'center'
    }
  })

  currentY += nameLineHeight * 2.0

  // Description — slightly larger than standard items - centered
  if (content.description) {
    const descMaxLines = tile.contentBudget?.descLines ?? 3
    const descFontSize = TYPOGRAPHY_TOKENS_V2.fontSize.xs
    const descHeight = descFontSize * descLineHeight * descMaxLines
    const descWidth = tile.width - (padding * 2)
    const descX = (tile.width - descWidth) / 2 // Center horizontally

    elements.push({
      type: 'text',
      x: descX,
      y: currentY,
      width: descWidth,
      height: descHeight,
      content: content.description,
      style: {
        fontSize: descFontSize,
        lineHeight: descLineHeight,
        maxLines: descMaxLines,
        color: palette.colors.itemDescription,
        textAlign: 'center'
      }
    })
    currentY += descHeight + 6
  }

  // Price — larger and bolder for featured items - centered
  const currencyCode = content.currency || 'USD'
  const priceText = formatCurrency(content.price, currencyCode)
  const priceFontSize = TYPOGRAPHY_TOKENS_V2.fontSize.xsm
  const priceWidth = tile.width - (padding * 2)
  const priceX = (tile.width - priceWidth) / 2 // Center horizontally

  elements.push({
    type: 'text',
    x: priceX,
    y: currentY,
    width: priceWidth,
    height: priceFontSize * baseLineHeight,
    content: priceText,
    style: {
      fontSize: priceFontSize,
      fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
      lineHeight: baseLineHeight,
      maxLines: 1,
      color: palette.colors.itemPrice,
      textAlign: 'center'
    }
  })

  currentY += (priceFontSize * baseLineHeight) + 6

  // Indicators fallback (if not already rendered overlayed on image) - centered
  if (content.indicators && !content.showImage) {
    const indicatorWidth = tile.width - (padding * 2)
    const indicatorX = (tile.width - indicatorWidth) / 2 // Center horizontally
    const indicatorElements = renderIndicators(
      content.indicators,
      indicatorX,
      currentY,
      indicatorWidth,
      palette
    )
    elements.push(...indicatorElements)
  }

  return { elements }
}

/**
 * Render decorative divider content.
 * Supports line, pattern, icon, and ornament styles.
 */
function renderDividerContent(
  content: DividerContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = []
  const palette = getPalette(options)
  const centerY = tile.height / 2

  switch (content.style) {
    case 'line':
      // Simple horizontal line
      elements.push({
        type: 'background',
        x: tile.width * 0.1,
        y: centerY - 0.5,
        width: tile.width * 0.8,
        height: 1,
        content: '',
        style: {
          backgroundColor: palette.colors.border.medium,
        }
      })
      break

    case 'pattern':
      // Dashed pattern line
      elements.push({
        type: 'background',
        x: tile.width * 0.05,
        y: centerY - 0.5,
        width: tile.width * 0.9,
        height: 1,
        content: '',
        style: {
          backgroundColor: palette.colors.border.light,
          opacity: 0.6,
        }
      })
      break

    case 'icon':
      // Center dot with lines on each side
      elements.push({
        type: 'background',
        x: tile.width * 0.1,
        y: centerY - 0.5,
        width: tile.width * 0.35,
        height: 1,
        content: '',
        style: { backgroundColor: palette.colors.border.light }
      })
      elements.push({
        type: 'text',
        x: tile.width * 0.45,
        y: centerY - 5,
        width: tile.width * 0.1,
        height: 10,
        content: '◆',
        style: {
          fontSize: 8,
          color: palette.colors.border.medium,
          textAlign: 'center',
        }
      })
      elements.push({
        type: 'background',
        x: tile.width * 0.55,
        y: centerY - 0.5,
        width: tile.width * 0.35,
        height: 1,
        content: '',
        style: { backgroundColor: palette.colors.border.light }
      })
      break

    case 'ornament':
      // Ornamental divider with decorative center
      elements.push({
        type: 'background',
        x: tile.width * 0.15,
        y: centerY - 0.5,
        width: tile.width * 0.3,
        height: 1,
        content: '',
        style: { backgroundColor: palette.colors.border.light }
      })
      elements.push({
        type: 'text',
        x: tile.width * 0.35,
        y: centerY - 6,
        width: tile.width * 0.3,
        height: 12,
        content: '✦  ✦  ✦',
        style: {
          fontSize: 7,
          color: palette.colors.textMuted,
          textAlign: 'center',
        }
      })
      elements.push({
        type: 'background',
        x: tile.width * 0.55,
        y: centerY - 0.5,
        width: tile.width * 0.3,
        height: 1,
        content: '',
        style: { backgroundColor: palette.colors.border.light }
      })
      break
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
  content: TextBlockContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = []
  const palette = getPalette(options)
  const padding = 8

  elements.push({
    type: 'text',
    x: padding,
    y: padding,
    width: tile.width - (padding * 2),
    height: tile.height - (padding * 2),
    content: content.text,
    style: {
      fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.base,
      fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.normal,
      color: palette.colors.itemDescription,
      textAlign: 'left'
    }
  })

  return { elements }
}

function renderFooterInfoContent(
  content: FooterInfoContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = []
  const palette = getPalette(options)
  const padding = 8
  const fontSize = TYPOGRAPHY_TOKENS_V2.fontSize.xxs
  const lineHeight = 1.4
  let currentY = padding

  const addText = (text: string, bold = false) => {
    elements.push({
      type: 'text',
      x: padding,
      y: currentY,
      width: tile.width - (padding * 2),
      content: text,
      style: {
        fontSize,
        fontWeight: bold ? TYPOGRAPHY_TOKENS_V2.fontWeight.semibold : TYPOGRAPHY_TOKENS_V2.fontWeight.normal,
        color: palette.colors.textMuted,
        textAlign: 'center',
      }
    })
    currentY += fontSize * lineHeight
  }

  if (content.address) addText(content.address)
  
  let contactLine = ''
  if (content.phone) contactLine += content.phone
  if (content.email) contactLine += (contactLine ? ' • ' : '') + content.email
  if (contactLine) addText(contactLine)

  let socialLine = ''
  if (content.socialMedia?.instagram) socialLine += `Instagram: ${content.socialMedia.instagram}`
  if (content.socialMedia?.facebook) socialLine += (socialLine ? ' • ' : '') + `Facebook: ${content.socialMedia.facebook}`
  if (content.socialMedia?.x) socialLine += (socialLine ? ' • ' : '') + `X: ${content.socialMedia.x}`
  if (content.socialMedia?.website) socialLine += (socialLine ? ' • ' : '') + content.socialMedia.website
  if (socialLine) addText(socialLine)

  return { elements }
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