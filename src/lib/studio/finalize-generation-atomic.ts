import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { MinimalSchemaZ, type EditorState, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { logger } from '@/lib/logger'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { resolveStudioImageMimeType } from '@/lib/studio/image-format'
import {
  ObjectEditOperationMetadataZ,
  type ObjectEditOperationMetadata,
  type StudioGenerationSuccess,
} from '@/lib/studio/object-edit/contracts'
import {
  buildStudioStoragePath,
  isPhotoControlMimeType,
  normalizeStoragePublicUrl,
  STUDIO_STORAGE_BUCKET,
} from '@/lib/studio/storage-paths'

export class AtomicStudioGenerationError extends Error {
  constructor(
    message: string,
    readonly stage: 'input' | 'upload' | 'commit',
    readonly compensationFailed = false,
  ) {
    super(message)
    this.name = 'AtomicStudioGenerationError'
  }
}

export interface FinalizeStudioGenerationAtomicInput {
  userId: string
  dishId: string
  sourceImageId: string
  imageBase64: string
  /** Caller-selected type; final storage metadata is reconciled against the bytes. */
  mimeType: string
  /** Optional provider inlineData MIME claim for mismatch diagnostics. */
  providerMimeType?: string | null
  prompt: string
  requestedModel: string
  creditCost: number
  canonical: MinimalSchema
  /** Position remains compatible editor metadata, outside Minimal Schema. */
  position?: EditorState['position']
  objectEdit: ObjectEditOperationMetadata
  metadata?: Record<string, unknown>
  validationStatus?: StudioGenerationSuccess['validationStatus']
}

export interface AtomicStudioGenerationRecord {
  id: string
  publicUrl: string
  dishId: string
  model: string
  storagePath: string
  width: number
  height: number
}

export interface FinalizeStudioGenerationAtomicResult {
  record: AtomicStudioGenerationRecord
  success: StudioGenerationSuccess
}

interface AtomicStorage {
  upload(
    path: string,
    body: Buffer,
    options: { contentType: string; cacheControl: string; upsert: boolean },
  ): Promise<{ error: { message: string } | null }>
  remove(paths: string[]): Promise<{ error: { message: string } | null }>
  getPublicUrl(path: string): { data: { publicUrl: string } }
}

interface AtomicSupabase {
  storage: { from(bucket: string): AtomicStorage }
  rpc(
    name: string,
    parameters: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>
}

export interface FinalizeStudioGenerationAtomicDependencies {
  createClient?: () => AtomicSupabase
  createImageId?: () => string
}

function validPosition(position: EditorState['position'] | undefined): EditorState['position'] {
  if (!position) return { x: 0, y: 0 }
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new AtomicStudioGenerationError('Canonical editor position must be finite.', 'input')
  }
  return { x: position.x, y: position.y }
}

function firstRpcRow(data: unknown): Record<string, unknown> | null {
  const candidate = Array.isArray(data) ? data[0] : data
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : null
}

function readRpcString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readRpcBalance(row: Record<string, unknown>): number | null {
  const value = row.balance_after
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function validateInput(input: FinalizeStudioGenerationAtomicInput): {
  canonical: MinimalSchema
  objectEdit: ObjectEditOperationMetadata
  position: EditorState['position']
  buffer: Buffer
} {
  if (!isPhotoControlMimeType(input.mimeType)) {
    throw new AtomicStudioGenerationError('Generated image MIME type is unsupported.', 'input')
  }
  if (!Number.isFinite(input.creditCost) || input.creditCost <= 0) {
    throw new AtomicStudioGenerationError('Generation credit cost must be positive.', 'input')
  }
  if (!input.prompt || !input.requestedModel) {
    throw new AtomicStudioGenerationError('Generated image prompt and model are required.', 'input')
  }

  const canonicalResult = MinimalSchemaZ.safeParse(input.canonical)
  if (!canonicalResult.success) {
    throw new AtomicStudioGenerationError('Canonical child state is invalid.', 'input')
  }
  const objectEditResult = ObjectEditOperationMetadataZ.safeParse(input.objectEdit)
  if (!objectEditResult.success) {
    throw new AtomicStudioGenerationError('Object-edit operation metadata is invalid.', 'input')
  }
  if (
    objectEditResult.data.directParentImageId !== input.sourceImageId ||
    objectEditResult.data.selectedSourceImageId !== input.sourceImageId
  ) {
    throw new AtomicStudioGenerationError('Object-edit lineage must reference the submitted source image.', 'input')
  }

  const buffer = Buffer.from(input.imageBase64, 'base64')
  if (buffer.length === 0) {
    throw new AtomicStudioGenerationError('Generated image bytes are missing.', 'input')
  }
  return {
    canonical: canonicalResult.data,
    objectEdit: objectEditResult.data,
    position: validPosition(input.position),
    buffer,
  }
}

/**
 * Stages provider output in Storage, then commits the image row, direct-parent
 * lineage, canonical state, operation metadata, dish state, and credit debit
 * through one database RPC. An RPC failure never produces a successful child.
 */
export async function finalizeStudioGenerationAtomic(
  input: FinalizeStudioGenerationAtomicInput,
  dependencies: FinalizeStudioGenerationAtomicDependencies = {},
): Promise<FinalizeStudioGenerationAtomicResult> {
  const validated = validateInput(input)
  let dimensions: { width?: number; height?: number }
  try {
    dimensions = await sharp(validated.buffer).metadata()
  } catch (error) {
    throw new AtomicStudioGenerationError(
      error instanceof Error ? `Unable to decode generated image: ${error.message}` : 'Unable to decode generated image.',
      'input',
    )
  }
  if (!dimensions.width || !dimensions.height) {
    throw new AtomicStudioGenerationError('Generated image dimensions are unavailable.', 'input')
  }

  // Provider bytes are stored verbatim, and the provider may not return the
  // encoding the caller declares. The extension, storage content type, and the
  // persisted mime_type must all describe the bytes actually uploaded, otherwise
  // a later read of this child cannot decode it against its own label.
    const resolvedMime = resolveStudioImageMimeType(validated.buffer, input.mimeType)
  if (resolvedMime.mismatched || (input.providerMimeType && input.providerMimeType !== resolvedMime.mimeType)) {
    logger.warn('Generated image MIME metadata differs from its returned byte container', {
      declaredMimeType: input.mimeType,
      providerMimeType: input.providerMimeType ?? null,
      detectedMimeType: resolvedMime.detected,
      persistedMimeType: resolvedMime.mimeType,
    })
  }
  const storedMimeType = resolvedMime.mimeType

  const imageId = (dependencies.createImageId ?? randomUUID)()
  const storagePath = buildStudioStoragePath(input.userId, imageId, storedMimeType)
  const supabase = (dependencies.createClient ?? (() => createAdminSupabaseClient() as unknown as AtomicSupabase))()
  const storage = supabase.storage.from(STUDIO_STORAGE_BUCKET)

  const { error: uploadError } = await storage.upload(storagePath, validated.buffer, {
    contentType: storedMimeType,
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) {
    throw new AtomicStudioGenerationError(`Failed to upload generated image: ${uploadError.message}`, 'upload')
  }

  const publicUrl = normalizeStoragePublicUrl(storage.getPublicUrl(storagePath).data.publicUrl)
  const metadata = {
    ...(input.metadata ?? {}),
    editorStateVersion: 1,
    editorState: { schema: validated.canonical, position: validated.position },
    objectEdit: validated.objectEdit,
  }

  const { data, error } = await supabase.rpc('studio_commit_generated_image_v2', {
    p_user_id: input.userId,
    p_dish_id: input.dishId,
    p_source_image_id: input.sourceImageId,
    p_child_image_id: imageId,
    p_storage_path: storagePath,
    p_public_url: publicUrl,
    p_mime_type: storedMimeType,
    p_width: dimensions.width,
    p_height: dimensions.height,
    p_prompt: input.prompt,
    p_model: input.requestedModel,
    p_metadata: metadata,
    p_credit_cost: input.creditCost,
  })

  const row = !error ? firstRpcRow(data) : null
  const committedImageId = row ? readRpcString(row, 'image_id') : null
  const committedImageUrl = row ? readRpcString(row, 'image_url') : null
  const committedDishId = row ? readRpcString(row, 'dish_id') : null
  const committedModel = row ? readRpcString(row, 'model') : null
  const balanceAfter = row ? readRpcBalance(row) : null

  if (error || !committedImageId || !committedImageUrl || !committedDishId || !committedModel || balanceAfter === null) {
    const { error: compensationError } = await storage.remove([storagePath])
    if (compensationError) {
      logger.error('❌ [Studio Atomic Finalization] Failed to compensate orphaned storage object', {
        storagePath,
        imageId,
        error: compensationError.message,
      })
    }
    throw new AtomicStudioGenerationError(
      `Failed to atomically commit generated image: ${error?.message ?? 'invalid RPC result'}`,
      'commit',
      Boolean(compensationError),
    )
  }

  const success: StudioGenerationSuccess = {
    imageUrl: committedImageUrl,
    imageId: committedImageId,
    dishId: committedDishId,
    model: committedModel,
    ...(input.validationStatus === undefined ? {} : { validationStatus: input.validationStatus }),
    credits: { cost: input.creditCost, balanceAfter },
  }

  return {
    record: {
      id: committedImageId,
      publicUrl: committedImageUrl,
      dishId: committedDishId,
      model: committedModel,
      storagePath,
      width: dimensions.width,
      height: dimensions.height,
    },
    success,
  }
}
