import { createHash } from 'crypto'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { MutationEngine, type ObjectEditMutationInput } from '@/lib/photo-control/mutation-engine'
import { resolveRequestedStudioModel } from '@/lib/studio/generation-executor'
import {
  buildObjectEditInstruction,
  type ObjectEditContractV1,
  type ObjectEditSpatialEnrichmentInput,
} from '@/lib/studio/object-edit/instruction'
import {
  prepareObjectEditImages,
  serializeObjectEditValue,
  type PreparedObjectEditImages,
} from '@/lib/studio/object-edit/reference-image'
import type { PhotoControlMimeType } from '@/lib/photo-control/request-validation'
import type { StructuredEditIntent } from '@/lib/studio/object-edit/contracts'
import { STUDIO_FLASH_MODEL, STUDIO_PRO_MODEL } from '@/lib/studio/model-config'
import type { SpikeScenarioCase } from './manifest'

export type SpikeVariant = 'A' | 'B' | 'C'

/** A is intentionally missing enrichment; B/C preserve the production contract shape. */
export type SpikeVariantContract = Omit<ObjectEditContractV1, 'canonical' | 'spatial'> & {
  canonical?: ObjectEditContractV1['canonical']
  spatial?: unknown
}

export interface SpikeConstructionInput {
  scenarioCase: SpikeScenarioCase
  sourceBytes: Buffer
  sourceMimeType: PhotoControlMimeType
  canonical: MinimalSchema
  /** C only: the inventory must be derived from this exact source image. */
  currentSpatialInventory: unknown
}

export interface PreparedSpikeRequest {
  variant: SpikeVariant
  operation: 'remove' | 'move'
  requestedModelClass: 'nb2' | 'nb_pro'
  configuredModelIdentifier: string
  resolvedModelIdentifier: string
  sourceDigest: string
  annotatedDigest: string
  /** Digest of all invariant contract inputs, excluding canonical/spatial enrichment. */
  fixedContractDigest: string
  /** Digest of the exact variant contract sent to the provider. */
  contractDigest: string
  contract: SpikeVariantContract
  instruction: string
  mutationInput: ObjectEditMutationInput
}

export interface PreparedSpikeComparisonGroup {
  preparedImages: PreparedObjectEditImages
  requests: readonly [PreparedSpikeRequest, PreparedSpikeRequest, PreparedSpikeRequest]
}

