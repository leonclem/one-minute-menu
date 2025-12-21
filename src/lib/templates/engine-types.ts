/**
 * GridMenu Template Engine - Type Definitions
 * 
 * @module engine-types
 * @description
 * This module defines the core types for the GridMenu Template Engine.
 * The template engine transforms menu data combined with template definitions
 * into rendered layouts suitable for HTML viewing, PDF export, and image generation.
 * 
 * Key concepts:
 * - **MenuTemplate**: Declarative template definitions with grid layouts and constraints
 * - **TileDefinition**: Grid cell specifications that define content and position
 * - **GridLayoutDefinition**: Complete grid structures with optional repeat patterns
 * - **TemplateConstraints**: Rules defining template limitations (sections, items, etc.)
 * - **TemplateCapabilities**: Features supported by each template
 * - **LayoutInstance**: The output of the template engine (positioned tiles across pages)
 * 
 * @example
 * ```typescript
 * import type { MenuTemplate, LayoutInstance, EngineMenu } from '@/lib/templates/engine-types'
 * import { generateLayout } from '@/lib/templates/layout-engine'
 * 
 * const layout: LayoutInstance = generateLayout({
 *   menu: engineMenu,
 *   template: selectedTemplate
 * })
 * ```
 */

import { z } from 'zod'

// ============================================================================
// Template Identifiers and Enums
// ============================================================================

/**
 * Unique identifier for a template
 */
export type TemplateId = string

/**
 * Target page orientation for printed output
 * - A4_PORTRAIT: 210mm × 297mm (standard portrait)
 * - A4_LANDSCAPE: 297mm × 210mm (rotated landscape)
 */
export type PageOrientation = 'A4_PORTRAIT' | 'A4_LANDSCAPE'

/**
 * Hint for the intended aspect ratio of the template
 * Used for preview sizing and export format selection
 * - A4_PORTRAIT: Portrait A4 paper (210mm × 297mm)
 * - A4_LANDSCAPE: Landscape A4 paper (297mm × 210mm)
 * - SQUARE_1080: Square format for social media (1080×1080px)
 * - WEB_FULL: Full-width web view (responsive)
 */
export type AspectRatioHint = 'A4_PORTRAIT' | 'A4_LANDSCAPE' | 'SQUARE_1080' | 'WEB_FULL'

/**
 * Page type for layout logic
 * - FIRST: The very first page (index 0) of a multi-page menu
 * - CONTINUATION: Middle pages in a multi-page menu
 * - FINAL: The last page of a multi-page menu
 * - SINGLE: The only page of a single-page menu
 */
export type PageType = 'FIRST' | 'CONTINUATION' | 'FINAL' | 'SINGLE'

/**
 * Types of tiles that can appear in a grid layout
 * 
 * Content tiles:
 * - ITEM: Menu item with optional image
 * - ITEM_TEXT_ONLY: Menu item without image support
 * - SECTION_HEADER: Section/category name header
 * 
 * Static tiles:
 * - TITLE: Menu title (populated with menu.name)
 * - LOGO: Restaurant logo placeholder (MVP: text/icon only)
 * - TEXT_BLOCK: Venue info (address, etc.)
 * - IMAGE_DECORATION: Decorative image or pattern
 * - QR_CODE: Reserved for post-MVP QR code integration
 * 
 * Layout tiles:
 * - SPACER: Empty space for visual breathing room
 */
export type TileType =
  | 'ITEM'              // Menu item with optional image
  | 'ITEM_TEXT_ONLY'    // Menu item without image
  | 'SECTION_HEADER'    // Section name header
  | 'LOGO'              // Restaurant logo placeholder (MVP: text/icon only)
  | 'TITLE'             // Menu title
  | 'TEXT_BLOCK'        // Venue info (address, etc.)
  | 'IMAGE_DECORATION'  // Decorative image/pattern
  | 'SPACER'            // Empty space for breathing room
  | 'QR_CODE'           // Reserved for post-MVP; engine must not depend on this

/**
 * Result of checking template compatibility with a menu
 * - OK: Template works well with the menu
 * - WARNING: Template works but with caveats (e.g., missing images)
 * - INCOMPATIBLE: Template cannot handle the menu (e.g., too many items)
 */
