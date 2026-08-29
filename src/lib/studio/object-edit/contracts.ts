import { z } from 'zod'

/**
 * Contract fallback used before the source image's natural dimensions are loaded.
 * It matches the version-one annotated-reference marker radius (0.8% of each axis).
 * Image-aware derivation in the selection engine will supply its natural-image radius
 * while preserving this serialized version-one contract.
 */
export const SELECTION_BOUNDING_REGION_RADIUS = 0.008

/**
 * Upper bound, per axis, on the visible annotation radius a Selection may expand
 * its point extents by. The selection engine derives an image-aware radius from
 * the source image's natural dimensions, so the accepted region cannot be
 * reproduced from normalized coordinates alone; it is bounded and checked for
 * internal consistency instead of pinned to one value.
 */
export const SELECTION_BOUNDING_REGION_MAX_RADIUS = 0.1

/** Absorbs IEEE-754 drift when a per-axis radius is recovered by subtraction. */
const BOUNDING_REGION_EPSILON = 1e-9

export const NormalizedPointZ = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
  })
  .strict()

export const NormalizedRegionZ = z
  .object({
    left: z.number().finite().min(0).max(1),
    top: z.number().finite().min(0).max(1),
    right: z.number().finite().min(0).max(1),
    bottom: z.number().finite().min(0).max(1),
  })
  .strict()
  .refine((region) => region.left <= region.right && region.top <= region.bottom, {
    message: 'Bounding region edges must be ordered.',
  })

export const AnnotationStrokeZ = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('tap'),
      points: z.tuple([NormalizedPointZ]),
    })
    .strict(),
  z
    .object({
      kind: z.literal('path'),
      points: z.array(NormalizedPointZ).min(2).max(512),
    })
    .strict(),
])

export type NormalizedPoint = z.infer<typeof NormalizedPointZ>
export type NormalizedRegion = z.infer<typeof NormalizedRegionZ>
export type AnnotationStroke = z.infer<typeof AnnotationStrokeZ>

export function deriveSelectionBoundingRegion(
  strokes: readonly AnnotationStroke[],
  annotationRadius = SELECTION_BOUNDING_REGION_RADIUS,
): NormalizedRegion {
  if (!Number.isFinite(annotationRadius) || annotationRadius < 0 || annotationRadius > 1) {
    throw new Error('Annotation radius must be a finite normalized value from 0 through 1.')
  }

  const points = strokes.flatMap((stroke): readonly NormalizedPoint[] => stroke.points)
  if (points.length === 0) {
    throw new Error('Cannot derive a bounding region from an empty selection.')
  }

  const minX = Math.min(...points.map((point) => point.x))
  const maxX = Math.max(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxY = Math.max(...points.map((point) => point.y))

  return {
    left: Math.max(0, minX - annotationRadius),
    top: Math.max(0, minY - annotationRadius),
    right: Math.min(1, maxX + annotationRadius),
    bottom: Math.min(1, maxY + annotationRadius),
  }
}

export function deriveSelectionSourcePoint(region: NormalizedRegion): NormalizedPoint {
  return {
    x: (region.left + region.right) / 2,
    y: (region.top + region.bottom) / 2,
  }
}

function sameNumber(left: number, right: number): boolean {
  // This deliberately performs no rounding or re-normalization of accepted values.
  return left === right
}

export type BoundingRegionInconsistency =
  | 'not-containing'
  | 'asymmetric-expansion'
  | 'radius-out-of-range'

/**
 * Checks one axis of a submitted region against the retained point extents.
 *
 * A valid region is the point extents expanded by a single non-negative radius
 * on both sides of the axis, then clamped into [0, 1]. An unclamped edge reveals
 * that radius exactly, so the two edges must agree. A clamped edge only reveals a
 * lower bound, which additionally proves the extent sat within one radius of the
 * image border. Together this rejects any tampered edge without needing to know
 * the natural image dimensions the radius was derived from.
 */
function axisInconsistency(
  minimum: number,
  maximum: number,
  lower: number,
  upper: number,
): BoundingRegionInconsistency | null {
  if (lower > minimum + BOUNDING_REGION_EPSILON || upper < maximum - BOUNDING_REGION_EPSILON) {
    return 'not-containing'
  }

  const lowerRadius = minimum - lower
  const upperRadius = upper - maximum
  const lowerIsExact = lower > 0
  const upperIsExact = upper < 1
  const maxRadius = SELECTION_BOUNDING_REGION_MAX_RADIUS + BOUNDING_REGION_EPSILON

  if (lowerIsExact && lowerRadius > maxRadius) return 'radius-out-of-range'
  if (upperIsExact && upperRadius > maxRadius) return 'radius-out-of-range'
  // Clamping to an image border is only reachable within one radius of it.
  if (!lowerIsExact && minimum > maxRadius) return 'radius-out-of-range'
  if (!upperIsExact && maximum < 1 - maxRadius) return 'radius-out-of-range'

  if (lowerIsExact && upperIsExact) {
    return Math.abs(lowerRadius - upperRadius) > BOUNDING_REGION_EPSILON
      ? 'asymmetric-expansion'
      : null
  }
  if (!lowerIsExact && upperIsExact && lowerRadius > upperRadius + BOUNDING_REGION_EPSILON) {
    return 'asymmetric-expansion'
  }
  if (!upperIsExact && lowerIsExact && upperRadius > lowerRadius + BOUNDING_REGION_EPSILON) {
    return 'asymmetric-expansion'
  }
  return null
}

/**
 * Validates that a region is the deterministic derivation from every retained
 * point plus one visible annotation radius per axis, without assuming which
 * radius the selection engine derived for the source image.
 */
export function boundingRegionInconsistency(
  strokes: readonly AnnotationStroke[],
  region: NormalizedRegion,
): BoundingRegionInconsistency | null {
  const points = strokes.flatMap((stroke): readonly NormalizedPoint[] => stroke.points)
  if (points.length === 0) return 'not-containing'

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)

  return (
    axisInconsistency(Math.min(...xs), Math.max(...xs), region.left, region.right) ??
    axisInconsistency(Math.min(...ys), Math.max(...ys), region.top, region.bottom)
  )
}

