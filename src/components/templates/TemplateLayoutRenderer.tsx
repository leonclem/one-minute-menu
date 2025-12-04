/**
 * TemplateLayoutRenderer Component
 * 
 * Renders a LayoutInstance with the template's visual styling applied.
 * This is the main rendering component for the styled template system.
 * 
 * Features:
 * - Applies template colors, fonts, and styling
 * - Renders CSS Grid layout based on LayoutInstance structure
 * - Handles different item card styles (circular images, text-only, etc.)
 * - Supports color palette swapping
 * - Reuses existing theme-integration utilities
 */

'use client'

import React from 'react'
import Image from 'next/image'
import type {
  LayoutInstance,
  MenuTemplate,
  TileContentInstance,
  StaticTileInstance,
  SectionHeaderTileInstance,
  MenuItemTileInstance,
  SpacerTileInstance,
  TemplateColorPalette,
  TemplateStyle
} from '@/lib/templates/engine-types'
import { PAGE_SIZES } from '@/lib/templates/engine-config'
import { ItemImageFallback } from './ItemImageFallback'

// ============================================================================
// Component Props
// ============================================================================

export interface TemplateLayoutRendererProps {
  /** The generated layout instance from the layout engine */
  layout: LayoutInstance
  /** The full template definition with styling */
  template: MenuTemplate
  /** Optional override for the color palette (for palette swapping) */
  paletteId?: string
  /** Currency symbol for price formatting */
  currency?: string
  /** Optional className for the container */
  className?: string
  /** Whether to render at full page size (for export) */
  fullPageSize?: boolean
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the active color palette based on paletteId or use default
 */
function getActivePalette(style: TemplateStyle, paletteId?: string): TemplateColorPalette {
  if (!paletteId) return style.colors
  
  // Check alternate palettes
  const alternate = style.alternatePalettes?.find(p => p.id === paletteId)
  return alternate || style.colors
}

/**
 * Format price with currency symbol
 */
function formatPrice(price: number, currency: string = '$'): string {
  return `${currency}${price.toFixed(2)}`
}

/**
 * Get CSS for grid positioning of a tile
 */
function getTileGridStyles(tile: TileContentInstance): React.CSSProperties {
  return {
    gridColumn: `${tile.col + 1} / span ${tile.colSpan}`,
    gridRow: `${tile.row + 1} / span ${tile.rowSpan}`
  }
}

// ============================================================================
// Tile Components
// ============================================================================

interface TileProps {
  style: TemplateStyle
  palette: TemplateColorPalette
  currency: string
}

/**
 * Title Tile - Renders the menu title
 */
function TitleTile({ 
  tile, 
  style, 
  palette 
}: { tile: StaticTileInstance } & TileProps) {
  const gridStyles = getTileGridStyles(tile)
  const align = tile.options?.align || 'centre'
  
  return (
    <div 
      style={{
        ...gridStyles,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'centre' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        padding: '1.5rem',
        fontFamily: style.fonts.heading
      }}
    >
      <h1 
        className="menu-title"
        style={{ 
          fontFamily: "'Playfair Display', 'Times New Roman', serif",
          fontSize: '36px',
          fontWeight: 600,
          color: '#c8a562',
          margin: 0,
          letterSpacing: '0.08em',
          textTransform: 'uppercase'
        }}
      >
        {tile.content}
      </h1>
    </div>
  )
}

/**
 * Section Header Tile - Renders category headers
 */
function SectionHeaderTile({ 
  tile, 
  style, 
  palette 
}: { tile: SectionHeaderTileInstance } & TileProps) {
  const gridStyles = getTileGridStyles(tile)
  const align = tile.options?.align || 'left'
  
  return (
    <div 
      style={{
        ...gridStyles,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'centre' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        padding: '1.5rem 1rem',
        borderBottom: `1px solid rgba(255, 255, 255, 0.1)`,
        fontFamily: style.fonts.heading
      }}
    >
      <h2 
        style={{ 
          fontSize: '36px',
          fontWeight: 400,
          color: palette.heading,
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}
      >
        {tile.label}
      </h2>
    </div>
  )
}

/**
 * Menu Item Tile - Renders individual menu items with various styles
 */
function MenuItemTile({ 
  tile, 
  style, 
  palette,
  currency 
}: { tile: MenuItemTileInstance } & TileProps) {
  const gridStyles = getTileGridStyles(tile)
  const { itemCard } = style
  
  // Check if template supports images and image position allows it
  const templateSupportsImage = tile.showImage && itemCard.imagePosition !== 'none'
  // Check if we actually have an image URL
  const hasImage = !!tile.imageUrl
  // Show image (real or fallback) when template supports it
  const showImageArea = templateSupportsImage
  
  const showDescription = tile.options?.showDescription !== false && tile.description
  const showLeaderDots = itemCard.showLeaderDots
  
  // Circular image style (Elegant Dark template)
  if (itemCard.imagePosition === 'circle') {
    return (
      <div
        className="elegant-dark-card"
        style={{
          ...gridStyles,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 0,
          backgroundColor: 'transparent',
          borderRadius: '0',
          boxShadow: 'none'
        }}
      >
        {/* Circular image or fallback */}
        {showImageArea && (
          hasImage ? (
            <div 
              style={{
                width: '75px',
                height: '75px',
                borderRadius: '50%',
                overflow: 'hidden',
                marginBottom: '12px',
                border: `2px solid ${palette.accent}`,
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
                flexShrink: 0
              }}
            >
              <Image
                src={tile.imageUrl!}
                alt={tile.name}
                width={75}
                height={75}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
          ) : (
            <div style={{ marginBottom: '12px' }}>
              <ItemImageFallback
                accentColor={palette.accent}
                backgroundColor={palette.cardBackground}
                shape="circle"
                size={{ width: 75, height: 75 }}
              />
            </div>
          )
        )}
        
        {/* Item name */}
        <h3 
          className="menu-item-title"
          style={{ 
            fontFamily: "'Nanum Myeongjo', 'Habibi', 'Times New Roman', serif",
            fontSize: '9.5px',
            fontWeight: 400,
            color: '#f8f5f0',
            margin: '0 0 3px 0',
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1.3,
            overflow: 'hidden'
          }}
        >
          {tile.name}
        </h3>
        
        {/* Price */}
        <span 
          className="menu-item-price"
          style={{ 
            fontFamily: "'Lato', system-ui, sans-serif",
            fontSize: '12px',
            fontWeight: 500,
            color: '#c8a562',
            marginBottom: showDescription ? '4px' : '0',
            display: 'block',
            height: '16px',
            lineHeight: '16px'
          }}
        >
          {formatPrice(tile.price, currency)}
        </span>
        
        {/* Description */}
        {showDescription && (
          <p 
            className="menu-item-description"
            style={{ 
              fontFamily: "'Lato', system-ui, sans-serif",
              fontSize: '8px',
              fontWeight: 400,
              color: '#d4d2ce',
              margin: 0,
              textAlign: 'center',
              lineHeight: 1.35,
              paddingBottom: 0,
              textTransform: 'lowercase'
            }}
          >
            {tile.description}
          </p>
        )}
      </div>
    )
  }
  
  // Text-only style with leader dots (Classic Italian template)
  if (itemCard.imagePosition === 'none' || !showImageArea) {
    return (
      <div
        style={{
          ...gridStyles,
          padding: '0.75rem 0',
          borderBottom: `1px solid ${palette.accent}20`
        }}
      >
        {/* Name and price row with optional leader dots */}
        <div 
          style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '1rem',
            minHeight: '1.5rem'
          }}
        >
          <h3 
            style={{ 
              fontFamily: style.fonts.heading,
              fontSize: '1rem',
              fontWeight: 600,
              color: palette.text,
              margin: 0,
              flex: 1,
              minWidth: 0,
              wordBreak: 'break-word'
            }}
          >
            {tile.name}
          </h3>
          
          {showLeaderDots && (
            <span 
              style={{ 
                flex: '0 1 auto',
                minWidth: '2rem',
                borderBottom: `1px dotted ${palette.text}40`,
                marginBottom: '0.25rem'
              }} 
            />
          )}
          
          <span 
            style={{ 
              fontFamily: style.fonts.body,
              fontSize: '1rem',
              fontWeight: 700,
              color: palette.price,
              flexShrink: 0,
              whiteSpace: 'nowrap',
              marginLeft: 'auto'
            }}
          >
            {formatPrice(tile.price, currency)}
          </span>
        </div>
        
        {/* Description */}
        {showDescription && (
          <p 
            style={{ 
              fontFamily: style.fonts.body,
              fontSize: '0.875rem',
              color: palette.text,
              opacity: 0.7,
              margin: '0.25rem 0 0 0',
              lineHeight: 1.5
            }}
          >
            {tile.description}
          </p>
        )}
      </div>
    )
  }
  
