// Template System Type Definitions
// This file contains all type definitions for the Menu Template System

import type { MenuItemV2, CategoryV2 } from '@/lib/extraction/schema-stage2'

// ============================================================================
// Template Metadata and Configuration
// ============================================================================

export type PageFormat = 'A4' | 'US_LETTER' | 'TABLOID' | 'DIGITAL'
export type Orientation = 'portrait' | 'landscape'
export type PriceDisplayMode = 'symbol' | 'amount-only'

export interface TemplateMetadata {
  id: string
  name: string
  description: string
  author: string
  version: string
  previewImageUrl: string
  thumbnailUrl: string
  figmaFileKey: string
  pageFormat: PageFormat
  orientation: Orientation
  tags: string[]
  isPremium: boolean
  createdAt: Date
  updatedAt: Date
}

export interface TemplateConfig {
  metadata: TemplateMetadata
  bindings: TemplateBindings
  styling: TemplateStyling
  customization: CustomizationOptions
}

// ============================================================================
// Template Bindings
// ============================================================================

export interface TemplateBindings {
  // Required bindings
  restaurantName: string // Layer name for {{restaurant.name}}
  categoryName: string // Layer name for {{category.name}}
  categoryItems: string // Container layer for {{category.items}}
  itemName: string // Layer name for {{item.name}}
  
  // Optional bindings
  itemPrice?: string // Layer name for {{item.price}}
  itemDescription?: string // Layer name for {{item.description}}
  itemIcon?: string // Layer name for {{item.image_icon}}
  itemDietaryTags?: string // Layer name for {{item.dietaryTags}}
  itemAllergens?: string // Layer name for {{item.allergens}}
  itemVariants?: string // Container layer for {{item.variants}}
  
  // Conditional rendering rules
  conditionalLayers: ConditionalLayer[]
}

export interface ConditionalLayer {
  layerName: string
  condition: 'hasPrice' | 'hasDescription' | 'hasIcon' | 'hasDietaryTags' | 'hasAllergens' | 'hasVariants'
  action: 'show' | 'hide'
}

// ============================================================================
// Template Styling
// ============================================================================

export interface TemplateStyling {
  fonts: FontDefinition[]
  colors: ColorDefinition[]
  spacing: SpacingDefinition
}

export interface FontDefinition {
  role: string // e.g., 'heading', 'body', 'price'
  family: string
  size: string
  weight: string
  lineHeight?: string
}

export interface ColorDefinition {
  role: string // e.g., 'primary', 'secondary', 'text'
  value: string // Hex color code
}

export interface SpacingDefinition {
  itemSpacing: number
  categorySpacing: number
  padding: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

// ============================================================================
// Template Customization
// ============================================================================

export interface CustomizationOptions {
  allowColorCustomization: boolean
  allowFontCustomization: boolean
  customizableColors: string[] // Color role names
  customizableFonts: string[] // Font role names
}

export interface UserCustomization {
  colors?: {
    primary?: string
    secondary?: string
    accent?: string
    [key: string]: string | undefined
  }
  fonts?: {
    heading?: string
    body?: string
    [key: string]: string | undefined
  }
  priceDisplayMode?: PriceDisplayMode
}

// ============================================================================
// Figma Parsing Types
// ============================================================================

export interface FigmaNode {
  id: string
  name: string
  type: string
  children?: FigmaNode[]
  styles: NodeStyles
  layout: LayoutProperties
}

export interface NodeStyles {
  fills: Fill[]
  strokes: Stroke[]
  effects: Effect[]
  typography?: TypographyStyle
}

export interface Fill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE'
  color?: { r: number; g: number; b: number; a: number }
  opacity?: number
}

export interface Stroke {
  type: 'SOLID'
  color: { r: number; g: number; b: number; a: number }
  weight: number
}

export interface Effect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR'
  radius: number
  offset?: { x: number; y: number }
  color?: { r: number; g: number; b: number; a: number }
}

export interface TypographyStyle {
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
  letterSpacing?: number
  textAlign?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH'
}

export interface LayoutProperties {
  layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  primaryAxisSizingMode: 'FIXED' | 'AUTO'
  counterAxisSizingMode: 'FIXED' | 'AUTO'
  paddingLeft: number
  paddingRight: number
  paddingTop: number
  paddingBottom: number
  itemSpacing: number
  counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX'
  primaryAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
}

export interface ParsedTemplate {
  structure: FigmaNode
  bindings: TemplateBindings
  styles: ComputedStyles
  assets: TemplateAssets
}

export interface ComputedStyles {
  css: string
  fonts: string[]
  colors: Record<string, string>
}

export interface TemplateAssets {
  images: AssetImage[]
  fonts: AssetFont[]
}

export interface AssetImage {
  id: string
  url: string
  width: number
  height: number
}

export interface AssetFont {
  family: string
  url: string
  weight: string
  style: string
}

// ============================================================================
// Data Binding Types
// ============================================================================

export interface BindingContext {
  menu: {
    restaurantName?: string
    categories: CategoryV2[]
  }
  template: TemplateConfig
  customization?: UserCustomization
}