export type CompatibilityStatus = 'OK' | 'WARNING' | 'INCOMPATIBLE'

// ============================================================================
// Tile Definitions
// ============================================================================

/**
 * Definition of a single tile in a grid layout
 * 
 * Tiles are the building blocks of templates. Each tile occupies a rectangular
 * region in the grid and can contain menu items, section headers, static content,
 * or decorative elements.
 * 
 * @example
 * ```typescript
 * const itemTile: TileDefinition = {
 *   id: 'item-1',
 *   type: 'ITEM',
 *   col: 0,
 *   row: 1,
 *   colSpan: 1,
 *   rowSpan: 1,
 *   options: { showImage: true, showDescription: true }
 * }
 * ```
 */
export interface TileDefinition {
  /** Unique identifier for the tile within the template */
  id: string
  /** Type of content this tile will contain */
  type: TileType
  /** 0-based column index (left-to-right) */
  col: number
  /** 0-based row index (top-to-bottom) */
  row: number
  /** Width in grid columns */
  colSpan: number
  /** Height in grid rows */
  rowSpan: number
  /** For templates with fixed section regions (maps to menu section index) */
  sectionSlot?: number
  /** Presentation options for the tile */
  options?: {
    /** Whether to display item images (ITEM tiles only) */
    showImage?: boolean
    /** Whether to display item descriptions */
    showDescription?: boolean
    /** Whether to visually emphasise the price */
    emphasisePrice?: boolean
    /** Text alignment within the tile */
    align?: 'left' | 'centre' | 'right'
    /** Variant name for decorative tiles */
    decorativeVariant?: string
    /** Whether to style as a hero/featured item */
    emphasiseAsHero?: boolean
    /** Conditional visibility rules */
    visibility?: {
      /** Only show on these page types */
      showOn?: PageType[]
      /** Hide on these page types */
      hideOn?: PageType[]
    }
  }
}

// Zod schema for TileDefinition
export const TileDefinitionSchema = z.object({
  id: z.string(),
  type: z.enum(['ITEM', 'ITEM_TEXT_ONLY', 'SECTION_HEADER', 'LOGO', 'TITLE', 'TEXT_BLOCK', 'IMAGE_DECORATION', 'SPACER', 'QR_CODE']),
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
  colSpan: z.number().int().positive(),
  rowSpan: z.number().int().positive(),
  sectionSlot: z.number().int().nonnegative().optional(),
  options: z.object({
    showImage: z.boolean().optional(),
    showDescription: z.boolean().optional(),
    emphasisePrice: z.boolean().optional(),
    align: z.enum(['left', 'centre', 'right']).optional(),
    decorativeVariant: z.string().optional(),
    emphasiseAsHero: z.boolean().optional(),
    visibility: z.object({
      showOn: z.array(z.enum(['FIRST', 'CONTINUATION', 'FINAL', 'SINGLE'])).optional(),
      hideOn: z.array(z.enum(['FIRST', 'CONTINUATION', 'FINAL', 'SINGLE'])).optional()
    }).optional()
  }).optional()
})

// ============================================================================
// Grid Layout Definition
// ============================================================================

/**
 * Configuration for repeating tile patterns
 * 
 * Templates use repeat patterns to scale vertically for larger menus.
 * When menu items exceed the base layout capacity, the engine adds
 * repeated blocks of tiles to accommodate additional items.
 * 
 * @example
 * ```typescript
 * const repeatPattern: RepeatPatternConfig = {
 *   fromRow: 4,              // Start repeating after row 4
 *   rowsPerRepeat: 1,        // Each repeat adds 1 row
 *   repeatItemTileIds: ['item-10', 'item-11', 'item-12'],
 *   maxRepeats: 10,          // Maximum 10 repeats (30 more items)
 *   newPagePerRepeat: false  // All on same page
 * }
 * ```
 */
export interface RepeatPatternConfig {
  /** Row index where repeating begins (0-based) */
  fromRow: number
  /** Height of one repeat block in rows */
  rowsPerRepeat: number
  /** IDs of ITEM tiles in each repeat block */
  repeatItemTileIds: string[]
  /** Optional ID of a SECTION_HEADER tile in the repeat block */
  repeatSectionHeaderTileId?: string
  /** Maximum number of repeats (safety limit) */
  maxRepeats: number
  /** If true, each repeat starts a new page */
  newPagePerRepeat?: boolean
}

