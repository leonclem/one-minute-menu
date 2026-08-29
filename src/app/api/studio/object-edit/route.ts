import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getMutationEngine } from '@/lib/photo-control/mutation-engine'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import { loadOwnedDishSource, OwnedStudioSourceNotFoundError } from '@/lib/studio/owned-source'
import { loadStudioImageBytes } from '@/lib/studio/image-bytes'
import {
  guardStudioGeneration,
  mapStudioGenerationError,
} from '@/lib/studio/generation-request'
import { executeStudioGeneration } from '@/lib/studio/generation-executor'
import { finalizeStudioGenerationAtomic } from '@/lib/studio/finalize-generation-atomic'
import {
  ObjectEditSubmissionZ,
  type StudioGenerationSuccess,
} from '@/lib/studio/object-edit/contracts'
import {
  loadSpatialInventory,
  matchSpatialElement,
  persistSpatialInventory,
  type SpatialInventoryV1,
} from '@/lib/studio/object-edit/spatial-inventory'
import {
  CanonicalSourceStateError,
  establishCanonicalSourceState,
} from '@/lib/studio/object-edit/canonical-state'
import {
  buildObjectEditInstruction,
} from '@/lib/studio/object-edit/instruction'
import {
  ObjectEditImagePreparationError,
  prepareObjectEditImages,
  serializeObjectEditValue,
} from '@/lib/studio/object-edit/reference-image'
import {
  reconcileObjectEditChildState,
} from '@/lib/studio/object-edit/reconciliation'
import {
  extractStudioOutputEvidence,
  scoreStudioOutputEvidence,
  type StudioOutputEvidence,
} from '@/lib/studio/output-validation'
import { logger } from '@/lib/logger'
import {
  createObjectEditRequestId,
  objectEditDiagnosticContext,
} from '@/lib/studio/object-edit/diagnostics'

export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_OBJECT_EDIT_BODY_BYTES = 256 * 1024

class ObjectEditRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ObjectEditRequestError'
  }
}

function requestErrorResponse(error: ObjectEditRequestError): NextResponse {
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
}

async function parseSubmission(request: NextRequest, requestId: string) {
  const contentLengthHeader = request.headers.get('content-length')
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN
  if (Number.isFinite(contentLength) && contentLength > MAX_OBJECT_EDIT_BODY_BYTES) {
    throw new ObjectEditRequestError('OBJECT_EDIT_REQUEST_TOO_LARGE', 413, 'Object-edit request is too large.')
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    throw new ObjectEditRequestError('OBJECT_EDIT_INVALID_JSON', 400, 'Object-edit request must be valid JSON.')
  }
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_OBJECT_EDIT_BODY_BYTES) {
    throw new ObjectEditRequestError('OBJECT_EDIT_REQUEST_TOO_LARGE', 413, 'Object-edit request is too large.')
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    throw new ObjectEditRequestError('OBJECT_EDIT_INVALID_JSON', 400, 'Object-edit request must be valid JSON.')
  }

  const parsed = ObjectEditSubmissionZ.safeParse(body)
  if (!parsed.success) {
    // Field paths and messages only; normalized coordinates are never logged.
    logger.warn('Object-edit submission failed contract validation', {
      requestId,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    })
    throw new ObjectEditRequestError('OBJECT_EDIT_INVALID_REQUEST', 400, 'Object-edit request is invalid.')
  }
  return parsed.data
}

function contractDigest(contract: unknown): string {
  return createHash('sha256').update(serializeObjectEditValue(contract)).digest('hex')
}

