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
  FlagshipCardContentV2,
  DividerContentV2,
  ImageModeV2,
  FontStylePreset,
  BannerContentV2,
  BannerStripContentV2
} from './engine-types-v2'
import { formatCurrency } from '../../currency-formatter'
import {
  COLOR_TOKENS_V2,
  PALETTES_V2,
  DEFAULT_PALETTE_V2,
  type InverseTileColorsV2,
  type PromotedItemColorsV2,
  type FlagshipPromotedColorsV2,
  type ColorPaletteV2,
} from './palettes-v2'
export {
  COLOR_TOKENS_V2,
  PALETTES_V2,
  DEFAULT_PALETTE_V2,
  type InverseTileColorsV2,
  type PromotedItemColorsV2,
  type FlagshipPromotedColorsV2,
  type ColorPaletteV2,
} from './palettes-v2'

// ============================================================================
// Text Transform Helpers
// ============================================================================

/**
 * True title case: uppercases the first letter of each word without lowercasing
 * the rest. This preserves intentional mixed-case text such as menu items that
 * contain quoted phrases (e.g. `"Not an acai"` stays `"Not an acai"` rather
 * than becoming `"Not An Acai"`).
 *
 * We only uppercase the character that immediately follows a word boundary
 * (start-of-string or whitespace), leaving all other characters untouched.
 */
function toTitleCase(text: string): string {
  return text.replace(/(?:^|\s)\S/g, ch => ch.toUpperCase())
}

/**
 * Apply text transform in JS and return the transformed string.
 * For 'capitalize' (title case) we transform in JS so the result is true
 * title case regardless of the source casing. CSS text-transform: capitalize
 * only uppercases the first letter — it doesn't lowercase the rest.
 *
 * Returns [transformedText, cssTextTransform] — the second value is undefined
 * when the transform was applied in JS (no CSS needed).
 */
function applyTextTransform(
  text: string,
  transform: string | undefined
): [string, string | undefined] {
  if (!transform || transform === 'none') return [text, undefined]
  if (transform === 'capitalize') return [toTitleCase(text), undefined]
  // uppercase / lowercase — let CSS handle it
  return [text, transform]
}

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
  /** Show category/section title headers (defaults to true) */
  showCategoryTitles?: boolean
  /** Override filler tile rendering with this pattern ID (from FILLER_PATTERN_REGISTRY); when set, all filler tiles use this pattern */
  spacerTilePatternId?: string
  /** Per-item image transform overrides (itemId → transform). Applied at render time for live preview without re-fetching layout. */
  imageTransforms?: Map<string, import('@/types').ImageTransform>
  /** Live banner hero image transform override (applied during edit without re-fetching layout) */
  bannerHeroTransform?: import('@/types').ImageTransform
  /** Live banner logo image transform override (applied during edit without re-fetching layout) */
  bannerLogoTransform?: import('@/types').ImageTransform
  /** When true, image tiles show the interactive edit overlay */
  imageEditMode?: boolean
  /** Callback when user adjusts a per-item image transform via the overlay */
  onImageTransformChange?: (itemId: string, transform: import('@/types').ImageTransform) => void
  /** Callback when user adjusts the banner hero or logo transform */
  onBannerTransformChange?: (target: 'hero' | 'logo', transform: import('@/types').ImageTransform) => void
  /** Font style preset for banner title and section headers */
  fontStylePreset?: FontStylePreset
  /** Centre-align category headings (and item tiles when spacer tiles = "None") */
  centreAlignment?: boolean
  /** When true, suppress the "SAMPLE" stamp overlay on placeholder item tiles */
  hideSampleLabels?: boolean
  /**
   * Pre-fetched base64 data URLs for social media icons (used in export mode).
   * Keys match the platform names: 'instagram' | 'facebook' | 'x' | 'tiktok'.
   * When absent, the renderer falls back to relative /logos/ paths (web preview only).
   */
  socialIconDataUrls?: Record<string, string>
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
  /** Google Fonts API param (e.g. 'Inter:wght@400;600;700'). Empty for system fonts. */
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
  },
  {
    id: 'system-sans',
    name: 'System Sans (Arial)',
    primary: 'Arial',
    fallback: 'Helvetica, "Helvetica Neue", sans-serif',
    googleFonts: '',
    description: 'System sans-serif - clear, neutral, works everywhere'
  },
  {
    id: 'system-sans-bold',
    name: 'System Sans Bold (Arial Black)',
    primary: 'Arial Black',
    fallback: 'Arial, Helvetica, sans-serif',
    googleFonts: '',
    description: 'Heavy system sans - strong headings and titles'
  },
  {
    id: 'merriweather',
    name: 'Merriweather',
    primary: 'Merriweather',
    fallback: 'Georgia, serif',
    googleFonts: 'Merriweather:wght@400;600;700',
    description: 'Classic serif - elegant headings, editorial feel'
  },
  {
    id: 'raleway',
    name: 'Raleway',
    primary: 'Raleway',
    fallback: 'system-ui, sans-serif',
    googleFonts: 'Raleway:wght@400;500;600;700',
    description: 'Refined sans - clean and readable'
  },
  {
    id: 'lato',
    name: 'Lato',
    primary: 'Lato',
    fallback: 'system-ui, sans-serif',
    googleFonts: 'Lato:wght@400;700',
    description: 'Friendly sans - warm and approachable'
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
// Font Style Presets (Banner Title & Section Headers)
// ============================================================================

/** Configuration for a font style preset */
export interface FontStylePresetConfig {
  id: FontStylePreset
  label: string
  /** CSS font-family string for banner title */
  bannerTitleFamily: string
  /** CSS font-family string for section headers */
  sectionHeaderFamily: string
  /** Google Fonts API param (empty string for system fonts) */
  googleFonts: string
  bannerTitleWeight: number
  sectionHeaderWeight: number
  /** Optional multiplier applied to the template's section header font size (default 1.0) */
  sectionHeaderFontSizeMultiplier?: number
}

/** Registry of all font style presets */
export const FONT_STYLE_PRESETS: Record<FontStylePreset, FontStylePresetConfig> = {
  strong: {
    id: 'strong',
    label: 'Strong',
    bannerTitleFamily: '"Anton", "Impact", "Arial Black", sans-serif',
    sectionHeaderFamily: '"Anton", "Impact", "Arial Black", sans-serif',
    googleFonts: 'Anton', // Anton is a Google Font (weight 400 only)
    bannerTitleWeight: 400, // Anton only has 400
    sectionHeaderWeight: 400,
  },
  fun: {
    id: 'fun',
    label: 'Fun',
    bannerTitleFamily: '"Caveat Bold", "Caveat", "Ink Free", cursive',
    sectionHeaderFamily: '"Caveat Bold", "Caveat", "Ink Free", cursive',
    googleFonts: 'Caveat:wght@400;700',
    bannerTitleWeight: 700,
    sectionHeaderWeight: 700,
    sectionHeaderFontSizeMultiplier: 1.25,
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    bannerTitleFamily: '"Oswald", "Arial Narrow", sans-serif',
    sectionHeaderFamily: '"Oswald", "Arial Narrow", sans-serif',
    googleFonts: 'Oswald:wght@400;500;600;700',
    bannerTitleWeight: 600,
    sectionHeaderWeight: 500,
  },
  serif: {
    id: 'serif',
    label: 'Serif',
    bannerTitleFamily: '"Times New Roman", "Georgia", serif',
    sectionHeaderFamily: '"Times New Roman", "Georgia", serif',
    googleFonts: '', // System font — no Google Fonts needed
    bannerTitleWeight: 700,
    sectionHeaderWeight: 700,
  },
  future: {
    id: 'future',
    label: 'Future',
    bannerTitleFamily: '"Orbitron", "Anta", system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
    sectionHeaderFamily: '"Orbitron", "Anta", system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
    googleFonts: 'Orbitron:wght@400;500;600;700&family=Anta',
    bannerTitleWeight: 600,
    sectionHeaderWeight: 500,
  },
  handwriting: {
    id: 'handwriting',
    label: 'Handwriting',
    bannerTitleFamily: '"Petit Formal Script", cursive',
    sectionHeaderFamily: '"Petit Formal Script", cursive',
    googleFonts: 'Petit+Formal+Script',
    bannerTitleWeight: 600, // Petit Formal Script is weight 400 only
    sectionHeaderWeight: 600,
    sectionHeaderFontSizeMultiplier: 0.8, // Script fonts read small — bump size to compensate
  },
  elegant: {
    id: 'elegant',
    label: 'Elegant',
    bannerTitleFamily: '"Josefin Sans", "Arial Narrow", sans-serif',
    sectionHeaderFamily: '"Josefin Sans", "Arial Narrow", sans-serif',
    googleFonts: 'Josefin+Sans:wght@100;200;300', // Light end of the weight range
    bannerTitleWeight: 600,
    sectionHeaderWeight: 600,
  },
}

/**
 * Generate a Google Fonts import URL for a given font style preset.
 * Returns an empty string for presets that use only system fonts.
 */
export function getFontStylePresetGoogleFontsUrl(preset: FontStylePreset): string {
  const config = FONT_STYLE_PRESETS[preset]
  if (!config.googleFonts) return ''
  return `https://fonts.googleapis.com/css2?family=${config.googleFonts}&display=swap`
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
    xss: 8,    // 8pt (compact footer / microcopy)
    xsm: 9,    // 9pt (Reduced from 11pt)
    xs: 10,    // 10pt
    smd: 11,   // 11pt
    sm: 12,    // 12pt
    base: 14,  // 14pt
    lg: 16,    // 16pt
    xl: 18,    // 18pt
    '2xl': 20, // 20pt
    '3xl': 24, // 24pt
    '4xl': 28, // 28pt
    '5xl': 30  // 30pt - section headers, hero
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

/** Spacing constants (in points) for consistent element gaps. Aligned with GridMenu-Typography-Spacing-Guide. */
export const SPACING_V2 = {
  nameToDesc: 8,  // 8px – name and description feel connected
  descToPrice: 6, // 6px – price sits close to its item, same visual unit
  afterImage: 16,  // 16px – moderate separation from image to name
  tilePadding: 8,  // 8px base; templates may use larger via contentBudget
} as const

/**
 * Background-mode text styling: applied to text overlaid on background images
 * for readability. The shadow provides a crisp dark halo around letterforms.
 * The gradient is darkest at the top (where text sits) and fades to transparent
 * at the bottom so the food image remains visible and vibrant.
 * Name and price use lightened palette colours so they keep the colour scheme
 * but contrast with the dark overlay; description stays light with shadow.
 * Compatible with CSS (web preview + Puppeteer PDF export).
 */
export const BG_IMAGE_TEXT = {
  shadow: '0 1px 3px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.3)',
  /** Darkest at top (text zone) for contrast; fades to transparent at bottom to reveal image. */
  gradient: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0) 100%)',
  /** Description stays light for contrast on gradient. */
  descColor: '#f0f0f0',
  /** Blend factor (0–1) for item name: more white = lighter text on dark overlay. Names need most contrast. */
  lightenBlendName: 0.82,
  /** Blend factor (0–1) for item price: lighter than default palette but name is lightest. */
  lightenBlendPrice: 0.72,
  /** Font size bump (pt) for item name when Image Option is Background. */
  nameSizeBump: 4,
  /** Font size bump (pt) for item price when Image Option is Background. */
  priceSizeBump: 3,
  /** Max name fontSize (pt) in background mode. */
  nameSizeMax: 20,
  /** Max price fontSize (pt) in background mode. */
  priceSizeMax: 14,
} as const

/**
 * Lighten a hex colour by blending with white for use on dark overlays.
 * Preserves hue while improving contrast. Returns hex in #RRGGBB form.
 */
export function lightenHexForDarkBackground(hex: string, whiteAmount: number): string {
  const normalized = hex.replace('#', '').trim()
  const value = normalized.length === 3
    ? normalized.split('').map(c => c + c).join('')
    : normalized
  const num = parseInt(value, 16)
  if (Number.isNaN(num)) return hex
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  const w = Math.max(0, Math.min(1, whiteAmount))
  const r2 = Math.round(r * (1 - w) + 255 * w)
  const g2 = Math.round(g * (1 - w) + 255 * w)
  const b2 = Math.round(b * (1 - w) + 255 * w)
  const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`
}

// ============================================================================
// Galactic theme effects (neon glow)
// ============================================================================

function mergeTextShadow(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b
  if (!b) return a
  return `${a}, ${b}`
}

function isGalacticPalette(options: RenderOptionsV2): boolean {
  return (options.palette?.id ?? DEFAULT_PALETTE_V2.id) === 'galactic-menu'
}

function neonTextGlow(palette: ColorPaletteV2, kind: 'title' | 'header' | 'price'): string {
  const cyan = '#57E6FF'
  const gold = '#F9C74F'
  const glow = kind === 'price' ? gold : cyan
  // Keep the glow subtle enough for print/PDF raster while still reading as neon.
  return `0 0 2px rgba(255,255,255,0.55), 0 0 8px ${glow}55, 0 0 18px ${glow}33`
}

/**
 * Blend two #RGB / #RRGGBB colours. `t` in [0,1] moves from `baseHex` toward `towardHex`.
 * Used for subtle featured-item tile tinting toward the palette accent.
 */
export function blendHexTowards(baseHex: string, towardHex: string, t: number): string {
  const parse = (hex: string) => {
    const normalized = hex.replace('#', '').trim()
    const value =
      normalized.length === 3
        ? normalized.split('').map(c => c + c).join('')
        : normalized
    const num = parseInt(value, 16)
    if (Number.isNaN(num)) return { r: 255, g: 255, b: 255 }
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
  }
  const a = parse(baseHex)
  const b = parse(towardHex)
  const u = Math.max(0, Math.min(1, t))
  const toByte = (x: number) => Math.max(0, Math.min(255, Math.round(x)))
  const r = toByte(a.r + (b.r - a.r) * u)
  const g = toByte(a.g + (b.g - a.g) * u)
  const b2 = toByte(a.b + (b.b - a.b) * u)
  const toHex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b2)}`
}

/** Font size type for template styling */
export type FontSizeV2 = keyof typeof TYPOGRAPHY_TOKENS_V2.fontSize

/** Font weight type for template styling */
export type FontWeightV2 = keyof typeof TYPOGRAPHY_TOKENS_V2.fontWeight

/** Text alignment type for template styling */
export type TextAlignV2 = 'left' | 'center' | 'right'

/** Line height type for template styling */
export type LineHeightV2 = keyof typeof TYPOGRAPHY_TOKENS_V2.lineHeight

// ============================================================================
// Texture Registry
// ============================================================================