/** Zod schema for validating RepeatPatternConfig */
export const RepeatPatternConfigSchema = z.object({
  fromRow: z.number().int().nonnegative(),
  rowsPerRepeat: z.number().int().positive(),
  repeatItemTileIds: z.array(z.string()),
  repeatSectionHeaderTileId: z.string().optional(),
  maxRepeats: z.number().int().positive(),
  newPagePerRepeat: z.boolean().optional()
})

/**
 * Complete definition of a grid layout
 * 
 * A grid layout specifies the base grid dimensions, all tile definitions,
 * and an optional repeat pattern for scaling to larger menus.
 * 
 * @example
 * ```typescript
 * const layout: GridLayoutDefinition = {
 *   baseCols: 3,
 *   baseRows: 4,
 *   tiles: [titleTile, ...itemTiles],
 *   repeatPattern: { fromRow: 4, rowsPerRepeat: 1, ... }
 * }
 * ```
 */
export interface GridLayoutDefinition {
  /** Number of columns in the grid */
  baseCols: number
  /** Number of rows in the base layout (before repeats) */
  baseRows: number
  /** Array of tile definitions in the base layout */
  tiles: TileDefinition[]
  /** Optional pattern for expanding layout vertically */
  repeatPattern?: RepeatPatternConfig
}

export const GridLayoutDefinitionSchema = z.object({
  baseCols: z.number().int().positive(),
  baseRows: z.number().int().positive(),
  tiles: z.array(TileDefinitionSchema),
  repeatPattern: RepeatPatternConfigSchema.optional()
})

// ============================================================================
// Template Constraints and Capabilities
// ============================================================================

/**
 * Rules defining template limitations
 * 
 * Constraints are used by the compatibility checker to determine whether
 * a template can handle a given menu. If any constraint is violated,
 * the template is marked as INCOMPATIBLE.
 * 
 * @example
 * ```typescript
 * const constraints: TemplateConstraints = {
 *   minSections: 1,
 *   maxSections: 'unbounded',
 *   minItems: 3,
 *   hardMaxItems: 150
 * }
 * ```
 */
export interface TemplateConstraints {
  /** Minimum number of menu sections required */
  minSections: number
  /** Maximum sections allowed, or 'unbounded' for no limit */
  maxSections: number | 'unbounded'
  /** Minimum number of menu items required */
  minItems: number
  /** Optional limit on items per page (for multi-page templates) */
  maxItemsPerPage?: number
  /** Absolute maximum items supported (default: 150 from global config) */
  hardMaxItems?: number
  /** If true, template requires item images to work well */
  requiresImages?: boolean
}

/** Zod schema for validating TemplateConstraints */
export const TemplateConstraintsSchema = z.object({
  minSections: z.number().int().positive(),
  maxSections: z.union([z.number().int().positive(), z.literal('unbounded')]),
  minItems: z.number().int().positive(),
  maxItemsPerPage: z.number().int().positive().optional(),
  hardMaxItems: z.number().int().positive().optional(),
  requiresImages: z.boolean().optional()
})

/**
 * Features supported by a template
 * 
 * Capabilities indicate what features are available for a template.
 * These are displayed as badges in the template selection UI and
 * influence how the template is rendered.
 * 
 * @example
 * ```typescript
 * const capabilities: TemplateCapabilities = {
 *   supportsImages: true,
 *   supportsLogoPlaceholder: false,
 *   supportsColourPalettes: false,
 *   supportsTextOnlyMode: true,
 *   supportsResponsiveWeb: true,
 *   autoFillerTiles: false
 * }
 * ```
 */
export interface TemplateCapabilities {
  /** Whether the template can display item images */
  supportsImages: boolean
  /** Whether the template has a logo placeholder area */
  supportsLogoPlaceholder: boolean
  /** Whether the template supports custom colour palettes */
  supportsColourPalettes: boolean
  /** Whether the template can render without images */
  supportsTextOnlyMode: boolean
  /** Whether the template works well on responsive web */
  supportsResponsiveWeb: boolean
  /** If true, engine automatically inserts SPACER tiles in empty cells */
  autoFillerTiles: boolean
}

