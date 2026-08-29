import { MinimalSchemaZ, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import {
  StructuredEditIntentZ,
  type MovePlacement,
  type Selection,
  type StructuredEditIntent,
} from '@/lib/studio/object-edit/contracts'
import {
  ANNOTATION_RENDERER_VERSION,
  serializeObjectEditValue,
} from '@/lib/studio/object-edit/reference-image'

export interface ObjectEditSpatialEnrichmentInput {
  /** The inventory is only eligible when it describes this current source image. */
  inventory: unknown
  isCurrent: boolean
  isUnambiguous: boolean
  conflictsWithImageGuidance?: boolean
}

export interface ObjectEditInstructionInput {
  intent: StructuredEditIntent
  /**
   * Production object edits always supply canonical state. The optional form is
   * intentionally limited to the internal A/B/C spike, where Request A must
   * prove behavior without canonical or spatial enrichment.
   */
  canonical?: MinimalSchema
  spatial?: ObjectEditSpatialEnrichmentInput
  renderDigest?: string
}

export interface ObjectEditContractV1 {
  version: 1
  operation: 'remove' | 'move'
  selection: Selection
  placement?: MovePlacement
  canonical?: {
    version: 1
    schema: MinimalSchema
  }
  spatial?: unknown
  metadata: {
    annotationRendererVersion: typeof ANNOTATION_RENDERER_VERSION
    renderDigest?: string
    selectionSignal: 'primary'
    spatialSignal: 'secondary'
    placementGuideAccuracy?: 'approximate'
  }
}

export interface BuiltObjectEditInstruction {
  contract: ObjectEditContractV1
  instruction: string
}

function acceptedSpatialEnrichment(
  spatial: ObjectEditSpatialEnrichmentInput | undefined,
): unknown | undefined {
  if (!spatial || !spatial.isCurrent || !spatial.isUnambiguous || spatial.conflictsWithImageGuidance) {
    return undefined
  }
  return spatial.inventory
}

/**
 * Produces the only text instruction used for object-edit Gemini requests.
 * Image A/B and the raw accepted selection remain the primary targeting signal.
 */
export function buildObjectEditInstruction(
  input: ObjectEditInstructionInput,
): BuiltObjectEditInstruction {
  let intent: StructuredEditIntent
  try {
    const intentResult = StructuredEditIntentZ.safeParse(input.intent)
    if (!intentResult.success) {
      throw new Error('Cannot compose an instruction from an invalid object-edit intent.')
    }
    intent = intentResult.data
  } catch (error) {
    if (error instanceof Error && error.message === 'Cannot compose an instruction from an invalid object-edit intent.') {
      throw error
    }
    throw new Error('Cannot compose an instruction from an invalid object-edit intent.')
  }
  const canonicalResult =
    input.canonical === undefined ? undefined : MinimalSchemaZ.safeParse(input.canonical)
  if (canonicalResult && !canonicalResult.success) {
    throw new Error('Cannot compose an instruction from invalid canonical editor JSON.')
  }
  if (input.renderDigest !== undefined && !/^[a-f0-9]{64}$/i.test(input.renderDigest)) {
    throw new Error('Renderer digest must be a SHA-256 hex digest when provided.')
  }

  const spatial = acceptedSpatialEnrichment(input.spatial)
  if (spatial !== undefined && canonicalResult === undefined) {
    throw new Error('Spatial enrichment requires canonical editor JSON.')
  }
  const contract: ObjectEditContractV1 = {
    version: 1,
    operation: intent.operation,
    selection: intent.selection,
    ...(intent.operation === 'move' ? { placement: intent.placement } : {}),
    ...(canonicalResult === undefined
      ? {}
      : {
          canonical: {
            version: 1,
            schema: canonicalResult.data,
          },
        }),
    ...(spatial === undefined ? {} : { spatial }),
    metadata: {
      annotationRendererVersion: ANNOTATION_RENDERER_VERSION,
      ...(input.renderDigest === undefined ? {} : { renderDigest: input.renderDigest }),
      selectionSignal: 'primary',
      spatialSignal: 'secondary',
      ...(intent.operation === 'move' ? { placementGuideAccuracy: 'approximate' as const } : {}),
    },
  }

  const roleText = [
    'Image A is the current clean source image to edit.',
    'Image B is guidance only and must not appear in the output.',
    intent.operation === 'move'
      ? 'The marks in Image B identify the selected object and destination guidance.'
      : 'The marks in Image B identify the selected object guidance.',
  ]

  const operationText =
    intent.operation === 'remove'
      ? [
          'Remove only the one object indicated by the raw annotation in Image B.',
          'Reconstruct the revealed region naturally.',
        ]
      : [
          'Relocate only the one object indicated by the raw annotation in Image B to the supplied destination.',
          'Reconstruct the object\'s original region naturally.',
          'Preserve the selected object\'s visual identity, scale, and orientation.',
          'The placement guidance is approximate and is not a pixel-exact transform.',
        ]

  const preservationText =
    'Preserve all unselected image content, including unrelated objects, camera angle, lighting, surface, backdrop, and composition.'
  const contractText = serializeObjectEditValue(contract)

  return {
    contract,
    instruction: [...roleText, ...operationText, preservationText, `Structured object-edit contract:\n${contractText}`].join('\n\n'),
  }
}
