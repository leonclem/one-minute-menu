/**
 * V2 Layout Engine Exports
 *
 * This module exports all public types and functions for the GridMenu V2 Layout Engine.
 */

// Type definitions
export type {
  // Page types
  PageSpecV2,
  PageDimensionId,
  // Region types
  RegionIdV2,
  RegionV2,
  // Page types
  PageTypeV2,
  // Tile types
  TileTypeV2,
  TileLayerV2,
  ContentBudgetV2,
  TileInstanceV2,
  TileContentV2,
  // Tile content types
  LogoContentV2,
  TitleContentV2,
  SectionHeaderContentV2,
  ItemContentV2,
  FillerContentV2,
  TextBlockContentV2,
  // Indicator types
  DietaryIndicator,
  ItemIndicatorsV2,
  // Layout types
  PageLayoutV2,
  LayoutDocumentV2,
  LayoutDebugInfoV2,
  PlacementLogEntry,
  // Menu input types
  EngineMenuV2,
  EngineSectionV2,
  EngineItemV2,
  // Selection config
  SelectionConfigV2,
  // Template types
  TemplateV2,
  TemplatePageConfigV2,
  TemplateRegionsConfigV2,
  TemplateBodyConfigV2,
  BodyContainerTypeV2,
  TemplateTileVariantsV2,
  TileVariantDefV2,
  TemplatePoliciesV2,
  TemplateFillerConfigV2,
  FillerTileDefV2,
  FillerPolicyV2,
  SafeZoneV2,
  TemplateIndicatorConfigV2,
  IndicatorModeV2,
  IndicatorIconSetV2,
} from './engine-types-v2'

// Constants and functions
export {
  PAGE_DIMENSIONS,
  buildPageSpec,
  calculateTileHeight,
  calculateTileWidth,
  calculateCellWidth,
  calculateMaxRows,
} from './engine-types-v2'

// Region calculator
export {
  calculateRegions,
  getBodyRegion,
  validateRegions,
} from './region-calculator'

// Tile placer
export type { PlacementContext } from './tile-placer'
export {
  initPlacementContext,
  createSectionHeaderTile,
  createItemTile,
  createLogoTile,
  createTitleTile,
  selectItemVariant,
  placeTile,
  advancePosition,
  advanceToNextRow,
  applyLastRowBalancing,
  generateTileId,
} from './tile-placer'

// Filler manager
export {
  insertFillers,
  insertInterspersedFillers,
  buildOccupancyGrid,
  findEmptyCellsInSafeZones,
  resolveSafeZoneIndex,
  selectFillers,
  hashString,
} from './filler-manager-v2'

// Menu transformer
export type { TransformOptionsV2 } from './menu-transformer-v2'
export {
  transformMenuToV2,
  isEngineMenuV2,
  isEngineSectionV2,
  isEngineItemV2,
} from './menu-transformer-v2'

// Main layout engine
export type { LayoutEngineInputV2 } from './layout-engine-v2'
export { generateLayoutV2 } from './layout-engine-v2'

// Template loader
export { loadTemplateV2, clearTemplateCache } from './template-loader-v2'

// Streaming paginator
export { streamingPaginate } from './streaming-paginator'

// Invariant validator
export { validateInvariants } from './invariant-validator'

// Error types
export type { InvariantViolation } from './errors-v2'
export {
  TemplateValidationError,
  InvariantViolationError,
  LayoutEngineErrorV2,
} from './errors-v2'

// Renderer types and functions
export type { RenderOptionsV2 } from './renderer-v2'
export type { PDFExportResultV2 } from './renderer-pdf-v2'
export { renderToPdf } from './renderer-pdf-v2'