/** Zod schema for validating TemplateCapabilities */
export const TemplateCapabilitiesSchema = z.object({
  supportsImages: z.boolean(),
  supportsLogoPlaceholder: z.boolean(),
  supportsColourPalettes: z.boolean(),
  supportsTextOnlyMode: z.boolean(),
  supportsResponsiveWeb: z.boolean(),
  autoFillerTiles: z.boolean()
})

/**
 * Schema defining what configuration options users can set for a template
 * 
 * This controls which customisation options appear in the template selection UI.
 */
export interface TemplateConfigurationSchema {
  /** Whether users can select a custom colour palette */
  allowColourPalette?: boolean
  /** Whether users can upload a logo */
  allowLogoUpload?: boolean
  /** Whether users can toggle images on/off */
  allowImageToggle?: boolean
}

export const TemplateConfigurationSchemaSchema = z.object({
  allowColourPalette: z.boolean().optional(),
  allowLogoUpload: z.boolean().optional(),
  allowImageToggle: z.boolean().optional()
})

// ============================================================================
// Template Style (Visual Styling)
// ============================================================================

/**
 * Color palette for a template
 * 
 * Defines all colors used in a template's visual appearance.
 * Templates can have multiple palettes that users can swap between.
 * 
 * @example
 * ```typescript
 * const darkPalette: TemplateColorPalette = {
 *   id: 'elegant-dark',
 *   name: 'Elegant Dark',
 *   background: '#1a1f2e',
 *   text: '#ffffff',
 *   heading: '#c9a227',
 *   price: '#c9a227',
 *   accent: '#c9a227',
 *   cardBackground: '#252a3a'
 * }
 * ```
 */
export interface TemplateColorPalette {
  /** Unique identifier for this palette */
  id: string
  /** Display name for palette selection UI */
  name: string
  /** Page/container background color */
  background: string
  /** Primary text color */
  text: string
  /** Section header text color */
  heading: string
  /** Price text color */
  price: string
  /** Accent color for decorations, borders, highlights */
  accent: string
  /** Background color for item cards */
  cardBackground: string
}

/** Zod schema for TemplateColorPalette */
export const TemplateColorPaletteSchema = z.object({
  id: z.string(),
  name: z.string(),
  background: z.string(),
  text: z.string(),
  heading: z.string(),
  price: z.string(),
  accent: z.string(),
  cardBackground: z.string()
})

/**
 * Item card styling configuration
 * 
 * Defines how menu item cards are visually presented.
 */
export interface TemplateItemCardStyle {
  /** Border radius for cards (e.g., '0', '8px', '50%' for circular) */
  borderRadius: string
  /** Box shadow for cards (CSS box-shadow value) */
  shadow: string
  /** Position of item image relative to content */
  imagePosition: 'top' | 'left' | 'circle' | 'background' | 'none'
  /** Border radius for images (e.g., '0', '8px', '50%') */
  imageBorderRadius?: string
  /** Whether to show leader dots between name and price (text-only templates) */
  showLeaderDots?: boolean
}

/** Zod schema for TemplateItemCardStyle */
export const TemplateItemCardStyleSchema = z.object({
  borderRadius: z.string(),
  shadow: z.string(),
  imagePosition: z.enum(['top', 'left', 'circle', 'background', 'none']),
  imageBorderRadius: z.string().optional(),
  showLeaderDots: z.boolean().optional()
})

/**
 * Complete visual style definition for a template
 * 
 * Contains all styling information needed to render a template,
 * including colors, fonts, item card treatments, and background.
 * 
 * @example
 * ```typescript
 * const elegantDarkStyle: TemplateStyle = {
 *   colors: darkPalette,
 *   alternatePalettes: [lightPalette, warmPalette],
 *   fonts: {
 *     heading: 'Playfair Display, serif',
 *     body: 'Lato, sans-serif'
 *   },
 *   itemCard: {
 *     borderRadius: '8px',
 *     shadow: '0 2px 8px rgba(0,0,0,0.15)',
 *     imagePosition: 'circle'
 *   },
 *   fillerTileStyle: 'icon'
 * }
 * ```
 */