function samePoint(left: NormalizedPoint, right: NormalizedPoint): boolean {
  return sameNumber(left.x, right.x) && sameNumber(left.y, right.y)
}

export const SelectionZ = z
  .object({
    version: z.literal(1),
    strokes: z.array(AnnotationStrokeZ).min(1).max(8),
    boundingRegion: NormalizedRegionZ,
  })
  .strict()
  .superRefine((selection, context) => {
    const pointCount = selection.strokes.reduce((total, stroke) => total + stroke.points.length, 0)
    if (pointCount > 4096) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['strokes'],
        message: 'Selection point limit exceeded.',
      })
    }

    const inconsistency = boundingRegionInconsistency(selection.strokes, selection.boundingRegion)
    if (inconsistency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['boundingRegion'],
        message: `Bounding region must match the complete accepted selection (${inconsistency}).`,
      })
    }
  })

export const MovePlacementZ = z
  .object({
    source: NormalizedPointZ,
    destination: NormalizedPointZ,
  })
  .strict()

const RemoveEditIntentZ = z
  .object({
    version: z.literal(1),
    operation: z.literal('remove'),
    selection: SelectionZ,
  })
  .strict()

const MoveEditIntentZ = z
  .object({
    version: z.literal(1),
    operation: z.literal('move'),
    selection: SelectionZ,
    placement: MovePlacementZ,
  })
  .strict()

function addPlacementSourceIssue(
  selection: z.infer<typeof SelectionZ>,
  placement: z.infer<typeof MovePlacementZ>,
  context: z.RefinementCtx,
  path: (string | number)[],
): void {
  const expectedSource = deriveSelectionSourcePoint(selection.boundingRegion)
  if (!samePoint(placement.source, expectedSource)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: 'Move source must match the center of the selection bounding region.',
    })
  }
}

export const StructuredEditIntentZ = z
  .discriminatedUnion('operation', [RemoveEditIntentZ, MoveEditIntentZ])
  .superRefine((intent, context) => {
    if (intent.operation === 'move') {
      addPlacementSourceIssue(intent.selection, intent.placement, context, ['placement', 'source'])
    }
  })

export const ObjectEditSubmissionZ = z
  .object({
    dishId: z.string().uuid(),
    sourceImageId: z.string().uuid(),
    model: z.string().max(200).optional(),
    editIntent: StructuredEditIntentZ,
  })
  .strict()

export const ObjectEditOperationMetadataZ = z
  .object({
    version: z.literal(1),
    operation: z.enum(['remove', 'move']),
    directParentImageId: z.string().uuid(),
    selectedSourceImageId: z.string().uuid(),
    selection: SelectionZ,
    placement: MovePlacementZ.optional(),
    annotationRendererVersion: z.literal(1),
    contractDigest: z.string().regex(/^[a-f0-9]{64}$/i, 'Contract digest must be a SHA-256 hex digest.'),
  })
  .strict()
  .superRefine((metadata, context) => {
    if (metadata.operation === 'move') {
      if (!metadata.placement) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['placement'],
          message: 'Move metadata requires placement coordinates.',
        })
      } else {
        addPlacementSourceIssue(metadata.selection, metadata.placement, context, ['placement', 'source'])
      }
    } else if (metadata.placement !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['placement'],
        message: 'Remove metadata cannot include move placement coordinates.',
      })
    }
  })

export type Selection = z.infer<typeof SelectionZ>
export type MovePlacement = z.infer<typeof MovePlacementZ>
export type StructuredEditIntent = z.infer<typeof StructuredEditIntentZ>
export type ObjectEditSubmission = z.infer<typeof ObjectEditSubmissionZ>
export type ObjectEditOperationMetadata = z.infer<typeof ObjectEditOperationMetadataZ>

export const StudioValidationStatusZ = z.enum(['pass', 'warn', 'fail', 'skipped'])

/** The established browser success envelope for Studio generation routes. */
export const StudioGenerationSuccessZ = z
  .object({
    imageUrl: z.string(),
    imageId: z.string(),
    dishId: z.string(),
    model: z.string(),
    validationStatus: StudioValidationStatusZ.optional(),
    credits: z
      .object({
        cost: z.number(),
        balanceAfter: z.number(),
      })
      .strict(),
  })
  .strict()

/** The established browser error envelope; HTTP status remains the transport authority. */
export const StudioGenerationErrorZ = z
  .object({
    error: z.string(),
    code: z.string().optional(),
    retryAfter: z.number().optional(),
    filterReason: z.string().optional(),
    suggestions: z.array(z.string()).optional(),
    dishBlocked: z.boolean().optional(),
    dishBlockCode: z.string().optional(),
    failureCount: z.number().optional(),
  })
  .strict()

export type StudioGenerationSuccess = z.infer<typeof StudioGenerationSuccessZ>
export type StudioGenerationError = z.infer<typeof StudioGenerationErrorZ>

export type StudioGenerationErrorProjection = {
  status: number
  body: StudioGenerationError
}
