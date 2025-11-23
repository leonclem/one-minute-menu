/**
 * Template Definitions Registry
 * 
 * This file contains all template definitions for the GridMenu Template Engine.
 * Templates are declarative JSON-like structures that define grid layouts, constraints,
 * and capabilities.
 */

import type { MenuTemplate, TemplateId } from './engine-types'

/**
 * Classic Grid Cards Template
 * 
 * Photo-forward 3-column grid layout inspired by design-inspiration-7.png.
 * Features a title at the top and item cards with images in a 3-column grid.
 * Scales vertically using repeat patterns for larger menus.
 */
export const CLASSIC_GRID_CARDS: MenuTemplate = {
  id: 'classic-grid-cards',
  name: 'Classic Grid Cards',
  description: 'Photo-forward 3-column grid layout with item cards',
  thumbnailUrl: '/templates/previews/classic-grid-cards.jpg',
  aspectRatio: 'A4_PORTRAIT',
  orientation: 'A4_PORTRAIT',
  layout: {
    baseCols: 3,
    baseRows: 4,
    tiles: [
      // Title tile at top
      {
        id: 'title-1',
        type: 'TITLE',
        col: 0,
        row: 0,
        colSpan: 3,
        rowSpan: 1,
        options: { align: 'centre' }
      },
      // First row of items (3 items)
      {
        id: 'item-1',
        type: 'ITEM',
        col: 0,
        row: 1,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-2',
        type: 'ITEM',
        col: 1,
        row: 1,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-3',
        type: 'ITEM',
        col: 2,
        row: 1,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      // Second row of items (3 items)
      {
        id: 'item-4',
        type: 'ITEM',
        col: 0,
        row: 2,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-5',
        type: 'ITEM',
        col: 1,
        row: 2,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-6',
        type: 'ITEM',
        col: 2,
        row: 2,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      // Third row of items (3 items)
      {
        id: 'item-7',
        type: 'ITEM',
        col: 0,
        row: 3,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-8',
        type: 'ITEM',
        col: 1,
        row: 3,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-9',
        type: 'ITEM',
        col: 2,
        row: 3,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      }
    ],
    repeatPattern: {
      fromRow: 4,
      rowsPerRepeat: 1,
      repeatItemTileIds: ['item-10', 'item-11', 'item-12'],
      maxRepeats: 10,
      newPagePerRepeat: false
    }
  },
  constraints: {
    minSections: 1,
    maxSections: 'unbounded',
    minItems: 3,
    hardMaxItems: 150
  },
  capabilities: {
    supportsImages: true,
    supportsLogoPlaceholder: false,
    supportsColourPalettes: false,
    supportsTextOnlyMode: true,
    supportsResponsiveWeb: true,
    autoFillerTiles: false
  },
  configurationSchema: {
    allowColourPalette: false,
    allowLogoUpload: false,
    allowImageToggle: true
  },
  version: '1.0.0'
}

/**
 * Two-Column Text Template
 * 
 * Traditional text-focused layout inspired by italian.png.
 * Features a 2-column layout with section headers and text-only items.
 * This is the "tank" template that can handle any menu up to 150 items.
 */
export const TWO_COLUMN_TEXT: MenuTemplate = {
  id: 'two-column-text',
  name: 'Two-Column Text',
  description: 'Traditional text-focused layout with 2 columns',
  thumbnailUrl: '/templates/previews/two-column-text.jpg',
  aspectRatio: 'A4_PORTRAIT',
  orientation: 'A4_PORTRAIT',
  layout: {
    baseCols: 2,
    baseRows: 10,
    tiles: [
      // Title tile at top
      {
        id: 'title-1',
        type: 'TITLE',
        col: 0,
        row: 0,
        colSpan: 2,
        rowSpan: 1,
        options: { align: 'centre' }
      },
      // Section header for left column
      {
        id: 'section-header-1',
        type: 'SECTION_HEADER',
        col: 0,
        row: 1,
        colSpan: 1,
        rowSpan: 1,
        sectionSlot: 0
      },
      // Items in left column
      {
        id: 'item-1',
        type: 'ITEM_TEXT_ONLY',
        col: 0,
        row: 2,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      {
        id: 'item-2',
        type: 'ITEM_TEXT_ONLY',
        col: 0,
        row: 3,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      {
        id: 'item-3',
        type: 'ITEM_TEXT_ONLY',
        col: 0,
        row: 4,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      {
        id: 'item-4',
        type: 'ITEM_TEXT_ONLY',
        col: 0,
        row: 5,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      // Items in right column
      {
        id: 'item-5',
        type: 'ITEM_TEXT_ONLY',
        col: 1,
        row: 2,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      {
        id: 'item-6',
        type: 'ITEM_TEXT_ONLY',
        col: 1,
        row: 3,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      {
        id: 'item-7',
        type: 'ITEM_TEXT_ONLY',
        col: 1,
        row: 4,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      {
        id: 'item-8',
        type: 'ITEM_TEXT_ONLY',
        col: 1,
        row: 5,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      }
    ],
    repeatPattern: {
      fromRow: 6,
      rowsPerRepeat: 4,
      repeatItemTileIds: ['item-9', 'item-10', 'item-11', 'item-12', 'item-13', 'item-14', 'item-15', 'item-16'],
      maxRepeats: 10,
      newPagePerRepeat: false
    }
  },
  constraints: {
    minSections: 1,
    maxSections: 'unbounded',
    minItems: 1,
    hardMaxItems: 150
  },
  capabilities: {
    supportsImages: false,
    supportsLogoPlaceholder: false,
    supportsColourPalettes: false,
    supportsTextOnlyMode: true,
    supportsResponsiveWeb: true,
    autoFillerTiles: false
  },
  configurationSchema: {
    allowColourPalette: false,
    allowLogoUpload: false,
    allowImageToggle: false
  },
  version: '1.0.0'
}

/**
 * Simple Rows Template
 * 
 * Mobile-friendly single-column layout inspired by design-inspiration-9.jpg.
 * Features section headers and items in a vertical list with optional small thumbnails.
 * Ideal for mobile viewing and responsive web.
 */
export const SIMPLE_ROWS: MenuTemplate = {
  id: 'simple-rows',
  name: 'Simple Rows',
  description: 'Mobile-friendly single-column layout with optional thumbnails',
  thumbnailUrl: '/templates/previews/simple-rows.jpg',
  aspectRatio: 'A4_PORTRAIT',
  orientation: 'A4_PORTRAIT',
  layout: {
    baseCols: 1,
    baseRows: 10,
    tiles: [
      // Title tile at top
      {
        id: 'title-1',
        type: 'TITLE',
        col: 0,
        row: 0,
        colSpan: 1,
        rowSpan: 1,
        options: { align: 'centre' }
      },
      // Section header
      {
        id: 'section-header-1',
        type: 'SECTION_HEADER',
        col: 0,
        row: 1,
        colSpan: 1,
        rowSpan: 1,
        sectionSlot: 0
      },
      // Items in single column
      {
        id: 'item-1',
        type: 'ITEM',
        col: 0,
        row: 2,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-2',
        type: 'ITEM',
        col: 0,
        row: 3,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-3',
        type: 'ITEM',
        col: 0,
        row: 4,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-4',
        type: 'ITEM',
        col: 0,
        row: 5,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-5',
        type: 'ITEM',
        col: 0,
        row: 6,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-6',
        type: 'ITEM',
        col: 0,
        row: 7,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-7',
        type: 'ITEM',
        col: 0,
        row: 8,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-8',
        type: 'ITEM',
        col: 0,
        row: 9,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      }
    ],
    repeatPattern: {
      fromRow: 10,
      rowsPerRepeat: 8,
      repeatItemTileIds: ['item-9', 'item-10', 'item-11', 'item-12', 'item-13', 'item-14', 'item-15', 'item-16'],
      maxRepeats: 10,
      newPagePerRepeat: false
    }
  },
  constraints: {
    minSections: 1,
    maxSections: 'unbounded',
    minItems: 1,
    hardMaxItems: 150
  },
  capabilities: {
    supportsImages: true,
    supportsLogoPlaceholder: false,
    supportsColourPalettes: false,
    supportsTextOnlyMode: true,
    supportsResponsiveWeb: true,
    autoFillerTiles: false
  },
  configurationSchema: {
    allowColourPalette: false,
    allowLogoUpload: false,
    allowImageToggle: true
  },
  version: '1.0.0'
}

/**
 * Template Registry
 * 
 * Central registry of all available templates. Templates marked with isPostMvp: true
 * are not exposed in the /api/templates/available endpoint until ready.
 */
export const TEMPLATE_REGISTRY: Record<TemplateId, MenuTemplate> = {
  'classic-grid-cards': CLASSIC_GRID_CARDS,
  'two-column-text': TWO_COLUMN_TEXT,
  'simple-rows': SIMPLE_ROWS
}

/**
 * Get only MVP-ready templates
 * 
 * Filters out templates marked with isPostMvp: true
 */
export function getMvpTemplates(): MenuTemplate[] {
  return Object.values(TEMPLATE_REGISTRY).filter(t => !t.isPostMvp)
}