function digest(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function makeIntent(scenarioCase: SpikeScenarioCase): StructuredEditIntent {
  return scenarioCase.operation === 'move'
    ? {
        version: 1,
        operation: 'move',
        selection: scenarioCase.selection,
        placement: scenarioCase.placement!,
      }
    : { version: 1, operation: 'remove', selection: scenarioCase.selection }
}

function composeVariant(input: {
  variant: SpikeVariant
  intent: StructuredEditIntent
  canonical: MinimalSchema
  spatialInventory: unknown
  renderDigest: string
  preparedImages: PreparedObjectEditImages
  scenarioCase: SpikeScenarioCase
  sourceDigest: string
  annotatedDigest: string
  fixedContractDigest: string
}): PreparedSpikeRequest {
  const spatial: ObjectEditSpatialEnrichmentInput | undefined =
    input.variant === 'C'
      ? {
          inventory: input.spatialInventory,
          isCurrent: true,
          isUnambiguous: true,
          conflictsWithImageGuidance: false,
        }
      : undefined
  const built = buildObjectEditInstruction({
    intent: input.intent,
    ...(input.variant === 'A' ? {} : { canonical: input.canonical }),
    ...(spatial === undefined ? {} : { spatial }),
    renderDigest: input.renderDigest,
  })
  const output = {
    contract: built.contract as SpikeVariantContract,
    instruction: built.instruction,
  }
  const resolvedModelIdentifier = resolveRequestedStudioModel(input.scenarioCase.configuredModelIdentifier)

  return {
    variant: input.variant,
    operation: input.scenarioCase.operation,
    requestedModelClass: input.scenarioCase.requestedModelClass,
    configuredModelIdentifier: input.scenarioCase.configuredModelIdentifier,
    resolvedModelIdentifier,
    sourceDigest: input.sourceDigest,
    annotatedDigest: input.annotatedDigest,
    fixedContractDigest: input.fixedContractDigest,
    contractDigest: digest(serializeObjectEditValue(output.contract)),
    contract: output.contract,
    instruction: output.instruction,
    mutationInput: {
      request_scope: 'studio_object_edit',
      sourceImageBase64: input.preparedImages.clean.data,
      mimeType: input.preparedImages.clean.mimeType,
      annotationReference: {
        data: input.preparedImages.annotated.data,
        mimeType: input.preparedImages.annotated.mimeType,
      },
      prompt: output.instruction,
      model: resolvedModelIdentifier,
    },
  }
}

/**
 * Constructs all A/B/C requests from one prepared image pair. The only intentional
 * difference is absent enrichment (A), canonical enrichment (B), then canonical
 * plus current, unambiguous spatial inventory (C).
 */
export async function constructSpikeComparisonGroup(
  input: SpikeConstructionInput,
): Promise<PreparedSpikeComparisonGroup> {
  const intent = makeIntent(input.scenarioCase)
  const expectedModel =
    input.scenarioCase.requestedModelClass === 'nb_pro' ? STUDIO_PRO_MODEL : STUDIO_FLASH_MODEL
  if (resolveRequestedStudioModel(input.scenarioCase.configuredModelIdentifier) !== expectedModel) {
    throw new Error('Configured model identifier does not match the requested model class.')
  }

  const preparedImages = await prepareObjectEditImages({
    sourceBytes: input.sourceBytes,
    sourceMimeType: input.sourceMimeType,
    intent,
  })
  const sourceDigest = digest(input.sourceBytes)
  if (input.scenarioCase.sourceArtifact.sha256 !== sourceDigest) {
    throw new Error('Source bytes do not match the manifest source artifact digest.')
  }
  const annotatedDigest = digest(Buffer.from(preparedImages.annotated.data, 'base64'))
  if (
    input.scenarioCase.annotatedArtifact !== undefined &&
    input.scenarioCase.annotatedArtifact.sha256 !== annotatedDigest
  ) {
    throw new Error('Prepared annotation does not match the manifest annotation artifact digest.')
  }
  const fixedContractDigest = digest(
    serializeObjectEditValue({
      version: 1,
      sourceDigest,
      annotatedDigest,
      operation: intent.operation,
      selection: intent.selection,
      ...(intent.operation === 'move' ? { placement: intent.placement } : {}),
      renderDigest: preparedImages.renderDigest,
      requestedModelClass: input.scenarioCase.requestedModelClass,
      configuredModelIdentifier: input.scenarioCase.configuredModelIdentifier,
    }),
  )

  const shared = {
    intent,
    canonical: input.canonical,
    spatialInventory: input.currentSpatialInventory,
    renderDigest: preparedImages.renderDigest,
    preparedImages,
    scenarioCase: input.scenarioCase,
    sourceDigest,
    annotatedDigest,
    fixedContractDigest,
  }
  const requests: [PreparedSpikeRequest, PreparedSpikeRequest, PreparedSpikeRequest] = [
    composeVariant({ ...shared, variant: 'A' }),
    composeVariant({ ...shared, variant: 'B' }),
    composeVariant({ ...shared, variant: 'C' }),
  ]
  assertComparisonGroupInvariants(requests)
  return { preparedImages, requests }
}

/** Rejects a group if its request construction varies beyond the permitted enrichment. */
export function assertComparisonGroupInvariants(requests: readonly PreparedSpikeRequest[]): void {
  if (requests.length !== 3 || requests.map((request) => request.variant).join('') !== 'ABC') {
    throw new Error('A comparison group must contain exactly ordered A, B, and C requests.')
  }
  const [a, b, c] = requests as [PreparedSpikeRequest, PreparedSpikeRequest, PreparedSpikeRequest]
  for (const request of requests) {
    if (
      request.sourceDigest !== a.sourceDigest ||
      request.annotatedDigest !== a.annotatedDigest ||
      request.fixedContractDigest !== a.fixedContractDigest ||
      request.operation !== a.operation ||
      request.requestedModelClass !== a.requestedModelClass ||
      request.configuredModelIdentifier !== a.configuredModelIdentifier ||
      request.resolvedModelIdentifier !== a.resolvedModelIdentifier
    ) {
      throw new Error('A/B/C comparison inputs differ outside permitted enrichment.')
    }
    if (
      request.mutationInput.sourceImageBase64 !== a.mutationInput.sourceImageBase64 ||
      request.mutationInput.annotationReference.data !== a.mutationInput.annotationReference.data ||
      request.mutationInput.model !== a.mutationInput.model
    ) {
      throw new Error('A/B/C mutation inputs differ outside the composed instruction.')
    }
  }

  if (a.contract.canonical !== undefined || a.contract.spatial !== undefined) {
    throw new Error('Variant A must not include canonical or spatial enrichment.')
  }
  if (b.contract.canonical === undefined || b.contract.spatial !== undefined) {
    throw new Error('Variant B must contain canonical enrichment only.')
  }
  if (c.contract.canonical === undefined || c.contract.spatial === undefined) {
    throw new Error('Variant C must contain canonical and spatial enrichment.')
  }
  if (serializeObjectEditValue(b.contract.canonical) !== serializeObjectEditValue(c.contract.canonical)) {
    throw new Error('Variants B and C must use identical canonical enrichment.')
  }

  const invariantContract = (request: PreparedSpikeRequest) => ({
    version: request.contract.version,
    operation: request.contract.operation,
    selection: request.contract.selection,
    ...(request.contract.placement === undefined ? {} : { placement: request.contract.placement }),
    metadata: request.contract.metadata,
  })
  const invariantDigest = serializeObjectEditValue(invariantContract(a))
  for (const request of [b, c]) {
    if (serializeObjectEditValue(invariantContract(request)) !== invariantDigest) {
      throw new Error('A/B/C selection, destination, or normalized coordinates differ.')
    }
  }
}

/** Explicit production scope adapter; runner callers cannot add style/steering images. */
export async function executePreparedSpikeRequest(
  engine: MutationEngine,
  request: PreparedSpikeRequest,
) {
  return engine.mutate(request.mutationInput)
}
