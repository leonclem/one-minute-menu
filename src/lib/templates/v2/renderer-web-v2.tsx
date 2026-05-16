'use client'

/**
 * V2 Web Renderer - React Components for Layout Lab Preview
 * 
 * This module provides React components for rendering LayoutDocumentV2 outputs
 * in the Layout Lab web preview. Uses absolute positioning to match PDF output.
 * 
 * Key Design Decisions:
 * - Absolute positioning for all tiles (no CSS layout reflow)
 * - Margins applied ONCE at content-box wrapper level
 * - Deterministic scale factor (points to CSS pixels)
 * - Overlay toggles for debugging (grid, bounds, IDs)
 */

import React, { useEffect } from 'react'
import type { 
  LayoutDocumentV2, 
  PageLayoutV2, 
  TileInstanceV2, 
  RegionV2,
  PageSpecV2,
  ImageModeV2,
  ItemIndicatorsV2,
  DietaryIndicator,
  TileStyleV2,
} from './engine-types-v2'
import type { ItemContentV2, FeatureCardContentV2, FlagshipCardContentV2 } from './engine-types-v2'
import { 
  renderTileContent, 
  calculateAbsolutePosition,
  getDefaultScale,
  TYPOGRAPHY_TOKENS_V2,
  SPACING_V2,
  COLOR_TOKENS_V2,
  getFontSet,
  FONT_SETS_V2,
  TEXTURE_REGISTRY,
  PALETTE_TEXTURE_MAP,
  getFontStylePresetGoogleFontsUrl,
  BG_IMAGE_TEXT,
  blendHexTowards,
  getFlagshipBadgeMetrics,
  getFlagshipChrome,
  resolveSubElementTypography,
  resolveFlagshipTitleFit,
  resolveFlagshipTextSlots,
  computeImageTransformStyle,
  resolveTransformForMode,
  type RenderOptionsV2,
  type RenderElement 
} from './renderer-v2'
import { ImageTransformOverlay } from '@/components/ImageTransformOverlay'
import { formatCurrency } from '../../currency-formatter'

// ============================================================================
// Font Loading Utilities
// ============================================================================

/**
 * Extract font sets used in a layout document
 */
function extractUsedFontSets(document: LayoutDocumentV2): string[] {
  const fontSets = new Set<string>()
  
  // Add default font set
  fontSets.add('modern-sans')
  
  // Extract font sets from tiles
  document.pages.forEach(page => {
    page.tiles.forEach(tile => {
      const tileStyle = (tile as any).style
      if (tileStyle?.typography?.fontSet) {
        fontSets.add(tileStyle.typography.fontSet)
      }
    })
  })
  
  return Array.from(fontSets)
}

/**
 * Load Google Fonts dynamically
 */
function loadGoogleFonts(fontSetIds: string[]): void {
  // Check if we're in browser environment
  if (typeof window === 'undefined') return
  
  const fontSets = fontSetIds.map(id => getFontSet(id))
  const googleFontsParams = fontSets
    .map(set => set.googleFonts)
    .filter(Boolean)
    .join('&family=')
  
  const fontUrl = `https://fonts.googleapis.com/css2?family=${googleFontsParams}&display=swap`
  
  // Check if this font URL is already loaded
  const existingLink = document.querySelector(`link[href="${fontUrl}"]`)
  if (existingLink) return
  
  // Create and append font link
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = fontUrl
  document.head.appendChild(link)
}


// ============================================================================
// Web Render Function
// ============================================================================

/**
 * Render LayoutDocumentV2 to React component tree for Layout Lab preview
 * 
 * Returns a React component that renders the complete document with all pages.
 * Uses absolute positioning to match PDF output exactly.
 */
