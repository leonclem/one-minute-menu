/**
 * Layout Renderer for Template Engine
 * 
 * Server-side component that renders a LayoutInstance to HTML.
 * This component is used for PDF and HTML export.
 */

import React from 'react'
import type {
  LayoutInstance,
  PageLayout,
  TileContentInstance,
  StaticTileInstance,
  SectionHeaderTileInstance,
  MenuItemTileInstance,
  SpacerTileInstance,
  MenuTemplate,
  TemplateColorPalette,
  TemplateStyle
} from '../engine-types'
import { PAGE_SIZES } from '../engine-config'
import { generateStaticTemplateCSS, getActivePalette } from '../style-generator'

// ============================================================================
// Component Props
// ============================================================================

export interface LayoutRendererProps {
  layout: LayoutInstance
  /** The template definition with styles */
  template?: MenuTemplate
  /** Optional override color palette ID */
  paletteId?: string
  currency?: string
  className?: string
  /** Skip inline styles (for PDF/export where styles are in <head>) */
  skipInlineStyles?: boolean
  /** Legacy themeColors support - used if template not provided */
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
  /** Component to use for rendering images (defaults to 'img') */
  ImageComponent?: React.ComponentType<any> | string
  /** Whether to force fixed page dimensions (e.g. A4) or allow fluid width. Defaults to true (for PDF). */
  fixedPageSize?: boolean
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatPrice(price: number, currency: string = '$'): string {
  return `${currency}${price.toFixed(2)}`
}

function getTileStyles(tile: TileContentInstance): React.CSSProperties {
  return {
    gridColumn: `${tile.col + 1} / span ${tile.colSpan}`,
    gridRow: `${tile.row + 1} / span ${tile.rowSpan}`
  }
}

// ============================================================================
// Tile Rendering Components
// ============================================================================

function StaticTile({ tile }: { tile: StaticTileInstance }) {
  const styles = getTileStyles(tile)
  const align = tile.options?.align || 'left'
  
  if (tile.type === 'TITLE') {
    return (
      <div style={styles} className={`tile tile-title text-${align}`}>
        <h1 className="text-4xl font-bold">{tile.content}</h1>
      </div>
    )
  }
  
  if (tile.type === 'LOGO') {
    return (
      <div style={styles} className={`tile tile-logo text-${align}`}>
        <div className="logo-placeholder">
          {tile.content || 'Logo'}
        </div>
      </div>
    )
  }
  
  if (tile.type === 'TEXT_BLOCK') {
    return (
      <div style={styles} className={`tile tile-text-block text-${align}`}>
        <p className="text-sm text-gray-600">{tile.content}</p>
      </div>
    )
  }
  
  if (tile.type === 'IMAGE_DECORATION') {
    return (
      <div style={styles} className="tile tile-decoration">
        <div className="decoration-placeholder bg-gray-100" />
      </div>
    )
  }
  
  if (tile.type === 'QR_CODE') {
    return (
      <div style={styles} className={`tile tile-qr text-${align}`}>
        <div className="qr-placeholder">
          {tile.content || 'QR Code'}
        </div>
      </div>
    )
  }
  
  return null
}

function SectionHeaderTile({ tile }: { tile: SectionHeaderTileInstance }) {
  const styles = getTileStyles(tile)
  const align = tile.options?.align || 'left'
  
  return (
    <div style={styles} className={`tile tile-section-header text-${align}`}>
      <h2 className="text-2xl font-semibold text-gray-800">{tile.label}</h2>
    </div>
  )
}

/**
 * Generate a fallback placeholder for items without images
 * Matches the size and style of real images for consistent layout
 */
function ItemImagePlaceholder({ 
  accentColor, 
  isCircle = false 
}: { 
  accentColor: string
  isCircle?: boolean 
}) {
  const size = isCircle ? '75px' : '150px'
  return (
    <div 
      className="menu-item-image-fallback"
      style={{
        width: isCircle ? '75px' : '100%',
        height: size,
        borderRadius: isCircle ? '50%' : '8px',
        border: isCircle ? `2px solid ${accentColor}` : `2px solid ${accentColor}20`,
        backgroundColor: `${accentColor}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.9,
        flexShrink: 0,
        boxShadow: isCircle ? '0 2px 6px rgba(0, 0, 0, 0.25)' : 'none'
      }}
    >
      {/* Subtle GridMenu logo as inline SVG (uses existing logo geometry, scaled and centered) */}
      <svg
        viewBox="0 0 1727 1723"
        aria-hidden="true"
        focusable="false"
        style={{
          width: isCircle ? '46px' : '80px',
          height: isCircle ? '46px' : '80px',
          opacity: 0.18
        }}
      >
        <defs>
          <clipPath id="gridMenuLogoClip">
            <rect x="1052" y="328" width="1727" height="1723" />
          </clipPath>
        </defs>
        <g clipPath="url(#gridMenuLogoClip)" transform="translate(-1052 -328)">
          {/* Monochrome (white) version of the GridMenu logo for subtle placeholders */}
          <rect x="1054" y="328" width="738" height="739" fill="#FFFFFF" />
          <rect x="1054" y="1312" width="738" height="739" fill="#FFFFFF" />
          <rect x="2041" y="1312" width="738" height="739" fill="#FFFFFF" />
          <rect x="2039" y="328" width="738" height="739" fill="#FFFFFF" />
          <rect x="1795" y="1067" width="245" height="245" fill="#FFFFFF" />
          <rect x="1054" y="1312" width="738" height="739" fill="#FFFFFF" />
          <rect x="2041" y="1312" width="738" height="739" fill="#FFFFFF" />
          <rect x="2039" y="328" width="738" height="739" fill="#FFFFFF" />
          <rect x="1052" y="328" width="248" height="739" fill="#FFFFFF" />
          <rect x="1299" y="822" width="246" height="490" fill="#FFFFFF" />
          <rect x="1544" y="328" width="248" height="739" fill="#FFFFFF" />
          <rect x="1299" y="1312" width="246" height="739" fill="#FFFFFF" />
          <rect x="2039" y="328" width="247" height="739" fill="#FFFFFF" />
          <rect x="2286" y="328" width="246" height="984" fill="#FFFFFF" />
          <rect x="2288" y="1312" width="246" height="739" fill="#FFFFFF" />
        </g>
      </svg>
    </div>
  )
}

function MenuItemTile({ 
  tile, 
  currency,
  ImageComponent = 'img'
}: { 
  tile: MenuItemTileInstance
  currency: string 
  ImageComponent?: React.ComponentType<any> | string
}) {
  const styles = getTileStyles(tile)
  // Template supports images for this tile (based on layout engine flags)
  const templateSupportsImage = !!tile.showImage
  // Tile actually has an image URL available
  const hasImage = !!tile.imageUrl
  const showDescription = tile.options?.showDescription !== false && tile.description
  const emphasisePrice = tile.options?.emphasisePrice
  
  const Img = ImageComponent as any

  return (
    <div style={styles} className="tile tile-menu-item">
      <div className="menu-item-card">
        {templateSupportsImage && hasImage && (
          <div className="menu-item-image">
            <Img
              src={tile.imageUrl} 
              alt={tile.name}
              className="item-image"
              width={300}
              height={150}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          </div>
        )}
        {templateSupportsImage && !hasImage && (
          <div className="menu-item-image">
            <ItemImagePlaceholder accentColor="#c9a227" />
          </div>
        )}
        <div className="menu-item-content">
          {tile.type === 'ITEM_TEXT_ONLY' ? (
            <>
              <div>
                <h3 className="item-name">{tile.name}</h3>
                <span className="item-price">
                  {formatPrice(tile.price, currency)}
                </span>
              </div>
              {showDescription && (
                <p className="menu-item-description">{tile.description}</p>
              )}
            </>
          ) : (
            <>
              <h3 className="item-name">{tile.name}</h3>
              <span className="item-price">
                  {formatPrice(tile.price, currency)}
              </span>
              {showDescription && (
                <p className="menu-item-description">{tile.description}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SpacerTile({ tile }: { tile: SpacerTileInstance }) {
  const styles = getTileStyles(tile)
  const backgroundColor = tile.backgroundColor || '#F3F4F6'
  
  return (
    <div 
      style={{ ...styles, backgroundColor }} 
      className="tile tile-spacer"
      aria-hidden="true"
    />
  )
}

// ============================================================================
// Tile Router Component
// ============================================================================

function TileRenderer({ 
  tile, 
  currency,
  ImageComponent
}: { 
  tile: TileContentInstance
  currency: string 
  ImageComponent?: React.ComponentType<any> | string
}) {
  if (tile.type === 'SECTION_HEADER') {
    return <SectionHeaderTile tile={tile as SectionHeaderTileInstance} />
  }
  
  if (tile.type === 'ITEM' || tile.type === 'ITEM_TEXT_ONLY') {
    return <MenuItemTile tile={tile as MenuItemTileInstance} currency={currency} ImageComponent={ImageComponent} />
  }
  
  if (tile.type === 'SPACER') {
    return <SpacerTile tile={tile as SpacerTileInstance} />
  }
  
  // Static tiles: TITLE, LOGO, TEXT_BLOCK, IMAGE_DECORATION, QR_CODE
  return <StaticTile tile={tile as StaticTileInstance} />
}

// ============================================================================
// Page Component
// ============================================================================

function PageRenderer({ 
  page, 
  layout,
  currency,
  ImageComponent,
  fixedPageSize = true
}: { 
  page: PageLayout
  layout: LayoutInstance
  currency: string 
  ImageComponent?: React.ComponentType<any> | string
  fixedPageSize?: boolean
}) {
  // Calculate grid dimensions
  const maxCol = Math.max(...page.tiles.map(t => t.col + t.colSpan))
  const maxRow = Math.max(...page.tiles.map(t => t.row + t.rowSpan))
  
  const gridTemplateColumns = `repeat(${maxCol}, minmax(0, 1fr))`
  const gridTemplateRows = `repeat(${maxRow}, auto)`
  
  // Get page size
  const pageSize = PAGE_SIZES[layout.orientation]
  
  return (
    <div 
      className="page"
      style={{
        width: fixedPageSize ? pageSize.width : '100%',
        height: fixedPageSize ? pageSize.height : 'auto',
        minHeight: fixedPageSize ? undefined : pageSize.height, // Ensure minimal height matches page size in fluid mode
        padding: '20mm',
        pageBreakAfter: 'always',
        position: 'relative',
        zIndex: 1,
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="grid gap-4"
        style={{
          display: 'grid',
          gridTemplateColumns,
          gridTemplateRows,
          gap: '12px',
          columnGap: '24px'
        }}
      >
        {page.tiles.map((tile, index) => (
          <TileRenderer 
            key={`${tile.id}-${index}`} 
            tile={tile} 
            currency={currency} 
            ImageComponent={ImageComponent}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Main Layout Renderer Component
// ============================================================================

export function LayoutRenderer({
  layout,
  template,
  paletteId,
  currency = '$',
  className = '',
  skipInlineStyles = false,
  themeColors,
  ImageComponent = 'img',
  fixedPageSize = true
}: LayoutRendererProps) {
  // Generate CSS for inline styles if needed (Client/Preview usage)
  // For PDF export, skipInlineStyles is true, and styles are injected into <head> separately
  let styles = ''
  if (!skipInlineStyles) {
    styles = generateStaticTemplateCSS(template, paletteId)
  }
  
  return (
    <div className={`layout-renderer ${className}`}>
      {!skipInlineStyles && <style dangerouslySetInnerHTML={{ __html: styles }} />}
      {layout.pages.map((page, index) => (
        <PageRenderer 
          key={`page-${index}`} 
          page={page} 
          layout={layout}
          currency={currency} 
          ImageComponent={ImageComponent}
          fixedPageSize={fixedPageSize}
        />
      ))}
    </div>
  )
}

/**
 * Server-side wrapper for LayoutRenderer
 * This is used for server-side rendering in export endpoints
 */
export function ServerLayoutRenderer(props: LayoutRendererProps) {
  return <LayoutRenderer {...props} />
}

// Re-export generateTemplateCSS removed to avoid client-side bundling issues with server dependencies
// Import from server-style-generator.ts directly in server-side code