export interface TemplateStyle {
  /** Default color palette for this template */
  colors: TemplateColorPalette
  /** Additional palettes users can switch to */
  alternatePalettes?: TemplateColorPalette[]
  /** Font families for headings and body text */
  fonts: {
    /** Font for section headers and titles (e.g., 'Playfair Display, serif') */
    heading: string
    /** Font for item names, descriptions, prices (e.g., 'Lato, sans-serif') */
    body: string
  }
  /** Visual styling for menu item cards */
  itemCard: TemplateItemCardStyle
  /** Optional background (color, gradient, or image URL) */
  pageBackground?: string
  /** Style for auto-generated filler tiles */
  fillerTileStyle?: 'icon' | 'pattern' | 'color'
}

/** Zod schema for TemplateStyle */
export const TemplateStyleSchema = z.object({
  colors: TemplateColorPaletteSchema,
  alternatePalettes: z.array(TemplateColorPaletteSchema).optional(),
  fonts: z.object({
    heading: z.string(),
    body: z.string()
  }),
  itemCard: TemplateItemCardStyleSchema,
  pageBackground: z.string().optional(),
  fillerTileStyle: z.enum(['icon', 'pattern', 'color']).optional()
})

// ============================================================================
// Menu Template
// ============================================================================

/**
 * Complete definition of a menu template
 * 
 * A MenuTemplate is a declarative specification that tells the layout engine
 * how to arrange menu data into a visual layout. Templates are designed to
 * be self-contained and immutable - all the information needed to render a
 * menu is contained within the template definition.
 * 
 * @example
 * ```typescript
 * const template: MenuTemplate = {
 *   id: 'classic-grid-cards',
 *   name: 'Classic Grid Cards',
 *   description: 'Photo-forward 3-column grid layout',
 *   thumbnailUrl: '/templates/previews/classic-grid-cards.jpg',
 *   aspectRatio: 'A4_PORTRAIT',
 *   orientation: 'A4_PORTRAIT',
 *   layout: gridLayoutDefinition,
 *   constraints: templateConstraints,
 *   capabilities: templateCapabilities,
 *   configurationSchema: { allowImageToggle: true },
 *   version: '1.0.0'
 * }
 * ```
 */
export interface MenuTemplate {
  /** Unique identifier for the template */
  id: TemplateId
  /** Display name shown in UI */
  name: string
  /** Brief description of the template style */
  description: string
  /** URL to preview thumbnail image */
  thumbnailUrl: string
  /** Aspect ratio hint for preview sizing */
  aspectRatio: AspectRatioHint
  /** Target page orientation for print */
  orientation: PageOrientation
  /** Grid layout definition with tiles and repeat pattern */
  layout: GridLayoutDefinition
  /** Constraints for menu compatibility checking */
  constraints: TemplateConstraints
  /** Feature capabilities of this template */
  capabilities: TemplateCapabilities
  /** Configuration options available to users */
  configurationSchema: TemplateConfigurationSchema
  /** Visual styling (colors, fonts, card treatments) */
  style: TemplateStyle
  /** Strategy for balancing orphan items on the last row */
  balancingStrategy?: 'left' | 'center' | 'center-balanced'
  /** Semantic version string (e.g., '1.0.0') */
  version: string
  /** If true, template is hidden from /available endpoint (development only) */
  isPostMvp?: boolean
}

export const MenuTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  thumbnailUrl: z.string().min(1),
  aspectRatio: z.enum(['A4_PORTRAIT', 'A4_LANDSCAPE', 'SQUARE_1080', 'WEB_FULL']),
  orientation: z.enum(['A4_PORTRAIT', 'A4_LANDSCAPE']),
  layout: GridLayoutDefinitionSchema,
  constraints: TemplateConstraintsSchema,
  capabilities: TemplateCapabilitiesSchema,
  configurationSchema: TemplateConfigurationSchemaSchema.optional(),
  style: TemplateStyleSchema,
  balancingStrategy: z.enum(['left', 'center', 'center-balanced']).optional(),
  version: z.string(),
  isPostMvp: z.boolean().optional()
})

// ============================================================================
// Layout Instance (Output)
// ============================================================================