/** Configuration for a background texture pattern (palette-independent) */
export interface TextureConfig {
  label: string
  webCss: (textureUrl: string) => Record<string, string>
  webCssExport: (textureUrl: string) => Record<string, string>
  pdfTextureFile: string
  /**
   * When set, the texture is rendered as a separate absolutely-positioned overlay
   * at this opacity (0–1), so the palette background colour shows through underneath.
   * Without this, the texture is merged directly onto the background div.
   */
  overlayOpacity?: number
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

// Base64-encode an SVG string for Puppeteer PDF rendering.
// Percent-encoded SVG data URIs don't render in Chromium's PDF raster; base64 does.
function svgToBase64DataUri(rawSvg: string): string {
  const b64 = typeof globalThis.Buffer !== 'undefined'
    ? globalThis.Buffer.from(rawSvg).toString('base64')
    : btoa(rawSvg)
  return `data:image/svg+xml;base64,${b64}`
}

// Raw SVG strings (used to produce both preview and export data URIs)
const paperGrainSvg = randomDotsTile({ width: 60, height: 60, cellSize: 3, density: 62, rMin: 0.2, rMax: 0.45, opacity: 0.10 })
const linenSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><path d="M0 0h60v1H0zM0 15h60v0.5H0zM0 30h60v1H0zM0 45h60v0.5H0z" fill="#000" opacity="0.04"/><path d="M0 0v60h1V0zM15 0v60h0.5V0zM30 0v60h1V0zM45 0v60h0.5V0z" fill="#000" opacity="0.03"/></svg>'
const waveSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><path d="M0 30 Q30 10 60 30 Q90 50 120 30" fill="none" stroke="#000" stroke-width="0.5" opacity="0.04"/><path d="M0 45 Q30 25 60 45 Q90 65 120 45" fill="none" stroke="#000" stroke-width="0.5" opacity="0.03"/></svg>'
const subtleDotsSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60">' +
  [6, 18, 30, 42, 54].flatMap((x) => [6, 18, 30, 42, 54].map((y) =>
    `<circle cx="${x}" cy="${y}" r="0.5" fill="#000" opacity="0.09"/>`)).join('') +
  '</svg>'

// Export-specific SVGs: Puppeteer at 2x DPR still aliases sub-pixel strokes/circles.
// Wider strokes, larger dots, and higher opacity produce clean anti-aliased output.
const paperGrainExportSvg = randomDotsTile({ width: 60, height: 60, cellSize: 3, density: 62, rMin: 0.4, rMax: 0.8, opacity: 0.10 })
const linenExportSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><path d="M0 0h60v1.2H0zM0 15h60v0.8H0zM0 30h60v1.2H0zM0 45h60v0.8H0z" fill="#000" opacity="0.07"/><path d="M0 0v60h1.2V0zM15 0v60h0.8V0zM30 0v60h1.2V0zM45 0v60h0.8V0z" fill="#000" opacity="0.05"/></svg>'
const waveExportSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><path d="M0 30 Q30 10 60 30 Q90 50 120 30" fill="none" stroke="#000" stroke-width="0.9" opacity="0.07"/><path d="M0 45 Q30 25 60 45 Q90 65 120 45" fill="none" stroke="#000" stroke-width="0.9" opacity="0.05"/></svg>'
const subtleDotsExportSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60">' +
  [6, 18, 30, 42, 54].flatMap((x) => [6, 18, 30, 42, 54].map((y) =>
    `<circle cx="${x}" cy="${y}" r="0.9" fill="#000" opacity="0.12"/>`)).join('') +
  '</svg>'
const stripeHorizontalExportSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M0 0h40v0.9H0zM0 8h40v0.9H0zM0 16h40v0.9H0zM0 24h40v0.9H0zM0 32h40v0.9H0z" fill="#000" opacity="0.08"/></svg>'
const stripeVerticalExportSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M0 0v40h0.9V0zM8 0v40h0.9V0zM16 0v40h0.9V0zM24 0v40h0.9V0zM32 0v40h0.9V0z" fill="#000" opacity="0.08"/></svg>'
const stripeDiagonalExportSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M0 0 L16 16" stroke="#000" stroke-width="0.8" opacity="0.08" fill="none"/></svg>'

// Warp-speed background: non-tileable, full-bleed cover texture for the Galactic theme.
// Keep it filter-free so it renders reliably in both browser and Puppeteer PDF export.
const warpSpeedBgSvg = (() => {
  const lines: string[] = []
  // broken streak bundles with varied lengths/widths; deterministic for stability
  const streak = (x1: number, y1: number, x2: number, y2: number, w: number, o: number, color: string) =>
    `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`
  const w = 1200
  const h = 1200
  const cx = w / 2
  const cy = h / 2
  // Core rays
  for (let i = 0; i < 140; i++) {
    const a = (i / 140) * Math.PI * 2
    const jitter = (i % 7) * 0.012
    const r1 = 40 + (i % 9) * 6
    const r2 = 520 + (i % 11) * 48
    const width = (i % 5 === 0) ? 2.0 : 1.0
    // Middle ground: still subtle, but reads better behind tiles
    const baseColor = '#D6DEE9'
    const op = (i % 6 === 0) ? 0.26 : 0.14

    // Break into segments with gaps (reference-like)
    const segCount = 2 + (i % 3) // 2-4 segments
    const dirX = Math.cos(a + jitter)
    const dirY = Math.sin(a + jitter)
    let cursor = r1
    for (let s = 0; s < segCount; s++) {
      const segLen = 70 + ((i * 17 + s * 29) % 120) // 70-189
      const gapLen = 18 + ((i * 13 + s * 31) % 34)  // 18-51
      const start = cursor + gapLen
      const end = Math.min(r2, start + segLen)
      if (end <= start) break
      const x1s = cx + dirX * start
      const y1s = cy + dirY * start
      const x2s = cx + dirX * end
      const y2s = cy + dirY * end
      const localOp = op * (0.92 - s * 0.12)
      const localW = width * (1.0 - s * 0.12)
      lines.push(streak(x1s, y1s, x2s, y2s, localW, Math.max(0.05, localOp), baseColor))
      cursor = end
      if (cursor >= r2) break
    }
  }
  // Accent rays (cyan)
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.03
    const r1 = 60
    const r2 = 760
    const dirX = Math.cos(a)
    const dirY = Math.sin(a)
    const accent = '#57E6FF'
    const segCount = 2 + (i % 2)
    let cursor = r1
    for (let s = 0; s < segCount; s++) {
      const segLen = 120 + ((i * 19 + s * 23) % 160)
      const gapLen = 40 + ((i * 11 + s * 17) % 70)
      const start = cursor + gapLen
      const end = Math.min(r2, start + segLen)
      if (end <= start) break
      const x1s = cx + dirX * start
      const y1s = cy + dirY * start
      const x2s = cx + dirX * end
      const y2s = cy + dirY * end
      const localOp = 0.14 - s * 0.025
      const localW = 2.2 - s * 0.35
      lines.push(streak(x1s, y1s, x2s, y2s, Math.max(1.2, localW), Math.max(0.05, localOp), accent))
      cursor = end
      if (cursor >= r2) break
    }
  }

  // Small star specks (very subtle)
  const specks: string[] = []
  for (let i = 0; i < 120; i++) {
    const x = (hash2(i * 97) % 1200) + 0.5
    const y = (hash2(i * 193 + 11) % 1200) + 0.5
    const r = 0.6 + ((hash2(i * 29 + 7) % 100) / 100) * 1.0
    const o = 0.05 + ((hash2(i * 41 + 3) % 100) / 100) * 0.08
    specks.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#EAF2FF" opacity="${o.toFixed(2)}"/>`)
  }

  const bg = [
    `<defs>`,
    `<radialGradient id="warp_bg" cx="50%" cy="50%" r="65%">`,
    `<stop offset="0" stop-color="#000000" stop-opacity="1"/>`,
    `<stop offset="0.45" stop-color="#0B1020" stop-opacity="1"/>`,
    `<stop offset="1" stop-color="#000000" stop-opacity="1"/>`,
    `</radialGradient>`,
    `</defs>`,
    `<rect width="${w}" height="${h}" fill="url(#warp_bg)"/>`,
    specks.join(''),
    lines.join(''),
  ].join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg}</svg>`
})()

// Export SVG tuned for PDF raster: slightly thicker strokes and higher opacity.
const warpSpeedBgExportSvg = warpSpeedBgSvg
  .replace(/stroke-width="1\.0"/g, 'stroke-width="1.35"')
  .replace(/opacity="0\.14"/g, 'opacity="0.18"')

// Percent-encoded SVG data URIs for web preview (browser renders these natively)
const SVG_TEXTURES = {
  paperGrain: `data:image/svg+xml,${encodeURIComponent(paperGrainSvg)}`,
  linen: `data:image/svg+xml,${encodeURIComponent(linenSvg)}`,
  wave: `data:image/svg+xml,${encodeURIComponent(waveSvg)}`,
  subtleDots: `data:image/svg+xml,${encodeURIComponent(subtleDotsSvg)}`,
  stripesHorizontal: `data:image/svg+xml,${encodeURIComponent(stripeHorizontalSvg)}`,
  stripesVertical: `data:image/svg+xml,${encodeURIComponent(stripeVerticalSvg)}`,
  stripesDiagonal: `data:image/svg+xml,${encodeURIComponent(stripeDiagonalSvg)}`,
  warpSpeedBg: `data:image/svg+xml,${encodeURIComponent(warpSpeedBgSvg)}`,
}

// Base64-encoded SVG data URIs for PDF export (Puppeteer renders base64 reliably).
// Each uses the export-specific SVG with boosted stroke/radius/opacity for clean PDF output.
const SVG_TEXTURES_EXPORT = {
  paperGrain: svgToBase64DataUri(paperGrainExportSvg),
  linen: svgToBase64DataUri(linenExportSvg),
  wave: svgToBase64DataUri(waveExportSvg),
  subtleDots: svgToBase64DataUri(subtleDotsExportSvg),
  stripesHorizontal: svgToBase64DataUri(stripeHorizontalExportSvg),
  stripesVertical: svgToBase64DataUri(stripeVerticalExportSvg),
  stripesDiagonal: svgToBase64DataUri(stripeDiagonalExportSvg),
  warpSpeedBg: svgToBase64DataUri(warpSpeedBgExportSvg),
}

function svgTexturePattern(svgDataUri: string, exportDataUri: string): Pick<TextureConfig, 'webCss' | 'webCssExport' | 'pdfTextureFile'> {
  return {
    webCss: () => ({
      backgroundImage: `url("${svgDataUri}")`,
      backgroundRepeat: 'repeat',
      backgroundSize: 'auto',
    }),
    webCssExport: () => ({
      backgroundImage: `url("${exportDataUri}")`,
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
  ['floral', {
    label: 'Floral',
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
    pdfTextureFile: 'floral.png',
    overlayOpacity: 0.15,
  }],
  ['hearts', {
    label: 'Hearts',
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
    pdfTextureFile: 'hearts.png',
    overlayOpacity: 0.15,
  }],
  ['paper-grain', { label: 'Paper Grain', ...svgTexturePattern(SVG_TEXTURES.paperGrain, SVG_TEXTURES_EXPORT.paperGrain) }],
  // Legacy: old "Subtle Noise" ID; same effect as Paper Grain for saved configs
  ['subtle-noise', { label: 'Paper Grain', ...svgTexturePattern(SVG_TEXTURES.paperGrain, SVG_TEXTURES_EXPORT.paperGrain) }],
  ['stripes-horizontal', { label: 'Stripes (horizontal)', ...svgTexturePattern(SVG_TEXTURES.stripesHorizontal, SVG_TEXTURES_EXPORT.stripesHorizontal) }],
  ['stripes-vertical', { label: 'Stripes (vertical)', ...svgTexturePattern(SVG_TEXTURES.stripesVertical, SVG_TEXTURES_EXPORT.stripesVertical) }],
  ['stripes-diagonal', { label: 'Stripes (diagonal)', ...svgTexturePattern(SVG_TEXTURES.stripesDiagonal, SVG_TEXTURES_EXPORT.stripesDiagonal) }],
  ['waves', { label: 'Waves', ...svgTexturePattern(SVG_TEXTURES.wave, SVG_TEXTURES_EXPORT.wave) }],
  ['linen', { label: 'Linen', ...svgTexturePattern(SVG_TEXTURES.linen, SVG_TEXTURES_EXPORT.linen) }],
  ['subtle-dots', { label: 'Subtle Dots', ...svgTexturePattern(SVG_TEXTURES.subtleDots, SVG_TEXTURES_EXPORT.subtleDots) }],
  // Dark-only: available for dark palettes (Neon Blue, Midnight Gold, Lunar Red & Gold).
  ['warp-speed-bg', {
    label: 'Warp Speed',
    webCss: () => ({
      backgroundImage: `url("${SVG_TEXTURES.warpSpeedBg}")`,
      // Zoom in slightly so streaks reach nearer the page edges behind tiles
      backgroundSize: '135% 135%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
    }),
    webCssExport: () => ({
      backgroundImage: `url("${SVG_TEXTURES_EXPORT.warpSpeedBg}")`,
      backgroundSize: '135% 135%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
    }),
    pdfTextureFile: '',
  }],
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
  'floral',
  'hearts',
  'dark-paper',
  'warp-speed-bg',
]

/** Palette IDs that are dark-themed and pair well with dark-only textures */
export const DARK_PALETTE_IDS = new Set(['midnight-gold', 'lunar-red-gold', 'elegant-dark', 'galactic-menu'])

/** Texture IDs that only work well on dark palettes */
export const DARK_ONLY_TEXTURE_IDS = new Set(['dark-paper', 'warp-speed-bg'])

/** Texture IDs that only work well on light palettes */
export const LIGHT_ONLY_TEXTURE_IDS = new Set([
  'subtle-dots', 'paper-grain', 'stripes-horizontal', 'stripes-vertical',
  'stripes-diagonal', 'waves', 'linen', 'floral', 'hearts',
])

// ============================================================================
// Filler (Spacer Tile) Pattern Registry
// ============================================================================

/** Configuration for a palette-adaptive spacer tile pattern */
export interface FillerPatternConfig {
  label: string
  /** Returns a tileable SVG as data URI using palette colors */
  getSvgDataUri: (palette: ColorPaletteV2) => string
  /** Override background-size in px (defaults to FILLER_PATTERN_TILE_SIZE) */
  tileSize?: number
  /** Render once, scaled to the spacer tile bounds instead of repeated. */
  fitToTile?: boolean
  /** Optional pattern overlay opacity. */
  opacity?: number
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

/** Elegant windowpane grid (28×28 tile). */
function windowpaneSvg(palette: ColorPaletteV2): string {
  const { base, light } = fillerPalette(palette)
  const body = [
    '<defs>',
    '<pattern id="windowpane" width="28" height="28" patternUnits="userSpaceOnUse">',
    `<rect width="28" height="28" fill="${base}"/>`,
    `<path d="M 28 0 L 0 0 0 28" fill="none" stroke="${light}" stroke-width="1"/>`,
    '</pattern>',
    '</defs>',
    '<rect width="28" height="28" fill="url(#windowpane)"/>'
  ].join('')
  return fillerSvgDataUri(body, '0 0 28 28')
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

/** Star field: subtle dotted stars with a few softly glowing larger points. */
function starsSvg(palette: ColorPaletteV2): string {
  const { base, light, mid } = fillerPalette(palette)
  const accent = palette.colors.accent ?? palette.colors.itemPrice ?? palette.colors.sectionHeader
  const body = [
    '<defs>',
    '<filter id="starGlow" x="-80%" y="-80%" width="260%" height="260%">',
    '<feGaussianBlur stdDeviation="1.1" result="b"/>',
    '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>',
    '</filter>',
    '<pattern id="stars" width="96" height="96" patternUnits="userSpaceOnUse">',
    `<rect width="96" height="96" fill="${base}"/>`,
    `<rect width="96" height="96" fill="${light}" opacity="0.08"/>`,
    `<g filter="url(#starGlow)">`,
    `<circle cx="12" cy="14" r="0.9" fill="${mid}" opacity="0.60"/>`,
    `<circle cx="28" cy="34" r="0.7" fill="${light}" opacity="0.46"/>`,
    `<circle cx="52" cy="18" r="1.1" fill="${accent}" opacity="0.48"/>`,
    `<circle cx="78" cy="30" r="0.8" fill="${mid}" opacity="0.50"/>`,
    `<circle cx="88" cy="12" r="0.55" fill="${light}" opacity="0.36"/>`,
    `<circle cx="36" cy="10" r="0.65" fill="${mid}" opacity="0.42"/>`,
    `<circle cx="18" cy="68" r="1.5" fill="${accent}" opacity="0.34"/>`,
    `<circle cx="44" cy="74" r="0.8" fill="${light}" opacity="0.44"/>`,
    `<circle cx="70" cy="62" r="1.2" fill="${mid}" opacity="0.42"/>`,
    `<circle cx="88" cy="82" r="0.7" fill="${light}" opacity="0.38"/>`,
    `<circle cx="8" cy="46" r="0.6" fill="${light}" opacity="0.34"/>`,
    `<circle cx="34" cy="54" r="0.55" fill="${mid}" opacity="0.36"/>`,
    `<circle cx="58" cy="88" r="0.6" fill="${light}" opacity="0.34"/>`,
    `<circle cx="84" cy="50" r="0.55" fill="${accent}" opacity="0.34"/>`,
    '</g>',
    '</pattern>',
    '</defs>',
    '<rect width="96" height="96" fill="url(#stars)"/>',
  ].join('')
  return fillerSvgDataUri(body, '0 0 96 96')
}

/** Retro Target: rings + crosshair + small blips. */
function targetingGridSvg(palette: ColorPaletteV2): string {
  const { base, light, mid } = fillerPalette(palette)
  const accent = palette.colors.accent ?? palette.colors.sectionHeader ?? palette.colors.itemPrice
  const body = [
    '<defs>',
    '<pattern id="tg" width="96" height="96" patternUnits="userSpaceOnUse">',
    `<rect width="96" height="96" fill="${base}"/>`,
    `<circle cx="48" cy="48" r="32" fill="none" stroke="${light}" stroke-width="3" opacity="0.48"/>`,
    `<circle cx="48" cy="48" r="20" fill="none" stroke="${mid}" stroke-width="2.2" opacity="0.42"/>`,
    `<circle cx="48" cy="48" r="8" fill="none" stroke="${accent}" stroke-width="2" opacity="0.66"/>`,
    `<path d="M48 4 V28 M48 68 V92 M4 48 H28 M68 48 H92" stroke="${light}" stroke-width="1.4" opacity="0.32"/>`,
    `<circle cx="18" cy="24" r="2.6" fill="${accent}" opacity="0.48"/>`,
    `<circle cx="78" cy="66" r="2.1" fill="${accent}" opacity="0.40"/>`,
    `<circle cx="70" cy="20" r="1.6" fill="${mid}" opacity="0.34"/>`,
    '</pattern>',
    '</defs>',
    '<rect width="96" height="96" fill="url(#tg)"/>',
  ].join('')
  return fillerSvgDataUri(body, '0 0 96 96')
}

/** Orbit map: concentric orbits with small planets, subtle grid. Kept for potential future use. */
// eslint-disable-next-line no-unused-vars
function orbitMapSvg(palette: ColorPaletteV2): string {
  const { base, light, mid } = fillerPalette(palette)
  const accent = palette.colors.accent ?? palette.colors.itemPrice ?? palette.colors.sectionHeader
  const body = [
    '<defs>',
    '<pattern id="om" width="96" height="96" patternUnits="userSpaceOnUse">',
    `<rect width="96" height="96" fill="${base}"/>`,
    `<path d="M0 24 H96 M0 48 H96 M0 72 H96" stroke="${light}" stroke-width="1" opacity="0.12"/>`,
    `<path d="M24 0 V96 M48 0 V96 M72 0 V96" stroke="${light}" stroke-width="1" opacity="0.12"/>`,
    `<circle cx="48" cy="48" r="8" fill="${accent}" opacity="0.30"/>`,
    `<circle cx="48" cy="48" r="24" fill="none" stroke="${mid}" stroke-width="2" opacity="0.34"/>`,
    `<circle cx="48" cy="48" r="38" fill="none" stroke="${light}" stroke-width="2" opacity="0.26"/>`,
    `<ellipse cx="48" cy="48" rx="38" ry="16" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.30" transform="rotate(-25 48 48)"/>`,
    `<circle cx="68" cy="32" r="3" fill="${accent}" opacity="0.52"/>`,
    `<circle cx="26" cy="68" r="2.4" fill="${mid}" opacity="0.44"/>`,
    `<circle cx="76" cy="74" r="1.8" fill="${light}" opacity="0.32"/>`,
    '</pattern>',
    '</defs>',
    '<rect width="96" height="96" fill="url(#om)"/>',
  ].join('')
  return fillerSvgDataUri(body, '0 0 96 96')
}

/** Single flower: a simple five-petal flower centred in the tile, palette-adaptive.
 *  Tile background uses the palette accent/banner colour; petals are a lighter tint on top. */
function singleFlowerSvg(palette: ColorPaletteV2): string {
  // Tile fill: use the banner surface as the coloured background (e.g. pink for Blush Rose)
  const tileFill = palette.colors.bannerSurface ?? palette.colors.border.medium
  // Petals: white at reduced opacity so they read as a lighter tint of the tile colour
  const petalFill = '#FFFFFF'
  const petalOpacity = '0.55'
  // Centre dot: slightly more opaque white
  const centreFill = '#FFFFFF'
  // Five petals arranged around the centre, drawn as ellipses rotated 72° apart
  const petals = [0, 72, 144, 216, 288].map(deg => {
    const rad = (deg * Math.PI) / 180
    const cx = (48 + Math.cos(rad) * 14).toFixed(2)
    const cy = (48 + Math.sin(rad) * 14).toFixed(2)
    return `<ellipse cx="${cx}" cy="${cy}" rx="8" ry="5" fill="${petalFill}" opacity="${petalOpacity}" transform="rotate(${deg} ${cx} ${cy})"/>`
  }).join('')
  const body = [
    '<defs>',
    '<pattern id="sf" width="96" height="96" patternUnits="userSpaceOnUse">',
    `<rect width="96" height="96" fill="${tileFill}"/>`,
    petals,
    // Centre circle
    `<circle cx="48" cy="48" r="7" fill="${centreFill}" opacity="0.75"/>`,
    `<circle cx="48" cy="48" r="3.5" fill="${tileFill}" opacity="0.70"/>`,
    '</pattern>',
    '</defs>',
    '<rect width="96" height="96" fill="url(#sf)"/>',
  ].join('')
  return fillerSvgDataUri(body, '0 0 96 96')
}

