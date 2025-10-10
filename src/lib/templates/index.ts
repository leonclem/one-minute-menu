/**
 * Template System Module
 * 
 * This module provides a complete template system for menu rendering.
 * It includes type definitions, validation, loading, and registry management.
 */

// Export types
export type {
  TemplateDescriptor,
  TemplateMetadata,
  TemplateValidationError,
  CanvasConfig,
  LayerConfig,
  BackgroundLayer,
  Ornament,
  FontConfig,
  FontSpec,
  TextFrame,
  OverflowPolicy,
  PriceConfig,
  ContentLimits,
  ImageDisplayMode,
  AccessibilityConfig,
  TemplateMigration
} from './types';

// Export validation functions
export { validateDescriptor, validateDescriptorSafe } from './validation';

// Export loader
export { TemplateLoader } from './loader';

// Export registry
export { TemplateRegistry, getTemplateRegistry } from './registry';

