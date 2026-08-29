import type { MovePlacement, NormalizedPoint } from './contracts'
import { deriveMovePlacementGeometry, type TranslatedPoint, type TranslatedRegion } from './move-placement'
import type { SelectionState } from './selection'

export type RawAnnotationPrimitive =
  | { kind: 'target-marker'; point: NormalizedPoint }
  | { kind: 'stroke'; points: readonly NormalizedPoint[] }

export type ApproximatePlacementGuide = {
  strokes: readonly { kind: 'target-marker' | 'stroke'; points: readonly TranslatedPoint[] }[]
  boundingRegion: TranslatedRegion
}

export type LevelAProjection = {
  rawAnnotations: readonly RawAnnotationPrimitive[]
  strokeCount: number
  statusText: string | null
  guidanceText: string | null
  warningText: string | null
  destinationMarker: NormalizedPoint | null
  moveArrow: { from: NormalizedPoint; to: NormalizedPoint } | null
  approximatePlacementGuide: ApproximatePlacementGuide | null
}

export function projectLevelAEditor(input: {
  selection: SelectionState
  operation: 'remove' | 'move' | null
  placement: MovePlacement | null
}): LevelAProjection {
  const rawAnnotations = input.selection.strokes.map((stroke) =>
    stroke.kind === 'tap'
      ? ({ kind: 'target-marker' as const, point: stroke.points[0] })
      : ({ kind: 'stroke' as const, points: stroke.points }),
  )
  const strokeCount = input.selection.strokes.length
  const geometry = input.operation === 'move' ? deriveMovePlacementGeometry(input.selection, input.placement) : null

  let guidanceText: string | null = null
  if (strokeCount === 0) {
    guidanceText = 'Tap or draw over one object.'
  } else if (strokeCount === 6) {
    guidanceText = 'Keep the annotation focused on one object. Use Undo or Clear before adding unrelated marks.'
  } else if (input.operation === 'move' && !geometry) {
    guidanceText = 'Drag the approximate placement guide to choose a destination.'
  }

  return {
    rawAnnotations,
    strokeCount,
    statusText: strokeCount > 0 ? 'Selection added' : null,
    guidanceText,
    warningText: geometry?.likelyOutOfBounds ? 'The approximate placement may extend beyond the image edge.' : null,
    destinationMarker: geometry?.destination ?? null,
    moveArrow: geometry ? { from: geometry.source, to: geometry.destination } : null,
    approximatePlacementGuide: geometry
      ? {
          strokes: geometry.translatedStrokes.map((stroke) => ({
            kind: stroke.kind === 'tap' ? ('target-marker' as const) : ('stroke' as const),
            points: stroke.points,
          })),
          boundingRegion: geometry.translatedBoundingRegion,
        }
      : null,
  }
}
