/**
 * Render Module
 * 
 * This module handles the rendering of menu templates to HTML/CSS,
 * content fitting, and export to PDF/PNG formats.
 * 
 * Core components:
 * - FitEngine: Applies overflow policies to fit content
 * - MenuRenderer: Renders menu data to HTML/CSS
 * - MenuExporter: Exports rendered HTML to PDF/PNG
 * - ImageCompositor: Composites text layers with backgrounds
 */

export { FitEngine } from './fit-engine';
export type { 
  FitResult, 
  FitOptions, 
  ContentMetrics 
} from './fit-engine';

export { MenuRenderer } from './renderer';
export type {
  RenderOptions,
  RenderResult
} from './renderer';

export { MenuExporter, exportMenu } from './exporter';
export type {
  ExportOptions,
  ExportFormat,
  PaperSize
} from './exporter';

export { ImageCompositor, compositeImages } from './compositor';
export type {
  CompositeOptions,
  CompositeResult
} from './compositor';