/**
 * Registry mapping spacer tile pattern IDs to their configurations.
 * Patterns are palette-adaptive (base + accent from active palette).
 */
export const FILLER_PATTERN_REGISTRY = new Map<string, FillerPatternConfig>([
  ['diagonal-pinstripe', { label: 'Diagonal Pinstripe', getSvgDataUri: diagonalPinstripeSvg }],
  ['bauhaus-check', { label: 'Bauhaus Check & Circle', getSvgDataUri: bauhausCheckSvg }],
  ['overlapping-rings', { label: 'Overlapping Rings', getSvgDataUri: overlappingRingsSvg }],
  ['windowpane', { label: 'Windowpane Grid', getSvgDataUri: windowpaneSvg, tileSize: 28 }],
  ['matte-paper-grain', { label: 'Matte Paper Grain', getSvgDataUri: mattePaperGrainSvg }],
  ['warp-speed', { label: 'Stars', getSvgDataUri: starsSvg, tileSize: 96 }],
  ['targeting-grid', { label: 'Retro Target', getSvgDataUri: targetingGridSvg, tileSize: 128, opacity: 0.76 }],
  ['single-flower', { label: 'Flower', getSvgDataUri: singleFlowerSvg, tileSize: 96 }],
])

/** Ordered list of spacer tile pattern IDs for dropdowns */
export const FILLER_PATTERN_IDS = Array.from(FILLER_PATTERN_REGISTRY.keys())
export const GALACTIC_FILLER_PATTERN_IDS = ['warp-speed', 'targeting-grid'] as const

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

type InverseTileKind = 'logoTitle' | 'sectionHeader'

interface InverseTileChrome {
  colors: InverseTileColorsV2
  borderWidth: number
}

function getInverseTileChrome(palette: ColorPaletteV2, kind: InverseTileKind): InverseTileChrome {
  const configured = palette.colors.inverseTiles?.[kind]

  if (configured) {
    return {
      colors: configured,
      borderWidth: kind === 'logoTitle' ? 3 : 2,
    }
  }

  return kind === 'logoTitle'
    ? {
        colors: {
          background: blendHexTowards(
            palette.colors.menuTitle,
            palette.colors.accent ?? palette.colors.itemPrice,
            0.2
          ),
          text: palette.colors.background,
          border: palette.colors.accent ?? palette.colors.itemPrice ?? palette.colors.menuTitle,
        },
        borderWidth: 3,
      }
    : {
        colors: {
          background: blendHexTowards(
            palette.colors.surface ?? palette.colors.background,
            palette.colors.accent ?? palette.colors.itemPrice,
            0.2
          ),
          text: palette.colors.sectionHeader,
          border: palette.colors.border.medium,
        },
        borderWidth: 2,
      }
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

    case 'FLAGSHIP_CARD':
      return renderFlagshipCardContent(content as FlagshipCardContentV2, tile, options)
    
    case 'FILLER':
      return renderFillerContent(content as FillerContentV2, tile, options)
    
    case 'TEXT_BLOCK':
      return renderTextBlockContent(content as TextBlockContentV2, tile, options)
    
    case 'FOOTER_INFO':
      return renderFooterInfoContent(content as FooterInfoContentV2, tile, options)
    
    case 'DECORATIVE_DIVIDER':
      return renderDividerContent(content as DividerContentV2, tile, options)
    
    case 'BANNER':
      return renderBannerContent(content as BannerContentV2, tile, options)

    case 'BANNER_STRIP':
      return renderBannerStripContent(content as BannerStripContentV2, tile, options)
    
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
  type: 'text' | 'image' | 'indicator' | 'background' | 'svg'
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
  textShadow?: string
  whiteSpace?: string
  zIndex?: number
  /** Marks this image element as a cutout (transparent PNG, overflow visible, no background fill) */
  isCutout?: boolean
  /** CSS transform string (e.g. 'scale(1.5)') for per-item image zoom */
  transform?: string
  /** CSS transform-origin string (e.g. '50% 70%') paired with transform */
  transformOrigin?: string
  /** CSS writing-mode (e.g. 'vertical-rl') for rotated text */
  writingMode?: string
  /** CSS text-orientation paired with writingMode */
  textOrientation?: string
  /** CSS display override */
  display?: string
  /** CSS align-items override */
  alignItems?: string
  /** CSS justify-content override */
  justifyContent?: string
}

// ============================================================================
// Image Transform Helpers
// ============================================================================

/** Pick the single ImageTransform for the active image mode from a per-mode record. */
export function resolveTransformForMode(
  record: import('@/types').ImageTransformRecord | undefined,
  mode: string
): import('@/types').ImageTransform | undefined {
  if (!record) return undefined
  return record[mode]
}

/**
 * Compute objectPosition, transform, and transformOrigin CSS values from an ImageTransform.
 * baseX/baseY are the default focal percentages for the current image mode (e.g. 50 and 70 for stretch).
 * Returns only the fields that differ from the default (no transform when scale === 1.0).
 */
export function computeImageTransformStyle(
  imageTransform: import('@/types').ImageTransform | undefined,
  baseX: number,
  baseY: number,
  isCutoutMode?: boolean
): Pick<RenderStyle, 'objectPosition' | 'transform' | 'transformOrigin'> {
  if (!imageTransform) {
    const basePos = baseX === 50 && baseY === 50 ? 'center' : `center ${baseY}%`
    return { objectPosition: basePos }
  }
  const { offsetX = 0, offsetY = 0, scale = 1.0 } = imageTransform

  if (isCutoutMode) {
    // For cutout, we use translate to allow free movement independent of aspect ratio.
    // The image element size matches the oversized container, so % translates work perfectly.
    const transform = `translate(${offsetX}%, ${offsetY}%) scale(${scale})`
    return { 
      objectPosition: 'center',
      transform,
      transformOrigin: 'center'
    }
  }

  const posX = offsetX === 0 ? (baseX === 50 ? 'center' : `${baseX}%`) : `calc(${baseX}% + ${offsetX} * 1%)`
  const posY = offsetY === 0 ? (baseY === 50 ? 'center' : `${baseY}%`) : `calc(${baseY}% + ${offsetY} * 1%)`
  const objectPosition = `${posX} ${posY}`
  if (scale !== 1.0) {
    return { objectPosition, transform: `scale(${scale})`, transformOrigin: objectPosition }
  }
  return { objectPosition }
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
export function resolveSubElementTypography(
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
  const preset = FONT_STYLE_PRESETS[options.fontStylePreset ?? 'standard'] || FONT_STYLE_PRESETS.standard
  const isBodyLogoTile = tile.regionId === 'body'
  const inverseChrome = isBodyLogoTile ? getInverseTileChrome(palette, 'logoTitle') : undefined
  const inset = isBodyLogoTile
    ? Math.max(8, Math.min(14, tile.width * 0.08)) + (inverseChrome?.borderWidth ?? 0)
    : 0

  if (isBodyLogoTile) {
    elements.push({
      type: 'background',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: '',
      style: {
        backgroundColor: inverseChrome?.colors.background ?? blendHexTowards(
          palette.colors.surface ?? palette.colors.background,
          palette.colors.accent ?? palette.colors.itemPrice,
          0.1
        ),
        borderRadius: 0
      }
    })
    if (inverseChrome) {
      pushFrameBorders(elements, tile, inverseChrome.colors.border, inverseChrome.borderWidth)
    }
  }

  if (content.imageUrl) {
    elements.push({
      type: 'image',
      x: inset,
      y: inset,
      width: tile.width - inset * 2,
      height: tile.height - inset * 2,
      content: content.imageUrl,
      style: {
        objectFit: 'contain',
        objectPosition: 'center',
        backgroundColor: 'transparent',
        borderRadius: 0
      }
    })
  } else {
    // Fallback text logo
    elements.push({
      type: 'text',
      x: inset,
      y: inset,
      width: tile.width - inset * 2,
      height: tile.height - inset * 2,
      content: content.venueName || 'Logo',
      style: {
        fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xl,
        fontWeight: preset.bannerTitleWeight,
        fontFamily: preset.bannerTitleFamily,
        color: isBodyLogoTile
          ? (inverseChrome?.colors.text ?? blendHexTowards(palette.colors.menuTitle, palette.colors.accent ?? palette.colors.itemPrice, 0.35))
          : palette.colors.menuTitle,
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
  const galactic = isGalacticPalette(options)
  const tileStyle = (tile as any).style as TileStyleV2 | undefined

  // Banner-bar mode: when the YAML sets style.background.color = "bannerSurface",
  // render the title as a full-width colored strip using the palette banner colors.
  const isBannerBar = tileStyle?.background?.color === 'bannerSurface'

  const elements: RenderElement[] = []

  if (isBannerBar) {
    const preset = FONT_STYLE_PRESETS[options.fontStylePreset ?? 'standard'] || FONT_STYLE_PRESETS.standard
    const fontSize = Math.min(TYPOGRAPHY_TOKENS_V2.fontSize.xl, tile.height * 0.80)
    // Use palette surface color for the title bar — distinct from bannerSurface but still palette-aware
    const titleBarBg = palette.colors.surface ?? palette.colors.bannerSurface
    // Text uses menuTitle color which is designed to contrast with surface
    const titleBarText = palette.colors.menuTitle

    elements.push({
      type: 'background',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: '',
      style: { backgroundColor: titleBarBg }
    })
    elements.push({
      type: 'text',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: content.menuName,
      style: {
        fontSize,
        fontWeight: preset.bannerTitleWeight,
        fontFamily: preset.bannerTitleFamily,
        color: titleBarText,
        textAlign: 'center',
        letterSpacing: 2,
        textShadow: galactic ? neonTextGlow(palette, 'title') : undefined,
      }
    })
  } else {
    elements.push({
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
        textAlign: 'center',
        textShadow: galactic ? neonTextGlow(palette, 'title') : undefined
      }
    })
  }

  return { elements }
}

function renderSectionHeaderContent(
  content: SectionHeaderContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const palette = getPalette(options)
  const galactic = isGalacticPalette(options)
  const elements: RenderElement[] = []
  const isCompactHeaderTile = tile.regionId === 'body' && content.isCompactTile === true
  
  // Get tile styling from template (passed through tile.style)
  const tileStyle = (tile as any).style as TileStyleV2 | undefined
  
  // Apply typography styling
  const fontSet = tileStyle?.typography?.fontSet || 'modern-sans'
  const fontSize = tileStyle?.typography?.fontSize || '2xl'
  const fontWeight = tileStyle?.typography?.fontWeight || 'semibold'
  const textAlign = options.centreAlignment === true
    ? 'center'
    : options.centreAlignment === false
      ? 'left'
      : (tileStyle?.typography?.textAlign ?? 'center')
  const lineHeight = tileStyle?.typography?.lineHeight || 'normal'
  const letterSpacingOverride = tileStyle?.typography?.letterSpacing
  const decoration = tileStyle?.typography?.decoration
  
  // Spacing: padding from template (e.g. 24px top for subtitle, 8px left with decoration)
  const paddingLeft = tileStyle?.spacing?.paddingLeft ?? 0
  const paddingRight = tileStyle?.spacing?.paddingRight ?? paddingLeft
  const paddingTop = tileStyle?.spacing?.paddingTop ?? 0
  const effectivePaddingLeft = paddingLeft
  const effectivePaddingRight = paddingRight
  
  // Get font family from font set
  const fontFamily = getFontFamily(fontSet)
  
  // Apply font style preset override if set
  const presetConfig = options.fontStylePreset ? FONT_STYLE_PRESETS[options.fontStylePreset] : null
  const resolvedFontFamily = presetConfig
    ? presetConfig.sectionHeaderFamily
    : fontFamily
  const resolvedFontWeight = presetConfig ? presetConfig.sectionHeaderWeight : (TYPOGRAPHY_TOKENS_V2.fontWeight[fontWeight as FontWeightV2] || TYPOGRAPHY_TOKENS_V2.fontWeight.semibold)
  
  // For compact (1-column body) section header tiles, apply inverse chrome when
  // no explicit tileStyle background is set. This mirrors the logo tile behaviour.
  const inverseChrome = isCompactHeaderTile && !tileStyle?.background?.color
    ? getInverseTileChrome(palette, 'sectionHeader')
    : undefined

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
        borderRadius: isCompactHeaderTile ? 0 : (tileStyle.background.borderRadius || 0)
      }
    })
  } else if (inverseChrome) {
    elements.push({
      type: 'background',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: '',
      style: {
        backgroundColor: inverseChrome.colors.background,
        borderRadius: 0
      }
    })
    pushFrameBorders(elements, tile, inverseChrome.colors.border, inverseChrome.borderWidth)
  }

  // Galactic section framing is handled at the region level (web/PDF renderer),
  // so we avoid adding any header-only borders here.
  
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
  
  // Apply textTransform and letterSpacing from tile style
  const textTransformVal = tileStyle?.typography?.textTransform || undefined
  let letterSpacing =
    letterSpacingOverride !== undefined
      ? letterSpacingOverride
      : textTransformVal === 'uppercase'
        ? 1.5
        : undefined

  const [labelText, labelCssTransform] = applyTextTransform(content.label, textTransformVal)
  const baseResolvedFontSize = (TYPOGRAPHY_TOKENS_V2.fontSize[fontSize as FontSizeV2] || TYPOGRAPHY_TOKENS_V2.fontSize['2xl']) * (presetConfig?.sectionHeaderFontSizeMultiplier ?? 1)
  let resolvedFontSize = baseResolvedFontSize
  const decorationWidth = 14
  const decorationGap = 4
  const showDecoration = decoration && decoration !== 'none'
  const compactTextWidth = Math.max(
    0,
    tile.width
      - effectivePaddingLeft
      - effectivePaddingRight
      - (showDecoration ? decorationWidth + decorationGap : 0)
  )
  if (isCompactHeaderTile && labelText) {
    const compactMinFontSize = 11
    const compactMaxByHeight = Math.max(compactMinFontSize, tile.height * 0.42)
    resolvedFontSize = Math.min(baseResolvedFontSize, compactMaxByHeight)

    while (resolvedFontSize > compactMinFontSize && estimateUnboundedLineCount(labelText, compactTextWidth, resolvedFontSize) > 1) {
      resolvedFontSize -= 1
    }
    resolvedFontSize = Math.max(compactMinFontSize, resolvedFontSize)

    if (letterSpacing !== undefined) {
      letterSpacing = resolvedFontSize <= baseResolvedFontSize * 0.8
        ? Math.min(letterSpacing, 0.2)
        : Math.min(letterSpacing, 0.4)
    }
  }
  const resolvedLineHeight = TYPOGRAPHY_TOKENS_V2.lineHeight[lineHeight as LineHeightV2] || TYPOGRAPHY_TOKENS_V2.lineHeight.normal

  // Anchor text just above the bottom border so heading-to-divider proximity
  // is consistent regardless of tile height (which varies with rowHeight).
  const sectionTextLineHeight = resolvedFontSize * resolvedLineHeight
  const hasBottomBorder = tileStyle?.border?.sides?.includes('bottom') && (tileStyle?.border?.width ?? 0) > 0
  const explicitPaddingTop = tileStyle?.spacing?.paddingTop
  let textY: number
  if (explicitPaddingTop !== undefined && explicitPaddingTop > 0) {
    // Template explicitly sets paddingTop — use it directly so the YAML controls
    // text placement regardless of tile height or border presence.
    textY = explicitPaddingTop
  } else if (hasBottomBorder) {
    const borderTopEdge = tile.height - (tileStyle!.border!.width ?? 0)
    textY = Math.max(2, borderTopEdge - sectionTextLineHeight)
  } else {
    textY = paddingTop || tile.height / 2
  }
  // For compact (1-column) tiles, only override with vertical centering when
  // no explicit paddingTop is set in the template — otherwise respect the YAML value.
  if (isCompactHeaderTile && !explicitPaddingTop) {
    textY = Math.max(4, (tile.height - sectionTextLineHeight) / 2)
  }

  // Default: left-aligned label with optional decoration directly before it
  let decorationX = effectivePaddingLeft
  let textStartX = effectivePaddingLeft + (showDecoration ? decorationWidth + decorationGap : 0)
  let textWidth = compactTextWidth

  // When a decoration is present and textAlign is "center", treat the
  // bullet + label as a single group and approximate-center that group
  // within the tile. This keeps the bullet visually near the left-most
  // character while centering the heading as a whole.
  if (showDecoration && textAlign === 'center') {
    const label = content.label || ''
    const approxCharWidth = resolvedFontSize * 0.55
    const approxLabelWidthRaw = label.length * approxCharWidth

    // Constrain the estimated width to avoid overshooting the tile
    const maxLabelWidth = Math.max(0, tile.width - effectivePaddingLeft - effectivePaddingRight - decorationWidth - decorationGap)
    const approxLabelWidth = Math.min(Math.max(0, approxLabelWidthRaw), maxLabelWidth)

    const groupWidth = decorationWidth + decorationGap + approxLabelWidth
    const groupLeft = Math.max(effectivePaddingLeft, (tile.width - groupWidth) / 2)

    decorationX = groupLeft
    textStartX = groupLeft + decorationWidth + decorationGap
    textWidth = approxLabelWidth
  }

  if (showDecoration) {
    const decorationChar = decoration === 'bullet' ? '•' : decoration === 'diamond' ? '◆' : '·'
    const decorationFontSize = Math.round(Math.max(12, Math.min(18, resolvedFontSize * 0.55)))
    const textLineHeight = resolvedFontSize * resolvedLineHeight
    const decorationLineHeight = 1.2
    const decorationHeight = decorationFontSize * decorationLineHeight
    const textVerticalCenter = textY + textLineHeight / 2
    const decorationY = textVerticalCenter - decorationHeight / 2
    const decorationColor =
      tileStyle?.typography?.decorationColor ??
      tileStyle?.border?.color ??
      palette.colors.itemPrice
    elements.push({
      type: 'text',
      x: decorationX,
      y: decorationY,
      width: decorationWidth,
      content: decorationChar,
      style: {
        fontSize: decorationFontSize,
        fontWeight: resolvedFontWeight,
        color: decorationColor,
        fontFamily: resolvedFontFamily,
        textAlign: 'left'
      }
    })
  }

  elements.push({
    type: 'text',
    x: textStartX,
    y: textY,
    width: textWidth,
    content: labelText,
    style: {
      fontSize: resolvedFontSize,
      fontWeight: resolvedFontWeight,
      lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight[lineHeight as LineHeightV2] || TYPOGRAPHY_TOKENS_V2.lineHeight.normal,
      color: tileStyle?.typography?.color || (inverseChrome ? inverseChrome.colors.text : palette.colors.sectionHeader),
      // For centered headings with a decoration, we approximate-center the
      // bullet + label group via geometry, so the label's own textAlign
      // remains left-aligned to keep the bullet close to the first letter.
      textAlign: (showDecoration && textAlign === 'center' ? 'left' : textAlign) as TextAlignV2,
      fontFamily: resolvedFontFamily,
      textTransform: labelCssTransform,
      letterSpacing,
      textShadow: galactic ? neonTextGlow(palette, 'header') : undefined
    }
  })

  return { elements }
}