/**
 * The complete output of the layout engine
 * 
 * A LayoutInstance represents a fully computed layout ready for rendering.
 * It contains all pages with positioned tiles, and includes metadata about
 * the template used to generate it.
 * 
 * @example
 * ```typescript
 * const layout: LayoutInstance = generateLayout({ menu, template })
 * console.log(`Generated ${layout.pages.length} page(s)`)
 * ```
 */
export interface LayoutInstance {
  /** ID of the template used to generate this layout */
  templateId: TemplateId
  /** Version of the template used */
  templateVersion: string
  /** Page orientation for rendering */
  orientation: PageOrientation
  /** Array of pages, each containing positioned tiles */
  pages: PageLayout[]
}

/**
 * A single page in a layout instance
 * 
 * Each page contains an array of positioned tiles that should be
 * rendered together. Multi-page layouts are created when templates
 * use `newPagePerRepeat: true` in their repeat pattern.
 */
export interface PageLayout {
  /** Zero-based page index */
  pageIndex: number
  /** Type of page in the sequence */
  type: PageType
  /** Array of tiles positioned on this page */
  tiles: TileContentInstance[]
}

/**
 * Union type of all possible tile content instances
 * 
 * After layout generation, tiles are converted from TileDefinition
 * to TileContentInstance with actual content filled in.
 */
export type TileContentInstance =
  | StaticTileInstance
  | SectionHeaderTileInstance
  | MenuItemTileInstance
  | SpacerTileInstance

/**
 * Base interface for all tile instances
 * 
 * Contains common positioning properties shared by all tile types.
 */
export interface BaseTileInstance {
  /** Unique identifier for this tile instance */
  id: string
  /** Type of tile */
  type: TileType
  /** Column position (0-based) */
  col: number
  /** Row position (0-based) */
  row: number
  /** Width in grid columns */
  colSpan: number
  /** Height in grid rows */
  rowSpan: number
}

/**
 * Instance of a static content tile
 * 
 * Static tiles display fixed content like the menu title, logo,
 * venue address, or decorative elements.
 */
export interface StaticTileInstance extends BaseTileInstance {
  type: 'TITLE' | 'LOGO' | 'TEXT_BLOCK' | 'IMAGE_DECORATION' | 'QR_CODE'
  /** Text content to display */
  content: string
  /** Optional logo URL for LOGO tiles */
  logoUrl?: string
  /** Presentation options */
  options?: TileDefinition['options']
}

/**
 * Instance of a section header tile
 * 
 * Section headers display category names in the menu.
 */
export interface SectionHeaderTileInstance extends BaseTileInstance {
  type: 'SECTION_HEADER'
  /** Section name to display */
  label: string
  /** ID of the menu section this header represents */
  sectionId: string
  /** Presentation options */
  options?: TileDefinition['options']
}

/**
 * Instance of a menu item tile
 * 
 * Menu item tiles display individual dishes/products from the menu,
 * including name, description, price, and optionally an image.
 */
export interface MenuItemTileInstance extends BaseTileInstance {
  type: 'ITEM' | 'ITEM_TEXT_ONLY'
  /** ID of the menu item */
  itemId: string
  /** ID of the section this item belongs to */
  sectionId: string
  /** Item name/title */
  name: string
  /** Item description (optional) */
  description?: string
  /** Item price */
  price: number
  /** URL to item image (if available and should be shown) */
  imageUrl?: string
  /** Whether to render the image */
  showImage: boolean
  /** Presentation options */
  options?: TileDefinition['options']
}

/**
 * Instance of a spacer/filler tile
 * 
 * Spacer tiles fill empty cells in the grid to maintain
 * visual balance. They are automatically inserted when
 * `autoFillerTiles` is enabled.
 */
export interface SpacerTileInstance extends BaseTileInstance {
  type: 'SPACER'
  /** Background colour for the spacer */
  backgroundColor?: string
  /** Presentation options */
  options?: TileDefinition['options']
}

// ============================================================================
// Compatibility Result
// ============================================================================

