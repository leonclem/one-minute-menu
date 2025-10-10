/**
 * Template System Type Definitions
 * 
 * This module defines the core TypeScript interfaces for the template system.
 * Templates are declarative configurations that define layout, typography, and
 * rendering behavior for menu designs.
 */

/**
 * Canvas configuration defining the physical dimensions and layout grid
 */
export interface CanvasConfig {
  /** Paper size for print output */
  size: 'A4' | 'A3';
  /** Resolution in dots per inch */
  dpi: 300 | 600;
  /** Number of columns in the layout grid */
  cols: number;
  /** Spacing between columns in pixels */
  gutter: number;
  /** Page margins in pixels */
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /** Optional bleed area for professional printing */
  bleed?: number;
}

/**
 * Background layer configuration
 */
export interface BackgroundLayer {
  /** Type of background */
  type: 'raster' | 'solid';
  /** Reference image path for AI generation guidance */
  src?: string;
  /** Fallback solid color (hex format) */
  color?: string;
  /** Blend mode for compositing */
  blend?: 'normal' | 'multiply' | 'overlay';
}

/**
 * Decorative ornament configuration
 */
export interface Ornament {
  /** Type of ornament asset */
  type: 'svg' | 'raster';
  /** Path to ornament asset */
  src: string;
  /** Position on canvas */
  position: {
    x: number;
    y: number;
  };
}

/**
 * Layer configuration for backgrounds and ornaments
 */
export interface LayerConfig {
  /** Background layer configuration */
  background: BackgroundLayer;
  /** Optional decorative ornaments */
  ornaments?: Ornament[];
}

/**
 * Font specification with size constraints
 */
export interface FontSpec {
  /** Font family name (Google Fonts) */
  family: string;
  /** Font weight (100-900) */
  weight?: number;
  /** Minimum font size in pixels */
  min: number;
  /** Maximum font size in pixels */
  max: number;
  /** Use tabular numerals for alignment */
  tabular?: boolean;
}

/**
 * Font configuration for different text types
 */
export interface FontConfig {
  /** Font for headings and section titles */
  heading: FontSpec;
  /** Font for body text and descriptions */
  body: FontSpec;
  /** Font for prices */
  price: FontSpec;
}

/**
 * Text frame defining a content area in the layout
 */
export interface TextFrame {
  /** Unique identifier for this frame */
  key: string;
  /** Column number (1-indexed) */
  col: number;
  /** Overflow policies to apply in order */
  overflow: OverflowPolicy[];
}

/**
 * Overflow policy strategies for content fitting
 */
export type OverflowPolicy = 
  | 'wrap'      // Enable hyphenation and text wrapping
  | 'compact'   // Reduce spacing and line-height
  | 'reflow'    // Convert multi-column to single column
  | 'paginate'  // Create multiple pages
  | 'shrink';   // Reduce font sizes within min/max range

/**
 * Price formatting configuration
 */
export interface PriceConfig {
  /** Currency display strategy */
  currency: 'auto' | string;
  /** Number of decimal places */
  decimals: number;
  /** Price alignment */
  align: 'left' | 'right';
}

/**
 * Content limits for text fields
 */
export interface ContentLimits {
  /** Maximum characters for item names */
  nameChars: number;
  /** Maximum description lines for web display */
  descLinesWeb: number;
  /** Maximum description lines for print output */
  descLinesPrint: number;
}

/**
 * Image display mode for menu items
 */
export type ImageDisplayMode = 
  | 'icon'      // Camera icon inline with text
  | 'thumbnail' // Small thumbnail images
  | 'hero'      // Large section header images
  | 'none';     // No images displayed

/**
 * Accessibility requirements
 */
export interface AccessibilityConfig {
  /** Minimum body font size in pixels */
  minBodyPx: number;
  /** Minimum contrast ratio (WCAG) */
  contrastMin: number;
}

/**
 * Template migration information
 */
export interface TemplateMigration {
  /** Previous template version to migrate from */
  from: string;
  /** Migration notes and breaking changes */
  notes: string;
}

/**
 * Complete template descriptor
 * 
 * This is the main configuration object that defines a menu template.
 * Templates are loaded from JSON files and validated against this schema.
 */
export interface TemplateDescriptor {
  /** Unique template identifier */
  id: string;
  /** Human-readable template name */
  name: string;
  /** Template version (semver) */
  version: string;
  /** Canvas and layout configuration */
  canvas: CanvasConfig;
  /** Layer configuration for backgrounds and ornaments */
  layers: LayerConfig;
  /** Font configuration */
  fonts: FontConfig;
  /** Text frame definitions */
  textFrames: TextFrame[];
  /** Image display mode */
  imageDisplay: ImageDisplayMode;
  /** Price formatting configuration */
  price: PriceConfig;
  /** Content limits */
  limits: ContentLimits;
  /** Ordered list of overflow policies */
  overflowPolicies: OverflowPolicy[];
  /** Accessibility requirements */
  accessibility: AccessibilityConfig;
  /** Optional migration information */
  migration?: TemplateMigration;
}

/**
 * Template metadata for display in UI
 */
export interface TemplateMetadata {
  /** Template identifier */
  id: string;
  /** Display name */
  name: string;
  /** Preview image URL */
  preview: string;
  /** Template description */
  description?: string;
}

/**
 * Template validation error
 */
export interface TemplateValidationError {
  /** Field path where error occurred */
  field: string;
  /** Error message */
  message: string;
  /** Error code */
  code: string;
}

// Re-export validation functions for convenience
export { validateDescriptor, validateDescriptorSafe } from './validation';
