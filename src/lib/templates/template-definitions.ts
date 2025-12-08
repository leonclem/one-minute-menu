/**
 * Template Definitions Registry
 * 
 * @module template-definitions
 * @description
 * This module contains all template definitions for the GridMenu Template Engine.
 * Templates are declarative JSON-like structures that define grid layouts, constraints,
 * styling, and capabilities.
 * 
 * **Available MVP Templates:**
 * - `CLASSIC_GRID_CARDS` ("Elegant Dark"): Photo-forward 3-column grid with circular images
 * - `TWO_COLUMN_TEXT` ("Classic Italian"): Text-focused 2-column layout with leader dots
 * - `SIMPLE_ROWS`: Clean single-column layout with side thumbnails
 * 
 * ---
 * 
 * ## HOW TO ADD A NEW TEMPLATE
 * 
 * Adding a new template is a 4-step process:
 * 
 * ### Step 1: Define Color Palette(s)
 * Create at least one `TemplateColorPalette` with required colors:
 * ```typescript
 * const MY_PALETTE: TemplateColorPalette = {
 *   id: 'my-palette',
 *   name: 'My Palette',
 *   background: '#ffffff',    // Page background
 *   text: '#333333',          // Body text color
 *   heading: '#111111',       // Section headers
 *   price: '#059669',         // Price text
 *   accent: '#059669',        // Borders, decorations
 *   cardBackground: '#f9fafb' // Item card background
 * }
 * ```
 * 
 * ### Step 2: Define Template Style
 * Create a `TemplateStyle` object:
 * ```typescript
 * const MY_STYLE: TemplateStyle = {
 *   colors: MY_PALETTE,
 *   alternatePalettes: [ALTERNATE_PALETTE], // Optional swappable palettes
 *   fonts: {
 *     heading: "'Playfair Display', serif",
 *     body: "'Lato', sans-serif"
 *   },
 *   itemCard: {
 *     borderRadius: '8px',
 *     shadow: '0 2px 8px rgba(0,0,0,0.1)',
 *     imagePosition: 'top',  // 'top' | 'left' | 'circle' | 'background' | 'none'
 *     imageBorderRadius: '8px',
 *     showLeaderDots: false  // true for text-only menus
 *   },
 *   pageBackground: '#ffffff', // or gradient
 *   fillerTileStyle: 'icon'   // 'icon' | 'pattern' | 'color'
 * }
 * ```
 * 
 * ### Step 3: Define the Template
 * Create a `MenuTemplate` object with:
 * - **layout**: Grid structure with tile positions
 * - **constraints**: Menu size limits
 * - **capabilities**: Feature flags
 * - **style**: The style object from Step 2
 * 
 * ```typescript
 * export const MY_TEMPLATE: MenuTemplate = {
 *   id: 'my-template',
 *   name: 'My Template',
 *   description: 'Description for UI display',
 *   thumbnailUrl: '/templates/previews/my-template.jpg',
 *   aspectRatio: 'A4_PORTRAIT',
 *   orientation: 'A4_PORTRAIT',
 *   layout: {
 *     baseCols: 3,
 *     baseRows: 4,
 *     tiles: [
 *       { id: 'title-1', type: 'TITLE', col: 0, row: 0, colSpan: 3, rowSpan: 1 },
 *       { id: 'item-1', type: 'ITEM', col: 0, row: 1, colSpan: 1, rowSpan: 1 },
 *       // ... more tiles
 *     ],
 *     repeatPattern: { // Optional for scaling
 *       fromRow: 4,
 *       rowsPerRepeat: 1,
 *       repeatItemTileIds: ['item-10', 'item-11', 'item-12'],
 *       maxRepeats: 10
 *     }
 *   },
 *   constraints: { minSections: 1, maxSections: 'unbounded', minItems: 1 },
 *   capabilities: {
 *     supportsImages: true,
 *     supportsColourPalettes: true,
 *     supportsTextOnlyMode: true,
 *     supportsResponsiveWeb: true,
 *     supportsLogoPlaceholder: false,
 *     autoFillerTiles: true
 *   },
 *   configurationSchema: { allowColourPalette: true, allowImageToggle: true },
 *   style: MY_STYLE,
 *   version: '1.0.0'
 * }
 * ```
 * 
 * ### Step 4: Register the Template
 * Add to `TEMPLATE_REGISTRY`:
 * ```typescript
 * export const TEMPLATE_REGISTRY: Record<TemplateId, MenuTemplate> = {
 *   // ... existing templates
 *   'my-template': MY_TEMPLATE
 * }
 * ```
 * 
 * That's it! The template will appear in the template selection UI and work
 * with all export formats (PDF, HTML, preview).
 * 
 * ---
 * 
 * @example
 * ```typescript
 * import { 
 *   CLASSIC_GRID_CARDS, 
 *   TWO_COLUMN_TEXT, 
 *   getMvpTemplates,
 *   TEMPLATE_REGISTRY 
 * } from '@/lib/templates/template-definitions'
 * 
 * // Use a specific template
 * const layout = generateLayout({ menu, template: CLASSIC_GRID_CARDS })
 * 
 * // Get all MVP-ready templates
 * const templates = getMvpTemplates()
 * 
 * // Look up a template by ID
 * const template = TEMPLATE_REGISTRY['two-column-text']
 * ```
 */