/**
 * Result of checking template compatibility with a menu
 * 
 * The compatibility checker returns this result indicating whether
 * a template can handle a given menu, along with any warnings or
 * the reason for incompatibility.
 * 
 * @example
 * ```typescript
 * const result = checkCompatibility(menu, template)
 * if (result.status === 'INCOMPATIBLE') {
 *   console.log(`Cannot use template: ${result.message}`)
 * }
 * ```
 */
export interface CompatibilityResult {
  /** Overall compatibility status */
  status: CompatibilityStatus
  /** Explanation when status is INCOMPATIBLE */
  message?: string
  /** Array of warning messages (when status is WARNING) */
  warnings: string[]
}

// ============================================================================
// Template Selection
// ============================================================================

/**
 * Saved template selection for a menu
 * 
 * When a user selects a template and saves their selection,
 * this record is created to persist their choice and configuration.
 */
export interface MenuTemplateSelection {
  /** Unique identifier for the selection record */
  id: string
  /** ID of the menu this selection applies to */
  menuId: string
  /** ID of the selected template */
  templateId: string
  /** Version of the template at time of selection */
  templateVersion: string
  /** User configuration options */
  configuration: {
    /** Whether to render without images */
    textOnly: boolean
    /** Optional custom colour palette ID */
    colourPaletteId?: string
    /** Whether to include logo */
    useLogo: boolean
  }
  /** When the selection was created */
  createdAt: Date
  /** When the selection was last updated */
  updatedAt: Date
}

// ============================================================================
// Layout Engine Input
// ============================================================================

/**
 * Input parameters for the layout engine
 * 
 * @example
 * ```typescript
 * const input: LayoutEngineInput = {
 *   menu: engineMenu,
 *   template: selectedTemplate,
 *   selection: savedSelection  // Optional
 * }
 * const layout = generateLayout(input)
 * ```
 */
export interface LayoutEngineInput {
  /** Normalized menu data */
  menu: EngineMenu
  /** Template to use for layout generation */
  template: MenuTemplate
  /** Optional saved selection with user configuration */
  selection?: MenuTemplateSelection
}

// ============================================================================
// Engine Menu (Normalized Menu Data)
// ============================================================================

/**
 * Normalized menu structure for the template engine
 * 
 * The layout engine works with this normalized format rather than
 * the raw database Menu type. Use `toEngineMenu()` to convert a
 * database menu to this format.
 * 
 * @see {@link toEngineMenu} for conversion from database Menu
 * 
 * @example
 * ```typescript
 * const engineMenu: EngineMenu = toEngineMenu(databaseMenu)
 * ```
 */
export interface EngineMenu {
  /** Unique identifier for the menu */
  id: string
  /** Menu name/title */
  name: string
  /** Array of menu sections (categories) */
  sections: EngineSection[]
  /** Menu metadata */
  metadata: {
    /** Currency symbol for prices */
    currency: string
    /** Venue/restaurant name */
    venueName?: string
    /** Venue address */
    venueAddress?: string
    /** Optional logo URL for branding */
    logoUrl?: string
  }
}

/**
 * Normalized menu section (category)
 * 
 * Sections group related menu items together, like "Starters",
 * "Main Courses", "Desserts", etc.
 */
export interface EngineSection {
  /** Unique identifier for the section */
  id: string
  /** Section name (displayed as header) */
  name: string
  /** Sort order for section ordering */
  sortOrder: number
  /** Array of items in this section */
  items: EngineItem[]
}

/**
 * Normalized menu item
 * 
 * Represents a single dish or product on the menu.
 */
export interface EngineItem {
  /** Unique identifier for the item */
  id: string
  /** Item name/title */
  name: string
  /** Item description (optional) */
  description?: string
  /** Item price */
  price: number
  /** URL to item image (optional) */
  imageUrl?: string
  /** Sort order for item ordering within section */
  sortOrder: number
}

export const EngineItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  imageUrl: z.string().optional(),
  sortOrder: z.number()
})

export const EngineSectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number(),
  items: z.array(EngineItemSchema)
})

export const EngineMenuSchema = z.object({
  id: z.string(),
  name: z.string(),
  sections: z.array(EngineSectionSchema),
  metadata: z.object({
    currency: z.string(),
    venueName: z.string().optional(),
    venueAddress: z.string().optional(),
    logoUrl: z.string().optional()
  })
})
