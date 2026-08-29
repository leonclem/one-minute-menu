import { randomUUID } from 'crypto'
import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import type { StudioImageRecord } from '@/lib/studio/types'
import { NormalizedPointZ, NormalizedRegionZ, type NormalizedRegion } from './contracts'

export const SPATIAL_INVENTORY_VERSION = 1 as const
export const MAX_SPATIAL_ELEMENTS = 32
export const MAX_SPATIAL_LABEL_LENGTH = 160
export const MAX_SPATIAL_EVIDENCE_LENGTH = 400
export const MAX_SPATIAL_INVENTORY_BYTES = 24_000

const SpatialComponentRefZ = z
  .object({
    section: z.enum(['canvas', 'food_components']),
    field: z.enum(['main_vessel', 'main_item', 'garnishes', 'sides']),
    value: z.string().trim().min(1).max(MAX_SPATIAL_LABEL_LENGTH).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.section === 'canvas' && value.field !== 'main_vessel') {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Canvas may reference only main_vessel.' })
    }
    if (value.section === 'food_components' && value.field === 'main_vessel') {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Food components cannot reference main_vessel.' })
    }
  })

const CoarseSpatialHintZ = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('center'), center: NormalizedPointZ }).strict(),
  z.object({ kind: z.literal('region'), region: NormalizedRegionZ }).strict(),
])

export const SpatialElementV1Z = z
  .object({
    id: z.string().uuid(),
    label: z.string().trim().min(1).max(MAX_SPATIAL_LABEL_LENGTH),
    componentRef: SpatialComponentRefZ.optional(),
    hint: CoarseSpatialHintZ,
    visibility: z.enum(['visible', 'partial', 'occluded', 'removed']),
    confidence: z.number().finite().min(0).max(1).optional(),
    evidence: z.string().trim().min(1).max(MAX_SPATIAL_EVIDENCE_LENGTH).optional(),
  })
  .strict()

export const SpatialInventoryV1Z = z
  .object({
    version: z.literal(SPATIAL_INVENTORY_VERSION),
    imageId: z.string().uuid(),
    naturalWidth: z.number().int().positive().max(100_000),
    naturalHeight: z.number().int().positive().max(100_000),
    elements: z.array(SpatialElementV1Z).max(MAX_SPATIAL_ELEMENTS),
    extractedAt: z.string().datetime(),
    extractorVersion: z.string().trim().min(1).max(100),
  })
  .strict()
  .superRefine((inventory, context) => {
    const ids = new Set(inventory.elements.map((element) => element.id))
    if (ids.size !== inventory.elements.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['elements'], message: 'Element IDs must be unique.' })
    }
    if (JSON.stringify(inventory).length > MAX_SPATIAL_INVENTORY_BYTES) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Spatial inventory exceeds its byte limit.' })
    }
  })

export type SpatialElementV1 = z.infer<typeof SpatialElementV1Z>
export type SpatialInventoryV1 = z.infer<typeof SpatialInventoryV1Z>

const ProviderSpatialElementZ = z
  .object({
    label: z.string().trim().min(1).max(MAX_SPATIAL_LABEL_LENGTH),
    componentRef: SpatialComponentRefZ.optional(),
    hint: CoarseSpatialHintZ,
    visibility: z.enum(['visible', 'partial', 'occluded', 'removed']),
    confidence: z.number().finite().min(0).max(1).optional(),
    evidence: z.string().trim().min(1).max(MAX_SPATIAL_EVIDENCE_LENGTH).optional(),
  })
  .passthrough()

const ProviderSpatialObservationZ = z
  .object({
    elements: z.array(ProviderSpatialElementZ).max(MAX_SPATIAL_ELEMENTS),
    extractorVersion: z.string().trim().min(1).max(100).optional(),
  })
  .passthrough()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Converts provider observations into an image-bound, app-ID-owned inventory. */
