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
  SpacerTileInstance
} from '../engine-types'
import { PAGE_SIZES } from '../engine-config'

// ============================================================================
// Component Props
// ============================================================================

export interface LayoutRendererProps {
  layout: LayoutInstance
  currency?: string
  className?: string
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
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

function MenuItemTile({ 
  tile, 
  currency 
}: { 
  tile: MenuItemTileInstance
  currency: string 
}) {
  const styles = getTileStyles(tile)
  const showImage = tile.showImage && tile.imageUrl
  const showDescription = tile.options?.showDescription !== false && tile.description
  const emphasisePrice = tile.options?.emphasisePrice
  
  return (
    <div style={styles} className="tile tile-menu-item">
      <div className="menu-item-card">
        {showImage && (
          <div className="menu-item-image">
            <img 
              src={tile.imageUrl} 
              alt={tile.name}
              className="w-full h-48 object-cover rounded-t-lg"
            />
          </div>
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
  currency = '$',
  className = '',
  themeColors
}: LayoutRendererProps) {
  // Generate CSS as a string for server-side rendering
  const styles = `
    .tile {
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      background: white;
    }
    
    .tile-menu-item {
      border: none;
    }
    
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
    
    .tile-text-block {
      padding: 1rem;
    }
    
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
    
    .tile-decoration {
      border: none;
    }
    
    .decoration-placeholder {
      width: 100%;
      height: 100%;
      min-height: 100px;
    }
    
    .tile-spacer {
      border: none;
    }
    
    .text-left {
      text-align: left;
    }
    
    .text-centre {
      text-align: center;
    }
    
    .text-right {
      text-align: right;
    }
    
    @media print {
      .page {
        page-break-after: always;
      }
      
      .page:last-child {
        page-break-after: auto;
      }
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