export function renderToWeb(
  document: LayoutDocumentV2,
  options: RenderOptionsV2 = {
    scale: getDefaultScale(),
    showGridOverlay: false,
    showRegionBounds: false,
    showTileIds: false
  }
): React.ReactElement {
  // Load fonts dynamically based on document usage (non-blocking)
  const usedFontSets = extractUsedFontSets(document)
  loadGoogleFonts(usedFontSets)

  // Load font style preset fonts if specified
  if (options.fontStylePreset) {
    const presetUrl = getFontStylePresetGoogleFontsUrl(options.fontStylePreset)
    if (presetUrl && typeof window !== 'undefined') {
      const existing = window.document.querySelector(`link[href="${presetUrl}"]`)
      if (!existing) {
        const link = window.document.createElement('link')
        link.rel = 'stylesheet'
        link.href = presetUrl
        window.document.head.appendChild(link)
      }
    }
  }

  return (
    <div className="layout-document-v2" style={{ fontFamily: TYPOGRAPHY_TOKENS_V2.fontFamily.primary }}>
      {document.pages.map((page, pageIndex) => (
        <PageRenderer
          key={`page-${pageIndex}`}
          page={page}
          pageSpec={document.pageSpec}
          options={options}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Page Renderer Component
// ============================================================================

export interface PageRendererProps {
  page: PageLayoutV2
  pageSpec: PageSpecV2
  options: RenderOptionsV2
}

export function PageRenderer({ page, pageSpec, options }: PageRendererProps) {
  const { scale, isExport, palette, texturesEnabled } = options

  // Ensure the font style preset's Google Font is loaded whenever the preset changes
  useEffect(() => {
    if (!options.fontStylePreset || typeof window === 'undefined') return
    const presetUrl = getFontStylePresetGoogleFontsUrl(options.fontStylePreset)
    if (!presetUrl) return
    if (!window.document.querySelector(`link[href="${presetUrl}"]`)) {
      const link = window.document.createElement('link')
      link.rel = 'stylesheet'
      link.href = presetUrl
      window.document.head.appendChild(link)
    }
  }, [options.fontStylePreset])


  // Galactic banner font (Orbitron / Anta) is now loaded via the fontStylePreset effect above
  // when the 'future' preset is selected.

  const bgColor = palette?.colors.background || COLOR_TOKENS_V2.background.white
  const mutedTextColor = palette?.colors.textMuted || COLOR_TOKENS_V2.text.muted
  const borderColor = palette?.colors.border.light || COLOR_TOKENS_V2.border.light
  
  // Background: palette color. When user selects a texture (textureId), overlay it on palette.
  let backgroundStyle: React.CSSProperties = {
    backgroundColor: bgColor
  }
  // Resolve texture: direct textureId first, then palette-based fallback
  const resolvedTextureId = options.textureId
    || (texturesEnabled && palette?.id ? PALETTE_TEXTURE_MAP[palette.id] : undefined)
  if (resolvedTextureId) {
    const textureConfig = TEXTURE_REGISTRY.get(resolvedTextureId)
    // Only merge texture CSS onto the background div when there's no overlayOpacity —
    // overlay textures are rendered as a separate div so the palette colour shows through.
    if (textureConfig && !textureConfig.overlayOpacity) {
      const textureUrl = textureConfig.pdfTextureFile
        ? (options.textureDataURL || `/textures/${textureConfig.pdfTextureFile}`)
        : ''
      const cssProps = isExport
        ? textureConfig.webCssExport(textureUrl)
        : textureConfig.webCss(textureUrl)
      backgroundStyle = { ...backgroundStyle, ...cssProps as React.CSSProperties }
    }
  }
  
  // Banner and footer render full-bleed (flush to page edges), bypassing content-box margins.
  // Title also renders full-bleed when it has a bannerSurface background (1-column-tall title bar).
  const bannerRegion = page.regions.find(r => r.id === 'banner')
  const footerRegion = page.regions.find(r => r.id === 'footer')
  const titleRegion = page.regions.find(r => r.id === 'title')
  const titleTile = titleRegion ? page.tiles.find(t => t.regionId === 'title') : undefined
  const titleIsFullBleed = !!(titleTile && (titleTile as any).style?.background?.color === 'bannerSurface')
  const innerRegions = page.regions.filter(r => r.id !== 'banner' && r.id !== 'footer' && !(r.id === 'title' && titleIsFullBleed))

  return (
    <div 
      className="page-container-v2"
      style={{
        width: pageSpec.width * scale,
        height: pageSpec.height * scale,
        position: 'relative',
        marginBottom: isExport ? 0 : 20 * scale,
        boxShadow: isExport ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        borderRadius: isExport ? 0 : 4,
        overflow: 'hidden'
      }}
    >
      {/* Background layer (color) - explicitly behind content so borders/shadows read clearly */}
      <div
        className="page-background-v2"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          ...backgroundStyle
        }}
      />

      {/* Texture overlay — rendered as a separate div when the texture has overlayOpacity set,
          so the palette background colour shows through underneath at full strength */}
      {resolvedTextureId && (() => {
        const textureConfig = TEXTURE_REGISTRY.get(resolvedTextureId)
        if (!textureConfig?.overlayOpacity) return null
        const textureUrl = textureConfig.pdfTextureFile
          ? (options.textureDataURL || `/textures/${textureConfig.pdfTextureFile}`)
          : ''
        const cssProps = isExport
          ? textureConfig.webCssExport(textureUrl)
          : textureConfig.webCss(textureUrl)
        return (
          <div
            className="page-texture-overlay-v2"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              opacity: textureConfig.overlayOpacity,
              ...cssProps as React.CSSProperties,
            }}
          />
        )
      })()}

      {/* Full-bleed banner — flush to top and side edges, above title bar */}
      {bannerRegion && (
        <FullBleedRegionRenderer
          region={bannerRegion}
          tiles={page.tiles.filter(t => t.regionId === 'banner')}
          pageSpec={pageSpec}
          options={options}
          edge="top"
          zIndex={3}
        />
      )}

      {/* Full-bleed title bar — sits immediately below the banner; z-index below banner so enlarged images overlap it */}
      {titleIsFullBleed && titleRegion && (
        <FullBleedRegionRenderer
          region={titleRegion}
          tiles={page.tiles.filter(t => t.regionId === 'title')}
          pageSpec={pageSpec}
          options={options}
          edge="top"
          topOverride={bannerRegion ? bannerRegion.height : pageSpec.margins.top + titleRegion.y}
          zIndex={2}
        />
      )}

      {/* Content box wrapper - applies margins ONCE; above background */}
      <div
        className="content-box-v2"
        style={{
          position: 'absolute',
          left: pageSpec.margins.left * scale,
          top: pageSpec.margins.top * scale,
          width: (pageSpec.width - pageSpec.margins.left - pageSpec.margins.right) * scale,
          height: (pageSpec.height - pageSpec.margins.top - pageSpec.margins.bottom) * scale,
          zIndex: 1
        }}
      >
        {/* Non-bleed regions (header, title, body) */}
        {innerRegions.map(region => (
          <RegionRenderer
            key={region.id}
            region={region}
            tiles={page.tiles.filter(t => t.regionId === region.id)}
            options={options}
          />
        ))}
      </div>

      {/* Full-bleed footer — flush to bottom and side edges */}
      {footerRegion && (
        <FullBleedRegionRenderer
          region={footerRegion}
          tiles={page.tiles.filter(t => t.regionId === 'footer').map(t => ({
            ...t,
            // Extend tile height by bottom margin so footer text centres within the full-bleed area
            height: t.height + pageSpec.margins.bottom,
          }))}
          pageSpec={pageSpec}
          options={options}
          edge="bottom"
        />
      )}
      
      {/* Vignette overlay */}
      {options.showVignette && (
        <div
          className="vignette-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 80px rgba(0,0,0,0.08)',
            pointerEvents: 'none',
            zIndex: 2
          }}
        />
      )}

      {/* Page overlays - above content */}
      {options.showRegionBounds && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
          <RegionBoundsOverlay regions={page.regions} pageSpec={pageSpec} scale={scale} />
        </div>
      )}
      
      {options.showGridOverlay && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
          <GridOverlay page={page} pageSpec={pageSpec} scale={scale} />
        </div>
      )}
      
      {/* Page info */}
      {!isExport && (
        <div 
          className="page-info"
          style={{
            position: 'absolute',
            top: 4,
            right: 8,
            fontSize: 10,
            color: mutedTextColor,
            backgroundColor: bgColor,
            padding: '2px 6px',
            borderRadius: 2,
            border: `1px solid ${borderColor}`,
            zIndex: 10
          }}
        >
          Page {page.pageIndex + 1} ({page.pageType})
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Full-Bleed Region Renderer (banner / footer)
// ============================================================================

interface FullBleedRegionRendererProps {
  region: RegionV2
  tiles: TileInstanceV2[]
  pageSpec: PageSpecV2
  options: RenderOptionsV2
  edge: 'top' | 'bottom'
  topOverride?: number
  zIndex?: number
}

/**
 * Renders a region flush to the page edges (no margin inset).
 * Used for banner (top) and footer (bottom) so they span the full page width.
 * Tiles are re-rendered with width = pageSpec.width so internal layout fills the full bleed area.
 */
function FullBleedRegionRenderer({ region, tiles, pageSpec, options, edge, topOverride, zIndex = 2 }: FullBleedRegionRendererProps) {
  const { scale } = options
  const fullWidth = pageSpec.width

  // For bottom edge, extend the region height to cover the bottom margin so the
  // footer background is flush to the page edge.
  const extraHeight = edge === 'bottom' ? pageSpec.margins.bottom : 0
  const renderHeight = region.height + extraHeight

  // Re-map tiles to full page width so internal element positions scale correctly
  const fullBleedTiles: TileInstanceV2[] = tiles.map(tile => ({
    ...tile,
    x: 0,
    width: fullWidth,
  }))

  const top = topOverride !== undefined
    ? topOverride * scale
    : edge === 'top' ? 0 : (pageSpec.height - renderHeight) * scale

  return (
    <div
      className={`region-v2 region-${region.id} region-fullbleed`}
      style={{
        position: 'absolute',
        left: 0,
        top,
        width: fullWidth * scale,
        height: renderHeight * scale,
        zIndex,
        // Banner cutout images overflow upward — allow visible overflow on top edge
        overflow: edge === 'top' ? 'visible' : 'hidden',
      }}
    >
      {fullBleedTiles.map(tile => (
        <TileRenderer
          key={tile.id}
          tile={tile}
          options={options}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Region Renderer Component
// ============================================================================

interface RegionRendererProps {
  region: RegionV2
  tiles: TileInstanceV2[]
  options: RenderOptionsV2
}

function RegionRenderer({ region, tiles, options }: RegionRendererProps) {
  const { scale } = options
  const galactic = options.palette?.id === 'galactic-menu'

  // Galactic: draw a frame around each category block (SECTION_HEADER + items below it).
  const sectionFrames = React.useMemo(() => {
    if (!galactic || region.id !== 'body') return []
    const headers = tiles
      .filter(t => t.type === 'SECTION_HEADER')
      .slice()
      .sort((a, b) => a.y - b.y)
    if (headers.length === 0) return []

    const frames: Array<{ id: string; x: number; y: number; w: number; h: number }> = []
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i]
      const next = headers[i + 1]
      const sectionTiles = tiles.filter(t => (
        t.id !== h.id &&
        t.y >= h.y &&
        (!next || t.y < next.y)
      ))
      const contentTiles = sectionTiles.length > 0 ? sectionTiles : [h]
      const minX = Math.min(...contentTiles.map(t => t.x))
      const maxRight = Math.max(...contentTiles.map(t => t.x + t.width))
      const maxBottom = Math.max(...contentTiles.map(t => t.y + t.height))

      // Place the frame just outside the section content. Some templates place
      // item tiles at x=0, so a halfway-to-edge calculation still hugs items.
      const outsideGap = Math.max(8, Math.min(18, region.width * 0.025))
      const left = minX - outsideGap
      const right = maxRight + outsideGap
      const top = Math.max(0, h.y + h.height * 0.72)
      const nextFrameTop = next ? next.y + next.height * 0.72 : undefined
      const maxAllowedBottom = nextFrameTop !== undefined ? nextFrameTop - 8 : region.height - 8
      const bottom = Math.min(maxAllowedBottom, maxBottom + 12)
      const height = Math.max(28, bottom - top)
      frames.push({
        id: `section-frame-${h.id}`,
        x: left,
        y: top,
        w: Math.max(0, right - left),
        h: height,
      })
    }
    return frames
  }, [galactic, region.id, region.height, region.width, tiles])
  
  return (
    <div
      className={`region-v2 region-${region.id}`}
      style={{
        position: 'absolute',
        left: region.x * scale,  // always 0 (content-box relative)
        top: region.y * scale,   // stacked within content box
        width: region.width * scale,
        height: region.height * scale
      }}
    >
      {sectionFrames.map(frame => (
        <div
          key={frame.id}
          style={{
            position: 'absolute',
            left: frame.x * scale,
            top: frame.y * scale,
            width: frame.w * scale,
            height: frame.h * scale,
            border: '1.5px solid rgba(87, 230, 255, 0.55)',
            boxShadow: '0 0 14px rgba(87, 230, 255, 0.32), 0 0 30px rgba(87, 230, 255, 0.18)',
            borderRadius: 10,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Tiles within region */}
      {tiles.map(tile => (
        <TileRenderer
          key={tile.id}
          tile={tile}
          options={options}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Tile Renderer Component
// ============================================================================

interface TileRendererProps {
  tile: TileInstanceV2
  options: RenderOptionsV2
}

const MENU_ITEM_TILE_TYPES = ['ITEM_CARD', 'ITEM_TEXT_ROW', 'FEATURE_CARD', 'FLAGSHIP_CARD'] as const
const SUBTLE_ITEM_BORDER = '1px solid rgba(0,0,0,0.06)'
const SUBTLE_ITEM_SHADOW = '0 1px 3px rgba(0,0,0,0.08)'

const IMAGE_TILE_TYPES = ['ITEM_CARD', 'FEATURE_CARD', 'FLAGSHIP_CARD'] as const

interface FlagshipLayoutMetrics {
  padTop: number
  padBottom: number
  padX: number
  gap: number
  hasMediaColumn: boolean
  isBackgroundMode: boolean
  mediaFrame?: { left: number; top: number; width: number; height: number; borderRadius: number }
}

function getFlagshipLayoutMetrics(
  tile: TileInstanceV2,
  imageMode: ImageModeV2,
  showImage: boolean
): FlagshipLayoutMetrics {
  const padTop = tile.contentBudget?.paddingTop ?? 10
  const padBottom = tile.contentBudget?.paddingBottom ?? 10
  const padX = Math.max(10, Math.min(18, tile.width * 0.04))
  const gap = Math.max(10, Math.min(18, tile.width * 0.03))
  const bodyHeight = tile.height - padTop - padBottom
  const isBackgroundMode = imageMode === 'background'
  const hasMediaColumn = showImage && imageMode !== 'none' && !isBackgroundMode

  if (!hasMediaColumn) {
    return { padTop, padBottom, padX, gap, hasMediaColumn, isBackgroundMode }
  }

  let mediaWidth = Math.max(88, Math.min(tile.colSpan > 1 ? tile.width * 0.44 : tile.width * 0.38, tile.width - padX * 2 - 92))
  let mediaHeight = bodyHeight
  let mediaTop = padTop
  let mediaLeft = padX
  let borderRadius = 0

  if (imageMode === 'compact-rect') {
    mediaWidth = Math.min(mediaWidth, tile.width * 0.34)
    mediaHeight = Math.min(bodyHeight * 0.72, mediaWidth * 1.15)
    mediaTop = padTop + (bodyHeight - mediaHeight) / 2
    borderRadius = 0
  } else if (imageMode === 'compact-circle') {
    const diameter = Math.min(mediaWidth, bodyHeight * 0.7)
    mediaWidth = diameter
    mediaHeight = diameter
    mediaTop = padTop + (bodyHeight - diameter) / 2
    borderRadius = diameter / 2
  } else if (imageMode === 'cutout') {
    mediaWidth = Math.min(mediaWidth, tile.width * 0.4)
    mediaHeight = bodyHeight
    borderRadius = 0
  } else if (imageMode === 'stretch') {
    mediaHeight = tile.height
    mediaTop = 0
    mediaLeft = 0
  }

  return {
    padTop,
    padBottom,
    padX,
    gap,
    hasMediaColumn,
    isBackgroundMode,
    mediaFrame: {
      left: mediaLeft,
      top: mediaTop,
      width: mediaWidth,
      height: mediaHeight,
      borderRadius
    }
  }
}

function getFlagshipImageStyle(
  content: FlagshipCardContentV2,
  options: RenderOptionsV2,
  imageMode: ImageModeV2
): React.CSSProperties {
  const persistedTransform = resolveTransformForMode(content.imageTransform, imageMode)
  const effectiveTransform = options.imageTransforms?.get(content.itemId) ?? persistedTransform
  const baseY = imageMode === 'stretch' ? 56 : 50
  const transformStyle = computeImageTransformStyle(
    effectiveTransform,
    50,
    baseY,
    imageMode === 'cutout'
  )

  return {
    objectFit: imageMode === 'cutout' ? 'contain' : 'cover',
    objectPosition: transformStyle.objectPosition,
    transform: transformStyle.transform,
    transformOrigin: transformStyle.transformOrigin,
  }
}

function getIndicatorTokens(indicators: ItemIndicatorsV2): string[] {
  const dietaryTokens: Record<DietaryIndicator, string> = {
    vegetarian: '🥬',
    vegan: '🌱',
    halal: '☪️',
    kosher: '✡️',
    'gluten-free': '🌾',
  }

  return [
    ...indicators.dietary.map((dietary) => dietaryTokens[dietary] ?? 'V'),
    ...(indicators.spiceLevel && indicators.spiceLevel > 0
      ? ['🌶'.repeat(Math.min(indicators.spiceLevel, 3))]
      : []),
  ]
}

interface FlagshipCardProps {
  tile: TileInstanceV2
  content: FlagshipCardContentV2
  options: RenderOptionsV2
  scale: number
}

/**
 * Ink-stamp "SAMPLE" overlay for placeholder tiles.
 * Shared between regular item tiles and the flagship card.
 */
function SampleStamp({ tileId, tileWidth, tileHeight, scale, opacity = 1 }: { tileId: string; tileWidth: number; tileHeight: number; scale: number; opacity?: number }) {
  const stampSize = Math.max(10, Math.min(tileWidth, tileHeight) * 0.18 * scale)
  const filterId = `stamp-${tileId}`
  const inkColor = 'rgba(200, 120, 120, 0.4)'
  const dispScale = stampSize * 0.06

  // The text is the anchor. We size the SVG around the text with generous padding
  // so the border (drawn as a background rect behind the text) is never clipped.
  // Rotation is applied via CSS transform on the SVG — the tile's overflow:hidden
  // clips the final result at the tile boundary, which is fine.
  const textW = stampSize * 5.0   // generous width for "SAMPLE" + letter-spacing
  const textH = stampSize * 1.4
  const borderPad = stampSize * 0.35
  const rectX = -borderPad
  const rectY = -borderPad
  const rectW = textW + borderPad * 2
  const rectH = textH + borderPad * 2
  // SVG viewBox is centred on the text so rotation pivot is the stamp centre
  const vbHalfW = rectW / 2 + stampSize * 0.5
  const vbHalfH = rectH / 2 + stampSize * 0.5
  const svgW = vbHalfW * 2
  const svgH = vbHalfH * 2

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <svg
        width={svgW}
        height={svgH}
        viewBox={`${-vbHalfW} ${-vbHalfH} ${svgW} ${svgH}`}
        style={{ transform: 'rotate(-28deg)', overflow: 'visible', userSelect: 'none', opacity }}
      >
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="9" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={dispScale} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        {/* Border rect — positioned relative to the centred coordinate system */}
        <rect
          x={rectX - textW / 2}
          y={rectY - textH / 2}
          width={rectW}
          height={rectH}
          rx={stampSize * 0.14}
          fill="none"
          stroke={inkColor}
          strokeWidth={Math.max(1.5, stampSize * 0.1)}
          filter={`url(#${filterId})`}
        />
        {/* Stamp text — centred at origin */}
        <text
          x={0}
          y={stampSize * 0.36}
          textAnchor="middle"
          fontSize={stampSize}
          fontWeight="900"
          fontFamily='"Arial Black", "Impact", sans-serif'
          fill={inkColor}
          letterSpacing={stampSize * 0.16}
          filter={`url(#${filterId})`}
        >
          SAMPLE
        </text>
      </svg>
    </div>
  )
}

function FlagshipBadge({ tile, options, scale }: Omit<FlagshipCardProps, 'content'>) {
  const isGalactic = options.palette?.id === 'galactic-menu'
  const chrome = getFlagshipChrome(options.palette, tile.style as import('./engine-types-v2').TileStyleV2 | undefined, isGalactic)
  const metrics = getFlagshipBadgeMetrics(
    tile.width,
    isGalactic ? { glowColor: '#FFFFFF' } : undefined
  )
  const top = -metrics.overlap * scale
  const left = chrome.badgePosition === 'left' ? -metrics.overlap * scale : undefined
  const right = chrome.badgePosition === 'right' ? -metrics.overlap * scale : undefined

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top,
        left,
        right,
        zIndex: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: metrics.badgeW * scale,
          height: metrics.badgeH * scale,
          padding: `0 ${12 * scale}px`,
          borderRadius: chrome.badgeRadius * scale,
          backgroundColor: chrome.badgeFill,
          color: chrome.badgeText,
          boxShadow: metrics.boxShadow,
          fontSize: metrics.fontSize * scale,
          fontWeight: 800,
          letterSpacing: 0.2 * scale,
          whiteSpace: 'nowrap',
        }}
      >
        {chrome.badgeLabel}
      </span>
    </div>
  )
}

function FlagshipCard({ tile, content, options, scale }: FlagshipCardProps) {
  const palette = options.palette
  const tileStyle = tile.style as TileStyleV2 | undefined
  const imageMode: ImageModeV2 = options.imageMode || 'stretch'
  const layout = getFlagshipLayoutMetrics(tile, imageMode, content.showImage)
  const chrome = getFlagshipChrome(palette, tile.style as import('./engine-types-v2').TileStyleV2 | undefined, palette?.id === 'galactic-menu')
  const itemTitle = palette?.colors?.itemTitle ?? COLOR_TOKENS_V2.text.primary
  const itemDescription = palette?.colors?.itemDescription ?? COLOR_TOKENS_V2.text.secondary
  const itemPrice = palette?.colors?.itemPrice ?? COLOR_TOKENS_V2.text.primary
  const prominenceScale = Math.min(1.2, Math.max(1, (tile.colSpan + tile.rowSpan) / 3))
  const nameTypo = resolveSubElementTypography(tileStyle, 'name', {
    fontSize: Math.round(TYPOGRAPHY_TOKENS_V2.fontSize.base * prominenceScale),
    fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
    lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
  })
  const articleId = `flagship-title-${tile.id}`
  const indicatorTokens = getIndicatorTokens(content.indicators)
  const formattedPrice = formatCurrency(content.price, content.currency || 'USD')
  const imageStyle = getFlagshipImageStyle(content, options, imageMode)
  const hasMedia = !!(content.showImage && content.imageUrl && imageMode !== 'none')
  const mediaFrame = layout.mediaFrame
  const isStretchFlagship = imageMode === 'stretch' && layout.hasMediaColumn && !!mediaFrame
  const shouldClipToFlagshipFrame = imageMode === 'stretch' || imageMode === 'background'
  const baseNameFontSize = nameTypo.fontSize
  const previewTitleWidth = mediaFrame
    ? tile.width - mediaFrame.width - layout.gap - layout.padX - (chrome.borderWidth * 2)
    : tile.width - (layout.padX * 2) - (chrome.borderWidth * 2)
  const titleFit = resolveFlagshipTitleFit({
    text: content.name,
    availableWidth: previewTitleWidth,
    preferredFontSize: baseNameFontSize,
    preferredLines: 2,
    minFontSize: Math.min(baseNameFontSize, 9),
  })
  const nameFontSize = titleFit.fontSize * scale
  const descFontSize = TYPOGRAPHY_TOKENS_V2.fontSize.xsm * scale
  const priceFontSize = TYPOGRAPHY_TOKENS_V2.fontSize.sm * scale
  const nameLineHeightPx = nameFontSize * nameTypo.lineHeight
  const descLineHeightPx = descFontSize * TYPOGRAPHY_TOKENS_V2.lineHeight.normal
  const priceLineHeightPx = priceFontSize * TYPOGRAPHY_TOKENS_V2.lineHeight.tight
  const textSlots = resolveFlagshipTextSlots({
    availableHeight: isStretchFlagship
      ? (tile.height - (chrome.borderWidth * 2) - layout.padTop - layout.padBottom) * scale
      : (tile.height - layout.padTop - layout.padBottom) * scale,
    nameMaxLines: Math.max(tile.contentBudget?.nameLines ?? 2, titleFit.lineBudget),
    minNameLines: titleFit.lineBudget,
    descMaxLines: content.description ? (tile.contentBudget?.descLines ?? 4) : 0,
    hasDescription: !!content.description,
    nameLineHeight: nameLineHeightPx,
    descLineHeight: descLineHeightPx,
    priceLineHeight: priceLineHeightPx,
  })
  const clippedImageFillStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
  }

  return (
    <article
      aria-label={`Flagship item: ${content.name}`}
      aria-labelledby={articleId}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: layout.isBackgroundMode
          ? 'block'
          : 'flex',
        flexDirection: layout.hasMediaColumn ? 'row-reverse' : 'column',
        alignItems: layout.hasMediaColumn ? 'stretch' : undefined,
        gap: layout.hasMediaColumn && !isStretchFlagship ? layout.gap * scale : undefined,
        padding: isStretchFlagship
          ? 0
          : `${layout.padTop * scale}px ${layout.padX * scale}px ${layout.padBottom * scale}px`,
        backgroundColor: layout.isBackgroundMode ? 'transparent' : chrome.panel,
        borderRadius: 0,
        border: `${chrome.borderWidth * scale}px solid ${chrome.frameOuter}`,
        boxSizing: 'border-box',
        boxShadow: `0 ${8 * scale}px ${20 * scale}px rgba(84,58,4,0.16)`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: isStretchFlagship ? 'flex-start' : 'center',
          flex: '1 1 0',
          height: '100%',
          boxSizing: 'border-box',
          padding: isStretchFlagship
            ? `${layout.padTop * scale}px ${layout.padX * scale}px ${layout.padBottom * scale}px ${layout.gap * scale}px`
            : undefined,
        }}
      >
        <h3
          id={articleId}
          style={{
            margin: 0,
            color: layout.isBackgroundMode
              ? blendHexTowards('#FFFFFF', itemTitle, 0.18)
              : blendHexTowards(itemTitle, chrome.frameOuter, 0.14),
            fontSize: nameFontSize,
            lineHeight: nameTypo.lineHeight,
            fontWeight: nameTypo.fontWeight,
            fontFamily: nameTypo.fontFamily,
            textShadow: layout.isBackgroundMode ? BG_IMAGE_TEXT.shadow : undefined,
            height: textSlots.nameHeight,
            display: '-webkit-box',
            WebkitLineClamp: textSlots.nameLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            flex: '0 0 auto',
            textAlign: nameTypo.textAlign,
            textTransform: nameTypo.textTransform,
          }}
        >
          {content.name}
        </h3>

        {content.description && (
          <p
            style={{
              margin: `${textSlots.gapNameToDesc}px 0 0`,
              color: layout.isBackgroundMode ? BG_IMAGE_TEXT.descColor : itemDescription,
              fontSize: descFontSize,
              lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.normal,
              textShadow: layout.isBackgroundMode ? BG_IMAGE_TEXT.shadow : undefined,
              height: textSlots.descHeight,
              display: textSlots.descLines > 0 ? '-webkit-box' : 'none',
              WebkitLineClamp: textSlots.descLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              flex: '0 0 auto',
            }}
          >
            {content.description}
          </p>
        )}

        <p
          style={{
            margin: `${textSlots.gapDescToPrice}px 0 0`,
            color: layout.isBackgroundMode
              ? blendHexTowards('#FFFFFF', itemPrice, 0.28)
              : chrome.price,
            fontSize: priceFontSize,
            lineHeight: TYPOGRAPHY_TOKENS_V2.lineHeight.tight,
            fontWeight: TYPOGRAPHY_TOKENS_V2.fontWeight.bold,
            textShadow: layout.isBackgroundMode ? BG_IMAGE_TEXT.shadow : undefined,
            flex: '0 0 auto',
          }}
        >
          {formattedPrice}
        </p>

        {indicatorTokens.length > 0 && (
          <div
            aria-hidden="true"
            style={{
              marginTop: 10 * scale,
              display: 'flex',
              gap: 6 * scale,
              flexWrap: 'wrap',
            }}
          >
            {indicatorTokens.map((token, index) => (
              <span
                key={`${tile.id}-indicator-${index}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 20 * scale,
                  height: 20 * scale,
                  padding: `0 ${4 * scale}px`,
                  borderRadius: 999,
                  backgroundColor: layout.isBackgroundMode
                    ? 'rgba(255,255,255,0.18)'
                    : palette?.colors?.itemIndicators?.background ?? COLOR_TOKENS_V2.background.white,
                  fontSize: 12 * scale,
                }}
              >
                {token}
              </span>
            ))}
          </div>
        )}
      </div>

      {layout.isBackgroundMode ? (
        <>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 0,
              overflow: 'hidden',
            }}
          >
            {hasMedia && (
              <img
                src={content.imageUrl}
                alt=""
                aria-hidden="true"
                style={{
                  display: 'block',
                  borderRadius: 0,
                  ...clippedImageFillStyle,
                  ...imageStyle,
                }}
              />
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.46) 42%, rgba(0,0,0,0.18) 100%)',
                borderRadius: 0,
              }}
            />
          </div>
        </>
      ) : layout.hasMediaColumn && mediaFrame ? (
        <div
          style={{
            flex: '0 0 auto',
            width: mediaFrame.width * scale,
            minWidth: mediaFrame.width * scale,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'stretch',
            height: isStretchFlagship ? '100%' : undefined,
          }}
        >
          {hasMedia ? (
            <div
              style={{
                position: 'relative',
                width: mediaFrame.width * scale,
                height: isStretchFlagship ? '100%' : mediaFrame.height * scale,
                borderRadius: mediaFrame.borderRadius * scale,
                overflow: shouldClipToFlagshipFrame ? 'hidden' : 'visible',
              }}
            >
              <img
                src={content.imageUrl}
                alt={`Photo of ${content.name}`}
                style={{
                  display: 'block',
                  borderRadius: mediaFrame.borderRadius * scale,
                  boxShadow: imageMode === 'cutout' ? undefined : '0 6px 18px rgba(0,0,0,0.12)',
                  ...clippedImageFillStyle,
                  ...imageStyle,
                }}
              />
            </div>
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: mediaFrame.width * scale,
                height: mediaFrame.height * scale,
                borderRadius: mediaFrame.borderRadius * scale,
                backgroundColor: palette?.colors?.border?.light ?? COLOR_TOKENS_V2.border.light,
              }}
            />
          )}
        </div>
      ) : null}

      {/* "SAMPLE" stamp for placeholder flagship items */}
      {(content as any).isPlaceholder && content.imageUrl && !options.hideSampleLabels && (
        <SampleStamp tileId={tile.id} tileWidth={tile.width} tileHeight={tile.height} scale={scale} opacity={0.42} />
      )}
    </article>
  )
}

function TileRenderer({ tile, options }: TileRendererProps) {
  const { scale, palette } = options
  const isFlagshipTile = tile.type === 'FLAGSHIP_CARD'
  const renderData = isFlagshipTile ? undefined : renderTileContent(tile, options)
  const isMenuItemTile = MENU_ITEM_TILE_TYPES.includes(tile.type as (typeof MENU_ITEM_TILE_TYPES)[number])
  const itemMenuContent = isMenuItemTile
    ? (tile.content as ItemContentV2 | FeatureCardContentV2 | FlagshipCardContentV2)
    : undefined
  const flagshipContent = isFlagshipTile ? (tile.content as FlagshipCardContentV2) : undefined
  const isFeaturedItem =
    isMenuItemTile &&
    tile.type !== 'FEATURE_CARD' &&
    tile.type !== 'FLAGSHIP_CARD' &&
    !!(itemMenuContent && 'isFeatured' in itemMenuContent && (itemMenuContent as ItemContentV2).isFeatured)

  const accent =
    palette?.colors?.accent ??
    palette?.colors?.itemPrice ??
    COLOR_TOKENS_V2.text.primary
  const flagshipChrome = isFlagshipTile
    ? getFlagshipChrome(palette, tile.style as import('./engine-types-v2').TileStyleV2 | undefined, palette?.id === 'galactic-menu')
    : undefined
  const defaultPaper =
    palette?.colors?.surface ??
    palette?.colors?.background ??
    COLOR_TOKENS_V2.background.white

  const subtleBorder = options.itemBorders && isMenuItemTile ? SUBTLE_ITEM_BORDER : undefined
  const subtleShadow = options.itemDropShadow && isMenuItemTile ? SUBTLE_ITEM_SHADOW : undefined
  // Featured frame: use outline, not border. With global box-sizing: border-box, a 2px border
  // shrinks the content box ~4px while element x/y/width still assume the full tile — images
  // then drift and cover the frame asymmetrically. Outline does not affect layout.
  const border = options.showTileIds
    ? `1px dashed ${COLOR_TOKENS_V2.border.medium}`
    : isFeaturedItem
      ? 'none'
      : subtleBorder || 'none'
  // Galactic glow should apply to menu item tiles, not headings (prevents a "shadow box" around section headers).
  const galacticGlow =
    palette?.id === 'galactic-menu' && (isMenuItemTile || isFlagshipTile)
      ? `0 0 ${10 * scale}px rgba(87,230,255,0.18), 0 0 ${22 * scale}px rgba(87,230,255,0.10)`
      : undefined
  const boxShadow =
    subtleShadow && galacticGlow
      ? `${subtleShadow}, ${galacticGlow}`
      : subtleShadow || galacticGlow
  const fillColor = options.fillItemTiles && isMenuItemTile
    ? (palette?.colors?.surface ?? palette?.colors?.background ?? COLOR_TOKENS_V2.background.white)
    : undefined
  const backgroundColor = isFlagshipTile || isFeaturedItem ? 'transparent' : fillColor ?? 'transparent'

  // Resolve overlay: only for image tiles in edit mode
  const isImageTile = IMAGE_TILE_TYPES.includes(tile.type as (typeof IMAGE_TILE_TYPES)[number])
  const tileContent = tile.content as (ItemContentV2 | FeatureCardContentV2 | FlagshipCardContentV2) | undefined
  const hasImage = isImageTile && !!tileContent?.imageUrl
  const showOverlay = options.imageEditMode && hasImage && !!options.onImageTransformChange
  const overlayItemId = showOverlay ? tileContent?.itemId : undefined
  const overlayImageElement = showOverlay && renderData
    ? renderData.elements.find((element) => element.type === 'image' && element.width != null && element.height != null)
    : undefined

  let overlayFrame: { left: number; top: number; width: number; height: number; borderRadius?: number } | undefined
  let overlayHighlightFrame: { left: number; top: number; width: number; height: number; borderRadius?: number } | undefined

  if (showOverlay && isFlagshipTile && flagshipContent) {
    const imageMode: ImageModeV2 = options.imageMode || 'stretch'
    const layout = getFlagshipLayoutMetrics(tile, imageMode, flagshipContent.showImage)
    if (layout.isBackgroundMode || imageMode === 'cutout') {
      overlayFrame = {
        left: 0,
        top: 0,
        width: tile.width * scale,
        height: tile.height * scale,
        borderRadius: 12 * scale,
      }
    } else if (layout.mediaFrame) {
      overlayFrame = {
        left: layout.mediaFrame.left * scale,
        top: layout.mediaFrame.top * scale,
        width: layout.mediaFrame.width * scale,
        height: layout.mediaFrame.height * scale,
        borderRadius: layout.mediaFrame.borderRadius === 999
          ? layout.mediaFrame.width * scale / 2
          : layout.mediaFrame.borderRadius * scale,
      }
    }
  } else if (overlayImageElement) {
    if (options.imageMode === 'cutout') {
      overlayFrame = {
        left: 0,
        top: 0,
        width: tile.width * scale,
        height: tile.height * scale,
        borderRadius: 8 * scale,
      }
      overlayHighlightFrame = undefined
    } else {
      overlayFrame = {
        left: overlayImageElement.x * scale,
        top: overlayImageElement.y * scale,
        width: overlayImageElement.width! * scale,
        height: overlayImageElement.height! * scale,
        borderRadius: overlayImageElement.style.borderRadius != null
          ? overlayImageElement.style.borderRadius * scale
          : undefined,
      }
    }
  }

  // Banner image edit overlays (hero + logo)
  const isBannerTile = tile.type === 'BANNER'
  const showBannerOverlays = options.imageEditMode && isBannerTile && !!options.onBannerTransformChange
  const bannerContent = isBannerTile ? (tile.content as import('./engine-types-v2').BannerContentV2) : undefined
  const hasHeroImage = !!(bannerContent?.heroImageUrl || bannerContent?.heroImageCutoutUrl) && bannerContent?.bannerImageStyle !== 'none'
  const hasLogoImage = !!bannerContent?.logoUrl

  // Find hero and logo image elements from render data
  const heroImageElement = showBannerOverlays && hasHeroImage && renderData
    ? renderData.elements.filter(e => e.type === 'image').at(-1) // hero is always last image element
    : undefined
  const logoImageElement = showBannerOverlays && hasLogoImage && renderData
    ? renderData.elements.find(e => e.type === 'image' && e.style.zIndex === 30)
    : undefined

  // For cutout hero images the element is intentionally oversized (1.8× tile height) and
  // positioned with a negative y so the dish floats upward out of the banner. Using the raw
  // element bounds as the overlay frame produces a box that extends far below the banner and
  // off the right edge — confusing for users. Instead, clip the frame to the banner tile's
  // own bounds so the teal edit box stays within the visible banner area.
  const isCutoutHero = heroImageElement?.style.isCutout === true
  const heroOverlayFrame = heroImageElement ? (() => {
    const rawLeft = heroImageElement.x * scale
    const rawTop = heroImageElement.y * scale
    const rawRight = rawLeft + heroImageElement.width! * scale
    const rawBottom = rawTop + heroImageElement.height! * scale
    const tileW = tile.width * scale
    const tileH = tile.height * scale
    if (isCutoutHero) {
      // Clamp to tile bounds — this is the region the user can meaningfully drag within
      const clampedLeft = Math.max(0, Math.min(rawLeft, tileW))
      const clampedTop = Math.max(0, Math.min(rawTop, tileH))
      const clampedRight = Math.max(0, Math.min(rawRight, tileW))
      const clampedBottom = Math.max(0, Math.min(rawBottom, tileH))
      return {
        left: clampedLeft,
        top: clampedTop,
        width: clampedRight - clampedLeft,
        height: clampedBottom - clampedTop,
      }
    }
    return {
      left: rawLeft,
      top: Math.max(0, rawTop),
      width: heroImageElement.width! * scale,
      height: heroImageElement.height! * scale,
    }
  })() : undefined

  const logoOverlayFrame = logoImageElement ? {
    left: logoImageElement.x * scale,
    top: logoImageElement.y * scale,
    width: logoImageElement.width! * scale,
    height: logoImageElement.height! * scale,
  } : undefined
  const isCutoutTile = hasImage && options.imageMode === 'cutout'
  // All menu item tiles share the same z-index so no tile's stacking context sits above another's.
  // Cutout images overflow visually via overflow:visible on the tile, but DOM order (image pushed
  // before text elements) ensures text paints on top within each tile's own stacking context.
  const tileZIndex = tile.layer === 'background' ? 0 : 1

  return (
    <div
      className={`tile-v2 tile-${tile.type.toLowerCase()}${isFeaturedItem ? ' tile-featured' : ''}`}
      style={{
        position: 'absolute',
        left: tile.x * scale,
        top: tile.y * scale,
        width: tile.width * scale,
        height: tile.height * scale,
        zIndex: tileZIndex,
        backgroundColor,
        border,
        ...(boxShadow ? { boxShadow } : {}),
        ...((isCutoutTile || isBannerTile || isFeaturedItem || isFlagshipTile) ? { overflow: 'visible' } : {})
      }}
    >
      {/* Render tile content elements */}
      {isFlagshipTile && flagshipContent ? (
        <FlagshipCard
          tile={tile}
          content={flagshipContent}
          options={options}
          scale={scale}
        />
      ) : (
        renderData?.elements.map((element, index) => (
          <RenderElementComponent
            key={`${tile.id}-element-${index}`}
            element={element}
            scale={scale}
          />
        ))
      )}
      {isFlagshipTile && flagshipContent && !options.showTileIds ? (
        <FlagshipBadge tile={tile} options={options} scale={scale} />
      ) : null}

      {/* "SAMPLE" watermark for placeholder items — ink stamp style */}
      {isMenuItemTile && tileContent && 'isPlaceholder' in tileContent && (tileContent as ItemContentV2).isPlaceholder && hasImage && !options.hideSampleLabels && (
        <SampleStamp tileId={tile.id} tileWidth={tile.width} tileHeight={tile.height} scale={scale} />
      )}

      {/* Image edit mode overlay */}
      {showOverlay && overlayItemId && options.onImageTransformChange && (
        <ImageTransformOverlay
          itemId={overlayItemId}
          imageMode={options.imageMode}
          currentTransform={options.imageTransforms?.get(overlayItemId)}
          onChange={options.onImageTransformChange}
          frame={overlayFrame}
          highlightFrame={overlayHighlightFrame}
        />
      )}

      {/* Banner hero image edit overlay */}
      {showBannerOverlays && hasHeroImage && heroOverlayFrame && options.onBannerTransformChange && (
        <ImageTransformOverlay
          itemId="banner-hero"
          imageMode={bannerContent?.bannerImageStyle === 'cutout' ? 'cutout' : 'stretch'}
          currentTransform={options.bannerHeroTransform ?? bannerContent?.heroTransform}
          onChange={(_, transform) => options.onBannerTransformChange!('hero', transform)}
          frame={heroOverlayFrame}
        />
      )}

      {/* Banner logo image edit overlay */}
      {showBannerOverlays && hasLogoImage && logoOverlayFrame && options.onBannerTransformChange && (
        <ImageTransformOverlay
          itemId="banner-logo"
          imageMode="compact-rect"
          currentTransform={options.bannerLogoTransform ?? bannerContent?.logoTransform}
          onChange={(_, transform) => options.onBannerTransformChange!('logo', transform)}
          frame={logoOverlayFrame}
          zIndex={40}
        />
      )}
      
      {/* Tile ID overlay */}
      {options.showTileIds && (
        <div
          className="tile-id-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            fontSize: 8,
            color: COLOR_TOKENS_V2.text.primary,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '1px 3px',
            borderRadius: 2,
            border: `1px solid ${COLOR_TOKENS_V2.border.light}`,
            zIndex: 10
          }}
        >
          {tile.id}
          <br />
          <span style={{ fontSize: 7, color: COLOR_TOKENS_V2.text.muted }}>
            {tile.gridRow},{tile.gridCol} ({tile.colSpan}×{tile.rowSpan})
          </span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Render Element Component
// ============================================================================

interface RenderElementComponentProps {
  element: RenderElement
  scale: number
}

function RenderElementComponent({ element, scale }: RenderElementComponentProps) {
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: element.x * scale,
    top: element.y * scale,
    width: element.width ? element.width * scale : undefined,
    height: element.height ? element.height * scale : undefined,
    fontSize: element.style.fontSize ? element.style.fontSize * scale : undefined,
    fontWeight: element.style.fontWeight,
    fontFamily: element.style.fontFamily,
    lineHeight: element.style.lineHeight,
    color: element.style.color,
    backgroundColor: element.style.backgroundColor,
    textAlign: (element.style.textAlign as React.CSSProperties['textAlign']) || 'center',
    opacity: element.style.opacity,
    borderRadius: element.style.borderRadius ? element.style.borderRadius * scale : undefined,
    display: element.style.writingMode
      ? 'flex'
      : element.style.maxLines ? '-webkit-box' : (element.style.display as React.CSSProperties['display'] ?? 'flex'),
    WebkitLineClamp: element.style.maxLines,
    WebkitBoxOrient: element.style.maxLines ? 'vertical' : undefined,
    overflow: element.style.maxLines ? 'hidden' : undefined,
    alignItems: element.style.alignItems as React.CSSProperties['alignItems']
      ?? (element.style.maxLines ? undefined : 'center'),
    justifyContent: element.style.justifyContent as React.CSSProperties['justifyContent']
      ?? (element.style.textAlign === 'left' ? 'flex-start'
        : element.style.textAlign === 'right' ? 'flex-end'
        : 'center'),
    boxShadow: element.style.boxShadow,
    textTransform: element.style.textTransform as React.CSSProperties['textTransform'],
    letterSpacing: element.style.letterSpacing ? element.style.letterSpacing * scale : undefined,
    textShadow: element.style.textShadow,
    whiteSpace: element.style.whiteSpace as React.CSSProperties['whiteSpace'],
    writingMode: element.style.writingMode as React.CSSProperties['writingMode'],
    textOrientation: element.style.textOrientation as React.CSSProperties['textOrientation'],
    transform: element.style.writingMode ? element.style.transform : undefined,
    zIndex: element.style.zIndex,
    pointerEvents: 'none'
  }

  switch (element.type) {
    case 'text':
      return (
        <div style={baseStyle}>
          {element.content}
        </div>
      )
    
    case 'image':
      const borderRadius = element.style.borderRadius ? element.style.borderRadius * scale : undefined
      // Check if this is a circular image: borderRadius should be approximately half the width
      // Account for scaling and allow small floating point differences
      const imageWidth = typeof baseStyle.width === 'number' ? baseStyle.width : parseFloat(String(baseStyle.width || 0))
      const imageHeight = typeof baseStyle.height === 'number' ? baseStyle.height : parseFloat(String(baseStyle.height || 0))
      const isCircular = borderRadius && borderRadius > 0 && imageWidth > 0 && imageHeight > 0 &&
        Math.abs(borderRadius - imageWidth / 2) < 2 && Math.abs(imageWidth - imageHeight) < 2
      const isCutoutImage = element.style.isCutout === true
      const hasTransform = !!element.style.transform
      const imgOverflow = isCutoutImage ? 'visible' : (isCircular || hasTransform) ? 'hidden' : 'visible'
      return (
        <div
          style={{
            ...baseStyle,
            borderRadius,
            overflow: imgOverflow,
            zIndex: element.style.zIndex,
          }}
        >
          <img
            src={element.content}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: element.style.objectFit || 'cover',
              objectPosition: element.style.objectPosition || 'center',
              background: isCutoutImage ? 'transparent' : undefined,
              transform: element.style.transform,
              transformOrigin: element.style.transformOrigin,
            }}
          />
        </div>
      )
    
    case 'indicator':
      return (
        <div 
          style={{
            ...baseStyle,
            fontSize: element.style.fontSize ? element.style.fontSize * scale : 12 * scale,
            lineHeight: 1
          }}
        >
          {element.content}
        </div>
      )
    
    case 'background': {
      const bgStyle: React.CSSProperties = {
        ...baseStyle,
        background: element.style.background || element.style.backgroundColor || undefined
      }
      if (
        element.style.backgroundPositionX != null &&
        element.style.backgroundPositionY != null
      ) {
        bgStyle.backgroundPosition = `${element.style.backgroundPositionX * scale}px ${element.style.backgroundPositionY * scale}px`
      }
      return <div style={bgStyle} />
    }
    
    default:
      return null
  }
}

// ============================================================================
// Overlay Components
// ============================================================================

interface RegionBoundsOverlayProps {
  regions: RegionV2[]
  pageSpec: PageSpecV2
  scale: number
}

function RegionBoundsOverlay({ regions, pageSpec, scale }: RegionBoundsOverlayProps) {
  return (
    <div className="region-bounds-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Content box outline */}
      <div
        style={{
          position: 'absolute',
          left: pageSpec.margins.left * scale,
          top: pageSpec.margins.top * scale,
          width: (pageSpec.width - pageSpec.margins.left - pageSpec.margins.right) * scale,
          height: (pageSpec.height - pageSpec.margins.top - pageSpec.margins.bottom) * scale,
          border: `2px solid ${COLOR_TOKENS_V2.indicator.kosher}`,
          borderRadius: 2
        }}
      />
      
      {/* Region outlines */}
      {regions.map(region => (
        <div
          key={`region-bounds-${region.id}`}
          style={{
            position: 'absolute',
            left: (pageSpec.margins.left + region.x) * scale,
            top: (pageSpec.margins.top + region.y) * scale,
            width: region.width * scale,
            height: region.height * scale,
            border: `1px dashed ${COLOR_TOKENS_V2.indicator.vegetarian}`,
            backgroundColor: `${COLOR_TOKENS_V2.indicator.vegetarian}20`
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: 4,
              fontSize: 10,
              color: COLOR_TOKENS_V2.indicator.vegetarian,
              fontWeight: 600,
              textShadow: '0 0 2px white'
            }}
          >
            {region.id}
          </div>
        </div>
      ))}
    </div>
  )
}

interface GridOverlayProps {
  page: PageLayoutV2
  pageSpec: PageSpecV2
  scale: number
}

function GridOverlay({ page, pageSpec, scale }: GridOverlayProps) {
  const bodyRegion = page.regions.find(r => r.id === 'body')
  if (!bodyRegion) return null

  // This would need template info to draw grid - simplified for now
  const gridLines: React.ReactElement[] = []
  
  // Vertical lines (columns) - placeholder
  for (let i = 0; i <= 4; i++) {
    const x = (bodyRegion.width / 4) * i
    gridLines.push(
      <div
        key={`grid-col-${i}`}
        style={{
          position: 'absolute',
          left: (pageSpec.margins.left + bodyRegion.x + x) * scale,
          top: (pageSpec.margins.top + bodyRegion.y) * scale,
          width: 1,
          height: bodyRegion.height * scale,
          backgroundColor: COLOR_TOKENS_V2.indicator.spice,
          opacity: 0.3
        }}
      />
    )
  }
  
  // Horizontal lines (rows) - placeholder
  const rowHeight = 70 // From template
  const gapY = 8
  const totalRowHeight = rowHeight + gapY
  const maxRows = Math.floor(bodyRegion.height / totalRowHeight)
  
  for (let i = 0; i <= maxRows; i++) {
    const y = totalRowHeight * i
    if (y <= bodyRegion.height) {
      gridLines.push(
        <div
          key={`grid-row-${i}`}
          style={{
            position: 'absolute',
            left: (pageSpec.margins.left + bodyRegion.x) * scale,
            top: (pageSpec.margins.top + bodyRegion.y + y) * scale,
            width: bodyRegion.width * scale,
            height: 1,
            backgroundColor: COLOR_TOKENS_V2.indicator.spice,
            opacity: 0.3
          }}
        />
      )
    }
  }

  return (
    <div className="grid-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {gridLines}
    </div>
  )
}

// ============================================================================
// Debug Info Panel
// ============================================================================

interface DebugInfoPanelProps {
  document: LayoutDocumentV2
}

function DebugInfoPanel({ document }: DebugInfoPanelProps) {
  return (
    <div 
      className="debug-info-panel"
      style={{
        marginTop: 20,
        padding: 16,
        backgroundColor: COLOR_TOKENS_V2.background.gray50,
        border: `1px solid ${COLOR_TOKENS_V2.border.light}`,
        borderRadius: 4,
        fontSize: 12,
        fontFamily: 'monospace'
      }}
    >
      <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Debug Information</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div>
          <strong>Template:</strong> {document.templateId} v{document.templateVersion}
        </div>
        <div>
          <strong>Pages:</strong> {document.pages.length}
        </div>
        <div>
          <strong>Page Size:</strong> {document.pageSpec.width}×{document.pageSpec.height}pt
        </div>
        <div>
          <strong>Margins:</strong> {document.pageSpec.margins.top}pt/{document.pageSpec.margins.right}pt/{document.pageSpec.margins.bottom}pt/{document.pageSpec.margins.left}pt
        </div>
      </div>
      
      {document.debug && (
        <div style={{ marginTop: 12 }}>
          <strong>Generated:</strong> {document.debug.generatedAt}
          <br />
          <strong>Engine:</strong> {document.debug.engineVersion}
          <br />
          <strong>Input Hash:</strong> {document.debug.inputHash}
        </div>
      )}
      
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Tile Summary</summary>
        <div style={{ marginTop: 8 }}>
          {document.pages.map((page, pageIndex) => (
            <div key={pageIndex} style={{ marginBottom: 8 }}>
              <strong>Page {pageIndex + 1} ({page.pageType}):</strong> {page.tiles.length} tiles
              <ul style={{ margin: '4px 0 0 20px', fontSize: 11 }}>
                {page.tiles.map(tile => (
                  <li key={tile.id}>
                    {tile.type} in {tile.regionId} ({tile.x},{tile.y} {tile.width}×{tile.height})
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}

// ============================================================================
// Export Default Component
// ============================================================================

export interface LayoutPreviewV2Props {
  document: LayoutDocumentV2
  options?: Partial<RenderOptionsV2>
}

/**
 * Main Layout Preview component for use in Layout Lab
 */
export default function LayoutPreviewV2({ document, options = {} }: LayoutPreviewV2Props) {
  const renderOptions: RenderOptionsV2 = {
    scale: getDefaultScale(),
    showGridOverlay: false,
    showRegionBounds: false,
    showTileIds: false,
    showDebugInfo: false,
    ...options
  }

  return renderToWeb(document, renderOptions)
}