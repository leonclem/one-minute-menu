import { deriveSelectionSourcePoint, type AnnotationStroke, type MovePlacement, type NormalizedPoint, type NormalizedRegion } from './contracts'
import type { SelectionState } from './selection'

export type TranslatedPoint = { x: number; y: number }
export type TranslatedRegion = { left: number; top: number; right: number; bottom: number }

export type MovePlacementGeometry = {
  source: NormalizedPoint
  destination: NormalizedPoint
  translatedStrokes: readonly { kind: AnnotationStroke['kind']; points: readonly TranslatedPoint[] }[]
  translatedBoundingRegion: TranslatedRegion
  likelyOutOfBounds: boolean
}

export function isValidNormalizedPoint(point: NormalizedPoint | null | undefined): point is NormalizedPoint {
  return Boolean(
    point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      point.x >= 0 &&
      point.x <= 1 &&
      point.y >= 0 &&
      point.y <= 1,
  )
}

export function placementForDestination(
  selection: SelectionState,
  destination: NormalizedPoint,
): MovePlacement | null {
  if (!selection.boundingRegion || !isValidNormalizedPoint(destination)) return null
  return { source: deriveSelectionSourcePoint(selection.boundingRegion), destination }
}

export function translatePoint(point: NormalizedPoint, placement: MovePlacement): TranslatedPoint {
  return {
    x: point.x + placement.destination.x - placement.source.x,
    y: point.y + placement.destination.y - placement.source.y,
  }
}

export function translateRegion(region: NormalizedRegion, placement: MovePlacement): TranslatedRegion {
  const xOffset = placement.destination.x - placement.source.x
  const yOffset = placement.destination.y - placement.source.y
  return {
    left: region.left + xOffset,
    top: region.top + yOffset,
    right: region.right + xOffset,
    bottom: region.bottom + yOffset,
  }
}

export function isTranslatedRegionOutOfBounds(region: TranslatedRegion): boolean {
  return region.left < 0 || region.top < 0 || region.right > 1 || region.bottom > 1
}

export function deriveMovePlacementGeometry(
  selection: SelectionState,
  placement: MovePlacement | null,
): MovePlacementGeometry | null {
  if (!selection.boundingRegion || !placement || !isValidNormalizedPoint(placement.source) || !isValidNormalizedPoint(placement.destination)) {
    return null
  }

  const translatedBoundingRegion = translateRegion(selection.boundingRegion, placement)
  return {
    source: placement.source,
    destination: placement.destination,
    translatedStrokes: selection.strokes.map((stroke) => ({
      kind: stroke.kind,
      points: stroke.points.map((point) => translatePoint(point, placement)),
    })),
    translatedBoundingRegion,
    likelyOutOfBounds: isTranslatedRegionOutOfBounds(translatedBoundingRegion),
  }
}
