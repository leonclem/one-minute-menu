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

import React from 'react'
import type { 
  LayoutDocumentV2, 
  PageLayoutV2, 
  TileInstanceV2, 
  RegionV2,
  PageSpecV2 
} from './engine-types-v2'
import { 
  renderTileContent, 
  calculateAbsolutePosition,
  getDefaultScale,
  TYPOGRAPHY_TOKENS_V2,
  COLOR_TOKENS_V2,
  type RenderOptionsV2,
  type RenderElement 
} from './renderer-v2'

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
      
      {options.showDebugInfo && (
        <DebugInfoPanel document={document} />
      )}
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
  const bgColor = palette?.colors.background || COLOR_TOKENS_V2.background.white
  const mutedTextColor = palette?.colors.textMuted || COLOR_TOKENS_V2.text.muted
  const borderColor = palette?.colors.border.light || COLOR_TOKENS_V2.border.light
  
  // Apply textured background if enabled and palette supports it
  let backgroundStyle: React.CSSProperties = {
    backgroundColor: bgColor
  }
  
  if (texturesEnabled && palette?.id === 'midnight-gold') {
    backgroundStyle = {
      backgroundColor: '#1A1A1A',
      backgroundImage: `
        linear-gradient(135deg, rgba(212, 175, 55, 0.03) 0%, transparent 50%, rgba(212, 175, 55, 0.02) 100%),
        url('/textures/dark-paper-2.png')
      `,
      backgroundSize: '100% 100%, cover',
      backgroundRepeat: 'no-repeat, no-repeat',
      backgroundPosition: 'center, center',
      backgroundBlendMode: 'overlay, normal'
    }
  } else if (texturesEnabled && palette?.id === 'elegant-dark') {
    backgroundStyle = {
      backgroundColor: '#0b0d11',
      backgroundImage: `url('/textures/dark-paper.png')`,
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center'
    }
  }
  
  return (
    <div 
      className="page-container-v2"
      style={{
        width: pageSpec.width * scale,
        height: pageSpec.height * scale,
        position: 'relative',
        ...backgroundStyle,
        marginBottom: isExport ? 0 : 20 * scale,
        boxShadow: isExport ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        borderRadius: isExport ? 0 : 4,
        overflow: 'hidden'
      }}
    >
      {/* Content box wrapper - applies margins ONCE */}
      <div
        className="content-box-v2"
        style={{
          position: 'absolute',
          left: pageSpec.margins.left * scale,
          top: pageSpec.margins.top * scale,
          width: (pageSpec.width - pageSpec.margins.left - pageSpec.margins.right) * scale,
          height: (pageSpec.height - pageSpec.margins.top - pageSpec.margins.bottom) * scale
        }}
      >
        {/* Regions */}
        {page.regions.map(region => (
          <RegionRenderer
            key={region.id}
            region={region}
            tiles={page.tiles.filter(t => t.regionId === region.id)}
            options={options}
          />
        ))}
      </div>
      
      {/* Page overlays */}
      {options.showRegionBounds && (
        <RegionBoundsOverlay regions={page.regions} pageSpec={pageSpec} scale={scale} />
      )}
      
      {options.showGridOverlay && (
        <GridOverlay page={page} pageSpec={pageSpec} scale={scale} />
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
            border: `1px solid ${borderColor}`
          }}
        >
          Page {page.pageIndex + 1} ({page.pageType})
        </div>
      )}
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

function TileRenderer({ tile, options }: TileRendererProps) {
  const { scale } = options
  const renderData = renderTileContent(tile, options)
  
  return (
    <div
      className={`tile-v2 tile-${tile.type.toLowerCase()}`}
      style={{
        position: 'absolute',
        left: tile.x * scale,
        top: tile.y * scale,
        width: tile.width * scale,
        height: tile.height * scale,
        zIndex: tile.layer === 'background' ? 0 : 1,
        border: options.showTileIds ? `1px dashed ${COLOR_TOKENS_V2.border.medium}` : 'none'
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
    lineHeight: element.style.lineHeight,
    color: element.style.color,
    backgroundColor: element.style.backgroundColor,
    textAlign: element.style.textAlign,
    opacity: element.style.opacity,
    borderRadius: element.style.borderRadius ? element.style.borderRadius * scale : undefined,
    display: element.style.maxLines && element.style.maxLines > 1 ? '-webkit-box' : 'flex',
    WebkitLineClamp: element.style.maxLines,
    WebkitBoxOrient: element.style.maxLines && element.style.maxLines > 1 ? 'vertical' : undefined,
    overflow: element.style.maxLines ? 'hidden' : undefined,
    alignItems: element.style.maxLines ? 'flex-start' : 'center',
    justifyContent: element.style.textAlign === 'center' ? 'center' : 
                   element.style.textAlign === 'right' ? 'flex-end' : 'flex-start'
  }

  switch (element.type) {
    case 'text':
      return (
        <div style={baseStyle}>
          {element.content}
        </div>
      )
    
    case 'image':
      return (
        <img
          src={element.content}
          alt=""
          style={{
            ...baseStyle,
            objectFit: element.style.objectFit || 'cover',
            objectPosition: element.style.objectPosition || 'center',
            borderRadius: element.style.borderRadius ? element.style.borderRadius * scale : undefined
          }}
        />
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
    
    case 'background':
      return (
        <div style={baseStyle} />
      )
    
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