export interface BoundData {
  restaurantName?: string
  categoryBindings: CategoryBinding[]
  globalStyles: GlobalStyles
}

export interface CategoryBinding {
  categoryName: string
  items: ItemBinding[]
  subcategories?: CategoryBinding[]
}

export interface ItemBinding {
  name: string
  price?: string // Formatted with currency
  description?: string
  icon?: string // URL or data URI
  dietaryTags?: DietaryTag[]
  allergens?: string[]
  variants?: VariantBinding[]
  
  // Conditional visibility flags
  showPrice: boolean
  showDescription: boolean
  showIcon: boolean
  showDietaryTags: boolean
  showAllergens: boolean
  showVariants: boolean
}

export interface DietaryTag {
  type: 'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free' | 'nut-free' | 'halal' | 'kosher'
  label: string
  icon?: string
}

export interface VariantBinding {
  label: string
  price: string // Formatted with currency
}

export interface GlobalStyles {
  colors: Record<string, string>
  fonts: Record<string, string>
  spacing: SpacingDefinition
}

export interface ConditionalState {
  hasPrice: boolean
  hasDescription: boolean
  hasIcon: boolean
  hasDietaryTags: boolean
  hasAllergens: boolean
  hasVariants: boolean
}

// ============================================================================
// Rendering Types
// ============================================================================

export type RenderFormat = 'html' | 'pdf' | 'png'
export type RenderQuality = 'draft' | 'standard' | 'high'

export interface RenderOptions {
  format: RenderFormat
  quality?: RenderQuality
  includeStyles?: boolean
  embedFonts?: boolean
}

export interface RenderResult {
  html: string
  css: string
  assets: Asset[]
  metadata: RenderMetadata
}

export interface Asset {
  type: 'image' | 'font'
  url: string
  embedded: boolean
}

export interface RenderMetadata {
  templateId: string
  templateVersion: string
  renderedAt: Date
  itemCount: number
  categoryCount: number
  estimatedPrintSize: string
}

// ============================================================================
// Export Types
// ============================================================================

export type ExportFormat = 'pdf' | 'png' | 'html'
export type PageSize = 'A4' | 'US_LETTER' | 'TABLOID'

export interface ExportOptions {
  format: ExportFormat
  filename: string
  pageSize?: PageSize
  dpi?: number
  includeBleed?: boolean
}

export interface ExportResult {
  url: string // Supabase Storage URL (signed)
  filename: string
  fileSize: number
  format: ExportFormat
  createdAt: Date
}

export interface ExportJob {
  id: string
  userId: string
  menuId: string
  templateId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  format: ExportFormat
  options: ExportOptions
  result?: ExportResult
  errorMessage?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

// ============================================================================
// Database Types
// ============================================================================

export interface TemplateRender {
  id: string
  userId: string
  menuId: string
  templateId: string
  renderData: RenderResult
  customization?: UserCustomization
  format: RenderFormat
  outputUrl?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage?: string
  createdAt: Date
  completedAt?: Date
}

export interface UserTemplatePreference {
  id: string
  userId: string
  menuId: string
  templateId: string
  customization: UserCustomization
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// Validation and Error Types
// ============================================================================

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationWarning {
  field: string
  message: string
  code: string
}

export interface PreflightCheck {
  passed: boolean
  warnings: PreflightWarning[]
  errors: PreflightError[]
}

export interface PreflightWarning {
  type: 'missing_price' | 'empty_category' | 'low_confidence'
  message: string
  itemId?: string
  categoryId?: string
}

export interface PreflightError {
  type: 'no_categories' | 'invalid_data' | 'template_not_found'
  message: string
}

// ============================================================================
// Template Registry Types
// ============================================================================

export interface TemplateFilters {
  tags?: string[]
  pageFormat?: PageFormat
  orientation?: Orientation
  isPremium?: boolean
  searchQuery?: string
}

export interface TemplateListResult {
  templates: TemplateMetadata[]
  total: number
  page: number
  pageSize: number
}

// ============================================================================
// Performance Monitoring Types
// ============================================================================

export interface PerformanceMetrics {
  templateLoadTime: number
  bindingTime: number
  renderTime: number
  exportTime?: number
  totalTime: number
  itemCount: number
  categoryCount: number
}

// ============================================================================
// Currency Support Types
// ============================================================================

export type SupportedCurrency = 'SGD' | 'USD' | 'GBP' | 'EUR' | 'AUD'

export interface CurrencyConfig {
  code: SupportedCurrency
  symbol: string
  locale: string
}

export const SUPPORTED_CURRENCIES: Record<SupportedCurrency, CurrencyConfig> = {
  SGD: { code: 'SGD', symbol: 'S$', locale: 'en-SG' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB' },
  EUR: { code: 'EUR', symbol: '€', locale: 'en-EU' },
  AUD: { code: 'AUD', symbol: 'A$', locale: 'en-AU' },
}

// ============================================================================
// Re-export extraction types for convenience
// ============================================================================

export type { MenuItemV2, CategoryV2 }