export async function POST(request: NextRequest) {
  const requestId = createObjectEditRequestId()
  let failureContext: { userId: string; dishId: string } | null = null

  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const submission = await parseSubmission(request, requestId)
    failureContext = { userId: auth.user.id, dishId: submission.dishId }

    if (submission.editIntent.operation !== 'remove') {
      throw new ObjectEditRequestError(
        'OBJECT_EDIT_UNAVAILABLE',
        403,
        'Move is not available in this delivery.',
      )
    }

    if (!process.env.NANO_BANANA_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    const owned = await loadOwnedDishSource({
      userId: auth.user.id,
      dishId: submission.dishId,
      sourceImageId: submission.sourceImageId,
    })
    const guard = await guardStudioGeneration(auth.user.id, submission.dishId, submission.model)
    if (guard instanceof NextResponse) return guard

    const canonical = await establishCanonicalSourceState(owned.image)
    const sourceBytes = await loadStudioImageBytes(auth.user.id, owned.image.id)
    const prepared = await prepareObjectEditImages({
      sourceBytes: Buffer.from(sourceBytes.base64, 'base64'),
      sourceMimeType: sourceBytes.mimeType,
      intent: submission.editIntent,
    })

    let parentSpatialInventory = null
    try {
      parentSpatialInventory = await loadSpatialInventory(owned.image.id)
    } catch (error) {
      logger.warn(
        'Object-edit parent spatial inventory read failed; continuing without it',
        objectEditDiagnosticContext({
          requestId,
          userId: auth.user.id,
          dishId: submission.dishId,
          imageId: owned.image.id,
          operation: 'remove',
          stage: 'parent_spatial_read',
          error,
          softFailure: 'spatial_inventory_read',
        }),
      )
    }
    const spatialMatch = parentSpatialInventory
      ? matchSpatialElement({
          inventory: parentSpatialInventory,
          imageId: owned.image.id,
          selection: submission.editIntent.selection.boundingRegion,
        })
      : { matched: false as const, reason: 'no-match' as const }
    const matchedParentElement = spatialMatch.matched ? spatialMatch.element : null

    const instruction = buildObjectEditInstruction({
      intent: submission.editIntent,
      canonical: canonical.schema,
      spatial: parentSpatialInventory
        ? {
            inventory: parentSpatialInventory,
            isCurrent: parentSpatialInventory.imageId === owned.image.id,
            isUnambiguous: spatialMatch.matched,
          }
        : undefined,
      renderDigest: prepared.renderDigest,
    })
    const digest = contractDigest(instruction.contract)
    const engine = getMutationEngine()
    let spatialInventoryForPersistence: SpatialInventoryV1 | null = null

    const finalized = await executeStudioGeneration({
      userId: auth.user.id,
      dishId: submission.dishId,
      requestedModel: guard.requestedModel,
      creditCost: guard.creditCost,
      providerInput: {
        sourceImageBase64: prepared.clean.data,
        mimeType: prepared.clean.mimeType,
        prompt: instruction.instruction,
        model: guard.requestedModel,
        annotationReference: {
          data: prepared.annotated.data,
          mimeType: prepared.annotated.mimeType,
        },
        request_scope: 'studio_object_edit' as const,
      },
      invokeProvider: async (input) => engine.mutate(input),
      buildMetadata: async (providerResult) => {
        const evidence: StudioOutputEvidence | null = await extractStudioOutputEvidence({
          imageBase64: providerResult.imageBase64,
          mimeType: providerResult.mimeType ?? 'image/png',
        })
        const validation = scoreStudioOutputEvidence({
          evidence,
          expected: canonical.schema,
        })
        const reconciliation = reconcileObjectEditChildState({
          directParent: canonical,
          intent: submission.editIntent,
          sourceImage: { id: owned.image.id },
          childImage: {
            id: owned.image.id,
            width: prepared.clean.width,
            height: prepared.clean.height,
          },
          parentSpatialInventory,
          matchedParentElement,
          currentEvidence: evidence ? { canonical: evidence.canonical } : null,
        })
        spatialInventoryForPersistence = reconciliation.spatialInventory
        return { evidence, validation, reconciliation, providerModelIdentity: providerResult.providerModelIdentity }
      },
      finalize: async ({ providerResult, metadata }) => {
        const result = await finalizeStudioGenerationAtomic({
          userId: auth.user.id,
          dishId: submission.dishId,
          sourceImageId: owned.image.id,
          imageBase64: providerResult.imageBase64,
          mimeType: providerResult.mimeType ?? 'image/png',
          providerMimeType: providerResult.providerMimeType,
          prompt: instruction.instruction,
          requestedModel: guard.requestedModel,
          creditCost: guard.creditCost,
          canonical: metadata.reconciliation.canonical,
          position: canonical.editorState.position,
          objectEdit: {
            version: 1,
            operation: 'remove',
            directParentImageId: owned.image.id,
            selectedSourceImageId: owned.image.id,
            selection: submission.editIntent.selection,
            annotationRendererVersion: prepared.rendererVersion,
            contractDigest: digest,
          },
          metadata: {
            cost_credits: guard.creditCost,
            validation: {
              status: metadata.validation.status,
              score: metadata.validation.score,
              summary: metadata.validation.summary,
            },
            renderDigest: prepared.renderDigest,
            ...(metadata.providerModelIdentity
              ? { providerModelIdentity: metadata.providerModelIdentity }
              : {}),
          },
          validationStatus: metadata.validation.status,
        })
        return result
      },
    })

    if (spatialInventoryForPersistence) {
      const childSpatialInventory = JSON.parse(
        JSON.stringify(spatialInventoryForPersistence),
      ) as SpatialInventoryV1
      childSpatialInventory.imageId = finalized.success.imageId
      try {
        await persistSpatialInventory({
          userId: auth.user.id,
          dishId: submission.dishId,
          inventory: childSpatialInventory,
        })
      } catch (error) {
        logger.warn(
          'Object-edit child spatial inventory persistence failed; continuing',
          objectEditDiagnosticContext({
            requestId,
            userId: auth.user.id,
            dishId: submission.dishId,
            imageId: finalized.success.imageId,
            operation: 'remove',
            stage: 'child_spatial_persist',
            error,
            softFailure: 'spatial_inventory_persistence',
          }),
        )
      }
    }

    const success: StudioGenerationSuccess = finalized.success
    logger.info(
      'Object-edit Remove succeeded',
      objectEditDiagnosticContext({
        requestId,
        userId: auth.user.id,
        dishId: submission.dishId,
        imageId: success.imageId,
        operation: 'remove',
        modelClass: guard.requestedModel,
        stage: 'completed',
      }),
    )
    return NextResponse.json(success)
  } catch (error) {
    if (error instanceof ObjectEditRequestError) return requestErrorResponse(error)
    if (error instanceof OwnedStudioSourceNotFoundError) {
      return NextResponse.json({ error: 'Studio source image not found' }, { status: 404 })
    }
    if (error instanceof CanonicalSourceStateError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      )
    }
    if (error instanceof ObjectEditImagePreparationError) {
      return NextResponse.json(
        { error: error.message, code: 'OBJECT_EDIT_INPUT_PREPARATION_FAILED' },
        { status: 400 },
      )
    }
    return await mapStudioGenerationError(error, failureContext, 'Studio Object Edit')
  }
}
