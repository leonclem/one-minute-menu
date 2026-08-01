/**
 * Photo Studio — export variant persistence and orchestration.
 *
 * Owns the `studio_export_variants` table, storage under
 * `{userId}/studio/exports/{variantId}.{ext}`, and the tile projection the
 * Studio client renders.
 *
 * The table doubles as the work queue (see migration 078), following the
 * cut-out pipeline's precedent of queueing on the domain row rather than a
 * separate jobs table. Every function accepts an optional Supabase client so
 * the Railway worker can supply its Docker-aware client.
 */

import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'

import { logger } from '@/lib/logger'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { getCreditCostForExportMethod } from '@/lib/studio/credits'
import {
  EXPORT_PRESETS,
  resolveExportGenerationMethod,
  type ExportSourceDimensions,
  type StudioExportGenerationMethod,
  type StudioExportPreset,
  type StudioExportStatus,
  type StudioExportVariantType,
} from '@/lib/studio/export-presets'
import { isExportAiExpandEnabled } from '@/lib/studio/export-renderers'
import {
  extensionForMime,
  normalizeStoragePublicUrl,
  STUDIO_STORAGE_BUCKET,
} from '@/lib/studio/storage-paths'
import type {
  StudioExportTile,
  StudioExportVariantRecord,
  StudioImageRecord,
} from '@/lib/studio/types'

const TABLE = 'studio_export_variants'

/** Generation stuck past this long is treated as abandoned by the UI. */
export const STALE_IN_FLIGHT_MS = 5 * 60 * 1000

/** Any Supabase client with service-role access. */
export type ExportDbClient = SupabaseClient<any, any, any>

function db(client?: ExportDbClient): ExportDbClient {
  return client ?? (createAdminSupabaseClient() as ExportDbClient)
}

export class StudioExportError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status = 400) {
    super(message)
    this.name = 'StudioExportError'
    this.code = code
    this.status = status
  }
}

export function buildExportStoragePath(
  userId: string,
  variantId: string,
  mimeType: string,
): string {
  return `${userId}/studio/exports/${variantId}.${extensionForMime(mimeType)}`
}