/** Sizing for the featured “Popular” sticker; scales with item tile width (grid cell). */
export interface PopularBadgeMetrics {
  badgeW: number
  badgeH: number
  fontSize: number
  borderRadius: number
  /** Pixels the badge extends past the top and right of the tile (pt space). */
  overlap: number
  /** Extra top padding (pt) for ITEM_TEXT_ROW so title clears the sticker. */
  textRowTopReserve: number
  boxShadow: string
}

export function getPopularBadgeMetrics(
  tileWidthPt: number,
  options?: { glowColor?: string }
): PopularBadgeMetrics {
  const layoutScale = Math.min(1.5, Math.max(1, tileWidthPt / 108))
  // ~midway between first version (h≈11, no overlap) and the larger sticker (h≈20, overlap≈6 at scale 1)
  const overlap = Math.round(3 * layoutScale)
  const badgeW = Math.round(53 * layoutScale)
  const badgeH = Math.round(15.5 * layoutScale)
  const fontSize = Math.round(7.35 * layoutScale * 10) / 10
  const borderRadius = Math.max(2, Math.round(3 * layoutScale))
  const textRowTopReserve = overlap + badgeH + 3
  const lift = Math.round(2 * layoutScale)
  const blur = Math.round(10 * layoutScale)
  const base = [
    `0 ${lift}px ${blur}px rgba(0,0,0,0.3)`,
    `0 1px ${Math.max(2, Math.round(2 * layoutScale))}px rgba(0,0,0,0.2)`,
    `0 0 0 1px rgba(0,0,0,0.08)`,
  ]
  const glow = options?.glowColor
    ? [
        `0 0 ${Math.max(8, Math.round(10 * layoutScale))}px ${options.glowColor}55`,
        `0 0 ${Math.max(14, Math.round(18 * layoutScale))}px ${options.glowColor}33`,
      ]
    : []
  const boxShadow = [...base, ...glow].join(', ')
  return { badgeW, badgeH, fontSize, borderRadius, overlap, textRowTopReserve, boxShadow }
}

/** Compact circular featured mark when Image Style is none (text-only layout). */
export interface FeaturedStarBadgeMetrics {
  size: number
  overlap: number
  starFontSize: number
  borderRadius: number
  boxShadow: string
}

export function getFeaturedStarBadgeMetrics(tileWidthPt: number): FeaturedStarBadgeMetrics {
  const layoutScale = Math.min(1.12, Math.max(0.88, tileWidthPt / 130))
  const size = Math.max(12, Math.round(15 * layoutScale))
  const overlap = Math.round(2 * layoutScale)
  const starFontSize = Math.round(9.5 * layoutScale * 10) / 10
  const borderRadius = size / 2
  const boxShadow = `0 1px ${Math.max(2, Math.round(4 * layoutScale))}px rgba(0,0,0,0.2)`
  return { size, overlap, starFontSize, borderRadius, boxShadow }
}

export interface FlagshipBadgeMetrics {
  badgeW: number
  badgeH: number
  fontSize: number
  borderRadius: number
  overlap: number
  boxShadow: string
}

export interface FlagshipChromeV2 {
  frameOuter: string
  panel: string
  badgeFill: string
  badgeText: string
  badgeLabel: string
  badgePosition: 'left' | 'right'
  badgeRadius: number
  price: string
  borderWidth: number
}

export interface FeaturedChromeV2 {
  panel: string
  borderColor: string
  borderWidth: number
  badgeFill: string
  badgeText: string
  badgeLabel: string
  badgePosition: 'left' | 'right'
  badgeRadius: number
}

export function getFlagshipBadgeMetrics(
  tileWidthPt: number,
  options?: { glowColor?: string }
): FlagshipBadgeMetrics {
  const layoutScale = Math.min(1.24, Math.max(1, tileWidthPt / 190))
  const overlap = Math.round(6 * layoutScale)
  const badgeW = Math.round(92 * layoutScale)
  const badgeH = Math.round(24 * layoutScale)
  const fontSize = Math.round(8.8 * layoutScale * 10) / 10
  const borderRadius = Math.max(7, Math.round(7 * layoutScale))
  const base = [
    `0 ${Math.max(2, Math.round(2 * layoutScale))}px ${Math.max(10, Math.round(10 * layoutScale))}px rgba(76,53,2,0.24)`,
    `0 0 0 1px rgba(255,248,220,0.28)`,
  ]
  const glow = options?.glowColor
    ? [
        `0 0 ${Math.max(10, Math.round(14 * layoutScale))}px ${options.glowColor}44`,
        `0 0 ${Math.max(18, Math.round(24 * layoutScale))}px ${options.glowColor}22`,
      ]
    : []
  const boxShadow = [...base, ...glow].join(', ')

  return { badgeW, badgeH, fontSize, borderRadius, overlap, boxShadow }
}

export function getFlagshipChrome(
  palette?: ColorPaletteV2,
  tileStyle?: TileStyleV2,
  isGalactic?: boolean
): FlagshipChromeV2 {
  const promoted = palette?.colors.promoted.flagship
  const frameOuter = promoted?.border ?? '#7F5F14'
  const panel = promoted?.background ?? '#E0D8C2'
  const badgeFill = promoted?.badgeFill ?? '#745711'
  const badgeText = promoted?.badgeText ?? '#FFF9E8'
  const defaultBadgeLabel = isGalactic ? 'Stellar Special' : 'House Special'
  const badgeLabel = tileStyle?.badge?.label ?? defaultBadgeLabel
  const badgePosition = tileStyle?.badge?.position ?? 'left'
  const badgeRadius = tileStyle?.badge?.borderRadius ?? 7
  const price = promoted?.price ?? (palette?.colors.itemPrice ?? COLOR_TOKENS_V2.text.primary)
  const borderWidth = tileStyle?.border?.width ?? 7

  return {
    frameOuter,
    panel,
    badgeFill,
    badgeText,
    badgeLabel,
    badgePosition,
    badgeRadius,
    price,
    borderWidth,
  }
}

export function resolveFlagshipTextSlots(args: {
  availableHeight: number
  nameMaxLines: number
  minNameLines?: number
  descMaxLines: number
  hasDescription: boolean
  nameLineHeight: number
  descLineHeight: number
  priceLineHeight: number
}): {
  nameLines: number
  descLines: number
  nameHeight: number
  descHeight: number
  gapNameToDesc: number
  gapDescToPrice: number
  totalHeight: number
} {
  const {
    availableHeight,
    nameMaxLines,
    minNameLines = 1,
    descMaxLines,
    hasDescription,
    nameLineHeight,
    descLineHeight,
    priceLineHeight,
  } = args

  let nameLines = Math.max(1, nameMaxLines)
  let descLines = hasDescription ? Math.max(0, descMaxLines) : 0
  let gapNameToDesc: number = descLines > 0 ? SPACING_V2.nameToDesc : 0
  let gapDescToPrice: number = SPACING_V2.descToPrice

  const calcTotalHeight = () =>
    (nameLines * nameLineHeight) +
    (descLines > 0 ? gapNameToDesc + (descLines * descLineHeight) : 0) +
    gapDescToPrice +
    priceLineHeight

  let totalHeight = calcTotalHeight()
  if (totalHeight > availableHeight) {
    const totalGap = gapNameToDesc + gapDescToPrice
    const fixedHeight =
      (nameLines * nameLineHeight) +
      (descLines * descLineHeight) +
      priceLineHeight
    const availableForGaps = Math.max(0, availableHeight - fixedHeight)
    const gapScale = totalGap > 0 ? Math.min(1, availableForGaps / totalGap) : 0
    gapNameToDesc = descLines > 0 ? Math.max(2, gapNameToDesc * gapScale) : 0
    gapDescToPrice = Math.max(2, gapDescToPrice * gapScale)
    totalHeight = calcTotalHeight()

    while (totalHeight > availableHeight && descLines > 0) {
      descLines--
      if (descLines === 0) gapNameToDesc = 0
      totalHeight = calcTotalHeight()
    }

    while (totalHeight > availableHeight && nameLines > minNameLines) {
      nameLines--
      totalHeight = calcTotalHeight()
    }
  }

  return {
    nameLines,
    descLines,
    nameHeight: nameLines * nameLineHeight,
    descHeight: descLines * descLineHeight,
    gapNameToDesc,
    gapDescToPrice,
    totalHeight,
  }
}

export function resolveFlagshipTitleFit(args: {
  text: string
  availableWidth: number
  preferredFontSize: number
  preferredLines?: number
  minFontSize?: number
}): {
  fontSize: number
  lineBudget: number
} {
  const {
    text,
    availableWidth,
    preferredFontSize,
    preferredLines = 2,
    minFontSize = Math.min(preferredFontSize, 9),
  } = args

  if (!text || availableWidth <= 0) {
    return {
      fontSize: preferredFontSize,
      lineBudget: preferredLines,
    }
  }

  let fontSize = preferredFontSize
  while (
    fontSize > minFontSize &&
    estimateLineCount(text, availableWidth, fontSize, preferredLines) > preferredLines
  ) {
    fontSize -= 1
  }

  return {
    fontSize,
    lineBudget: preferredLines,
  }
}

export function getFeaturedChrome(
  palette?: ColorPaletteV2,
  tileStyle?: TileStyleV2
): FeaturedChromeV2 {
  const promoted = palette?.colors.promoted.featured

  return {
    panel: promoted?.background ?? (palette?.colors.surface ?? palette?.colors.background ?? COLOR_TOKENS_V2.background.white),
    borderColor: promoted?.border ?? (palette?.colors.accent ?? palette?.colors.itemPrice ?? COLOR_TOKENS_V2.text.primary),
    borderWidth: tileStyle?.border?.width ?? 2,
    badgeFill: promoted?.badgeFill ?? (palette?.colors.accent ?? palette?.colors.itemPrice ?? COLOR_TOKENS_V2.text.primary),
    badgeText: promoted?.badgeText ?? '#ffffff',
    badgeLabel: tileStyle?.badge?.label ?? 'Popular',
    badgePosition: tileStyle?.badge?.position ?? 'right',
    badgeRadius: tileStyle?.badge?.borderRadius ?? 3,
  }
}

/** Small accent disc + star (Image Style “none”) — same accent chrome as “Popular”, less vertical footprint. */
function pushFeaturedStarBadge(
  elements: RenderElement[],
  tile: TileInstanceV2,
  chrome: FeaturedChromeV2,
  fontFamily: string,
  metrics: FeaturedStarBadgeMetrics
): void {
  const { size, overlap, starFontSize, borderRadius, boxShadow } = metrics
  // Slight nudge past the featured outline so the disc does not sit flush on the border ring.
  const nudgeX = 2
  const nudgeY = 2
  const x = chrome.badgePosition === 'left'
    ? -overlap - nudgeX
    : tile.width - size + overlap + nudgeX
  const y = -overlap - nudgeY
  elements.push({
    type: 'text',
    x,
    y,
    width: size,
    height: size,
    content: '\u2605',
    style: {
      fontSize: starFontSize,
      fontWeight: 700,
      fontFamily,
      // Match “Popular” pill: light glyph on accent fill (reads across palettes).
      color: chrome.badgeText,
      backgroundColor: chrome.badgeFill,
      textAlign: 'center',
      borderRadius: chrome.badgeRadius ?? borderRadius,
      lineHeight: 1,
      zIndex: 35,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow,
    },
  })
}

function pushFlagshipBadge(
  elements: RenderElement[],
  tile: TileInstanceV2,
  chrome: FlagshipChromeV2,
  fontFamily: string,
  metrics: FlagshipBadgeMetrics
): void {
  const { badgeW, badgeH, fontSize, borderRadius, overlap, boxShadow } = metrics
  const badgeX = chrome.badgePosition === 'left' ? -overlap : tile.width - badgeW + overlap
  const badgeY = -overlap

  elements.push({
    type: 'text',
    x: badgeX,
    y: badgeY,
    width: badgeW,
    height: badgeH,
    content: chrome.badgeLabel,
    style: {
      fontSize,
      fontWeight: 800,
      fontFamily,
      color: chrome.badgeText,
      backgroundColor: chrome.badgeFill,
      textAlign: 'center',
      borderRadius: chrome.badgeRadius ?? borderRadius,
      zIndex: 35,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow,
      letterSpacing: 0.2,
    },
  })
}

function pushPopularBadge(
  elements: RenderElement[],
  tile: TileInstanceV2,
  chrome: FeaturedChromeV2,
  fontFamily: string,
  metrics: PopularBadgeMetrics
): void {
  const { badgeW, badgeH, fontSize, borderRadius, overlap, boxShadow } = metrics
  const x = chrome.badgePosition === 'left' ? -overlap : tile.width - badgeW + overlap
  const y = -overlap
  elements.push({
    type: 'text',
    x,
    y,
    width: badgeW,
    height: badgeH,
    content: chrome.badgeLabel,
    style: {
      fontSize,
      fontWeight: 700,
      fontFamily,
      color: chrome.badgeText,
      backgroundColor: chrome.badgeFill,
      textAlign: 'center',
      borderRadius: chrome.badgeRadius ?? borderRadius,
      zIndex: 35,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow,
    },
  })
}

function pushFrameBorders(
  elements: RenderElement[],
  tile: TileInstanceV2,
  color: string,
  width: number
): void {
  if (width <= 0) return

  elements.push(
    {
      type: 'background',
      x: 0,
      y: 0,
      width: tile.width,
      height: width,
      content: '',
      style: { backgroundColor: color },
    },
    {
      type: 'background',
      x: 0,
      y: tile.height - width,
      width: tile.width,
      height: width,
      content: '',
      style: { backgroundColor: color },
    },
    {
      type: 'background',
      x: 0,
      y: 0,
      width,
      height: tile.height,
      content: '',
      style: { backgroundColor: color },
    },
    {
      type: 'background',
      x: tile.width - width,
      y: 0,
      width,
      height: tile.height,
      content: '',
      style: { backgroundColor: color },
    }
  )
}