import type { MenuTemplate, TemplateId, TemplateStyle, TemplateColorPalette } from './engine-types'

// ============================================================================
// Color Palette Definitions
// ============================================================================

/**
 * Elegant Dark color palettes - inspired by Ravada design
 */
const ELEGANT_DARK_PALETTE: TemplateColorPalette = {
  id: 'elegant-dark',
  name: 'Elegant Dark',
  background: '#0b0d11',
  text: '#f8f5f0',
  heading: '#c8a562',
  price: '#c8a562',
  accent: '#c8a562',
  cardBackground: 'transparent'
}

const ELEGANT_DARK_LIGHT_PALETTE: TemplateColorPalette = {
  id: 'elegant-light',
  name: 'Elegant Light',
  background: '#faf9f7',
  text: '#1a1f2e',
  heading: '#8b6914',
  price: '#8b6914',
  accent: '#c9a227',
  cardBackground: '#ffffff'
}

const ELEGANT_DARK_WARM_PALETTE: TemplateColorPalette = {
  id: 'elegant-warm',
  name: 'Elegant Warm',
  background: '#2d1f1a',
  text: '#fff8f0',
  heading: '#d4a574',
  price: '#d4a574',
  accent: '#d4a574',
  cardBackground: '#3d2f2a'
}

/**
 * Classic Italian color palettes - inspired by Porta-Porta design
 */
const CLASSIC_CREAM_PALETTE: TemplateColorPalette = {
  id: 'classic-cream',
  name: 'Classic Cream',
  background: '#faf8f5',
  text: '#2d2d2d',
  heading: '#1a1a1a',
  price: '#1a1a1a',
  accent: '#8b7355',
  cardBackground: '#ffffff'
}

const CLASSIC_IVORY_PALETTE: TemplateColorPalette = {
  id: 'classic-ivory',
  name: 'Classic Ivory',
  background: '#fffff8',
  text: '#333333',
  heading: '#4a4a4a',
  price: '#4a4a4a',
  accent: '#6b8e23',
  cardBackground: '#fefefe'
}

const CLASSIC_SAGE_PALETTE: TemplateColorPalette = {
  id: 'classic-sage',
  name: 'Classic Sage',
  background: '#f5f7f4',
  text: '#2d3a2d',
  heading: '#3d4d3d',
  price: '#3d4d3d',
  accent: '#7a9a7a',
  cardBackground: '#ffffff'
}

/**
 * Simple modern color palettes
 */
const SIMPLE_CLEAN_PALETTE: TemplateColorPalette = {
  id: 'simple-clean',
  name: 'Clean White',
  background: '#ffffff',
  text: '#333333',
  heading: '#111111',
  price: '#059669',
  accent: '#059669',
  cardBackground: '#f9fafb'
}

const SIMPLE_DARK_PALETTE: TemplateColorPalette = {
  id: 'simple-dark',
  name: 'Dark Mode',
  background: '#111827',
  text: '#f3f4f6',
  heading: '#ffffff',
  price: '#10b981',
  accent: '#10b981',
  cardBackground: '#1f2937'
}

// ============================================================================
// Style Definitions
// ============================================================================

/**
 * Elegant Dark style - Photo-forward with circular images and gold accents
 */
const ELEGANT_DARK_STYLE: TemplateStyle = {
  colors: ELEGANT_DARK_PALETTE,
  alternatePalettes: [ELEGANT_DARK_LIGHT_PALETTE, ELEGANT_DARK_WARM_PALETTE],
  fonts: {
    heading: "'Playfair Display', Georgia, serif",
    body: "'Inter', 'Lato', 'Helvetica Neue', sans-serif"
  },
  itemCard: {
    borderRadius: '0',
    shadow: 'none',
    imagePosition: 'circle',
    imageBorderRadius: '50%'
  },
  pageBackground: '#0b0d11',
  fillerTileStyle: 'icon'
}