/** Methods that call a paid external provider and must run on the worker. */
export function isWorkerBoundMethod(method: StudioExportGenerationMethod): boolean {
  return method !== 'crop_resize'
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export interface ExportMethodAvailability {
  aiExpand: boolean
  cutout: boolean
}

/**
 * Which generation methods can actually run in this environment. Keeps the UI
 * honest instead of offering a tile that will always fail.
 *
 * Note these are evaluated where the code runs: the web app decides what to
 * offer, the worker holds the provider keys. `NANO_BANANA_API_KEY` and
 * `BACKGROUND_REMOVAL_PROVIDER` therefore need to be present on both.
 */
export function resolveExportMethodAvailability(): ExportMethodAvailability {
  return {
    aiExpand: isExportAiExpandEnabled() && Boolean(process.env.NANO_BANANA_API_KEY),
    cutout:
      process.env.CUTOUT_GENERATION_DISABLED !== 'true' &&
      Boolean(process.env.BACKGROUND_REMOVAL_PROVIDER),
  }
}

function unavailableReason(
  method: StudioExportGenerationMethod,
  availability: ExportMethodAvailability,
): string | null {
  if (method === 'cutout' && !availability.cutout) {
    return 'Cut-outs are not available yet on your account.'
  }
  if ((method === 'ai_expand' || method === 'ai_recompose') && !availability.aiExpand) {
    return 'AI background expansion is temporarily unavailable.'
  }
  return null
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export interface ExportVariantPlan {
  preset: StudioExportPreset
  method: StudioExportGenerationMethod
  estimatedCredits: number
  available: boolean
  unavailableReason: string | null
  /** True when this variant must be handed to the background worker. */
  queued: boolean
}

/** Resolve method + credit quote for one preset against a hero image. */
export function planExportVariant(
  preset: StudioExportPreset,
  source: ExportSourceDimensions | null,
  availability: ExportMethodAvailability = resolveExportMethodAvailability(),
): ExportVariantPlan {
  const method = resolveExportGenerationMethod(preset, source, {
    aiExpandEnabled: availability.aiExpand,
  })
  const reason = unavailableReason(method, availability)

  return {
    preset,
    method,
    estimatedCredits: getCreditCostForExportMethod(method),
    available: reason === null,
    unavailableReason: reason,
    queued: isWorkerBoundMethod(method),
  }
}

/**
 * Read the pixel dimensions of a hero image.
 *
 * Dimensions decide whether a format is a free resize or a charged AI expand,
 * so the quote shown in the grid and the charge applied on generate must come
 * from the same number. Images persisted before dimensions were recorded are
 * measured once and backfilled.
 */
export async function resolveHeroDimensions(
  image: StudioImageRecord,
  loadBuffer: () => Promise<Buffer>,
  client?: ExportDbClient,
): Promise<ExportSourceDimensions | null> {
  if (image.width && image.height) {
    return { width: image.width, height: image.height }
  }

  try {
    const meta = await sharp(await loadBuffer()).metadata()
    if (!meta.width || !meta.height) return null

    const dimensions = { width: meta.width, height: meta.height }
    await backfillStudioImageDimensions(image.id, dimensions, client)
    return dimensions
  } catch (error) {
    logger.warn('⚠️ [Studio Export] Could not read hero image dimensions', {
      imageId: image.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

async function backfillStudioImageDimensions(
  imageId: string,
  dimensions: ExportSourceDimensions,
  client?: ExportDbClient,
): Promise<void> {
  const { error } = await db(client)
    .from('studio_images')
    .update(dimensions)
    .eq('id', imageId)
    .is('width', null)

  if (error) {
    logger.warn('⚠️ [Studio Export] Failed to backfill image dimensions', {
      imageId,
      error: error.message,
    })
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listExportVariantsForSource(
  userId: string,
  sourceImageId: string,
  client?: ExportDbClient,
): Promise<StudioExportVariantRecord[]> {
  const { data, error } = await db(client)
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('source_image_id', sourceImageId)

  if (error) {
    throw new Error(`Failed to list studio export variants: ${error.message}`)
  }

  return (data ?? []) as StudioExportVariantRecord[]
}

export async function getExportVariant(
  userId: string,
  sourceImageId: string,
  variantType: StudioExportVariantType,
  client?: ExportDbClient,
): Promise<StudioExportVariantRecord | null> {
  const { data, error } = await db(client)
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('source_image_id', sourceImageId)
    .eq('variant_type', variantType)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load studio export variant: ${error.message}`)
  }

  return (data as StudioExportVariantRecord | null) ?? null
}

export async function getExportVariantById(
  variantId: string,
  client?: ExportDbClient,
): Promise<StudioExportVariantRecord | null> {
  const { data, error } = await db(client)
    .from(TABLE)
    .select('*')
    .eq('id', variantId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load studio export variant: ${error.message}`)
  }

  return (data as StudioExportVariantRecord | null) ?? null
}

/**
 * Project presets + persisted rows into the tile list the client renders, so
 * every MVP format always appears even before anything has been generated.
 */
export function buildExportTiles(input: {
  rows: StudioExportVariantRecord[]
  source: ExportSourceDimensions | null
  availability?: ExportMethodAvailability
}): StudioExportTile[] {
  const availability = input.availability ?? resolveExportMethodAvailability()
  const rowByType = new Map(input.rows.map((row) => [row.variant_type, row]))

  return EXPORT_PRESETS.map((preset) => {
    const plan = planExportVariant(preset, input.source, availability)
    const row = rowByType.get(preset.key) ?? null

    const status: StudioExportStatus = row?.status ?? 'empty'
    // A ready row keeps the method and cost it was actually produced with.
    const isReady = status === 'ready'

    return {
      variantType: preset.key,
      label: preset.label,
      hint: preset.hint,
      width: preset.width,
      height: preset.height,
      aspectRatio: preset.aspectRatio,
      fileType: preset.fileType,
      status,
      generationMethod: isReady && row ? row.generation_method : plan.method,
      estimatedCredits: plan.estimatedCredits,
      creditsCharged: row?.credits_charged ?? null,
      previewUrl: isReady ? (row?.preview_url ?? null) : null,
      errorMessage: row?.error_message ?? null,
      available: plan.available,
      unavailableReason: plan.unavailableReason,
      updatedAt: row?.updated_at ?? null,
    } satisfies StudioExportTile
  })
}

/** True when any tile is still in flight, so the client should keep polling. */
export function hasInFlightExportTiles(tiles: StudioExportTile[]): boolean {
  return tiles.some((tile) => tile.status === 'queued' || tile.status === 'generating')
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Stage a tile for generation, either `queued` for the worker or `generating`
 * for an inline crop/resize.
 *
 * A tile already in flight is rejected so a user cannot double-spend credits
 * by clicking Generate twice.
 */
export async function stageExportVariant(input: {
  userId: string
  dishId: string
  sourceImageId: string
  preset: StudioExportPreset
  method: StudioExportGenerationMethod
  estimatedCredits: number
  status: 'queued' | 'generating'
  priority?: number
  client?: ExportDbClient
}): Promise<StudioExportVariantRecord> {
  const supabase = db(input.client)
  const existing = await getExportVariant(
    input.userId,
    input.sourceImageId,
    input.preset.key,
    supabase,
  )

  if (
    existing &&
    (existing.status === 'queued' || existing.status === 'generating') &&
    Date.now() - new Date(existing.updated_at).getTime() <= STALE_IN_FLIGHT_MS
  ) {
    throw new StudioExportError(
      `${input.preset.label} is already being generated.`,
      'STUDIO_EXPORT_IN_FLIGHT',
      409,
    )
  }

  const now = new Date().toISOString()
  const patch = {
    user_id: input.userId,
    dish_id: input.dishId,
    source_image_id: input.sourceImageId,
    variant_type: input.preset.key,
    width: input.preset.width,
    height: input.preset.height,
    aspect_ratio: input.preset.aspectRatio,
    file_type: input.preset.fileType,
    status: input.status,
    generation_method: input.method,
    estimated_credits: input.estimatedCredits,
    error_message: null as string | null,
    error_code: null as string | null,
    retry_count: 0,
    priority: input.priority ?? 0,
    worker_id: null as string | null,
    available_at: now,
    started_at: input.status === 'generating' ? now : null,
    completed_at: null as string | null,
    updated_at: now,
  }

  const { data, error } = existing
    ? await supabase.from(TABLE).update(patch).eq('id', existing.id).select('*').single()
    : await supabase
        .from(TABLE)
        .insert({ id: randomUUID(), ...patch })
        .select('*')
        .single()

  if (error || !data) {
    throw new Error(`Failed to stage export variant: ${error?.message ?? 'unknown'}`)
  }

  return data as StudioExportVariantRecord
}

/** Upload the rendered asset and mark the variant ready. */
export async function completeExportVariant(input: {
  userId: string
  variant: StudioExportVariantRecord
  buffer: Buffer
  mimeType: string
  creditsCharged: number
  metadata?: Record<string, unknown>
  client?: ExportDbClient
}): Promise<StudioExportVariantRecord> {
  const supabase = db(input.client)
  const storagePath = buildExportStoragePath(input.userId, input.variant.id, input.mimeType)

  const { error: uploadError } = await supabase.storage
    .from(STUDIO_STORAGE_BUCKET)
    .upload(storagePath, input.buffer, {
      contentType: input.mimeType,
      cacheControl: '31536000',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Failed to upload export variant: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from(STUDIO_STORAGE_BUCKET)
    .getPublicUrl(storagePath)
  // Bust the CDN cache when a tile is regenerated at the same path, and force
  // the browser-facing host in case the worker resolved an internal origin.
  const publicUrl = `${normalizeStoragePublicUrl(urlData.publicUrl)}?v=${Date.now()}`

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'ready',
      storage_path: storagePath,
      preview_url: publicUrl,
      credits_charged: input.creditsCharged,
      error_message: null,
      error_code: null,
      worker_id: null,
      completed_at: new Date().toISOString(),
      metadata: { ...(input.variant.metadata ?? {}), ...(input.metadata ?? {}) },
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.variant.id)
    .select('*')
    .single()

  if (error || !data) {
    await supabase.storage
      .from(STUDIO_STORAGE_BUCKET)
      .remove([storagePath])
      .catch(() => undefined)
    throw new Error(`Failed to finalise export variant: ${error?.message ?? 'unknown'}`)
  }

  return data as StudioExportVariantRecord
}

export async function failExportVariant(
  variantId: string,
  message: string,
  errorCode?: string,
  client?: ExportDbClient,
): Promise<void> {
  const { error } = await db(client)
    .from(TABLE)
    .update({
      status: 'failed',
      error_message: message.slice(0, 500),
      error_code: errorCode ?? null,
      worker_id: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', variantId)

  if (error) {
    logger.warn('⚠️ [Studio Export] Failed to record variant failure', {
      variantId,
      error: error.message,
    })
  }
}

/** Return a variant to the queue with backoff after a transient failure. */
export async function requeueExportVariantWithBackoff(input: {
  variantId: string
  retryDelaySeconds: number
  message: string
  currentRetryCount: number
  client?: ExportDbClient
}): Promise<void> {
  const availableAt = new Date(Date.now() + input.retryDelaySeconds * 1000).toISOString()

  const { error } = await db(input.client)
    .from(TABLE)
    .update({
      status: 'queued',
      retry_count: input.currentRetryCount + 1,
      error_message: input.message.slice(0, 500),
      worker_id: null,
      started_at: null,
      available_at: availableAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.variantId)

  if (error) {
    logger.warn('⚠️ [Studio Export] Failed to requeue variant', {
      variantId: input.variantId,
      error: error.message,
    })
  }
}

/** Count claimable variants, for the worker's adaptive polling interval. */
export async function getStudioExportQueueDepth(client?: ExportDbClient): Promise<number> {
  const { count, error } = await db(client)
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued')
    .lte('available_at', new Date().toISOString())

  if (error) {
    throw new Error(`Failed to read studio export queue depth: ${error.message}`)
  }

  return count ?? 0
}

/**
 * Remove every export variant derived from a hero image, including its storage
 * objects. Called before the hero image itself is deleted.
 */
export async function deleteExportVariantsForSource(
  userId: string,
  sourceImageId: string,
  client?: ExportDbClient,
): Promise<void> {
  const supabase = db(client)
  const rows = await listExportVariantsForSource(userId, sourceImageId, supabase)
  const paths = rows
    .map((row) => row.storage_path)
    .filter((path): path is string => typeof path === 'string' && path.length > 0)

  if (paths.length > 0) {
    await supabase.storage
      .from(STUDIO_STORAGE_BUCKET)
      .remove(paths)
      .catch(() => undefined)
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('source_image_id', sourceImageId)

  if (error) {
    throw new Error(`Failed to delete export variants: ${error.message}`)
  }
}