function renderItemContent(
  content: ItemContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = []
  const palette = getPalette(options)
  const galactic = isGalacticPalette(options)
  const tileStyle = tile.style as TileStyleV2 | undefined
  const featuredChrome = content.isFeatured ? getFeaturedChrome(palette, tileStyle) : undefined

  // Use template contentBudget padding when available, fall back to global default
  const padTop = tile.contentBudget?.paddingTop ?? SPACING_V2.tilePadding
  const padBottom = tile.contentBudget?.paddingBottom ?? SPACING_V2.tilePadding
  const padH = SPACING_V2.tilePadding // horizontal padding unchanged

  const nameTypo = resolveSubElementTypography(tileStyle, 'name', {
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xsm,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.semibold,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
  })
  const descTypo = resolveSubElementTypography(tileStyle, 'description', {
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xxs,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.normal,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.relaxed,
  })
  const priceTypo = resolveSubElementTypography(tileStyle, 'price', {
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xxxs,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
  })

  const imageMode: ImageModeV2 = options.imageMode || 'stretch'
  const isBackgroundMode = imageMode === 'background'
  const isCircularMode = imageMode === 'compact-circle'
  const isCutoutMode = imageMode === 'cutout'
  const isImageNoneLayout = imageMode === 'none'
  const defaultImageBorderRadius = isCircularMode ? undefined : 8

  /**
   * Featured tiles get a 2px border on the wrapper; children paint above that border in CSS,
   * so imagery must be inset in pt space to sit inside the border ring.
   */
  const featuredContentInset = content.isFeatured
    ? Math.max(3, (featuredChrome?.borderWidth ?? 2) + 1)
    : 0

  /** Extra top offset for all text in background-image mode (clears “Popular” + reads lower on the photo). */
  const BACKGROUND_IMAGE_TEXT_TOP_BIAS_PT = 20

  const nameFontSize = isBackgroundMode
    ? Math.min(nameTypo.fontSize + BG_IMAGE_TEXT.nameSizeBump, BG_IMAGE_TEXT.nameSizeMax)
    : nameTypo.fontSize
  const priceFontSize = isBackgroundMode
    ? Math.min(priceTypo.fontSize + BG_IMAGE_TEXT.priceSizeBump, BG_IMAGE_TEXT.priceSizeMax)
    : priceTypo.fontSize
  const nameLineHeight = nameFontSize * nameTypo.lineHeight
  const nameMaxLines = tile.contentBudget?.nameLines ?? 3
  const descMaxLines = tile.contentBudget?.descLines ?? 3
  const textWidth = tile.width - (padH * 2)

  // --- Content-aware height estimation ---
  // Estimate actual line counts from content length rather than always reserving max lines.
  // The CSS WebkitLineClamp still caps rendering; this only affects Y positioning.
  const estNameLines = estimateLineCount(content.name, textWidth, nameFontSize, nameMaxLines)
  const estDescLines = content.description
    ? estimateLineCount(content.description, textWidth, descTypo.fontSize, descMaxLines)
    : 0

  const nameHeight = nameLineHeight * estNameLines
  const descLineHeight = descTypo.fontSize * descTypo.lineHeight
  const descHeight = descLineHeight * estDescLines
  const priceLineHeight = priceFontSize * priceTypo.lineHeight
  const hasDesc = estDescLines > 0
  const isTextRowTile = tile.type === 'ITEM_TEXT_ROW'

  const featuredBadgeFont =
    resolveSubElementTypography(tileStyle, 'name', {
      fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xsm,
      fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.semibold,
      lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
    }).fontFamily || TYPOGRAPHY_TOKENS_V2.fontFamily.primary

  const featuredStarMetrics =
    content.isFeatured && isImageNoneLayout ? getFeaturedStarBadgeMetrics(tile.width) : null
  const featuredBadgeMetrics =
    content.isFeatured && !isImageNoneLayout
      ? getPopularBadgeMetrics(tile.width, galactic ? { glowColor: '#57E6FF' } : undefined)
      : null

  if (content.isFeatured && featuredChrome) {
    elements.push({
      type: 'background',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: '',
      style: {
        backgroundColor: featuredChrome.panel,
        borderRadius: tileStyle?.background?.borderRadius ?? 0,
      }
    })
    pushFrameBorders(elements, tile, featuredChrome.borderColor, featuredChrome.borderWidth)
  }

  // ITEM_TEXT_ROW: fixed-slot layout with top-aligned content group.
  // All tiles of the same height get identical descY and priceY positions,
  // preventing wrapped titles from squashing descriptions and keeping
  // vertical alignment uniform across tiles in the same row.
  if (isTextRowTile) {
    const nameReservedLines = nameMaxLines
    const nameReservedHeight = nameReservedLines * nameLineHeight
    // ITEM_TEXT_ROW is always a text-only footprint (no image strip). Reserving vertical space for the
    // “Popular” badge shrinks usableHeight and pushes description/price out of short tiles — especially
    // when previews incorrectly passed imageMode 'stretch' while the layout used textOnly rows.
    // The badge overlays the top-right; it must not participate in the vertical slot budget.
    const featuredTextRowReserve = 0
    const bgTextTopBias = isBackgroundMode ? BACKGROUND_IMAGE_TEXT_TOP_BIAS_PT : 0
    const usableHeight =
      tile.height - padTop - padBottom - featuredTextRowReserve - bgTextTopBias

    // Prefer full SPACING_V2 gaps; fall back to compact gaps when it unlocks more desc lines
    let gapNameToDesc: number = SPACING_V2.nameToDesc
    let gapDescToPrice: number = SPACING_V2.descToPrice
    const spaceFullGaps = usableHeight - nameReservedHeight - gapNameToDesc - gapDescToPrice - priceLineHeight
    const descLinesFullGaps = Math.max(0, Math.floor(spaceFullGaps / descLineHeight))
    if (descLinesFullGaps < 2 && hasDesc) {
      const compactSpace = usableHeight - nameReservedHeight - 4 - 4 - priceLineHeight
      const descLinesCompact = Math.max(0, Math.floor(compactSpace / descLineHeight))
      if (descLinesCompact > descLinesFullGaps) {
        gapNameToDesc = 4
        gapDescToPrice = 4
      }
    }

    // How many desc lines fit after reserving name + gaps + price?
    const spaceForDesc = usableHeight - nameReservedHeight - gapNameToDesc - gapDescToPrice - priceLineHeight
    const maxDescFromSpace = Math.max(0, Math.floor(spaceForDesc / descLineHeight))
    const descReservedLines = Math.min(maxDescFromSpace, 2)
    const descReservedHeight = descReservedLines * descLineHeight
    const descLinesToRender = hasDesc ? Math.min(estDescLines, descReservedLines) : 0

    if (content.isFeatured && featuredStarMetrics && featuredChrome) {
      pushFeaturedStarBadge(elements, tile, featuredChrome, featuredBadgeFont, featuredStarMetrics)
    } else if (content.isFeatured && featuredBadgeMetrics && featuredChrome) {
      pushPopularBadge(elements, tile, featuredChrome, featuredBadgeFont, featuredBadgeMetrics)
    }

    const nameX = (tile.width - textWidth) / 2
    const nameY = padTop + featuredTextRowReserve + bgTextTopBias
    const descY = nameY + nameReservedHeight + gapNameToDesc
    const priceY = descY + descReservedHeight + gapDescToPrice

    const currencyCode = content.currency || 'USD'
    const priceText = formatCurrency(content.price, currencyCode)

    elements.push({
      type: 'text',
      x: nameX,
      y: nameY,
      width: textWidth,
      height: nameReservedHeight,
      content: applyTextTransform(content.name, nameTypo.textTransform)[0],
      style: {
        fontSize: nameFontSize,
        fontWeight: nameTypo.fontWeight,
        fontFamily: nameTypo.fontFamily,
        lineHeight: nameTypo.lineHeight,
        maxLines: nameReservedLines,
        color: palette.colors.itemTitle,
        textAlign: nameTypo.textAlign,
        textTransform: applyTextTransform(content.name, nameTypo.textTransform)[1],
      }
    })

    if (descLinesToRender > 0 && content.description) {
      elements.push({
        type: 'text',
        x: nameX,
        y: descY,
        width: textWidth,
        height: descLineHeight * descLinesToRender,
        content: applyTextTransform(content.description, descTypo.textTransform)[0],
        style: {
          fontSize: descTypo.fontSize,
          fontWeight: descTypo.fontWeight,
          fontFamily: descTypo.fontFamily,
          lineHeight: descTypo.lineHeight,
          maxLines: descLinesToRender,
          color: palette.colors.itemDescription,
          textAlign: descTypo.textAlign,
          textTransform: applyTextTransform(content.description, descTypo.textTransform)[1],
        }
      })
    }

    elements.push({
      type: 'text',
      x: nameX,
      y: priceY,
      width: textWidth,
      height: priceLineHeight,
      content: priceText,
      style: {
        fontSize: priceFontSize,
        fontWeight: priceTypo.fontWeight,
        fontFamily: priceTypo.fontFamily,
        lineHeight: priceTypo.lineHeight,
        maxLines: 1,
        color: palette.colors.itemPrice,
        textAlign: priceTypo.textAlign,
        textTransform: priceTypo.textTransform,
      }
    })

    return { elements }
  }

  // Compute the image portion height (0 when no image or background mode)
  let imageBlockHeight = 0
  let imageComputedWidth = 0
  let imageComputedHeight = 0
  let imageComputedX = 0
  let imageComputedBorderRadius = defaultImageBorderRadius ?? 8
  /** Horizontal/top inset for stretch mode (1px default; larger when featured so imagery clears the wrapper border). */
  let stretchSideInset = 1
  const textUsableHeight =
    tile.height - padTop - padBottom - (isBackgroundMode ? BACKGROUND_IMAGE_TEXT_TOP_BIAS_PT : 0)
  // 'none' = text-only layout: no image slot or placeholder (imageMode still comes from template/preview).
  const showImage =
    content.type === 'ITEM_CARD' &&
    content.showImage &&
    !isBackgroundMode &&
    !isImageNoneLayout

  if (showImage) {
    const nameReserve = nameLineHeight * nameMaxLines
    const descReserve = content.description
      ? (descLineHeight * descMaxLines) + SPACING_V2.nameToDesc
      : 0
    const priceReserve = priceLineHeight + SPACING_V2.descToPrice
    const textTotal = nameReserve + descReserve + priceReserve
    // stretch/cutout mode: image starts at y:0 so padTop is not subtracted; afterImage gap is also removed
    const stretchOverhead = (imageMode === 'stretch' || isCutoutMode) ? 0 : padTop + SPACING_V2.afterImage
    const availableForImage = Math.max(0, textUsableHeight - stretchOverhead - textTotal)

    if (imageMode === 'compact-rect') {
      const innerW = tile.width - 2 * featuredContentInset
      imageComputedWidth = innerW * 0.6
      imageComputedHeight = imageComputedWidth * 0.75
      if (imageComputedHeight > availableForImage) {
        imageComputedHeight = availableForImage
        imageComputedWidth = imageComputedHeight / 0.75
      }
      imageComputedX = featuredContentInset + (innerW - imageComputedWidth) / 2
    } else if (isCutoutMode) {
      // Cutout: container is modestly larger than the tile so the dish can protrude
      // slightly on all sides while keeping the drag/edit area predictably small.
      // object-fit: contain shows the full transparent PNG; overflow:visible on the
      // tile lets the dish extend beyond tile bounds; z-index keeps it above neighbours.
      const cutoutScale = 1.5
      const layoutHeight = Math.min(availableForImage, tile.width * 0.85)
      const baseCutoutW = tile.width * cutoutScale
      const baseCutoutH = layoutHeight * cutoutScale
      imageComputedWidth = baseCutoutW - 2 * featuredContentInset
      imageComputedHeight = baseCutoutH - 2 * featuredContentInset
      imageComputedX = (tile.width - imageComputedWidth) / 2
      imageComputedBorderRadius = 0
    } else if (isCircularMode) {
      const innerW = tile.width - 2 * featuredContentInset
      const diameter = Math.min(innerW * 0.45, availableForImage)
      imageComputedWidth = diameter
      imageComputedHeight = diameter
      imageComputedX = featuredContentInset + (innerW - imageComputedWidth) / 2
      imageComputedBorderRadius = diameter / 2
    } else {
      // stretch mode: edge-to-edge; featured tiles inset so imagery does not paint over the wrapper border
      stretchSideInset = featuredContentInset > 0 ? featuredContentInset : 1
      imageComputedWidth = tile.width - 2 * stretchSideInset
      const maxStretchH =
        availableForImage - (featuredContentInset > 0 ? 2 * featuredContentInset : 0)
      const ideal4by3 = imageComputedWidth * 0.9
      imageComputedHeight = Math.max(0, Math.min(ideal4by3, maxStretchH))
      imageComputedX = stretchSideInset
      imageComputedBorderRadius = 0
    }
    // stretch mode: no afterImage gap — text starts immediately below the image
    // cutout mode: use original layout height for text positioning (dish is oversized via cutoutScale)
    if (isCutoutMode) {
      imageBlockHeight = Math.min(availableForImage, tile.width * 0.85)
    } else if (imageMode === 'stretch') {
      const imageTop = stretchSideInset
      imageBlockHeight = Math.max(
        imageComputedHeight,
        imageTop + imageComputedHeight - padTop
      )
    } else {
      imageBlockHeight = imageComputedHeight + SPACING_V2.afterImage
    }
  }

  // Fit content within tile: compress gaps first, then reduce line estimates if needed.
  // Reserve fixed line counts for name AND description so all tiles of the same height
  // get identical desc-Y and price-Y, regardless of actual text length.
  const usableHeight = textUsableHeight
  let gapNameToDesc: number = hasDesc ? SPACING_V2.nameToDesc : 0
  let gapDescToPrice: number = SPACING_V2.descToPrice
  const descReservedLines = hasDesc ? Math.min(descMaxLines, 3) : 0
  let fitNameHeight = nameLineHeight * nameMaxLines
  let fitDescHeight = descLineHeight * descReservedLines
  let fitNameLines = nameMaxLines
  let fitDescLines = descReservedLines

  const calcContent = () => imageBlockHeight + fitNameHeight + gapNameToDesc + fitDescHeight + gapDescToPrice + priceLineHeight
  let contentHeight = calcContent()

  if (contentHeight > usableHeight) {
    const fixedContent = imageBlockHeight + fitNameHeight + fitDescHeight + priceLineHeight
    const totalGap = gapNameToDesc + gapDescToPrice
    const availableForGaps = Math.max(0, usableHeight - fixedContent)
    const scale = totalGap > 0 ? Math.min(1, availableForGaps / totalGap) : 0
    gapNameToDesc = Math.max(2, gapNameToDesc * scale)
    gapDescToPrice = Math.max(2, gapDescToPrice * scale)
    contentHeight = calcContent()

    // If still overflows after gap compression, preserve at least two description
    // lines before sacrificing extra name lines. Descriptions carry more meaning
    // in compact photo layouts, especially stretch/cutout modes.
    while (contentHeight > usableHeight && fitNameLines > 1) {
      fitNameLines--
      fitNameHeight = nameLineHeight * fitNameLines
      contentHeight = calcContent()
    }
    while (contentHeight > usableHeight && fitDescLines > 2) {
      fitDescLines--
      fitDescHeight = descLineHeight * fitDescLines
      contentHeight = calcContent()
    }
    while (contentHeight > usableHeight && fitDescLines > 1) {
      fitDescLines--
      fitDescHeight = descLineHeight * fitDescLines
      contentHeight = calcContent()
    }
  }

  // Top-align content within tile so names are consistently positioned across all tiles in the same row.
  // Centering would cause names to float at different heights depending on description length.
  const yOffset = padTop
  let currentY =
    yOffset +
    (content.type === 'ITEM_CARD' && isBackgroundMode ? BACKGROUND_IMAGE_TEXT_TOP_BIAS_PT : 0)

  // --- Background image mode (full-bleed, renders before text) ---
  if (content.type === 'ITEM_CARD' && content.showImage && isBackgroundMode) {
    const bg = featuredContentInset
    const bgW = tile.width - 2 * bg
    const bgH = tile.height - 2 * bg
    if (content.imageUrl) {
      const persistedBgTransform = resolveTransformForMode(content.imageTransform, imageMode)
      const effectiveTransform = options.imageTransforms?.get(content.itemId) ?? persistedBgTransform
      const bgTransformStyle = computeImageTransformStyle(effectiveTransform, 50, 50)
      elements.push({
        type: 'image', x: bg, y: bg, width: bgW, height: bgH,
        content: content.imageUrl,
        style: { borderRadius: 0, objectFit: 'cover', ...bgTransformStyle }
      })
      elements.push({
        type: 'background', x: bg, y: bg, width: bgW, height: bgH,
        content: '',
        style: { background: BG_IMAGE_TEXT.gradient, borderRadius: 0 }
      })
    }
    if (content.indicators) {
      elements.push(...renderIndicators(content.indicators, 4, 4, tile.width - 8, palette))
    }
  }

  // --- Non-background image ---
  if (showImage) {
    const defaultItemShadow = !isCircularMode ? '0 2px 8px rgba(0,0,0,0.1)' : undefined
    const imageShadow = tileStyle?.image?.boxShadow !== undefined ? tileStyle.image.boxShadow : defaultItemShadow
    // Stretch mode: top inset matches horizontal inset so the image does not cover the wrapper border
    // Cutout mode: align oversized container bottom with text start so dish floats upward
    const imageY = isCutoutMode
      ? (imageBlockHeight - imageComputedHeight)
      : (imageMode === 'stretch')
        ? stretchSideInset
        : currentY

    if (content.imageUrl) {
      const itemBaseX = 50
      const itemBaseY = (imageMode === 'stretch' || isCutoutMode) ? 60 : 50
      const persistedItemTransform = resolveTransformForMode(content.imageTransform, imageMode)
      const effectiveItemTransform = options.imageTransforms?.get(content.itemId) ?? persistedItemTransform
      const itemTransformStyle = computeImageTransformStyle(effectiveItemTransform, itemBaseX, itemBaseY, isCutoutMode)
      elements.push({
        type: 'image',
        x: imageComputedX, y: imageY,
        width: imageComputedWidth, height: imageComputedHeight,
        content: content.imageUrl,
        style: {
          borderRadius: imageComputedBorderRadius,
          objectFit: isCutoutMode ? 'contain' : 'cover',
          ...itemTransformStyle,
          boxShadow: isCutoutMode ? undefined : (imageShadow || undefined),
          // No explicit zIndex — DOM order (image before text) ensures text paints on top.
          // isCutout signals the web renderer to use overflow:visible and transparent background.
          isCutout: isCutoutMode ? true : undefined,
        }
      })
    } else {
      // Phase 3.4: Cutout placeholder for missing/pending cutouts in cutout mode
      if (isCutoutMode) {
        const placeholderSvg = `
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <!-- Dashed border circle (craft-like cutout pending indicator) -->
            <circle cx="100" cy="100" r="90" fill="none" stroke="#B8A595" stroke-width="2" stroke-dasharray="8,6" stroke-linecap="round"/>
            <!-- Plate silhouette (simple circle with shadow) -->
            <ellipse cx="100" cy="105" rx="75" ry="70" fill="#E8DCC8" opacity="0.6"/>
            <!-- Plate rim/edge detail -->
            <ellipse cx="100" cy="100" rx="75" ry="70" fill="none" stroke="#9E8B7E" stroke-width="1.5" opacity="0.4"/>
            <!-- Food silhouette (minimalist plate with mound) -->
            <ellipse cx="100" cy="95" rx="55" ry="45" fill="#D4B5A0" opacity="0.4"/>
            <!-- Center detail (utensil-like) -->
            <line x1="85" y1="80" x2="115" y2="110" stroke="#9E8B7E" stroke-width="1.5" opacity="0.3" stroke-linecap="round"/>
          </svg>
        `
        elements.push({
          type: 'svg',
          x: imageComputedX, y: imageY,
          width: imageComputedWidth, height: imageComputedHeight,
          content: placeholderSvg,
          style: {
            borderRadius: imageComputedBorderRadius,
            backgroundColor: 'transparent',
            opacity: 0.5,
          }
        })
      } else {
        // Regular mode: light grey placeholder background
        elements.push({
          type: 'background',
          x: imageComputedX, y: imageY,
          width: imageComputedWidth, height: imageComputedHeight,
          content: '',
          style: { backgroundColor: palette.colors.border.light, borderRadius: imageComputedBorderRadius }
        })
      }
    }
    if (content.indicators) {
      elements.push(...renderIndicators(content.indicators, imageComputedX + 4, currentY + 4, imageComputedWidth - 8, palette))
    }
    currentY += imageBlockHeight
  }

  if (content.isFeatured && featuredStarMetrics && featuredChrome) {
    pushFeaturedStarBadge(elements, tile, featuredChrome, featuredBadgeFont, featuredStarMetrics)
  } else if (content.isFeatured && featuredBadgeMetrics && featuredChrome) {
    pushPopularBadge(elements, tile, featuredChrome, featuredBadgeFont, featuredBadgeMetrics)
  }

  // --- Name ---
  const nameX = (tile.width - textWidth) / 2
  elements.push({
    type: 'text',
    x: nameX, y: currentY,
    width: textWidth, height: nameLineHeight * fitNameLines,
    content: applyTextTransform(content.name, nameTypo.textTransform)[0],
    style: {
      fontSize: nameFontSize,
      fontWeight: nameTypo.fontWeight,
      fontFamily: nameTypo.fontFamily,
      lineHeight: nameTypo.lineHeight,
      maxLines: fitNameLines,
      color: isBackgroundMode
        ? lightenHexForDarkBackground(palette.colors.itemTitle, BG_IMAGE_TEXT.lightenBlendName)
        : palette.colors.itemTitle,
      textAlign: nameTypo.textAlign,
      textTransform: applyTextTransform(content.name, nameTypo.textTransform)[1],
      // Keep names crisp; glow strains the eye at small sizes.
      textShadow: isBackgroundMode ? BG_IMAGE_TEXT.shadow : undefined
    }
  })
  currentY += fitNameHeight + (hasDesc ? gapNameToDesc : gapDescToPrice)

  // --- Description ---
  if (hasDesc) {
    const descX = (tile.width - textWidth) / 2
    elements.push({
      type: 'text',
      x: descX, y: currentY,
      width: textWidth, height: descLineHeight * fitDescLines,
      content: applyTextTransform(content.description!, descTypo.textTransform)[0],
      style: {
        fontSize: descTypo.fontSize,
        fontWeight: isBackgroundMode ? Math.max(descTypo.fontWeight, TYPOGRAPHY_TOKENS_V2.fontWeight.medium) : descTypo.fontWeight,
        fontFamily: descTypo.fontFamily,
        lineHeight: descTypo.lineHeight,
        maxLines: fitDescLines,
        color: isBackgroundMode ? BG_IMAGE_TEXT.descColor : palette.colors.itemDescription,
        textAlign: descTypo.textAlign,
        textTransform: applyTextTransform(content.description!, descTypo.textTransform)[1],
        textShadow: isBackgroundMode ? BG_IMAGE_TEXT.shadow : undefined
      }
    })
    currentY += fitDescHeight + gapDescToPrice
  }

  // --- Price ---
  const priceX = (tile.width - textWidth) / 2
  const currencyCode = content.currency || 'USD'
  const priceText = formatCurrency(content.price, currencyCode)
  elements.push({
    type: 'text',
    x: priceX, y: currentY,
    width: textWidth, height: priceLineHeight,
    content: priceText,
    style: {
      fontSize: priceFontSize,
      fontWeight: priceTypo.fontWeight,
      fontFamily: priceTypo.fontFamily,
      lineHeight: priceTypo.lineHeight,
      maxLines: 1,
      color: isBackgroundMode
        ? lightenHexForDarkBackground(palette.colors.itemPrice, BG_IMAGE_TEXT.lightenBlendPrice)
        : palette.colors.itemPrice,
      textAlign: priceTypo.textAlign,
      textTransform: priceTypo.textTransform,
      textShadow: mergeTextShadow(
        isBackgroundMode ? BG_IMAGE_TEXT.shadow : undefined,
        galactic ? neonTextGlow(palette, 'price') : undefined
      )
    }
  })
  currentY += priceLineHeight + 4

  // --- Indicators (only when not already placed on the image/background layer) ---
  const itemIndicatorsOnImageLayer =
    content.type === 'ITEM_CARD' &&
    content.showImage &&
    (showImage || isBackgroundMode)
  if (content.indicators && !itemIndicatorsOnImageLayer) {
    const indicatorWidth = textWidth
    const indicatorX = (tile.width - indicatorWidth) / 2
    elements.push(...renderIndicators(content.indicators, indicatorX, currentY, indicatorWidth, palette))
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
  const tileStyle = tile.style as TileStyleV2 | undefined

  const padTop = tile.contentBudget?.paddingTop ?? 12
  const padBottom = tile.contentBudget?.paddingBottom ?? 12
  const padH = 12

  const nameTypo = resolveSubElementTypography(tileStyle, 'name', {
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.sm,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
  })
  const descTypo = resolveSubElementTypography(tileStyle, 'description', {
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xs,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.normal,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.relaxed,
  })
  const priceTypo = resolveSubElementTypography(tileStyle, 'price', {
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xsm,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
  })

  const imageMode: ImageModeV2 = options.imageMode || 'stretch'
  const isBackgroundMode = imageMode === 'background'
  const isCircularMode = imageMode === 'compact-circle'

  const nameFontSize = isBackgroundMode
    ? Math.min(nameTypo.fontSize + BG_IMAGE_TEXT.nameSizeBump, BG_IMAGE_TEXT.nameSizeMax)
    : nameTypo.fontSize
  const priceFontSize = isBackgroundMode
    ? Math.min(priceTypo.fontSize + BG_IMAGE_TEXT.priceSizeBump, BG_IMAGE_TEXT.priceSizeMax)
    : priceTypo.fontSize
  const nameLineHeight = nameFontSize * nameTypo.lineHeight
  const nameMaxLines = tile.contentBudget?.nameLines ?? 2
  const descMaxLines = tile.contentBudget?.descLines ?? 3
  const textWidth = tile.width - (padH * 2)

  const estNameLines = estimateLineCount(content.name, textWidth, nameFontSize, nameMaxLines)
  const estDescLines = content.description
    ? estimateLineCount(content.description, textWidth, descTypo.fontSize, descMaxLines)
    : 0
  const nameHeight = nameLineHeight * estNameLines
  const descLineHeight = descTypo.fontSize * descTypo.lineHeight
  const descHeight = descLineHeight * estDescLines
  const priceLineHeight = priceFontSize * priceTypo.lineHeight
  const hasDesc = estDescLines > 0

  // Compute image block height
  let imageBlockHeight = 0
  let imgW = 0, imgH = 0, imgX = 0, imgBR = isCircularMode ? 0 : 8
  const showImage = content.showImage && !isBackgroundMode

  if (showImage) {
    if (imageMode === 'compact-rect') {
      imgW = tile.width * 0.6
      imgH = imgW * 0.75
      const avail = tile.height - padTop - 10 - 80
      if (imgH > avail) { imgH = avail; imgW = imgH / 0.75 }
      imgX = (tile.width - imgW) / 2
    } else if (isCircularMode) {
      const avail = tile.height - padTop - 10 - 80
      const d = Math.min(tile.width * 0.45, avail)
      imgW = d; imgH = d; imgX = (tile.width - imgW) / 2; imgBR = d / 2
    } else {
      // stretch mode: full-width (minus 2px to avoid border overflow), edge-to-edge, viewport anchored 70% down
      imgH = tile.contentBudget?.imageBoxHeight ?? 120
      imgW = tile.width - 2
      imgX = 0
      imgBR = 0
    }
    // stretch mode: no afterImage gap — text starts immediately below the image
    imageBlockHeight = imgH + (imageMode === 'stretch' ? 0 : SPACING_V2.afterImage + 4)
  }

  const usableHeight = tile.height - padTop - padBottom
  let gapNameToDesc: number = hasDesc ? SPACING_V2.nameToDesc : 0
  let gapDescToPrice: number = SPACING_V2.descToPrice
  let fitNameHeight = nameHeight
  let fitDescHeight = descHeight
  let fitNameLines = estNameLines
  let fitDescLines = estDescLines

  const calcContent = () => imageBlockHeight + fitNameHeight + gapNameToDesc + fitDescHeight + gapDescToPrice + priceLineHeight
  let contentHeight = calcContent()

  if (contentHeight > usableHeight) {
    const fixedContent = imageBlockHeight + fitNameHeight + fitDescHeight + priceLineHeight
    const totalGap = gapNameToDesc + gapDescToPrice
    const availableForGaps = Math.max(0, usableHeight - fixedContent)
    const scale = totalGap > 0 ? Math.min(1, availableForGaps / totalGap) : 0
    gapNameToDesc = Math.max(2, gapNameToDesc * scale)
    gapDescToPrice = Math.max(2, gapDescToPrice * scale)
    contentHeight = calcContent()

    while (contentHeight > usableHeight && fitDescLines > 1) {
      fitDescLines--
      fitDescHeight = descLineHeight * fitDescLines
      contentHeight = calcContent()
    }
    while (contentHeight > usableHeight && fitNameLines > 1) {
      fitNameLines--
      fitNameHeight = nameLineHeight * fitNameLines
      contentHeight = calcContent()
    }
  }

  const yOffset = padTop + Math.max(0, (usableHeight - contentHeight) / 2)
  let currentY = yOffset

  // Background image mode
  if (content.showImage && isBackgroundMode) {
    if (content.imageUrl) {
      const persistedFeatureBgTransform = resolveTransformForMode(content.imageTransform, imageMode)
      const effectiveFeatureBgTransform = options.imageTransforms?.get(content.itemId) ?? persistedFeatureBgTransform
      const featureBgTransformStyle = computeImageTransformStyle(effectiveFeatureBgTransform, 50, 50)
      elements.push({
        type: 'image', x: 0, y: 0, width: tile.width, height: tile.height,
        content: content.imageUrl,
        style: { borderRadius: 0, objectFit: 'cover', ...featureBgTransformStyle }
      })
      elements.push({
        type: 'background', x: 0, y: 0, width: tile.width, height: tile.height,
        content: '',
        style: { background: BG_IMAGE_TEXT.gradient, borderRadius: 0 }
      })
    }
    if (content.indicators) {
      elements.push(...renderIndicators(content.indicators, 4, 4, tile.width - 8, palette))
    }
  }

  // Non-background image
  if (showImage) {
    const defaultFeatureShadow = !isCircularMode ? '0 2px 8px rgba(0,0,0,0.1)' : undefined
    const featureImageShadow = tileStyle?.image?.boxShadow !== undefined ? tileStyle.image.boxShadow : defaultFeatureShadow
    const imageY = imageMode === 'stretch' ? 0 : currentY

    if (content.imageUrl) {
      const featureBaseY = imageMode === 'stretch' ? 75 : 50
      const persistedFeatureTransform = resolveTransformForMode(content.imageTransform, imageMode)
      const effectiveFeatureTransform = options.imageTransforms?.get(content.itemId) ?? persistedFeatureTransform
      const featureTransformStyle = computeImageTransformStyle(effectiveFeatureTransform, 50, featureBaseY)
      elements.push({
        type: 'image', x: imgX, y: imageY, width: imgW, height: imgH,
        content: content.imageUrl,
        style: { borderRadius: imgBR, objectFit: 'cover', ...featureTransformStyle, boxShadow: featureImageShadow || undefined }
      })
    } else {
      elements.push({
        type: 'background', x: imgX, y: imageY, width: imgW, height: imgH,
        content: '',
        style: { backgroundColor: palette.colors.border.light, borderRadius: imgBR }
      })
    }
    if (content.indicators) {
      elements.push(...renderIndicators(content.indicators, imgX + 4, imageY + 4, imgW - 8, palette))
    }
    currentY += imageBlockHeight
  }

  // Name
  const nameX = (tile.width - textWidth) / 2
  elements.push({
    type: 'text', x: nameX, y: currentY, width: textWidth,
    height: nameLineHeight * fitNameLines,
    content: applyTextTransform(content.name, nameTypo.textTransform)[0],
    style: {
      fontSize: nameFontSize, fontWeight: nameTypo.fontWeight,
      fontFamily: nameTypo.fontFamily, lineHeight: nameTypo.lineHeight,
      maxLines: fitNameLines,
      color: isBackgroundMode ? lightenHexForDarkBackground(palette.colors.itemTitle, BG_IMAGE_TEXT.lightenBlendName) : palette.colors.itemTitle,
      textAlign: nameTypo.textAlign,
      textTransform: applyTextTransform(content.name, nameTypo.textTransform)[1],
      textShadow: isBackgroundMode ? BG_IMAGE_TEXT.shadow : undefined,
    }
  })
  currentY += fitNameHeight + (hasDesc ? gapNameToDesc : gapDescToPrice)

  // Description
  if (hasDesc) {
    const descX = (tile.width - textWidth) / 2
    elements.push({
      type: 'text', x: descX, y: currentY, width: textWidth,
      height: descLineHeight * fitDescLines,
      content: applyTextTransform(content.description!, descTypo.textTransform)[0],
      style: {
        fontSize: descTypo.fontSize,
        fontWeight: isBackgroundMode ? Math.max(descTypo.fontWeight, TYPOGRAPHY_TOKENS_V2.fontWeight.medium) : descTypo.fontWeight,
        fontFamily: descTypo.fontFamily, lineHeight: descTypo.lineHeight,
        maxLines: fitDescLines,
        color: isBackgroundMode ? BG_IMAGE_TEXT.descColor : palette.colors.itemDescription,
        textAlign: descTypo.textAlign,
        textTransform: applyTextTransform(content.description!, descTypo.textTransform)[1],
        textShadow: isBackgroundMode ? BG_IMAGE_TEXT.shadow : undefined,
      }
    })
    currentY += fitDescHeight + gapDescToPrice
  }

  // Price
  const priceX = (tile.width - textWidth) / 2
  const priceText = formatCurrency(content.price, content.currency || 'USD')
  elements.push({
    type: 'text', x: priceX, y: currentY, width: textWidth,
    height: priceLineHeight,
    content: priceText,
    style: {
      fontSize: priceFontSize, fontWeight: priceTypo.fontWeight,
      fontFamily: priceTypo.fontFamily, lineHeight: priceTypo.lineHeight,
      maxLines: 1,
      color: isBackgroundMode ? lightenHexForDarkBackground(palette.colors.itemPrice, BG_IMAGE_TEXT.lightenBlendPrice) : palette.colors.itemPrice,
      textAlign: priceTypo.textAlign, textTransform: priceTypo.textTransform,
      textShadow: isBackgroundMode ? BG_IMAGE_TEXT.shadow : undefined,
    }
  })
  currentY += priceLineHeight + SPACING_V2.descToPrice

  // Indicators (text-only mode)
  if (content.indicators && !content.showImage) {
    const indicatorWidth = textWidth
    const indicatorX = (tile.width - indicatorWidth) / 2
    elements.push(...renderIndicators(content.indicators, indicatorX, currentY, indicatorWidth, palette))
  }

  return { elements }
}

function renderFlagshipCardContent(
  content: FlagshipCardContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = []
  const palette = getPalette(options)
  const galactic = isGalacticPalette(options)
  const tileStyle = tile.style as TileStyleV2 | undefined
  const imageMode: ImageModeV2 = options.imageMode || 'stretch'
  const isBackgroundMode = imageMode === 'background'
  const showsMedia = content.showImage && imageMode !== 'none'
  const hasImageAsset = !!content.imageUrl
  const padTop = tile.contentBudget?.paddingTop ?? 10
  const padBottom = tile.contentBudget?.paddingBottom ?? 10
  const padX = Math.max(10, Math.min(18, tile.width * 0.04))
  const gap = Math.max(10, Math.min(18, tile.width * 0.03))
  const chrome = getFlagshipChrome(palette, tileStyle, galactic)
  const badgeMetrics = getFlagshipBadgeMetrics(tile.width, galactic ? { glowColor: '#FFFFFF' } : undefined)
  const surfaceColor = blendHexTowards(
    palette.colors.surface ?? palette.colors.background,
    palette.colors.accent ?? palette.colors.itemPrice,
    0.14
  )
  const bodyHeight = tile.height - padTop - padBottom
  const prominenceScale = Math.min(1.2, Math.max(1, (tile.colSpan + tile.rowSpan) / 3))

  const nameTypo = resolveSubElementTypography(tileStyle, 'name', {
    fontSize: Math.round(TYPOGRAPHY_TOKENS_V2.fontSize.base * prominenceScale),
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
  })
  const descTypo = resolveSubElementTypography(tileStyle, 'description', {
    fontSize: Math.round(TYPOGRAPHY_TOKENS_V2.fontSize.sm * Math.min(prominenceScale, 1.02)),
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.normal,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.normal,
  })
  const priceTypo = resolveSubElementTypography(tileStyle, 'price', {
    fontSize: Math.round(TYPOGRAPHY_TOKENS_V2.fontSize.base * Math.min(prominenceScale, 1.02)),
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
  })
  const badgeFontFamily =
    resolveSubElementTypography(tileStyle, 'name', {
      fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xsm,
      fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
      lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
    }).fontFamily || TYPOGRAPHY_TOKENS_V2.fontFamily.primary
  const outerFrameInset = 0
  const panelInset = chrome.borderWidth

  elements.push({
    type: 'background',
    x: outerFrameInset,
    y: outerFrameInset,
    width: tile.width - outerFrameInset * 2,
    height: tile.height - outerFrameInset * 2,
    content: '',
    style: {
      backgroundColor: chrome.frameOuter,
      borderRadius: 0
    }
  })
  elements.push({
    type: 'background',
    x: panelInset,
    y: panelInset,
    width: tile.width - panelInset * 2,
    height: tile.height - panelInset * 2,
    content: '',
    style: {
      backgroundColor: isBackgroundMode ? surfaceColor : chrome.panel,
      borderRadius: 0
    }
  })

  let mediaX = padX
  let mediaY = padTop
  let mediaWidth = 0
  let mediaHeight = 0
  let mediaBorderRadius = imageMode === 'compact-circle' ? 999 : 0

  const hasMediaColumn = showsMedia && !isBackgroundMode
  const isStretchFlagship = imageMode === 'stretch' && hasMediaColumn
  if (hasMediaColumn) {
    const baseMediaWidth = tile.colSpan > 1 ? tile.width * 0.44 : tile.width * 0.38
    mediaWidth = Math.max(88, Math.min(baseMediaWidth, tile.width - padX * 2 - 92))
    mediaHeight = bodyHeight

    if (imageMode === 'compact-rect') {
      mediaWidth = Math.min(mediaWidth, tile.width * 0.34)
      mediaHeight = Math.min(bodyHeight * 0.72, mediaWidth * 1.15)
      mediaY = padTop + (bodyHeight - mediaHeight) / 2
      mediaBorderRadius = 0
    } else if (imageMode === 'compact-circle') {
      const diameter = Math.min(mediaWidth, bodyHeight * 0.7)
      mediaWidth = diameter
      mediaHeight = diameter
      mediaY = padTop + (bodyHeight - diameter) / 2
      mediaBorderRadius = diameter / 2
    } else if (imageMode === 'cutout') {
      mediaWidth = Math.min(mediaWidth, tile.width * 0.4)
      mediaHeight = bodyHeight
      mediaBorderRadius = 0
    } else if (imageMode === 'stretch') {
      mediaX = panelInset
      mediaY = panelInset
      mediaHeight = tile.height - panelInset * 2
    }

    if (hasImageAsset) {
      const persistedTransform = resolveTransformForMode(content.imageTransform, imageMode)
      const effectiveTransform = options.imageTransforms?.get(content.itemId) ?? persistedTransform
      const baseY = imageMode === 'stretch' ? 55 : 50
      const transformStyle = computeImageTransformStyle(
        effectiveTransform,
        50,
        baseY,
        imageMode === 'cutout'
      )
      elements.push({
        type: 'image',
        x: mediaX,
        y: mediaY,
        width: mediaWidth,
        height: mediaHeight,
        content: content.imageUrl!,
        style: {
          borderRadius: mediaBorderRadius,
          objectFit: imageMode === 'cutout' ? 'contain' : 'cover',
          boxShadow: imageMode === 'cutout' ? undefined : '0 6px 18px rgba(0,0,0,0.12)',
          isCutout: imageMode === 'cutout' ? true : undefined,
          ...transformStyle
        }
      })
    } else {
      elements.push({
        type: 'background',
        x: mediaX,
        y: mediaY,
        width: mediaWidth,
        height: mediaHeight,
        content: '',
        style: {
          backgroundColor: palette.colors.border.light,
          borderRadius: mediaBorderRadius
        }
      })
    }

    if (content.indicators) {
      elements.push(...renderIndicators(content.indicators, mediaX + 6, mediaY + 6, Math.max(30, mediaWidth - 12), palette))
    }
  }

  if (content.showImage && isBackgroundMode) {
    if (hasImageAsset) {
      const persistedBgTransform = resolveTransformForMode(content.imageTransform, imageMode)
      const effectiveBgTransform = options.imageTransforms?.get(content.itemId) ?? persistedBgTransform
      const bgTransformStyle = computeImageTransformStyle(effectiveBgTransform, 50, 50)
      elements.push({
        type: 'image',
        x: panelInset,
        y: panelInset,
        width: tile.width - panelInset * 2,
        height: tile.height - panelInset * 2,
        content: content.imageUrl!,
        style: {
          borderRadius: 0,
          objectFit: 'cover',
          ...bgTransformStyle
        }
      })
    } else {
      elements.push({
        type: 'background',
        x: panelInset,
        y: panelInset,
        width: tile.width - panelInset * 2,
        height: tile.height - panelInset * 2,
        content: '',
        style: {
          backgroundColor: surfaceColor,
          borderRadius: 0
        }
      })
    }

    elements.push({
      type: 'background',
      x: panelInset,
      y: panelInset,
      width: tile.width - panelInset * 2,
      height: tile.height - panelInset * 2,
      content: '',
      style: {
        background: 'linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.46) 42%, rgba(0,0,0,0.18) 100%)',
        borderRadius: 0
      }
    })

    if (content.indicators) {
      elements.push(...renderIndicators(content.indicators, padX, padTop, Math.max(40, tile.width - padX * 2), palette))
    }
  }

  const textX = hasMediaColumn ? mediaX + mediaWidth + gap : padX
  const textRightPad = isStretchFlagship ? panelInset + padX : padX
  const textWidth = tile.width - textX - textRightPad
  const baseNameFontSize = isBackgroundMode
    ? Math.min(nameTypo.fontSize + 2, BG_IMAGE_TEXT.nameSizeMax)
    : nameTypo.fontSize
  const titleFit = resolveFlagshipTitleFit({
    text: content.name,
    availableWidth: textWidth,
    preferredFontSize: baseNameFontSize,
    preferredLines: 2,
    minFontSize: Math.min(baseNameFontSize, 9),
  })
  const nameFontSize = titleFit.fontSize
  const priceFontSize = isBackgroundMode
    ? Math.min(priceTypo.fontSize + 1, BG_IMAGE_TEXT.priceSizeMax)
    : Math.max(11, priceTypo.fontSize - 1)
  const nameLineHeight = nameFontSize * nameTypo.lineHeight
  const descLineHeight = descTypo.fontSize * descTypo.lineHeight
  const priceLineHeight = priceFontSize * priceTypo.lineHeight
  const nameLines = Math.max(tile.contentBudget?.nameLines ?? 2, titleFit.lineBudget)
  const descLines = content.description ? (tile.contentBudget?.descLines ?? 4) : 0
  const availableTextHeight = isBackgroundMode || isStretchFlagship
    ? tile.height - (panelInset * 2) - padTop - padBottom
    : bodyHeight
  const textSlots = resolveFlagshipTextSlots({
    availableHeight: availableTextHeight,
    nameMaxLines: nameLines,
    minNameLines: titleFit.lineBudget,
    descMaxLines: descLines,
    hasDescription: !!content.description,
    nameLineHeight,
    descLineHeight,
    priceLineHeight,
  })
  const textBodyHeight = textSlots.totalHeight
  const badgeHeight = badgeMetrics.badgeH
  const badgeVerticalOverlap = badgeMetrics.overlap
  const effectiveBadgeIntrusion = Math.max(0, badgeHeight - badgeVerticalOverlap)
  const badgePosition = chrome.badgePosition ?? 'left'
  // Reserve enough top space to clear a left-anchored badge, plus a small
  // visual gap so ascenders do not appear tucked under the sticker.
  const badgeGap = 4
  const badgeIntrusion = badgePosition === 'left' ? effectiveBadgeIntrusion + badgeGap : 0
  const centeredTextY = padTop + Math.max(0, (bodyHeight - textBodyHeight) / 2)
  const textY = isBackgroundMode
    ? Math.max(padTop + 18 + badgeIntrusion, (tile.height - textBodyHeight) / 2)
    : isStretchFlagship
      ? panelInset + Math.max(padTop, badgeIntrusion)
      : Math.max(padTop + badgeIntrusion, centeredTextY)

  let currentY = textY
  const [nameText, nameTransform] = applyTextTransform(content.name, nameTypo.textTransform)
  elements.push({
    type: 'text',
    x: textX,
    y: currentY,
    width: textWidth,
    height: textSlots.nameHeight,
    content: nameText,
    style: {
      fontSize: nameFontSize,
      fontWeight: nameTypo.fontWeight,
      fontFamily: nameTypo.fontFamily,
      lineHeight: nameTypo.lineHeight,
      maxLines: textSlots.nameLines,
      color: isBackgroundMode
        ? lightenHexForDarkBackground(palette.colors.itemTitle, BG_IMAGE_TEXT.lightenBlendName)
        : palette.colors.itemTitle,
      textAlign: nameTypo.textAlign,
      textTransform: nameTransform,
      textShadow: isBackgroundMode ? BG_IMAGE_TEXT.shadow : undefined
    }
  })
  currentY += textSlots.nameHeight

  if (content.description && textSlots.descLines > 0) {
    currentY += textSlots.gapNameToDesc
    const [descText, descTransform] = applyTextTransform(content.description, descTypo.textTransform)
    elements.push({
      type: 'text',
      x: textX,
      y: currentY,
      width: textWidth,
      height: textSlots.descHeight,
      content: descText,
      style: {
        fontSize: descTypo.fontSize,
        fontWeight: isBackgroundMode ? Math.max(descTypo.fontWeight, TYPOGRAPHY_TOKENS_V2.fontWeight.medium) : descTypo.fontWeight,
        fontFamily: descTypo.fontFamily,
        lineHeight: descTypo.lineHeight,
        maxLines: textSlots.descLines,
        color: isBackgroundMode ? BG_IMAGE_TEXT.descColor : palette.colors.itemDescription,
        textAlign: descTypo.textAlign,
        textTransform: descTransform,
        textShadow: isBackgroundMode ? BG_IMAGE_TEXT.shadow : undefined
      }
    })
    currentY += textSlots.descHeight
  }

  currentY += textSlots.gapDescToPrice
  elements.push({
    type: 'text',
    x: textX,
    y: currentY,
    width: textWidth,
    height: priceLineHeight,
    content: formatCurrency(content.price, content.currency || 'USD'),
    style: {
      fontSize: priceFontSize,
      fontWeight: priceTypo.fontWeight,
      fontFamily: priceTypo.fontFamily,
      lineHeight: priceTypo.lineHeight,
      maxLines: 1,
      color: isBackgroundMode
        ? lightenHexForDarkBackground(palette.colors.itemPrice, BG_IMAGE_TEXT.lightenBlendPrice)
        : chrome.price,
      textAlign: priceTypo.textAlign,
      textTransform: priceTypo.textTransform,
      textShadow: isBackgroundMode ? BG_IMAGE_TEXT.shadow : undefined
    }
  })
  currentY += priceLineHeight + 6

  if (content.indicators && !showsMedia) {
    elements.push(...renderIndicators(content.indicators, textX, currentY, textWidth, palette))
  }

  pushFlagshipBadge(elements, tile, chrome, badgeFontFamily, badgeMetrics)

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
  const lineThickness = content.lineThickness ?? 1
  const centerY = tile.height / 2
  const lineY = centerY - lineThickness / 2

  switch (content.style) {
    case 'line':
      // Simple horizontal line
      elements.push({
        type: 'background',
        x: tile.width * 0.1,
        y: lineY,
        width: tile.width * 0.8,
        height: lineThickness,
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
        y: lineY,
        width: tile.width * 0.9,
        height: lineThickness,
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
        y: lineY,
        width: tile.width * 0.35,
        height: lineThickness,
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
        y: lineY,
        width: tile.width * 0.35,
        height: lineThickness,
        content: '',
        style: { backgroundColor: palette.colors.border.light }
      })
      break

    case 'ornament':
      // Ornamental divider with decorative center
      elements.push({
        type: 'background',
        x: tile.width * 0.15,
        y: lineY,
        width: tile.width * 0.3,
        height: lineThickness,
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
        y: lineY,
        width: tile.width * 0.3,
        height: lineThickness,
        content: '',
        style: { backgroundColor: palette.colors.border.light }
      })
      break
  }

  return { elements }
}

/** When spacerTilePatternId is 'blank', fillers render as plain rectangles (no pattern/icon). */
export const SPACER_BLANK_ID = 'blank'

function renderFillerContent(
  content: FillerContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = []
  const palette = getPalette(options)
  const isBlank = options.spacerTilePatternId === SPACER_BLANK_ID
  const galactic = isGalacticPalette(options)

  // Blank: plain rectangle only; alternating light vs mid with tuned opacity so neither is too faint nor too dark
  if (isBlank) {
    const { light, mid } = fillerPalette(palette)
    const alt = (content.fillerIndex ?? 0) % 2
    elements.push({
      type: 'background',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: '',
      style: {
        backgroundColor: alt === 0 ? light : mid,
        opacity: alt === 0 ? 0.7 : 0.5,
        borderRadius: 4
      }
    })
    return { elements }
  }

  // Resolve pattern: "mix" rotates through regular patterns, or only cosmic patterns for Galactic.
  const mixPatternIds = galactic ? [...GALACTIC_FILLER_PATTERN_IDS] : FILLER_PATTERN_IDS
  const patternId =
    options.spacerTilePatternId === 'mix'
      ? mixPatternIds[(content.fillerIndex ?? 0) % mixPatternIds.length]
      : options.spacerTilePatternId && FILLER_PATTERN_REGISTRY.has(options.spacerTilePatternId)
        ? options.spacerTilePatternId
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
    const scale = options.scale ?? 1
    const size = (config.tileSize ?? FILLER_PATTERN_TILE_SIZE) * scale
    const background = config.fitToTile
      ? `url("${dataUri}") no-repeat center / 100% 100%`
      : `url("${dataUri}") repeat 0 0 / ${size}px ${size}px`
    // Align pattern to region origin so it tessellates seamlessly across adjacent filler tiles
    elements.push({
      type: 'background',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: '',
      style: {
        background,
        opacity: config.opacity,
        backgroundPositionX: config.fitToTile ? undefined : -tile.x * scale,
        backgroundPositionY: config.fitToTile ? undefined : -tile.y * scale,
        borderRadius: 4
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

function renderBannerContent(
  content: BannerContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = []
  const preset = FONT_STYLE_PRESETS[content.fontStylePreset] || FONT_STYLE_PRESETS.standard
  const palette = getPalette(options)
  const galactic = isGalacticPalette(options)
  const titleText = content.title
  // Prefer live palette colors so the web preview updates instantly on palette change.
  // Fall back to baked-in content colors (used by PDF renderer and backward compat).
  const bannerSurface = options.palette?.colors?.bannerSurface ?? content.surfaceColor
  const bannerText = options.palette?.colors?.bannerText ?? content.textColor

  const galacticStarsOverlayDataUri = () => {
    // Tileable star-dots with subtle glow; tuned for header/footer overlays.
    const c1 = '#FFFFFF'
    const c2 = palette.colors.menuTitle ?? palette.colors.sectionHeader
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="90" viewBox="0 0 220 90">',
      '<defs>',
      '<filter id="g" x="-50%" y="-50%" width="200%" height="200%">',
      '<feGaussianBlur stdDeviation="0.8" result="b"/>',
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>',
      '</filter>',
      '</defs>',
      `<g filter="url(#g)" opacity="0.92">`,
      // small stars
      `<circle cx="18" cy="18" r="0.9" fill="${c1}" opacity="0.70"/>`,
      `<circle cx="42" cy="28" r="0.7" fill="${c1}" opacity="0.55"/>`,
      `<circle cx="74" cy="20" r="0.8" fill="${c2}" opacity="0.55"/>`,
      `<circle cx="96" cy="34" r="0.7" fill="${c1}" opacity="0.50"/>`,
      `<circle cx="128" cy="18" r="0.9" fill="${c1}" opacity="0.62"/>`,
      `<circle cx="156" cy="30" r="0.7" fill="${c2}" opacity="0.50"/>`,
      `<circle cx="188" cy="22" r="0.8" fill="${c1}" opacity="0.48"/>`,
      `<circle cx="212" cy="34" r="0.7" fill="${c1}" opacity="0.42"/>`,
      // medium stars
      `<circle cx="26" cy="62" r="1.3" fill="${c1}" opacity="0.60"/>`,
      `<circle cx="66" cy="58" r="1.1" fill="${c2}" opacity="0.52"/>`,
      `<circle cx="112" cy="64" r="1.2" fill="${c1}" opacity="0.52"/>`,
      `<circle cx="170" cy="62" r="1.15" fill="${c2}" opacity="0.46"/>`,
      `<circle cx="206" cy="66" r="1.25" fill="${c1}" opacity="0.44"/>`,
      // a few bigger glows
      `<circle cx="14" cy="38" r="1.8" fill="${c2}" opacity="0.33"/>`,
      `<circle cx="138" cy="42" r="1.7" fill="${c1}" opacity="0.30"/>`,
      `<circle cx="196" cy="44" r="1.9" fill="${c2}" opacity="0.28"/>`,
      '</g>',
      '</svg>',
    ].join('')
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
  }

  // 1. Full banner background
  elements.push({
    type: 'background',
    x: 0, y: 0,
    width: tile.width,
    height: tile.height,
    content: '',
    style: { backgroundColor: bannerSurface }
  })

  // 1b. Galactic overlay: subtle star dots behind text / hero
  if (galactic) {
    elements.push({
      type: 'background',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: '',
      style: {
        background: `url("${galacticStarsOverlayDataUri()}") repeat 0 0 / 220px 90px`,
        opacity: 0.55,
        zIndex: 1,
      }
    })
  }

  const hasHeroImage = !!content.heroImageUrl || !!content.heroImageCutoutUrl
  const showHero = hasHeroImage && content.bannerImageStyle !== 'none'
  const isCutout = content.bannerImageStyle === 'cutout'
  const hasVenueIdentity = content.showVenueName && (content.logoUrl || content.venueName)
  // For compact banners (≤60pt tall), suppress the title sidebar — the narrow height
  // doesn't give enough room for vertical text. The title bar below the banner handles it instead.
  const showTitle = content.showBannerTitle && tile.height > 60

  // Resolve live-edit transforms (override persisted values from content)
  const logoTransform = options.bannerLogoTransform ?? content.logoTransform
  const logoTransformStyle = computeImageTransformStyle(logoTransform, 0, 50)

  // Hero zone: right 48% of banner width. In cutout mode the image overflows both
  // the top and right edges so it's clipped by the page container.
  const heroWidthRatio = showHero ? 0.48 : 0
  const heroZoneWidth = tile.width * heroWidthRatio

  // Determine whether to show the sidebar slice.
  // The sidebar is only shown when BOTH venue identity AND title are visible
  // (so there are two things to split between sidebar and main zone).
  const showSidebar = hasVenueIdentity && showTitle

  if (showSidebar) {
    // ── LAYOUT A / B (swappable) ─────────────────────────────────────────────
    // Default (swapLayout=false): sidebar = title vertical, main = venue name/logo
    // Swapped  (swapLayout=true):  sidebar = venue name vertical, main = title large
    //
    // The sidebar is a narrow strip on the left with a thin divider.

    const sidebarWidth = Math.max(32, tile.height * 0.26)
    const dividerWidth = 1
    const sidebarTotalWidth = sidebarWidth + dividerWidth
    const textPadH = Math.max(12, tile.height * 0.08)
    const textZoneX = sidebarTotalWidth + textPadH
    const textZoneWidth = tile.width - sidebarTotalWidth - heroZoneWidth - textPadH * 2

    // Sidebar divider
    elements.push({
      type: 'background',
      x: sidebarWidth, y: 0,
      width: dividerWidth,
      height: tile.height,
      content: '',
      style: { backgroundColor: bannerText, opacity: 0.2 }
    })

    if (!content.swapLayout) {
      // ── Default: "MENU" vertical in sidebar, venue name/logo in main ──────

      if (showTitle) {
        const sidebarFontSize = Math.max(12, sidebarWidth * 0.72)
        elements.push({
          type: 'text',
          x: 0, y: 0,
          width: sidebarWidth,
          height: tile.height,
          content: titleText,
          style: {
            fontSize: sidebarFontSize,
            fontWeight: preset.bannerTitleWeight,
            fontFamily: preset.bannerTitleFamily,
            color: bannerText,
            textAlign: 'center',
            lineHeight: 1,
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            letterSpacing: 2,
            zIndex: 30,
            textShadow: galactic ? neonTextGlow(palette, 'title') : undefined,
          }
        })
      }

      // Venue name / logo centred in main zone
      if (content.logoUrl) {
        // Fill ~50% of the available text zone width, capped by height
        const maxLogoW = textZoneWidth * 0.5
        const maxLogoH = tile.height * 0.7
        const logoWidth = Math.min(maxLogoW, maxLogoH * 4)
        const logoHeight = Math.min(maxLogoH, logoWidth / 2)
        const logoY = (tile.height - logoHeight) / 2
        elements.push({
          type: 'image',
          x: textZoneX,
          y: logoY,
          width: logoWidth,
          height: logoHeight,
          content: content.logoUrl,
          style: { objectFit: 'contain', objectPosition: logoTransformStyle.objectPosition ?? 'left center', transform: logoTransformStyle.transform, transformOrigin: logoTransformStyle.transformOrigin, zIndex: 30, isCutout: true }
        })
      } else if (content.venueName) {
        // Scale font size down for longer names so they fit on one line.
        // Base size fits ~12 chars; beyond that, reduce proportionally.
        const charCount = content.venueName.length
        const baseFontSize = Math.max(18, Math.min(tile.height * 0.55, textZoneWidth * 0.16))
        const charScaleFactor = charCount > 12 ? Math.max(0.45, 12 / charCount) : 1
        const venueFontSize = Math.max(10, baseFontSize * charScaleFactor)
        const venueY = (tile.height - venueFontSize * 1.1) / 2
        elements.push({
          type: 'text',
          x: textZoneX,
          y: venueY,
          width: textZoneWidth,
          content: content.venueName,
          style: {
            fontSize: venueFontSize,
            fontWeight: preset.bannerTitleWeight,
            fontFamily: preset.bannerTitleFamily,
            color: bannerText,
            textAlign: 'left',
            lineHeight: 1.05,
            whiteSpace: 'nowrap',
            zIndex: 30,
          }
        })
      }

    } else {
      // ── Swapped: venue name vertical in sidebar, "MENU" large in main ─────

      // Venue name / logo rotated vertically in sidebar
      if (content.logoUrl) {
        // Logo rotated 90° in sidebar — keep it small enough to fit
        const logoH = Math.min(sidebarWidth * 0.8, tile.height * 0.5)
        const logoW = logoH * 3
        const logoX = (sidebarWidth - logoH) / 2
        const logoY = (tile.height - logoW) / 2
        elements.push({
          type: 'image',
          x: logoX,
          y: logoY,
          width: logoH,
          height: logoW,
          content: content.logoUrl,
          style: { objectFit: 'contain', objectPosition: 'center', zIndex: 30, isCutout: true }
        })
      } else if (content.venueName) {
        const sidebarFontSize = Math.max(10, sidebarWidth * 0.55)
        elements.push({
          type: 'text',
          x: 0, y: 0,
          width: sidebarWidth,
          height: tile.height,
          content: content.venueName,
          style: {
            fontSize: sidebarFontSize,
            fontWeight: preset.bannerTitleWeight,
            fontFamily: preset.bannerTitleFamily,
            color: bannerText,
            textAlign: 'center',
            lineHeight: 1,
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            letterSpacing: 1,
            zIndex: 30,
            textShadow: galactic ? neonTextGlow(palette, 'title') : undefined,
          }
        })
      }

      // "MENU" large and horizontal in main zone
      if (showTitle) {
        const titleFontSize = Math.max(20, Math.min(tile.height * 0.72, textZoneWidth * 0.35))
        const titleY = (tile.height - titleFontSize * 1.0) / 2
        elements.push({
          type: 'text',
          x: textZoneX,
          y: titleY,
          width: textZoneWidth,
          content: titleText,
          style: {
            fontSize: titleFontSize,
            fontWeight: preset.bannerTitleWeight,
            fontFamily: preset.bannerTitleFamily,
            color: bannerText,
            textAlign: 'left',
            lineHeight: 1.0,
            zIndex: 30,
            textShadow: galactic ? neonTextGlow(palette, 'title') : undefined,
          }
        })
      }
    }

  } else if (hasVenueIdentity && !showTitle) {
    // ── Venue identity only (no title, no sidebar) ──────────────────────────
    // Logo or venue name fills the left portion of the banner generously.
    const padH = Math.max(12, tile.height * 0.1)
    const padV = Math.max(8, tile.height * 0.12)
    const availW = tile.width - heroZoneWidth - padH * 2
    const availH = tile.height - padV * 2

    if (content.logoUrl) {
      // Fill ~55% of the non-hero width, capped so it doesn't clip vertically
      const targetW = availW * 0.55
      const targetH = availH * 0.85
      const logoWidth = Math.min(targetW, targetH * 4)
      const logoHeight = Math.min(targetH, logoWidth)
      const logoY = (tile.height - logoHeight) / 2
      elements.push({
        type: 'image',
        x: padH,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
        content: content.logoUrl,
        style: { objectFit: 'contain', objectPosition: logoTransformStyle.objectPosition ?? 'left center', transform: logoTransformStyle.transform, transformOrigin: logoTransformStyle.transformOrigin, zIndex: 30, isCutout: true }
      })
    } else if (content.venueName) {
      const venueFontSize = Math.max(18, Math.min(tile.height * 0.55, availW * 0.16))
      const venueY = (tile.height - venueFontSize * 1.1) / 2
      elements.push({
        type: 'text',
        x: padH,
        y: venueY,
        width: availW,
        content: content.venueName,
        style: {
          fontSize: venueFontSize,
          fontWeight: preset.bannerTitleWeight,
          fontFamily: preset.bannerTitleFamily,
          color: bannerText,
          textAlign: 'left',
          lineHeight: 1.05,
          zIndex: 30,
          textShadow: galactic ? neonTextGlow(palette, 'title') : undefined,
        }
      })
    }

  } else {
    // ── NO venue identity: title fills the available width ───────────────────
    if (showTitle) {
      const padH = Math.max(12, tile.height * 0.08)
      const textZoneWidth = tile.width - heroZoneWidth - padH * 2
      const titleFontSize = Math.max(20, tile.height * 0.72)
      const titleY = (tile.height - titleFontSize * 1.0) / 2
      elements.push({
        type: 'text',
        x: padH,
        y: titleY,
        width: textZoneWidth,
        content: titleText,
        style: {
          fontSize: titleFontSize,
          fontWeight: preset.bannerTitleWeight,
          fontFamily: preset.bannerTitleFamily,
          color: bannerText,
          textAlign: 'left',
          lineHeight: 1.0,
          zIndex: 30,
          textShadow: galactic ? neonTextGlow(palette, 'title') : undefined,
        }
      })
    }
  }

  // ── Hero image ────────────────────────────────────────────────────────────
  if (showHero) {
    const heroTransform = options.bannerHeroTransform ?? content.heroTransform
    if (isCutout) {
      const imageUrl = content.heroImageCutoutUrl || content.heroImageUrl!
      const heroSize = tile.height * 1.8
      const heroX = tile.width - heroSize * 0.75
      const heroY = tile.height - heroSize * 0.85
      const heroTransformStyle = computeImageTransformStyle(heroTransform, 50, 100, true)
      elements.push({
        type: 'image',
        x: heroX,
        y: heroY,
        width: heroSize,
        height: heroSize,
        content: imageUrl,
        style: {
          objectFit: 'contain',
          objectPosition: heroTransformStyle.objectPosition ?? 'right bottom',
          transform: heroTransformStyle.transform,
          transformOrigin: heroTransformStyle.transformOrigin,
          zIndex: 3,
          isCutout: true,
        }
      })
    } else {
      const imageUrl = content.heroImageUrl!
      const heroTransformStyle = computeImageTransformStyle(heroTransform, 50, 50)
      elements.push({
        type: 'image',
        x: tile.width - heroZoneWidth,
        y: 0,
        width: heroZoneWidth,
        height: tile.height,
        content: imageUrl,
        style: {
          objectFit: 'cover',
          objectPosition: heroTransformStyle.objectPosition ?? 'center',
          transform: heroTransformStyle.transform,
          transformOrigin: heroTransformStyle.transformOrigin,
        }
      })
    }
  }

  return { elements }
}

function renderBannerStripContent(
  content: BannerStripContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const bannerSurface = options.palette?.colors?.bannerSurface ?? content.surfaceColor
  return {
    elements: [{
      type: 'background',
      x: 0, y: 0,
      width: tile.width,
      height: tile.height,
      content: '',
      style: { backgroundColor: bannerSurface }
    }]
  }
}

function renderFooterInfoContent(
  content: FooterInfoContentV2,
  tile: TileInstanceV2,
  options: RenderOptionsV2
): TileRenderData {
  const elements: RenderElement[] = []
  const palette = getPalette(options)
  const galactic = isGalacticPalette(options)
  const tileStyle = tile.style as TileStyleV2 | undefined
  const paddingH = SPACING_V2.tilePadding
  // Use template contentBudget for vertical padding when present (allows tighter footer and less gap below text)
  const paddingTop = tile.contentBudget?.paddingTop ?? SPACING_V2.tilePadding

  // Footer background block — full-bleed surface color at full opacity.
  // Prefer the live palette banner surface so footer matches the banner on palette change.
  // Falls back to baked-in content.surfaceColor (set when banner is present) or palette surface/background.
  const bgColor = options.palette?.colors?.bannerSurface ?? content.surfaceColor ?? tileStyle?.background?.color ?? palette.colors.surface ?? palette.colors.background
  // Use a generous height so the background fills the full-bleed region
  // (the region container clips any overflow beyond the page edge).
  const bgHeight = tile.height * 3
  elements.push({
    type: 'background',
    x: 0,
    y: 0,
    width: tile.width,
    height: bgHeight,
    content: '',
    style: {
      backgroundColor: bgColor,
      opacity: 1,
      borderRadius: tileStyle?.background?.borderRadius || 0
    }
  })

  if (galactic) {
    const c1 = '#FFFFFF'
    const c2 = palette.colors.menuTitle ?? palette.colors.sectionHeader
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="90" viewBox="0 0 220 90">',
      '<defs>',
      '<filter id="g" x="-50%" y="-50%" width="200%" height="200%">',
      '<feGaussianBlur stdDeviation="0.8" result="b"/>',
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>',
      '</filter>',
      '</defs>',
      `<g filter="url(#g)" opacity="0.92">`,
      `<circle cx="20" cy="16" r="0.9" fill="${c1}" opacity="0.60"/>`,
      `<circle cx="58" cy="22" r="0.7" fill="${c1}" opacity="0.48"/>`,
      `<circle cx="92" cy="14" r="0.8" fill="${c2}" opacity="0.46"/>`,
      `<circle cx="130" cy="24" r="0.8" fill="${c1}" opacity="0.52"/>`,
      `<circle cx="164" cy="18" r="0.7" fill="${c2}" opacity="0.42"/>`,
      `<circle cx="198" cy="22" r="0.8" fill="${c1}" opacity="0.44"/>`,
      `<circle cx="32" cy="58" r="1.2" fill="${c2}" opacity="0.40"/>`,
      `<circle cx="86" cy="62" r="1.1" fill="${c1}" opacity="0.44"/>`,
      `<circle cx="146" cy="60" r="1.15" fill="${c2}" opacity="0.38"/>`,
      `<circle cx="206" cy="64" r="1.2" fill="${c1}" opacity="0.36"/>`,
      `<circle cx="12" cy="38" r="1.7" fill="${c2}" opacity="0.26"/>`,
      `<circle cx="182" cy="44" r="1.8" fill="${c1}" opacity="0.24"/>`,
      '</g>',
      '</svg>',
    ].join('')
    const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`
    elements.push({
      type: 'background',
      x: 0,
      y: 0,
      width: tile.width,
      height: tile.height,
      content: '',
      style: {
        background: `url("${uri}") repeat 0 0 / 220px 90px`,
        opacity: 0.55,
        zIndex: 1,
      }
    })
  }

  // Top border
  const borderColor = tileStyle?.border?.color || palette.colors.footerBorder
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
    fontSize: TYPOGRAPHY_TOKENS_V2.fontSize.xss,
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.normal,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
  })
  // Use the resolved font family from the contact typography (follows the template/palette font)
  const footerFontFamily = contactTypo.fontFamily
  const fontSize = contactTypo.fontSize
  const lineHeight = contactTypo.lineHeight
  const defaultTextColor = tileStyle?.typography?.color || palette.colors.footerText

  // Pre-calculate text lines (address + contact) for vertical centring
  const textLines: Array<{ text: string; bold: boolean }> = []
  if (content.address) textLines.push({ text: content.address, bold: false })

  let contactLine = ''
  if (content.phone) contactLine += content.phone
  if (content.email) contactLine += (contactLine ? ' • ' : '') + content.email
  if (content.socialMedia?.website) {
    let websiteDisplay = content.socialMedia.website
    if (websiteDisplay.startsWith('https://')) {
      websiteDisplay = 'www.' + websiteDisplay.substring(8)
    } else if (websiteDisplay.startsWith('http://')) {
      websiteDisplay = 'www.' + websiteDisplay.substring(7)
    } else if (!websiteDisplay.startsWith('www.')) {
      websiteDisplay = 'www.' + websiteDisplay
    }
    contactLine += (contactLine ? ' • ' : '') + websiteDisplay
  }
  if (contactLine) textLines.push({ text: contactLine, bold: false })

  // Social media: icon image + handle text, laid out horizontally and centred
  const socialItems: Array<{ icon: string; handle: string }> = []
  const iconUrls = options.socialIconDataUrls ?? {}
  if (content.socialMedia?.instagram) socialItems.push({ icon: iconUrls['instagram'] ?? '/logos/instagram.png', handle: content.socialMedia.instagram })
  if (content.socialMedia?.facebook) socialItems.push({ icon: iconUrls['facebook'] ?? '/logos/facebook.png', handle: content.socialMedia.facebook })
  if (content.socialMedia?.x) socialItems.push({ icon: iconUrls['x'] ?? '/logos/x.png', handle: content.socialMedia.x })
  if (content.socialMedia?.tiktok) socialItems.push({ icon: iconUrls['tiktok'] ?? '/logos/tiktok.png', handle: content.socialMedia.tiktok })

  const hasSocialLine = socialItems.length > 0
  const totalLines = textLines.length + (hasSocialLine ? 1 : 0)

  // Vertically centre the whole block within the tile (below the border)
  const totalTextHeight = totalLines * fontSize * lineHeight
  const availableHeight = tile.height - borderWidth
  let currentY = borderWidth + Math.max(paddingTop, (availableHeight - totalTextHeight) / 2)

  // Render text lines (address, contact)
  textLines.forEach(({ text, bold }) => {
    elements.push({
      type: 'text',
      x: paddingH,
      y: currentY,
      width: tile.width - (paddingH * 2),
      content: text,
      style: {
        fontSize,
        fontWeight: bold ? TYPOGRAPHY_TOKENS_V2.fontWeight.semibold : contactTypo.fontWeight,
        fontFamily: footerFontFamily,
        lineHeight,
        color: defaultTextColor,
        textAlign: 'center',
      }
    })
    currentY += fontSize * lineHeight
  })

  // Render social media line with real icons
  if (hasSocialLine) {
    const iconSize = fontSize * 1.1  // icon slightly taller than text cap height
    const iconTextGap = 2            // gap between icon and handle text
    const bulletGap = 6              // gap around bullet separator
    const bulletText = ' • '
    // Estimate character width for Inconsolata (monospace ~0.6× fontSize)
    const charWidth = fontSize * 0.6
    const bulletWidth = bulletText.length * charWidth

    // Measure total width of the social row to centre it
    let totalRowWidth = 0
    socialItems.forEach((item, i) => {
      const handleWidth = item.handle.length * charWidth
      totalRowWidth += iconSize + iconTextGap + handleWidth
      if (i < socialItems.length - 1) totalRowWidth += bulletWidth
    })

    const iconY = currentY + (fontSize * lineHeight - iconSize) / 2
    let x = (tile.width - totalRowWidth) / 2

    socialItems.forEach((item, i) => {
      // Icon image
      elements.push({
        type: 'image',
        x,
        y: iconY,
        width: iconSize,
        height: iconSize,
        content: item.icon,
        style: { objectFit: 'contain' }
      })
      x += iconSize + iconTextGap

      // Handle text
      const handleWidth = item.handle.length * charWidth
      elements.push({
        type: 'text',
        x,
        y: currentY,
        width: handleWidth,
        content: item.handle,
        style: {
          fontSize,
          fontWeight: contactTypo.fontWeight,
          fontFamily: footerFontFamily,
          lineHeight,
          color: defaultTextColor,
          textAlign: 'left',
          whiteSpace: 'nowrap',
        }
      })
      x += handleWidth

      // Gap between social items — just whitespace, icons provide the visual separation
      if (i < socialItems.length - 1) {
        x += bulletWidth
      }
    })
  }

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
 * Clamp text to fit within specified dimensions.
 * Used for text truncation with ellipsis.
 */
export function clampText(
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number = 1
): string {
  const avgCharWidth = fontSize * 0.6
  const charsPerLine = Math.floor(maxWidth / avgCharWidth)
  const maxChars = charsPerLine * maxLines

  if (text.length <= maxChars) {
    return text
  }

  return text.substring(0, maxChars - 3) + '...'
}

export function estimateUnboundedLineCount(
  text: string | undefined | null,
  availableWidth: number,
  fontSize: number
): number {
  if (!text || text.length === 0) return 0
  const avgCharWidth = fontSize * 0.6
  const charsPerLine = Math.max(1, Math.floor(availableWidth / avgCharWidth))
  return Math.max(1, Math.ceil(text.length / charsPerLine))
}

/**
 * Estimate the number of rendered lines a text string will occupy.
 * Uses a simplified character-width heuristic (same as clampText).
 * Result is clamped to [1, maxLines].
 */
export function estimateLineCount(
  text: string | undefined | null,
  availableWidth: number,
  fontSize: number,
  maxLines: number
): number {
  const lines = estimateUnboundedLineCount(text, availableWidth, fontSize)
  if (lines === 0) return 0
  return Math.min(Math.max(1, lines), maxLines)
}

/**
 * Generate deterministic scale factor for consistent rendering
 */
export function getDefaultScale(): number {
  // 1 point = 1 pixel for web preview
  // This ensures consistent sizing between web and PDF
  return 1.0
}