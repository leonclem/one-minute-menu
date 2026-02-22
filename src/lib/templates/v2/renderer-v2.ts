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
  TypographyStyleV2,
  SubElementTypographyV2,
  TextBlockContentV2,
  FooterInfoContentV2,
  FeatureCardContentV2,
  DividerContentV2,
  ImageModeV2
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
  /** Optional texture ID (overrides palette-based texture when set) */
  textureId?: string
  /** Image rendering mode - defaults to 'stretch' */
  imageMode?: ImageModeV2
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
  /** Enable vignette edge effect */
  showVignette?: boolean
  /** Add very subtle borders to every menu item tile */
  itemBorders?: boolean
  /** Add drop shadow to every menu item tile */
  itemDropShadow?: boolean
  /** Fill menu item tiles with the palette background colour */
  fillItemTiles?: boolean
  /** Override filler tile rendering with this pattern ID (from FILLER_PATTERN_REGISTRY); when set, all filler tiles use this pattern */
  spacerTilePatternId?: string
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
    bold: 700,
    extrabold: 800
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6
  }
} as const

/** Spacing constants (in points) for consistent element gaps */
export const SPACING_V2 = {
  nameToDesc: 3,
  descToPrice: 6,
  afterImage: 6,
  tilePadding: 8,
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
    /** Optional surface colour for cards/item tiles; should work well with background. Falls back to background if omitted. */
    surface?: string
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
      surface: '#F9FAFB',
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
      surface: '#F5F2E8',
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
      surface: '#252525',
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
      surface: '#EDE6DC',
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
      surface: '#E8EEF2',
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
      surface: '#E8EDE5',
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
      surface: '#FCE4E9',
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
      surface: '#3d1515',
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

/** Configuration for a background texture pattern (palette-independent) */
export interface TextureConfig {
  label: string
  webCss: (textureUrl: string) => Record<string, string>
  webCssExport: (textureUrl: string) => Record<string, string>
  pdfTextureFile: string
}

// SVG data-URI textures (inline, no external files needed).
// All patterns use only vector shapes (no feTurbulence/filter) so they render reliably
// as CSS background-image in browser and PDF.
// Deterministic hash for tileable "random" patterns (same seed => same tile).
function hash2(seed: number): number {
  return ((seed * 31) ^ (seed >>> 16)) >>> 0
}
function randomDotsTile(options: {
  width: number
  height: number
  cellSize: number
  density: number
  rMin: number
  rMax: number
  opacity: number
}): string {
  const { width, height, cellSize, density, rMin, rMax, opacity } = options
  const circles: string[] = []
  for (let i = 0; i < width; i += cellSize) {
    for (let j = 0; j < height; j += cellSize) {
      const seed = (i / cellSize) * 31 + (j / cellSize) * 17
      const h = hash2(seed)
      if ((h % 100) >= density) continue
      const dx = (hash2(h + 1) % 100) / 100
      const dy = (hash2(h + 2) % 100) / 100
      const cx = i + dx * cellSize
      const cy = j + dy * cellSize
      const r = rMin + ((hash2(h + 3) % 100) / 100) * (rMax - rMin)
      circles.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="#000" opacity="${opacity.toFixed(2)}"/>`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${circles.join('')}</svg>`
}

// Subtle stripe patterns: tileable, low opacity for professionalism without distracting from content.
const stripeHorizontalSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M0 0h40v0.5H0zM0 8h40v0.5H0zM0 16h40v0.5H0zM0 24h40v0.5H0zM0 32h40v0.5H0z" fill="#000" opacity="0.05"/></svg>'
const stripeVerticalSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M0 0v40h0.5V0zM8 0v40h0.5V0zM16 0v40h0.5V0zM24 0v40h0.5V0zM32 0v40h0.5V0z" fill="#000" opacity="0.05"/></svg>'
const stripeDiagonalSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M0 0 L16 16" stroke="#000" stroke-width="0.4" opacity="0.05" fill="none"/></svg>'

const SVG_TEXTURES = {
  // Paper grain: fine random grain (formerly "Subtle Noise"); deterministic, non-uniform. Opacity here.
  paperGrain: `data:image/svg+xml,${encodeURIComponent(randomDotsTile({ width: 60, height: 60, cellSize: 3, density: 62, rMin: 0.2, rMax: 0.45, opacity: 0.10 }))}`,
  linen: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><path d="M0 0h60v1H0zM0 15h60v0.5H0zM0 30h60v1H0zM0 45h60v0.5H0z" fill="#000" opacity="0.04"/><path d="M0 0v60h1V0zM15 0v60h0.5V0zM30 0v60h1V0zM45 0v60h0.5V0z" fill="#000" opacity="0.03"/></svg>')}`,
  wave: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><path d="M0 30 Q30 10 60 30 Q90 50 120 30" fill="none" stroke="#000" stroke-width="0.5" opacity="0.04"/><path d="M0 45 Q30 25 60 45 Q90 65 120 45" fill="none" stroke="#000" stroke-width="0.5" opacity="0.03"/></svg>')}`,
  subtleDots: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60">' +
    [6, 18, 30, 42, 54].flatMap((x) => [6, 18, 30, 42, 54].map((y) =>
      `<circle cx="${x}" cy="${y}" r="0.5" fill="#000" opacity="0.09"/>`)).join('') +
    '</svg>')}`,
  stripesHorizontal: `data:image/svg+xml,${encodeURIComponent(stripeHorizontalSvg)}`,
  stripesVertical: `data:image/svg+xml,${encodeURIComponent(stripeVerticalSvg)}`,
  stripesDiagonal: `data:image/svg+xml,${encodeURIComponent(stripeDiagonalSvg)}`,
}

function svgTexturePattern(svgDataUri: string): Pick<TextureConfig, 'webCss' | 'webCssExport' | 'pdfTextureFile'> {
  return {
    webCss: () => ({
      backgroundImage: `url("${svgDataUri}")`,
      backgroundRepeat: 'repeat',
      backgroundSize: 'auto',
    }),
    webCssExport: () => ({
      backgroundImage: `url("${svgDataUri}")`,
      backgroundRepeat: 'repeat',
      backgroundSize: 'auto',
    }),
    pdfTextureFile: '',
  }
}

/**
 * Registry mapping texture pattern IDs to their configurations.
 * Textures are palette-independent overlays applied on top of the selected colour palette.
 */
export const TEXTURE_REGISTRY = new Map<string, TextureConfig>([
  ['dark-paper', {
    label: 'Dark Paper',
    webCss: (url: string) => ({
      backgroundImage: `url('${url}')`,
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
    }),
    webCssExport: (url: string) => ({
      backgroundImage: `url('${url}')`,
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
    }),
    pdfTextureFile: 'dark-paper-2.png',
  }],
  ['paper-grain', { label: 'Paper Grain', ...svgTexturePattern(SVG_TEXTURES.paperGrain) }],
  // Legacy: old "Subtle Noise" ID; same effect as Paper Grain for saved configs
  ['subtle-noise', { label: 'Paper Grain', ...svgTexturePattern(SVG_TEXTURES.paperGrain) }],
  ['stripes-horizontal', { label: 'Stripes (horizontal)', ...svgTexturePattern(SVG_TEXTURES.stripesHorizontal) }],
  ['stripes-vertical', { label: 'Stripes (vertical)', ...svgTexturePattern(SVG_TEXTURES.stripesVertical) }],
  ['stripes-diagonal', { label: 'Stripes (diagonal)', ...svgTexturePattern(SVG_TEXTURES.stripesDiagonal) }],
  ['waves', { label: 'Waves', ...svgTexturePattern(SVG_TEXTURES.wave) }],
  ['linen', { label: 'Linen', ...svgTexturePattern(SVG_TEXTURES.linen) }],
  ['subtle-dots', { label: 'Subtle Dots', ...svgTexturePattern(SVG_TEXTURES.subtleDots) }],
])

/** Ordered list of texture pattern IDs for user selection dropdowns (3. Background texture) */
export const TEXTURE_IDS: string[] = [
  'subtle-dots',
  'paper-grain',
  'stripes-horizontal',
  'stripes-vertical',
  'stripes-diagonal',
  'waves',
  'linen',
  'dark-paper',
]

// ============================================================================
// Filler (Spacer Tile) Pattern Registry
// ============================================================================

/** Configuration for a palette-adaptive spacer tile pattern */
export interface FillerPatternConfig {
  label: string
  /** Returns a tileable SVG as data URI using palette colors */
  getSvgDataUri: (palette: ColorPaletteV2) => string
}

const FILLER_PATTERN_TILE_SIZE = 64

/** Build tileable SVG data URI; optional viewBox scales pattern to tile size (e.g. "0 0 40 40"). */
function fillerSvgDataUri(svgBody: string, viewBox?: string): string {
  const vb = viewBox ? ` viewBox="${viewBox}"` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FILLER_PATTERN_TILE_SIZE}" height="${FILLER_PATTERN_TILE_SIZE}"${vb}>${svgBody}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Palette-derived fills for spacer patterns: base (lightest), light, mid. */
function fillerPalette(palette: ColorPaletteV2): { base: string; light: string; mid: string } {
  return {
    base: palette.colors.surface ?? palette.colors.border.light,
    light: palette.colors.border.light,
    mid: palette.colors.border.medium
  }
}

/** Minimalist diagonal pinstripe (40×40 tile). */
function diagonalPinstripeSvg(palette: ColorPaletteV2): string {
  const { base, light } = fillerPalette(palette)
  const body = [
    '<defs>',
    `<pattern id="diagonal-stripe" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`,
    `<rect width="20" height="40" fill="${base}"/>`,
    `<rect x="20" width="20" height="40" fill="${light}"/>`,
    '</pattern>',
    '</defs>',
    '<rect width="40" height="40" fill="url(#diagonal-stripe)"/>'
  ].join('')
  return fillerSvgDataUri(body, '0 0 40 40')
}

/** Modern Bauhaus check & circle (80×80 tile). */
function bauhausCheckSvg(palette: ColorPaletteV2): string {
  const { base, light, mid } = fillerPalette(palette)
  const body = [
    '<defs>',
    '<pattern id="circle-check" width="80" height="80" patternUnits="userSpaceOnUse">',
    `<rect width="80" height="80" fill="${base}"/>`,
    `<rect width="40" height="40" fill="${light}"/>`,
    `<rect x="40" y="40" width="40" height="40" fill="${light}"/>`,
    `<circle cx="20" cy="60" r="12" fill="${mid}"/>`,
    `<circle cx="60" cy="20" r="12" fill="${mid}"/>`,
    '</pattern>',
    '</defs>',
    '<rect width="80" height="80" fill="url(#circle-check)"/>'
  ].join('')
  return fillerSvgDataUri(body, '0 0 80 80')
}

/** Overlapping rings / scallop (60×60 tile). */
function overlappingRingsSvg(palette: ColorPaletteV2): string {
  const { base, light, mid } = fillerPalette(palette)
  const body = [
    '<defs>',
    '<pattern id="interlocking" width="60" height="60" patternUnits="userSpaceOnUse">',
    `<rect width="60" height="60" fill="${base}"/>`,
    `<circle cx="0" cy="0" r="40" fill="none" stroke="${light}" stroke-width="4"/>`,
    `<circle cx="60" cy="0" r="40" fill="none" stroke="${light}" stroke-width="4"/>`,
    `<circle cx="0" cy="60" r="40" fill="none" stroke="${light}" stroke-width="4"/>`,
    `<circle cx="60" cy="60" r="40" fill="none" stroke="${light}" stroke-width="4"/>`,
    `<circle cx="30" cy="30" r="40" fill="none" stroke="${mid}" stroke-width="4"/>`,
    '</pattern>',
    '</defs>',
    '<rect width="60" height="60" fill="url(#interlocking)"/>'
  ].join('')
  return fillerSvgDataUri(body, '0 0 60 60')
}

/** Elegant windowpane grid (30×30 tile). */
function windowpaneSvg(palette: ColorPaletteV2): string {
  const { base, light } = fillerPalette(palette)
  const body = [
    '<defs>',
    '<pattern id="windowpane" width="30" height="30" patternUnits="userSpaceOnUse">',
    `<rect width="30" height="30" fill="${base}"/>`,
    `<path d="M 30 0 L 0 0 0 30" fill="none" stroke="${light}" stroke-width="1.5"/>`,
    '</pattern>',
    '</defs>',
    '<rect width="30" height="30" fill="url(#windowpane)"/>'
  ].join('')
  return fillerSvgDataUri(body, '0 0 30 30')
}

/** Matte paper grain: subtle 8×8 micro-stipple (palette-adaptive). */
function mattePaperGrainSvg(palette: ColorPaletteV2): string {
  const { base, light } = fillerPalette(palette)
  const body = [
    '<defs>',
    '<pattern id="micro-stipple" width="8" height="8" patternUnits="userSpaceOnUse">',
    `<rect width="8" height="8" fill="${base}"/>`,
    `<circle cx="2" cy="2" r="0.75" fill="${light}"/>`,
    `<circle cx="6" cy="6" r="0.75" fill="${light}"/>`,
    '</pattern>',
    '</defs>',
    '<rect width="100%" height="100%" fill="url(#micro-stipple)"/>'
  ].join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FILLER_PATTERN_TILE_SIZE}" height="${FILLER_PATTERN_TILE_SIZE}">${body}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * Registry mapping spacer tile pattern IDs to their configurations.
 * Patterns are palette-adaptive (base + accent from active palette).
 */
export const FILLER_PATTERN_REGISTRY = new Map<string, FillerPatternConfig>([
  ['diagonal-pinstripe', { label: 'Diagonal Pinstripe', getSvgDataUri: diagonalPinstripeSvg }],
  ['bauhaus-check', { label: 'Bauhaus Check & Circle', getSvgDataUri: bauhausCheckSvg }],
  ['overlapping-rings', { label: 'Overlapping Rings', getSvgDataUri: overlappingRingsSvg }],
  ['windowpane', { label: 'Windowpane Grid', getSvgDataUri: windowpaneSvg }],
  ['matte-paper-grain', { label: 'Matte Paper Grain', getSvgDataUri: mattePaperGrainSvg }],
])

/** Ordered list of spacer tile pattern IDs for dropdowns */
export const FILLER_PATTERN_IDS = Array.from(FILLER_PATTERN_REGISTRY.keys())

/** Map palette IDs to their default texture pattern (used for legacy texturesEnabled fallback) */
export const PALETTE_TEXTURE_MAP: Record<string, string> = {
  'midnight-gold': 'dark-paper',
  'elegant-dark': 'dark-paper',
  'lunar-red-gold': 'dark-paper',
  'elegant-cream': 'paper-grain',
  'warm-earth': 'paper-grain',
  'ocean-breeze': 'waves',
  'forest-green': 'linen',
  'valentines-rose': 'subtle-dots',
  'clean-modern': 'subtle-noise',
}

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
  /** CSS background (e.g. linear-gradient for overlays) */
  background?: string
  /** Offset for repeating backgrounds so pattern aligns across tiles (region-space; applied as background-position). */
  backgroundPositionX?: number
  backgroundPositionY?: number
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  opacity?: number
  borderRadius?: number
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  objectPosition?: string
  boxShadow?: string
  textTransform?: string
  letterSpacing?: number
}

// ============================================================================
// Sub-Element Typography Resolution
// ============================================================================

interface ResolvedTypography {
  fontSize: number
  fontWeight: number
  fontFamily: string
  lineHeight: number
  textAlign: 'left' | 'center' | 'right' | 'justify'
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
}

/** Resolve sub-element typography from tile YAML style with fallback defaults */
function resolveSubElementTypography(
  tileStyle: TileStyleV2 | undefined,
  element: 'name' | 'description' | 'price' | 'label' | 'contact',
  defaults: { fontSize: number; fontWeight: number; lineHeight: number }
): ResolvedTypography {
  const typo = tileStyle?.typography
  const sub: SubElementTypographyV2 | undefined = typo?.[element]
  const fontSetId = sub?.fontSet || typo?.fontSet || 'modern-sans'
  const fontSizeToken = sub?.fontSize || undefined
  const fontWeightToken = sub?.fontWeight || undefined
  const lineHeightToken = sub?.lineHeight || undefined
  const textAlign = sub?.textAlign || typo?.textAlign || 'center'
  const textTransform = sub?.textTransform ?? typo?.textTransform

  return {
    fontSize: fontSizeToken
      ? (TYPOGRAPHY_TOKENS_V2.fontSize[fontSizeToken as FontSizeV2] ?? defaults.fontSize)
      : defaults.fontSize,
    fontWeight: fontWeightToken
      ? (TYPOGRAPHY_TOKENS_V2.fontWeight[fontWeightToken as FontWeightV2] ?? defaults.fontWeight)
      : defaults.fontWeight,
    fontFamily: getFontFamily(fontSetId),
    lineHeight: lineHeightToken
      ? (TYPOGRAPHY_TOKENS_V2.lineHeight[lineHeightToken as LineHeightV2] ?? defaults.lineHeight)
      : defaults.lineHeight,
    textAlign,
    textTransform,
  }
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
  
  // Apply textTransform from tile style
  const textTransformVal = tileStyle?.typography?.textTransform || undefined

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
      color: tileStyle?.typography?.color || palette.colors.sectionHeader,
      textAlign: textAlign as TextAlignV2,
      fontFamily,
      textTransform: textTransformVal,
      letterSpacing: textTransformVal === 'uppercase' ? 1.5 : undefined
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
  const padding = SPACING_V2.tilePadding
  let currentY = padding

  // Resolve per-sub-element typography from tile YAML style
  const tileStyle = tile.style as TileStyleV2 | undefined
  const nameTypo = resolveSubElementTypography(tileStyle, 'name', {
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xsm,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.semibold,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
  })
  const descTypo = resolveSubElementTypography(tileStyle, 'description', {
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xxs,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.normal,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.normal,
  })
  const priceTypo = resolveSubElementTypography(tileStyle, 'price', {
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xxxs,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
  })

  const isCircularMode = (options.imageMode || 'stretch') === 'compact-circle'
  const defaultImageBorderRadius = isCircularMode ? undefined : 8

  // Item image (for ITEM_CARD)
  if (content.type === 'ITEM_CARD' && content.showImage) {
    const imageMode: ImageModeV2 = options.imageMode || 'stretch'
    
    const nameReserve = (nameTypo.fontSize * nameTypo.lineHeight) * 2.0
    const descReserve = content.description
      ? (descTypo.fontSize * descTypo.lineHeight * (tile.contentBudget?.descLines ?? 2)) + SPACING_V2.nameToDesc
      : 0
    const priceReserve = (priceTypo.fontSize * priceTypo.lineHeight) + SPACING_V2.descToPrice
    const textTotal = nameReserve + descReserve + priceReserve
    
    const availableForImage = tile.height - padding - SPACING_V2.afterImage - textTotal
    
    if (imageMode === 'background') {
      if (content.imageUrl) {
        elements.push({
          type: 'image',
          x: 0,
          y: 0,
          width: tile.width,
          height: tile.height,
          content: content.imageUrl,
          style: {
            borderRadius: 0,
            objectFit: 'cover',
            objectPosition: 'center'
          }
        })
        
        elements.push({
          type: 'background',
          x: 0,
          y: 0,
          width: tile.width,
          height: tile.height,
          content: '',
          style: {
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.5) 100%)',
            borderRadius: 0
          }
        })
      }
      
      if (content.indicators) {
        const indicatorElements = renderIndicators(
          content.indicators,
          4,
          4,
          tile.width - 8,
          palette
        )
        elements.push(...indicatorElements)
      }
    } else {
      let imageWidth: number
      let imageHeight: number
      let imageX: number
      let borderRadius: number = defaultImageBorderRadius ?? 8
      
      if (imageMode === 'compact-rect') {
        imageWidth = tile.width * 0.6
        imageHeight = imageWidth * 0.75
        if (imageHeight > availableForImage) {
          imageHeight = availableForImage
          imageWidth = imageHeight / 0.75
        }
        imageX = (tile.width - imageWidth) / 2
      } else if (imageMode === 'compact-circle') {
        const diameter = Math.min(tile.width * 0.45, availableForImage)
        imageWidth = diameter
        imageHeight = diameter
        imageX = (tile.width - imageWidth) / 2
        borderRadius = diameter / 2
      } else {
        imageWidth = tile.width - (padding * 2)
        const ideal4by3 = imageWidth * 0.75
        imageHeight = Math.max(40, Math.min(ideal4by3, availableForImage))
        imageX = (tile.width - imageWidth) / 2
      }
      
      const defaultItemShadow = imageMode !== 'compact-circle' ? '0 2px 8px rgba(0,0,0,0.1)' : undefined
      const imageShadow = tileStyle?.image?.boxShadow !== undefined ? tileStyle.image.boxShadow : defaultItemShadow

      if (content.imageUrl) {
        elements.push({
          type: 'image',
          x: imageX,
          y: currentY,
          width: imageWidth,
          height: imageHeight,
          content: content.imageUrl,
          style: {
            borderRadius,
            objectFit: 'cover',
            objectPosition: 'center',
            boxShadow: imageShadow || undefined
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
            borderRadius
          }
        })
      }

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

      currentY += imageHeight + SPACING_V2.afterImage
    }
  }

  const imageMode: ImageModeV2 = options.imageMode || 'stretch'
  const isBackgroundMode = imageMode === 'background'
  const nameWidth = tile.width - (padding * 2)
  const nameMaxLines = tile.contentBudget?.nameLines ?? 3
  const nameLineHeight = nameTypo.fontSize * nameTypo.lineHeight
  const nameX = (tile.width - nameWidth) / 2

  elements.push({
    type: 'text',
    x: nameX,
    y: currentY,
    width: nameWidth,
    height: nameLineHeight * nameMaxLines,
    content: content.name,
    style: {
      fontSize: nameTypo.fontSize,
      fontWeight: nameTypo.fontWeight,
      fontFamily: nameTypo.fontFamily,
      lineHeight: nameTypo.lineHeight,
      maxLines: nameMaxLines,
      color: isBackgroundMode ? '#ffffff' : palette.colors.itemTitle,
      textAlign: nameTypo.textAlign,
      textTransform: nameTypo.textTransform
    }
  })

  currentY += (nameLineHeight * 2.0) + SPACING_V2.nameToDesc

  if (content.description) {
    const descMaxLines = tile.contentBudget?.descLines ?? 3
    const descHeight = descTypo.fontSize * descTypo.lineHeight * descMaxLines
    const descWidth = tile.width - (padding * 2)
    const descX = (tile.width - descWidth) / 2
    
    elements.push({
      type: 'text',
      x: descX,
      y: currentY,
      width: descWidth,
      height: descHeight,
      content: content.description,
      style: {
        fontSize: descTypo.fontSize,
        fontWeight: descTypo.fontWeight,
        fontFamily: descTypo.fontFamily,
        lineHeight: descTypo.lineHeight,
        maxLines: descMaxLines,
        color: isBackgroundMode ? '#f5f5f5' : palette.colors.itemDescription,
        textAlign: descTypo.textAlign,
        textTransform: descTypo.textTransform
      }
    })
    currentY += descHeight + SPACING_V2.descToPrice
  }

  const currencyCode = content.currency || 'USD'
  const priceText = formatCurrency(content.price, currencyCode)
  const priceWidth = tile.width - (padding * 2)
  const priceX = (tile.width - priceWidth) / 2
  elements.push({
    type: 'text',
    x: priceX,
    y: currentY,
    width: priceWidth,
    height: priceTypo.fontSize * priceTypo.lineHeight,
    content: priceText,
    style: {
      fontSize: priceTypo.fontSize,
      fontWeight: priceTypo.fontWeight,
      fontFamily: priceTypo.fontFamily,
      lineHeight: priceTypo.lineHeight,
      maxLines: 1,
      color: isBackgroundMode ? '#ffffff' : palette.colors.itemPrice,
      textAlign: priceTypo.textAlign,
      textTransform: priceTypo.textTransform
    }
  })

  currentY += (priceTypo.fontSize * priceTypo.lineHeight) + 4

  if (content.indicators && !(content.type === 'ITEM_CARD' && content.showImage)) {
    const indicatorWidth = tile.width - (padding * 2)
    const indicatorX = (tile.width - indicatorWidth) / 2
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

  const tileStyle = tile.style as TileStyleV2 | undefined
  const nameTypo = resolveSubElementTypography(tileStyle, 'name', {
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.sm,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
  })
  const descTypo = resolveSubElementTypography(tileStyle, 'description', {
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xs,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.normal,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.normal,
  })
  const priceTypo = resolveSubElementTypography(tileStyle, 'price', {
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xsm,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
  })

  const isCircularMode = (options.imageMode || 'stretch') === 'compact-circle'

  if (content.showImage) {
    const imageMode: ImageModeV2 = options.imageMode || 'stretch'
    
    if (imageMode === 'background') {
      if (content.imageUrl) {
        elements.push({
          type: 'image',
          x: 0,
          y: 0,
          width: tile.width,
          height: tile.height,
          content: content.imageUrl,
          style: {
            borderRadius: 0,
            objectFit: 'cover',
            objectPosition: 'center'
          }
        })
        
        elements.push({
          type: 'background',
          x: 0,
          y: 0,
          width: tile.width,
          height: tile.height,
          content: '',
          style: {
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.5) 100%)',
            borderRadius: 0
          }
        })
      }
      
      if (content.indicators) {
        const indicatorElements = renderIndicators(
          content.indicators,
          4,
          4,
          tile.width - 8,
          palette
        )
        elements.push(...indicatorElements)
      }
    } else {
      let imageWidth: number
      let imageHeight: number
      let imageX: number
      let borderRadius: number = isCircularMode ? 0 : 8
      
      if (imageMode === 'compact-rect') {
        imageWidth = tile.width * 0.6
        imageHeight = imageWidth * 0.75
        const availableForImage = tile.height - padding - 10 - 80
        if (imageHeight > availableForImage) {
          imageHeight = availableForImage
          imageWidth = imageHeight / 0.75
        }
        imageX = (tile.width - imageWidth) / 2
      } else if (imageMode === 'compact-circle') {
        const availableForImage = tile.height - padding - 10 - 80
        const diameter = Math.min(tile.width * 0.45, availableForImage)
        imageWidth = diameter
        imageHeight = diameter
        imageX = (tile.width - imageWidth) / 2
        borderRadius = diameter / 2
      } else {
        imageHeight = tile.contentBudget?.imageBoxHeight ?? 100
        imageWidth = tile.width - (padding * 2)
        imageX = (tile.width - imageWidth) / 2
      }
      
      const defaultFeatureShadow = !isCircularMode ? '0 2px 8px rgba(0,0,0,0.1)' : undefined
      const featureImageShadow = tileStyle?.image?.boxShadow !== undefined ? tileStyle.image.boxShadow : defaultFeatureShadow

      if (content.imageUrl) {
        elements.push({
          type: 'image',
          x: imageX,
          y: currentY,
          width: imageWidth,
          height: imageHeight,
          content: content.imageUrl,
          style: {
            borderRadius,
            objectFit: 'cover',
            objectPosition: 'center',
            boxShadow: featureImageShadow || undefined
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
            borderRadius
          }
        })
      }

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

      currentY += imageHeight + SPACING_V2.afterImage + 4
    }
  }

  const imageMode: ImageModeV2 = options.imageMode || 'stretch'
  const isBackgroundMode = imageMode === 'background'
  const nameWidth = tile.width - (padding * 2)
  const nameMaxLines = tile.contentBudget?.nameLines ?? 2
  const nameLineHeight = nameTypo.fontSize * nameTypo.lineHeight
  const nameX = (tile.width - nameWidth) / 2

    elements.push({
      type: 'text',
      x: nameX,
      y: currentY,
      width: nameWidth,
      height: nameLineHeight * nameMaxLines,
      content: content.name,
      style: {
        fontSize: nameTypo.fontSize,
        fontWeight: nameTypo.fontWeight,
        fontFamily: nameTypo.fontFamily,
        lineHeight: nameTypo.lineHeight,
        maxLines: nameMaxLines,
        color: isBackgroundMode ? '#ffffff' : palette.colors.itemTitle,
        textAlign: nameTypo.textAlign,
        textTransform: nameTypo.textTransform
      }
    })

  currentY += nameLineHeight * 2.0 + SPACING_V2.nameToDesc

  if (content.description) {
    const descMaxLines = tile.contentBudget?.descLines ?? 3
    const descHeight = descTypo.fontSize * descTypo.lineHeight * descMaxLines
    const descWidth = tile.width - (padding * 2)
    const descX = (tile.width - descWidth) / 2

    elements.push({
      type: 'text',
      x: descX,
      y: currentY,
      width: descWidth,
      height: descHeight,
      content: content.description,
      style: {
        fontSize: descTypo.fontSize,
        fontWeight: descTypo.fontWeight,
        fontFamily: descTypo.fontFamily,
        lineHeight: descTypo.lineHeight,
        maxLines: descMaxLines,
        color: isBackgroundMode ? '#f5f5f5' : palette.colors.itemDescription,
        textAlign: descTypo.textAlign,
        textTransform: descTypo.textTransform
      }
    })
    currentY += descHeight + SPACING_V2.descToPrice
  }

  const currencyCode = content.currency || 'USD'
  const priceText = formatCurrency(content.price, currencyCode)
  const priceWidth = tile.width - (padding * 2)
  const priceX = (tile.width - priceWidth) / 2

  elements.push({
    type: 'text',
    x: priceX,
    y: currentY,
    width: priceWidth,
    height: priceTypo.fontSize * priceTypo.lineHeight,
    content: priceText,
    style: {
      fontSize: priceTypo.fontSize,
      fontWeight: priceTypo.fontWeight,
      fontFamily: priceTypo.fontFamily,
      lineHeight: priceTypo.lineHeight,
      maxLines: 1,
      color: isBackgroundMode ? '#ffffff' : palette.colors.itemPrice,
      textAlign: priceTypo.textAlign,
      textTransform: priceTypo.textTransform
    }
  })

  currentY += (priceTypo.fontSize * priceTypo.lineHeight) + SPACING_V2.descToPrice

  if (content.indicators && !content.showImage) {
    const indicatorWidth = tile.width - (padding * 2)
    const indicatorX = (tile.width - indicatorWidth) / 2
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

  // Resolve pattern: "mix" rotates through FILLER_PATTERN_IDS by fillerIndex; else user override; else template
  const patternId =
    options.spacerTilePatternId === 'mix'
      ? FILLER_PATTERN_IDS[(content.fillerIndex ?? 0) % FILLER_PATTERN_IDS.length]
      : options.spacerTilePatternId && FILLER_PATTERN_REGISTRY.has(options.spacerTilePatternId)
        ? options.spacerTilePatternId
        : content.style === 'pattern' && content.content && FILLER_PATTERN_REGISTRY.has(content.content)
          ? content.content
          : undefined

  // Base background (half-opacity palette block)
  elements.push({
    type: 'background',
    x: 0,
    y: 0,
    width: tile.width,
    height: tile.height,
    content: '',
    style: {
      backgroundColor: palette.colors.border.light,
      opacity: 0.5,
      borderRadius: 4
    }
  })

  if (patternId) {
    const config = FILLER_PATTERN_REGISTRY.get(patternId)!
    const dataUri = config.getSvgDataUri(palette)
    const size = FILLER_PATTERN_TILE_SIZE
    // Align pattern to region origin so it tessellates seamlessly across adjacent filler tiles
    elements.push({
      type: 'background',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: '',
      style: {
        background: `url("${dataUri}") repeat 0 0 / ${size}px ${size}px`,
        backgroundPositionX: -tile.x,
        backgroundPositionY: -tile.y,
        borderRadius: 4
      }
    })
  } else if (content.style === 'icon' && content.content) {
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
  const tileStyle = tile.style as TileStyleV2 | undefined
  const padding = SPACING_V2.tilePadding

  // Footer background block
  const bgColor = tileStyle?.background?.color || palette.colors.border.light
  elements.push({
    type: 'background',
    x: 0,
    y: 0,
    width: tile.width,
    height: tile.height,
    content: '',
    style: {
      backgroundColor: bgColor,
      opacity: tileStyle?.background?.color ? 1 : 0.08,
      borderRadius: tileStyle?.background?.borderRadius || 0
    }
  })

  // Top border
  const borderColor = tileStyle?.border?.color || palette.colors.border.light
  const borderWidth = tileStyle?.border?.width || 1
  elements.push({
    type: 'background',
    x: 0,
    y: 0,
    width: tile.width,
    height: borderWidth,
    content: '',
    style: { backgroundColor: borderColor }
  })

  const contactTypo = resolveSubElementTypography(tileStyle, 'contact', {
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xs,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.normal,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.normal,
  })
  const fontSize = contactTypo.fontSize
  const lineHeight = contactTypo.lineHeight
  let currentY = padding + borderWidth + 2

  const addText = (text: string, bold = false) => {
    elements.push({
      type: 'text',
      x: padding,
      y: currentY,
      width: tile.width - (padding * 2),
      content: text,
      style: {
        fontSize,
        fontWeight: bold ? TYPOGRAPHY_TOKENS_V2.fontWeight.semibold : contactTypo.fontWeight,
        fontFamily: contactTypo.fontFamily,
        lineHeight,
        color: tileStyle?.typography?.color || palette.colors.textMuted,
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