  // Left image style (Simple Rows template)
  if (itemCard.imagePosition === 'left') {
    return (
      <div
        style={{
          ...gridStyles,
          display: 'flex',
          gap: '1rem',
          padding: '0.75rem',
          backgroundColor: palette.cardBackground,
          borderRadius: itemCard.borderRadius,
          boxShadow: itemCard.shadow
        }}
      >
        {/* Left-aligned image or fallback */}
        {showImageArea && (
          hasImage ? (
            <div 
              style={{
                width: '80px',
                height: '80px',
                borderRadius: itemCard.imageBorderRadius || '6px',
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              <Image
                src={tile.imageUrl!}
                alt={tile.name}
                width={80}
                height={80}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            </div>
          ) : (
            <ItemImageFallback
              accentColor={palette.accent}
              backgroundColor={`${palette.accent}10`}
              shape="square"
              size={{ width: 80, height: 80 }}
            />
          )
        )}
        
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 
              style={{ 
                fontFamily: style.fonts.body,
                fontSize: '1rem',
                fontWeight: 600,
                color: palette.text,
                margin: 0
              }}
            >
              {tile.name}
            </h3>
            <span 
              style={{ 
                fontFamily: style.fonts.body,
                fontSize: '1rem',
                fontWeight: 700,
                color: palette.price
              }}
            >
              {formatPrice(tile.price, currency)}
            </span>
          </div>
          
          {showDescription && (
            <p 
              style={{ 
                fontFamily: style.fonts.body,
                fontSize: '0.875rem',
                color: palette.text,
                opacity: 0.7,
                margin: '0.25rem 0 0 0',
                lineHeight: 1.4
              }}
            >
              {tile.description}
            </p>
          )}
        </div>
      </div>
    )
  }
  
  // Top image style (default card layout)
  return (
    <div
      style={{
        ...gridStyles,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: palette.cardBackground,
        borderRadius: itemCard.borderRadius,
        boxShadow: itemCard.shadow,
        overflow: 'hidden'
      }}
    >
      {/* Top image or fallback */}
      {showImageArea && (
        hasImage ? (
          <div 
            style={{
              width: '100%',
              height: '150px',
              overflow: 'hidden'
            }}
          >
            <Image
              src={tile.imageUrl!}
              alt={tile.name}
              width={300}
              height={150}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          </div>
        ) : (
          <ItemImageFallback
            accentColor={palette.accent}
            backgroundColor={`${palette.accent}10`}
            shape="rectangle"
            size={{ width: '100%', height: 150 }}
          />
        )
      )}
      
      {/* Content */}
      <div style={{ padding: '1rem', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h3 
            style={{ 
              fontFamily: style.fonts.body,
              fontSize: '1rem',
              fontWeight: 600,
              color: palette.text,
              margin: 0
            }}
          >
            {tile.name}
          </h3>
          <span 
            style={{ 
              fontFamily: style.fonts.body,
              fontSize: '1rem',
              fontWeight: 700,
              color: palette.price
            }}
          >
            {formatPrice(tile.price, currency)}
          </span>
        </div>
        
        {showDescription && (
          <p 
            style={{ 
              fontFamily: style.fonts.body,
              fontSize: '0.875rem',
              color: palette.text,
              opacity: 0.7,
              margin: '0.5rem 0 0 0',
              lineHeight: 1.4
            }}
          >
            {tile.description}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Spacer Tile - Renders filler/spacer tiles
 */
function SpacerTile({ 
  tile, 
  palette 
}: { tile: SpacerTileInstance; palette: TemplateColorPalette }) {
  const gridStyles = getTileGridStyles(tile)
  const backgroundColor = tile.backgroundColor || `${palette.accent}20`
  
  return (
    <div 
      style={{
        ...gridStyles,
        backgroundColor,
        borderRadius: '8px'
      }}
      aria-hidden="true"
    />
  )
}

/**
 * Static Tile - Renders logo, text blocks, QR codes, etc.
 */
function StaticTile({ 
  tile, 
  style, 
  palette 
}: { tile: StaticTileInstance } & Omit<TileProps, 'currency'>) {
  const gridStyles = getTileGridStyles(tile)
  const align = tile.options?.align || 'centre'
  
  if (tile.type === 'LOGO') {
    return (
      <div 
        style={{
          ...gridStyles,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}
      >
        <div 
          style={{
            width: '80px',
            height: '80px',
            border: `2px dashed ${palette.accent}`,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: palette.accent,
            fontFamily: style.fonts.body,
            fontSize: '0.75rem'
          }}
        >
          {tile.content || 'Logo'}
        </div>
      </div>
    )
  }
  
  if (tile.type === 'TEXT_BLOCK') {
    return (
      <div 
        style={{
          ...gridStyles,
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'centre' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          padding: '1rem'
        }}
      >
        <p 
          style={{
            fontFamily: style.fonts.body,
            fontSize: '0.875rem',
            color: palette.text,
            opacity: 0.8,
            margin: 0,
            textAlign: align === 'centre' ? 'center' : align === 'right' ? 'right' : 'left'
          }}
        >
          {tile.content}
        </p>
      </div>
    )
  }
  
  if (tile.type === 'QR_CODE') {
    return (
      <div 
        style={{
          ...gridStyles,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}
      >
        <div 
          style={{
            width: '100px',
            height: '100px',
            border: `2px dashed ${palette.accent}`,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: palette.accent,
            fontFamily: style.fonts.body,
            fontSize: '0.75rem',
            textAlign: 'center'
          }}
        >
          {tile.content || 'QR Code'}
        </div>
      </div>
    )
  }
  
  if (tile.type === 'IMAGE_DECORATION') {
    return (
      <div 
        style={{
          ...gridStyles,
          backgroundColor: `${palette.accent}10`,
          borderRadius: '8px'
        }}
        aria-hidden="true"
      />
    )
  }
  
  return null
}

/**
 * Tile Router - Routes to appropriate tile component
 */
function TileRenderer({ 
  tile, 
  style, 
  palette, 
  currency 
}: { tile: TileContentInstance } & TileProps) {
  if (tile.type === 'TITLE') {
    return <TitleTile tile={tile as StaticTileInstance} style={style} palette={palette} currency={currency} />
  }
  
  if (tile.type === 'SECTION_HEADER') {
    return <SectionHeaderTile tile={tile as SectionHeaderTileInstance} style={style} palette={palette} currency={currency} />
  }
  
  if (tile.type === 'ITEM' || tile.type === 'ITEM_TEXT_ONLY') {
    return <MenuItemTile tile={tile as MenuItemTileInstance} style={style} palette={palette} currency={currency} />
  }
  
  if (tile.type === 'SPACER') {
    return <SpacerTile tile={tile as SpacerTileInstance} palette={palette} />
  }
  
  // Static tiles: LOGO, TEXT_BLOCK, IMAGE_DECORATION, QR_CODE
  return <StaticTile tile={tile as StaticTileInstance} style={style} palette={palette} />
}

// ============================================================================
// Main Component
// ============================================================================

export function TemplateLayoutRenderer({
  layout,
  template,
  paletteId,
  currency = '$',
  className = '',
  fullPageSize = false
}: TemplateLayoutRendererProps) {
  const { style } = template
  const palette = getActivePalette(style, paletteId)
  
  // Calculate grid dimensions from layout
  const maxCol = Math.max(...layout.pages.flatMap(p => p.tiles.map(t => t.col + t.colSpan)))
  const gridTemplateColumns = `repeat(${maxCol}, 1fr)`
  
  // Get page size for full-page rendering
  const pageSize = fullPageSize ? PAGE_SIZES[layout.orientation] : undefined
  
  // Check if this is the Elegant Dark template to apply texture
  const isElegantDark = template.id === 'classic-grid-cards' && palette.id === 'elegant-dark'
  
  return (
    <div 
      className={`template-layout-renderer ${isElegantDark ? 'template-bg-elegant-dark' : ''} ${className}`}
      style={{
        fontFamily: style.fonts.body,
        backgroundColor: palette.background,
        background: isElegantDark ? undefined : (style.pageBackground || palette.background),
        color: palette.text
      }}
    >
      {layout.pages.map((page, pageIndex) => {
        // Calculate max row for this page
        const maxRow = Math.max(...page.tiles.map(t => t.row + t.rowSpan))
        const gridTemplateRows = `repeat(${maxRow}, auto)`
        
        return (
          <div 
            key={`page-${pageIndex}`}
            className={`template-page ${isElegantDark ? 'elegant-dark-grid' : ''}`}
            style={{
              display: 'grid',
              gridTemplateColumns,
              gridTemplateRows,
              gap: '12px',
              columnGap: '24px', // Increased column gap for two-column layouts
              padding: '2rem',
              minHeight: fullPageSize ? pageSize?.height : 'auto',
              width: fullPageSize ? pageSize?.width : '100%',
              boxSizing: 'border-box',
              pageBreakAfter: pageIndex < layout.pages.length - 1 ? 'always' : 'auto',
              position: 'relative',
              zIndex: 1
            }}
          >
            {page.tiles.map((tile, tileIndex) => (
              <TileRenderer
                key={`${tile.id}-${tileIndex}`}
                tile={tile}
                style={style}
                palette={palette}
                currency={currency}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

export default TemplateLayoutRenderer