/**
 * Classic Italian style - Text-focused with serif fonts and leader dots
 */
const CLASSIC_ITALIAN_STYLE: TemplateStyle = {
  colors: CLASSIC_CREAM_PALETTE,
  alternatePalettes: [CLASSIC_IVORY_PALETTE, CLASSIC_SAGE_PALETTE],
  fonts: {
    heading: "'Cormorant Garamond', 'Times New Roman', serif",
    body: "'Source Sans Pro', 'Helvetica Neue', sans-serif"
  },
  itemCard: {
    borderRadius: '0',
    shadow: 'none',
    imagePosition: 'none',
    showLeaderDots: true
  },
  pageBackground: '#faf8f5',
  fillerTileStyle: 'pattern'
}

/**
 * Simple Rows style - Clean and modern with small thumbnails
 */
const SIMPLE_ROWS_STYLE: TemplateStyle = {
  colors: SIMPLE_CLEAN_PALETTE,
  alternatePalettes: [SIMPLE_DARK_PALETTE],
  fonts: {
    heading: "'Inter', 'Helvetica Neue', sans-serif",
    body: "'Inter', 'Helvetica Neue', sans-serif"
  },
  itemCard: {
    borderRadius: '8px',
    shadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    imagePosition: 'left',
    imageBorderRadius: '6px'
  },
  fillerTileStyle: 'color'
}

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
  description: 'Photo-forward 4-column grid with circular images and gold accents',
  thumbnailUrl: '/templates/previews/classic-grid-cards.jpg',
  aspectRatio: 'A4_PORTRAIT',
  orientation: 'A4_PORTRAIT',
  layout: {
    baseCols: 4,
    baseRows: 5,
    tiles: [
      // Logo centered at top
      {
        id: 'logo-1',
        type: 'LOGO',
        col: 0,
        row: 0,
        colSpan: 4,
        rowSpan: 1,
        options: { align: 'centre' }
      },
      // Title below logo
      {
        id: 'title-1',
        type: 'TITLE',
        col: 0,
        row: 1,
        colSpan: 4,
        rowSpan: 1,
        options: { align: 'centre' }
      },
      // First row of items (4 items)
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
        col: 1,
        row: 2,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-3',
        type: 'ITEM',
        col: 2,
        row: 2,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-4',
        type: 'ITEM',
        col: 3,
        row: 2,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      // Second row of items (4 items)
      {
        id: 'item-5',
        type: 'ITEM',
        col: 0,
        row: 3,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-6',
        type: 'ITEM',
        col: 1,
        row: 3,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-7',
        type: 'ITEM',
        col: 2,
        row: 3,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-8',
        type: 'ITEM',
        col: 3,
        row: 3,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      // Third row of items (4 items)
      {
        id: 'item-9',
        type: 'ITEM',
        col: 0,
        row: 4,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-10',
        type: 'ITEM',
        col: 1,
        row: 4,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-11',
        type: 'ITEM',
        col: 2,
        row: 4,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-12',
        type: 'ITEM',
        col: 3,
        row: 4,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      }
    ],
    repeatPattern: {
      fromRow: 5,
      rowsPerRepeat: 1,
      repeatItemTileIds: ['item-13', 'item-14', 'item-15', 'item-16'],
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
    supportsLogoPlaceholder: true,
    supportsColourPalettes: true,
    supportsTextOnlyMode: true,
    supportsResponsiveWeb: true,
    autoFillerTiles: true
  },
  configurationSchema: {
    allowColourPalette: true,
    allowLogoUpload: true,
    allowImageToggle: true
  },
  style: ELEGANT_DARK_STYLE,
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
  description: 'Elegant text-focused 2-column layout with serif fonts and leader dots',
  thumbnailUrl: '/templates/previews/two-column-text.jpg',
  aspectRatio: 'A4_PORTRAIT',
  orientation: 'A4_PORTRAIT',
  layout: {
    baseCols: 2,
    baseRows: 11,
    tiles: [
      // Logo centered at top
      {
        id: 'logo-1',
        type: 'LOGO',
        col: 0,
        row: 0,
        colSpan: 2,
        rowSpan: 1,
        options: { align: 'centre' }
      },
      // Title below logo
      {
        id: 'title-1',
        type: 'TITLE',
        col: 0,
        row: 1,
        colSpan: 2,
        rowSpan: 1,
        options: { align: 'centre' }
      },
      // Section header for left column
      {
        id: 'section-header-1',
        type: 'SECTION_HEADER',
        col: 0,
        row: 2,
        colSpan: 1,
        rowSpan: 1,
        sectionSlot: 0
      },
      // Items in left column
      {
        id: 'item-1',
        type: 'ITEM_TEXT_ONLY',
        col: 0,
        row: 3,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      {
        id: 'item-2',
        type: 'ITEM_TEXT_ONLY',
        col: 0,
        row: 4,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      {
        id: 'item-3',
        type: 'ITEM_TEXT_ONLY',
        col: 0,
        row: 5,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      {
        id: 'item-4',
        type: 'ITEM_TEXT_ONLY',
        col: 0,
        row: 6,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      // Items in right column
      {
        id: 'item-5',
        type: 'ITEM_TEXT_ONLY',
        col: 1,
        row: 3,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      {
        id: 'item-6',
        type: 'ITEM_TEXT_ONLY',
        col: 1,
        row: 4,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      {
        id: 'item-7',
        type: 'ITEM_TEXT_ONLY',
        col: 1,
        row: 5,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      },
      {
        id: 'item-8',
        type: 'ITEM_TEXT_ONLY',
        col: 1,
        row: 6,
        colSpan: 1,
        rowSpan: 1,
        options: { showDescription: true }
      }
    ],
    repeatPattern: {
      fromRow: 7,
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
    supportsLogoPlaceholder: true,
    supportsColourPalettes: true,
    supportsTextOnlyMode: true,
    supportsResponsiveWeb: true,
    autoFillerTiles: false
  },
  configurationSchema: {
    allowColourPalette: true,
    allowLogoUpload: true,
    allowImageToggle: false
  },
  style: CLASSIC_ITALIAN_STYLE,
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
  description: 'Clean, modern single-column layout with small thumbnails',
  thumbnailUrl: '/templates/previews/simple-rows.jpg',
  aspectRatio: 'A4_PORTRAIT',
  orientation: 'A4_PORTRAIT',
  layout: {
    baseCols: 1,
    baseRows: 11,
    tiles: [
      // Logo centered at top
      {
        id: 'logo-1',
        type: 'LOGO',
        col: 0,
        row: 0,
        colSpan: 1,
        rowSpan: 1,
        options: { align: 'centre' }
      },
      // Title below logo
      {
        id: 'title-1',
        type: 'TITLE',
        col: 0,
        row: 1,
        colSpan: 1,
        rowSpan: 1,
        options: { align: 'centre' }
      },
      // Section header
      {
        id: 'section-header-1',
        type: 'SECTION_HEADER',
        col: 0,
        row: 2,
        colSpan: 1,
        rowSpan: 1,
        sectionSlot: 0
      },
      // Items in single column
      {
        id: 'item-1',
        type: 'ITEM',
        col: 0,
        row: 3,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-2',
        type: 'ITEM',
        col: 0,
        row: 4,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-3',
        type: 'ITEM',
        col: 0,
        row: 5,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-4',
        type: 'ITEM',
        col: 0,
        row: 6,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-5',
        type: 'ITEM',
        col: 0,
        row: 7,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-6',
        type: 'ITEM',
        col: 0,
        row: 8,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-7',
        type: 'ITEM',
        col: 0,
        row: 9,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      },
      {
        id: 'item-8',
        type: 'ITEM',
        col: 0,
        row: 10,
        colSpan: 1,
        rowSpan: 1,
        options: { showImage: true, showDescription: true }
      }
    ],
    repeatPattern: {
      fromRow: 11,
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
    supportsLogoPlaceholder: true,
    supportsColourPalettes: true,
    supportsTextOnlyMode: true,
    supportsResponsiveWeb: true,
    autoFillerTiles: false
  },
  configurationSchema: {
    allowColourPalette: true,
    allowLogoUpload: true,
    allowImageToggle: true
  },
  style: SIMPLE_ROWS_STYLE,
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
 * Returns all templates that are ready for production use.
 * Templates marked with `isPostMvp: true` are excluded.
 * 
 * @returns Array of production-ready MenuTemplate objects
 * 
 * @example
 * ```typescript
 * import { getMvpTemplates } from '@/lib/templates/template-definitions'
 * import { checkCompatibility } from '@/lib/templates/compatibility-checker'
 * 
 * // Get all templates and check compatibility
 * const templates = getMvpTemplates()
 * const compatibleTemplates = templates.map(template => ({
 *   template,
 *   compatibility: checkCompatibility(engineMenu, template)
 * }))
 * 
 * // Filter to only compatible templates
 * const usableTemplates = compatibleTemplates.filter(
 *   t => t.compatibility.status !== 'INCOMPATIBLE'
 * )
 * ```
 */
export function getMvpTemplates(): MenuTemplate[] {
  return Object.values(TEMPLATE_REGISTRY).filter(t => !t.isPostMvp)
}
