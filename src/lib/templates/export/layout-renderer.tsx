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
  /** Legacy themeColors support - used if template not provided */
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
}

// ============================================================================
// Style Helpers
// ============================================================================

/**
 * Get the active color palette based on paletteId or use default
 */
function getActivePalette(style: TemplateStyle, paletteId?: string): TemplateColorPalette {
  if (!paletteId) return style.colors
  const alternate = style.alternatePalettes?.find(p => p.id === paletteId)
  return alternate || style.colors
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
 */
function ItemImagePlaceholder({ accentColor }: { accentColor: string }) {
  return (
    <div 
      className="menu-item-image-fallback"
      style={{
        width: '100%',
        height: '150px',
        backgroundColor: `${accentColor}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2.5rem',
        opacity: 0.6
      }}
    >
      🍽️
    </div>
  )
}

function MenuItemTile({ 
  tile, 
  currency 
}: { 
  tile: MenuItemTileInstance
  currency: string 
}) {
  const styles = getTileStyles(tile)
  // Template supports images for this tile
  const templateSupportsImage = tile.showImage
  // Tile actually has an image
  const hasImage = !!tile.imageUrl
  const showDescription = tile.options?.showDescription !== false && tile.description
  const emphasisePrice = tile.options?.emphasisePrice
  
  return (
    <div style={styles} className="tile tile-menu-item">
      <div className="menu-item-card">
        {templateSupportsImage && hasImage && (
          <div className="menu-item-image">
            <img 
              src={tile.imageUrl} 
              alt={tile.name}
              className="w-full h-48 object-cover rounded-t-lg"
            />
          </div>
        )}
        {templateSupportsImage && !hasImage && (
          <ItemImagePlaceholder accentColor="#c9a227" />
        )}
        <div className="menu-item-content p-4">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-medium text-gray-900">{tile.name}</h3>
            <span className={`text-lg ${emphasisePrice ? 'font-bold text-green-600' : 'text-gray-700'}`}>
              {formatPrice(tile.price, currency)}
            </span>
          </div>
          {showDescription && (
            <p className="mt-2 text-sm text-gray-600">{tile.description}</p>
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
  currency 
}: { 
  tile: TileContentInstance
  currency: string 
}) {
  if (tile.type === 'SECTION_HEADER') {
    return <SectionHeaderTile tile={tile as SectionHeaderTileInstance} />
  }
  
  if (tile.type === 'ITEM' || tile.type === 'ITEM_TEXT_ONLY') {
    return <MenuItemTile tile={tile as MenuItemTileInstance} currency={currency} />
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
  currency 
}: { 
  page: PageLayout
  layout: LayoutInstance
  currency: string 
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
        width: pageSize.width,
        height: pageSize.height,
        padding: '20mm',
        pageBreakAfter: 'always'
      }}
    >
      <div 
        className="grid gap-4"
        style={{
          display: 'grid',
          gridTemplateColumns,
          gridTemplateRows,
          gap: '1rem'
        }}
      >
        {page.tiles.map((tile, index) => (
          <TileRenderer 
            key={`${tile.id}-${index}`} 
            tile={tile} 
            currency={currency} 
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
  themeColors
}: LayoutRendererProps) {
  // Get template styles if available
  const templateStyle = template?.style
  const palette = templateStyle ? getActivePalette(templateStyle, paletteId) : null
  
  // Generate CSS as a string for server-side rendering
  // Note: @import must be at the very top for fonts to load correctly
  const styles = templateStyle && palette ? `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@400;700&family=Cormorant+Garamond:wght@400;600;700&family=Source+Sans+Pro:wght@400;600;700&family=Inter:wght@400;600;700&display=swap');
    
    * {
      box-sizing: border-box;
    }
    
    html, body {
      margin: 0;
      padding: 0;
      background: ${templateStyle.pageBackground || palette.background};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    
    .layout-renderer {
      font-family: ${templateStyle.fonts.body};
      background: ${templateStyle.pageBackground || palette.background};
      color: ${palette.text};
      min-height: 100vh;
      width: 100%;
    }
    
    .tile {
      border-radius: ${templateStyle.itemCard.borderRadius};
      overflow: hidden;
      box-sizing: border-box;
    }
    
    .tile-menu-item {
      background: ${palette.cardBackground};
      border-radius: ${templateStyle.itemCard.borderRadius};
      box-shadow: ${templateStyle.itemCard.shadow};
      overflow: hidden;
    }
    
    .menu-item-card {
      background: ${palette.cardBackground};
      border-radius: ${templateStyle.itemCard.borderRadius};
      overflow: hidden;
      height: 100%;
    }
    
    .menu-item-image {
      ${templateStyle.itemCard.imagePosition === 'circle' ? `
        display: flex;
        justify-content: center;
        padding: 1rem;
      ` : ''}
    }
    
    .menu-item-image img {
      ${templateStyle.itemCard.imagePosition === 'circle' ? `
        width: 120px;
        height: 120px;
        border-radius: 50%;
        border: 3px solid ${palette.accent};
        object-fit: cover;
      ` : `
        width: 100%;
        height: 150px;
        object-fit: cover;
        border-radius: ${templateStyle.itemCard.imageBorderRadius || '0'};
      `}
    }
    
    .menu-item-content {
      padding: 1rem;
    }
    
    .menu-item-name {
      font-family: ${templateStyle.fonts.body};
      font-size: 1rem;
      font-weight: 600;
      color: ${palette.text};
    }
    
    .menu-item-price {
      font-family: ${templateStyle.fonts.body};
      font-size: 1rem;
      font-weight: 700;
      color: ${palette.price};
    }
    
    .menu-item-description {
      font-family: ${templateStyle.fonts.body};
      font-size: 0.875rem;
      color: ${palette.text};
      opacity: 0.7;
      margin-top: 0.5rem;
      line-height: 1.4;
    }
    
    .tile-title {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    
    .tile-title h1 {
      font-family: ${templateStyle.fonts.heading};
      font-size: 2.25rem;
      font-weight: 700;
      color: ${palette.heading};
      letter-spacing: 0.025em;
    }
    
    .tile-section-header {
      display: flex;
      align-items: center;
      padding: 1rem;
      border-bottom: 2px solid ${palette.accent};
    }
    
    .tile-section-header h2 {
      font-family: ${templateStyle.fonts.heading};
      font-size: 1.5rem;
      font-weight: 600;
      color: ${palette.heading};
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    
    .tile-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .logo-placeholder {
      width: 80px;
      height: 80px;
      border: 2px dashed ${palette.accent};
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${palette.accent};
      font-family: ${templateStyle.fonts.body};
      font-size: 0.75rem;
    }
    
    .tile-text-block {
      padding: 1rem;
    }
    
    .tile-text-block p {
      font-family: ${templateStyle.fonts.body};
      font-size: 0.875rem;
      color: ${palette.text};
      opacity: 0.8;
    }
    
    .tile-qr {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .qr-placeholder {
      width: 100px;
      height: 100px;
      border: 2px dashed ${palette.accent};
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${palette.accent};
      font-family: ${templateStyle.fonts.body};
      font-size: 0.75rem;
    }
    
    .tile-decoration {
      background: ${palette.accent}10;
      border-radius: 0.5rem;
    }
    
    .tile-spacer {
      border-radius: 0.5rem;
    }
    
    .leader-dots {
      flex: 1;
      border-bottom: 1px dotted ${palette.text}40;
      margin: 0 0.5rem 0.25rem;
    }
    
    .text-left { text-align: left; }
    .text-centre { text-align: center; }
    .text-right { text-align: right; }
    
    .tile {
      overflow: hidden;
      box-sizing: border-box;
    }
    
    @media print {
      html, body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  ` : `
    * {
      box-sizing: border-box;
    }
    
    html, body {
      margin: 0;
      padding: 0;
      background: #f9fafb;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    
    .layout-renderer {
      min-height: 100vh;
      width: 100%;
    }
    
    .tile {
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      background: white;
      overflow: hidden;
      box-sizing: border-box;
    }
    
    .tile-menu-item { border: none; }
    
    .menu-item-card {
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      overflow: hidden;
      background: white;
      height: 100%;
    }
    
    .tile-title {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .tile-section-header {
      display: flex;
      align-items: center;
      padding: 1rem;
      background: #f9fafb;
    }
    
    .tile-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .logo-placeholder {
      width: 100px;
      height: 100px;
      border: 2px dashed #d1d5db;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
    }
    
    .tile-text-block { padding: 1rem; }
    
    .tile-qr {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .qr-placeholder {
      width: 150px;
      height: 150px;
      border: 2px dashed #d1d5db;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
    }
    
    .tile-decoration { border: none; }
    .decoration-placeholder {
      width: 100%;
      height: 100%;
      min-height: 100px;
    }
    .tile-spacer { border: none; }
    .text-left { text-align: left; }
    .text-centre { text-align: center; }
    .text-right { text-align: right; }
    
    @media print {
      html, body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  `
  
  return (
    <div className={`layout-renderer ${className}`}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      {layout.pages.map((page, index) => (
        <PageRenderer 
          key={`page-${index}`} 
          page={page} 
          layout={layout}
          currency={currency} 
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

/**
 * Generate CSS string for a template with styling
 * This can be used to embed styles in a document <head>
 */
export function generateTemplateCSS(
  template?: MenuTemplate,
  paletteId?: string
): string {
  if (!template?.style) {
    return getDefaultCSS()
  }
  
  const palette = getActivePalette(template.style, paletteId)
  return getTemplateCSS(template.style, palette)
}

/**
 * Get default CSS when no template is provided
 */
function getDefaultCSS(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    
    * {
      box-sizing: border-box;
    }
    
    html, body {
      margin: 0;
      padding: 0;
      background: #f9fafb;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    
    .layout-renderer {
      min-height: 100vh;
      width: 100%;
    }
    
    .tile {
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      background: white;
      overflow: hidden;
      box-sizing: border-box;
    }
    
    .tile-menu-item { border: none; }
    
    .menu-item-card {
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      overflow: hidden;
      background: white;
      height: 100%;
    }
    
    .tile-title {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .tile-section-header {
      display: flex;
      align-items: center;
      padding: 1rem;
      background: #f9fafb;
    }
    
    .tile-logo, .tile-qr {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .logo-placeholder, .qr-placeholder {
      border: 2px dashed #d1d5db;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
    }
    
    .logo-placeholder { width: 100px; height: 100px; }
    .qr-placeholder { width: 150px; height: 150px; }
    
    .tile-text-block { padding: 1rem; }
    .tile-decoration { border: none; }
    .decoration-placeholder { width: 100%; height: 100%; min-height: 100px; }
    .tile-spacer { border: none; }
    
    .text-left { text-align: left; }
    .text-centre { text-align: center; }
    .text-right { text-align: right; }
    
    @media print {
      html, body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  `
}

/**
 * Get template-specific CSS with full styling
 */
function getTemplateCSS(style: TemplateStyle, palette: TemplateColorPalette): string {
  return `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@400;700&family=Cormorant+Garamond:wght@400;600;700&family=Source+Sans+Pro:wght@400;600;700&family=Inter:wght@400;600;700&display=swap');
    
    * {
      box-sizing: border-box;
    }
    
    html, body {
      margin: 0;
      padding: 0;
      background: ${style.pageBackground || palette.background};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    
    .layout-renderer {
      font-family: ${style.fonts.body};
      background: ${style.pageBackground || palette.background};
      color: ${palette.text};
      min-height: 100vh;
      width: 100%;
    }
    
    .tile {
      border-radius: ${style.itemCard.borderRadius};
      overflow: hidden;
      box-sizing: border-box;
    }
    
    .tile-menu-item {
      background: ${palette.cardBackground};
      border-radius: ${style.itemCard.borderRadius};
      box-shadow: ${style.itemCard.shadow};
      overflow: hidden;
    }
    
    .menu-item-card {
      background: ${palette.cardBackground};
      border-radius: ${style.itemCard.borderRadius};
      overflow: hidden;
      height: 100%;
    }
    
    .menu-item-image {
      ${style.itemCard.imagePosition === 'circle' ? `
        display: flex;
        justify-content: center;
        padding: 1rem;
      ` : ''}
    }
    
    .menu-item-image img {
      ${style.itemCard.imagePosition === 'circle' ? `
        width: 120px;
        height: 120px;
        border-radius: 50%;
        border: 3px solid ${palette.accent};
        object-fit: cover;
      ` : `
        width: 100%;
        height: 150px;
        object-fit: cover;
        border-radius: ${style.itemCard.imageBorderRadius || '0'};
      `}
    }
    
    .menu-item-content {
      padding: 1rem;
    }
    
    .menu-item-name {
      font-family: ${style.fonts.body};
      font-size: 1rem;
      font-weight: 600;
      color: ${palette.text};
    }
    
    .menu-item-price {
      font-family: ${style.fonts.body};
      font-size: 1rem;
      font-weight: 700;
      color: ${palette.price};
    }
    
    .menu-item-description {
      font-family: ${style.fonts.body};
      font-size: 0.875rem;
      color: ${palette.text};
      opacity: 0.7;
      margin-top: 0.5rem;
      line-height: 1.4;
    }
    
    .menu-item-image-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${palette.accent}15;
    }
    
    .tile-title {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    
    .tile-title h1 {
      font-family: ${style.fonts.heading};
      font-size: 2.25rem;
      font-weight: 700;
      color: ${palette.heading};
      letter-spacing: 0.025em;
    }
    
    .tile-section-header {
      display: flex;
      align-items: center;
      padding: 1rem;
      border-bottom: 2px solid ${palette.accent};
    }
    
    .tile-section-header h2 {
      font-family: ${style.fonts.heading};
      font-size: 1.5rem;
      font-weight: 600;
      color: ${palette.heading};
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    
    .tile-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .logo-placeholder {
      width: 80px;
      height: 80px;
      border: 2px dashed ${palette.accent};
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${palette.accent};
      font-family: ${style.fonts.body};
      font-size: 0.75rem;
    }
    
    .tile-text-block {
      padding: 1rem;
    }
    
    .tile-text-block p {
      font-family: ${style.fonts.body};
      font-size: 0.875rem;
      color: ${palette.text};
      opacity: 0.8;
    }
    
    .tile-qr {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .qr-placeholder {
      width: 100px;
      height: 100px;
      border: 2px dashed ${palette.accent};
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${palette.accent};
      font-family: ${style.fonts.body};
      font-size: 0.75rem;
    }
    
    .tile-decoration {
      background: ${palette.accent}10;
      border-radius: 0.5rem;
    }
    
    .tile-spacer {
      border-radius: 0.5rem;
    }
    
    .leader-dots {
      flex: 1;
      border-bottom: 1px dotted ${palette.text}40;
      margin: 0 0.5rem 0.25rem;
    }
    
    .text-left { text-align: left; }
    .text-centre { text-align: center; }
    .text-right { text-align: right; }
    
    .tile {
      overflow: hidden;
      box-sizing: border-box;
    }
    
    @media print {
      html, body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  `
}