export function buildSpatialInventory(
  source: Pick<StudioImageRecord, 'id' | 'width' | 'height'>,
  raw: unknown,
  now = new Date(),
): SpatialInventoryV1 | null {
  const naturalWidth = source.width
  const naturalHeight = source.height
  if (!isRecord(raw) || !Number.isInteger(naturalWidth) || !Number.isInteger(naturalHeight) || naturalWidth === null || naturalHeight === null || naturalWidth <= 0 || naturalHeight <= 0) {
    return null
  }
  const candidate = raw.spatialInventory ?? raw.spatial_inventory
  const parsed = ProviderSpatialObservationZ.safeParse(candidate)
  if (!parsed.success) return null

  const inventory = {
    version: SPATIAL_INVENTORY_VERSION,
    imageId: source.id,
    naturalWidth,
    naturalHeight,
    elements: parsed.data.elements.map((element) => ({
      id: randomUUID(),
      label: element.label,
      ...(element.componentRef ? { componentRef: element.componentRef } : {}),
      hint: element.hint,
      visibility: element.visibility,
      ...(element.confidence === undefined ? {} : { confidence: element.confidence }),
      ...(element.evidence === undefined ? {} : { evidence: element.evidence }),
    })),
    extractedAt: now.toISOString(),
    extractorVersion: parsed.data.extractorVersion ?? 'studio-extraction-v1',
  }
  const validated = SpatialInventoryV1Z.safeParse(inventory)
  return validated.success ? validated.data : null
}

export async function persistSpatialInventory(input: {
  userId: string
  dishId: string
  inventory: SpatialInventoryV1
}): Promise<void> {
  const validated = SpatialInventoryV1Z.parse(input.inventory)
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('studio_image_spatial_inventories').upsert(
    {
      image_id: validated.imageId,
      user_id: input.userId,
      dish_id: input.dishId,
      version: validated.version,
      inventory: validated,
      diagnostics_status: 'validated',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'image_id' },
  )
  if (error) throw new Error(`Failed to persist spatial inventory: ${error.message}`)
}

export type SpatialMatch =
  | { matched: true; element: SpatialElementV1; score: number }
  | { matched: false; reason: 'stale' | 'ambiguous' | 'no-match' }

function regionArea(region: NormalizedRegion): number {
  return (region.right - region.left) * (region.bottom - region.top)
}

function overlap(left: NormalizedRegion, right: NormalizedRegion): number {
  const width = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
  const height = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top))
  return width * height
}

function hintScore(element: SpatialElementV1, selection: NormalizedRegion): number {
  if (element.hint.kind === 'region') {
    const intersection = overlap(element.hint.region, selection)
    if (intersection <= 0) return 0
    return intersection / Math.max(1e-6, Math.min(regionArea(element.hint.region), regionArea(selection)))
  }
  const center = element.hint.center
  const dx = center.x < selection.left ? selection.left - center.x : center.x > selection.right ? center.x - selection.right : 0
  const dy = center.y < selection.top ? selection.top - center.y : center.y > selection.bottom ? center.y - selection.bottom : 0
  const distance = Math.hypot(dx, dy)
  return Math.max(0, 1 - distance / 0.25)
}

/**
 * Returns an identity only for one clear, current-image candidate. Ancestor
 * inventory IDs are rejected as stale and broad/multi-object selections remain
 * deliberately ambiguous.
 */
export function matchSpatialElement(input: {
  inventory: SpatialInventoryV1 | null | undefined
  imageId: string
  selection: NormalizedRegion
}): SpatialMatch {
  const { inventory, imageId, selection } = input
  if (!inventory || inventory.imageId !== imageId || !SpatialInventoryV1Z.safeParse(inventory).success) {
    return { matched: false, reason: 'stale' }
  }
  if (regionArea(selection) > 0.5) return { matched: false, reason: 'ambiguous' }

  const scored = inventory.elements
    .filter((element) => element.visibility === 'visible' || element.visibility === 'partial')
    .map((element) => ({ element, score: hintScore(element, selection) }))
    .filter((entry) => entry.score >= 0.2)
    .sort((left, right) => right.score - left.score)

  if (scored.length === 0) return { matched: false, reason: 'no-match' }
  if (scored.length > 1 && scored[0].score - scored[1].score < 0.15) {
    return { matched: false, reason: 'ambiguous' }
  }
  return { matched: true, element: scored[0].element, score: scored[0].score }
}

export async function loadSpatialInventory(imageId: string): Promise<SpatialInventoryV1 | null> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_image_spatial_inventories')
    .select('inventory')
    .eq('image_id', imageId)
    .maybeSingle()

  if (error || !data || !isRecord(data)) return null
  const parsed = SpatialInventoryV1Z.safeParse(data.inventory)
  return parsed.success && parsed.data.imageId === imageId ? parsed.data : null
}
