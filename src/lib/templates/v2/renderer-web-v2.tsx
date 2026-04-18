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
  PageSpecV2 
} from './engine-types-v2'
import type { ItemContentV2, FeatureCardContentV2 } from './engine-types-v2'
import { 
  renderTileContent, 
  calculateAbsolutePosition,
  getDefaultScale,
  TYPOGRAPHY_TOKENS_V2,
  COLOR_TOKENS_V2,
  getFontSet,
  FONT_SETS_V2,
  TEXTURE_REGISTRY,
  PALETTE_TEXTURE_MAP,
  getFontStylePresetGoogleFontsUrl,
  blendHexTowards,
  type RenderOptionsV2,
  type RenderElement 
} from './renderer-v2'
import { ImageTransformOverlay } from '@/components/ImageTransformOverlay'

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
    if (textureConfig) {
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
  const bannerRegion = page.regions.find(r => r.id === 'banner')
  const footerRegion = page.regions.find(r => r.id === 'footer')
  const innerRegions = page.regions.filter(r => r.id !== 'banner' && r.id !== 'footer')

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
      {/* Background layer (color + texture) - explicitly behind content so borders/shadows read clearly */}
      <div
        className="page-background-v2"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          ...backgroundStyle
        }}
      />

      {/* Full-bleed banner — flush to top and side edges */}
      {bannerRegion && (
        <FullBleedRegionRenderer
          region={bannerRegion}
          tiles={page.tiles.filter(t => t.regionId === 'banner')}
          pageSpec={pageSpec}
          options={options}
          edge="top"
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
          tiles={page.tiles.filter(t => t.regionId === 'footer')}
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
}

/**
 * Renders a region flush to the page edges (no margin inset).
 * Used for banner (top) and footer (bottom) so they span the full page width.
 * Tiles are re-rendered with width = pageSpec.width so internal layout fills the full bleed area.
 */
function FullBleedRegionRenderer({ region, tiles, pageSpec, options, edge }: FullBleedRegionRendererProps) {
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

  const top = edge === 'top' ? 0 : (pageSpec.height - renderHeight) * scale

  return (
    <div
      className={`region-v2 region-${region.id} region-fullbleed`}
      style={{
        position: 'absolute',
        left: 0,
        top,
        width: fullWidth * scale,
        height: renderHeight * scale,
        zIndex: 2,
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

const MENU_ITEM_TILE_TYPES = ['ITEM_CARD', 'ITEM_TEXT_ROW', 'FEATURE_CARD'] as const
const SUBTLE_ITEM_BORDER = '1px solid rgba(0,0,0,0.06)'
const SUBTLE_ITEM_SHADOW = '0 1px 3px rgba(0,0,0,0.08)'

const IMAGE_TILE_TYPES = ['ITEM_CARD', 'FEATURE_CARD'] as const

function TileRenderer({ tile, options }: TileRendererProps) {
  const { scale, palette } = options
  const renderData = renderTileContent(tile, options)
  const isMenuItemTile = MENU_ITEM_TILE_TYPES.includes(tile.type as (typeof MENU_ITEM_TILE_TYPES)[number])
  const itemMenuContent = isMenuItemTile ? (tile.content as ItemContentV2 | FeatureCardContentV2) : undefined
  const isFeaturedItem =
    isMenuItemTile &&
    tile.type !== 'FEATURE_CARD' &&
    !!(itemMenuContent && 'isFeatured' in itemMenuContent && (itemMenuContent as ItemContentV2).isFeatured)

  const accent =
    palette?.colors?.accent ??
    palette?.colors?.itemPrice ??
    COLOR_TOKENS_V2.text.primary
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
  const boxShadow = subtleShadow
  const fillColor = options.fillItemTiles && isMenuItemTile
    ? (palette?.colors?.surface ?? palette?.colors?.background ?? COLOR_TOKENS_V2.background.white)
    : undefined
  const featuredBg = isFeaturedItem ? blendHexTowards(defaultPaper, accent, 0.09) : undefined
  const backgroundColor = featuredBg ?? fillColor ?? 'transparent'

  // Resolve overlay: only for image tiles in edit mode
  const isImageTile = IMAGE_TILE_TYPES.includes(tile.type as (typeof IMAGE_TILE_TYPES)[number])
  const tileContent = tile.content as (ItemContentV2 | FeatureCardContentV2) | undefined
  const hasImage = isImageTile && !!(tileContent as ItemContentV2 | FeatureCardContentV2)?.imageUrl
  const showOverlay = options.imageEditMode && hasImage && !!options.onImageTransformChange
  const overlayItemId = showOverlay ? (tileContent as ItemContentV2 | FeatureCardContentV2).itemId : undefined
  const overlayImageElement = showOverlay
    ? renderData.elements.find((element) => element.type === 'image' && element.width != null && element.height != null)
    : undefined

  let overlayFrame: { left: number; top: number; width: number; height: number; borderRadius?: number } | undefined
  let overlayHighlightFrame: { left: number; top: number; width: number; height: number; borderRadius?: number } | undefined

  if (overlayImageElement) {
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
  const heroImageElement = showBannerOverlays && hasHeroImage
    ? renderData.elements.filter(e => e.type === 'image').at(-1) // hero is always last image element
    : undefined
  const logoImageElement = showBannerOverlays && hasLogoImage
    ? renderData.elements.find(e => e.type === 'image' && e.style.zIndex === 4)
    : undefined

  const heroOverlayFrame = heroImageElement ? {
    left: heroImageElement.x * scale,
    top: Math.max(0, heroImageElement.y * scale),
    width: heroImageElement.width! * scale,
    height: heroImageElement.height! * scale,
  } : undefined

  const logoOverlayFrame = logoImageElement ? {
    left: logoImageElement.x * scale,
    top: logoImageElement.y * scale,
    width: logoImageElement.width! * scale,
    height: logoImageElement.height! * scale,
  } : undefined
  const isCutoutTile = hasImage && options.imageMode === 'cutout'
  const tileZIndex = tile.layer === 'background' ? 0 : isCutoutTile ? 5 : 1

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
        ...(isFeaturedItem && !options.showTileIds
          ? { outline: `2px solid ${accent}`, outlineOffset: 0 }
          : {}),
        ...(boxShadow ? { boxShadow } : {}),
        ...((isCutoutTile || isBannerTile || isFeaturedItem) ? { overflow: 'visible' } : {})
      }}
    >
      {/* Render tile content elements */}
      {renderData.elements.map((element, index) => (
        <RenderElementComponent
          key={`${tile.id}-element-${index}`}
          element={element}
          scale={scale}
        />
      ))}

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
      const isCutoutImage = element.style.zIndex != null
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