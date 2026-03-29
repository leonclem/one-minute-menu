/**
 * Template Components Index
 * 
 * Re-exports template components still used by the legacy dashboard preview.
 * The V2 layout engine uses renderer-web-v2.tsx directly.
 */

export { default as GridMenuLayout, ResponsiveGridMenuLayout } from './GridMenuLayout'
export type { GridMenuLayoutProps, ResponsiveGridMenuLayoutProps } from './GridMenuLayout'

export { default as MenuTile } from './MenuTile'
export type { MenuTileProps } from './MenuTile'

export { default as MetadataOverlay, LightMetadataOverlay, SolidMetadataOverlay } from './MetadataOverlay'
export type { MetadataOverlayProps, LightMetadataOverlayProps, SolidMetadataOverlayProps } from './MetadataOverlay'

export { default as FillerTile } from './FillerTile'
export type { FillerTileProps } from './FillerTile'
