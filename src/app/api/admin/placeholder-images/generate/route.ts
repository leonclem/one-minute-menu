import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { getPromptConstructionService } from '@/lib/prompt-construction'
import {
  insertQueuedImageJobsConsumeQuotaAndRelease,
  type QueuedImageGenerationJobInsert,
} from '@/lib/image-generation/enqueue-helpers'
import imageLibrary from '@/data/placeholder-menus/image-library.json'
import type { PlaceholderImageEntry } from '@/data/placeholder-menus/types'
import type { MenuItem } from '@/types'
import { logger } from '@/lib/logger'

const library = imageLibrary as PlaceholderImageEntry[]

const SYSTEM_MENU_NAME = '__placeholder_image_generation__'

/**
 * Ensure a system-owned menu exists for placeholder image generation.
 * This menu holds menu_items rows required by the generation pipeline.
 */
async function ensureSystemMenu(supabase: any, adminUserId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('menus')
    .select('id')
    .eq('user_id', adminUserId)
    .eq('name', SYSTEM_MENU_NAME)
    .limit(1)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data: created, error } = await supabase
    .from('menus')
    .insert({
      user_id: adminUserId,
      name: SYSTEM_MENU_NAME,
      slug: 'placeholder-gen',
      status: 'draft',
      current_version: 1,
      menu_data: { items: [], theme: {} },
    })
    .select('id')
    .single()

  if (error || !created?.id) {
    throw new Error(`Failed to create system menu: ${error?.message}`)
  }
  return created.id
}

/**
 * Ensure a menu_items row exists for a given image key.
 * The worker requires a `menu_items` row to process the job.
 */
async function ensureMenuItem(
  supabase: any,
  menuId: string,
  imageKey: string,
  entry: PlaceholderImageEntry,
): Promise<string> {
  const stableId = imageKeyToUuid(imageKey)

  // Check by stable ID first
  const { data: existing } = await supabase
    .from('menu_items')
    .select('id')
    .eq('id', stableId)
    .maybeSingle()

  if (existing?.id) return existing.id

  // Use a unique order_index derived from the key hash to avoid collisions
  // across multiple items in the same system menu
  let h = 0
  for (let i = 0; i < imageKey.length; i++) {
    h = ((h << 5) - h + imageKey.charCodeAt(i)) | 0
  }
  const orderIndex = Math.abs(h) % 100000

  const { error } = await supabase
    .from('menu_items')
    .insert({
      id: stableId,
      menu_id: menuId,
      name: entry.representative_item,
      description: `${entry.cuisine} ${entry.image_archetype}`,
      price: 0,
      category: entry.image_archetype,
      available: true,
      order_index: orderIndex,
      image_source: 'none',
    })

  if (error) {
    // If insert failed, re-query — another request may have inserted it concurrently
    const { data: retry } = await supabase
      .from('menu_items')
      .select('id')
      .eq('id', stableId)
      .maybeSingle()

    if (retry?.id) return retry.id

    throw new Error(`Failed to create menu_items row for ${imageKey}: ${error.message}`)
  }

  return stableId
}

/** Convert an image key to a stable, valid UUID v4-format string. */
function imageKeyToUuid(key: string): string {
  // Two independent hashes for enough bits to fill a UUID
  let h1 = 0, h2 = 0
  for (let i = 0; i < key.length; i++) {
    h1 = ((h1 << 5) - h1 + key.charCodeAt(i)) | 0
    h2 = ((h2 << 7) + h2 + key.charCodeAt(i) * 31) | 0
  }
  const a = Math.abs(h1).toString(16).padStart(8, '0').slice(0, 8)
  const b = Math.abs(h2).toString(16).padStart(8, '0').slice(0, 4)
  const c = ('4' + Math.abs(h1 ^ h2).toString(16).padStart(3, '0')).slice(0, 4)
  const d = ('a' + Math.abs(h2 ^ 0x5f3e).toString(16).padStart(3, '0')).slice(0, 4)
  const e = Math.abs(h1 ^ h2 ^ 0xdead).toString(16).padStart(12, '0').slice(0, 12)
  return `${a}-${b}-${c}-${d}-${e}`
}

/**
 * POST /api/admin/placeholder-images/generate
 *
 * Enqueue placeholder image generation using the same pipeline as /extracted.
 * Uses PromptConstructionService for prompt building and the Railway worker
 * (Gemini Flash) for actual generation.
 *
 * Body: { imageKey: string, cuisine?: string, establishmentType?: string }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { user, supabase } = admin

  const body = await request.json() as {
    imageKey: string
    cuisine?: string
    establishmentType?: string
  }

  if (!body.imageKey) {
    return NextResponse.json({ error: 'imageKey is required' }, { status: 400 })
  }

  const entry = library.find(e => e.suggested_image_key === body.imageKey)
  if (!entry) {
    return NextResponse.json({ error: 'Image key not found in library' }, { status: 404 })
  }

  logger.info(`[Placeholder Gen] Enqueueing: ${body.imageKey}`)

  try {
    // 1. Ensure system menu and menu_items row
    const menuId = await ensureSystemMenu(supabase, user.id)
    const menuItemId = await ensureMenuItem(supabase, menuId, body.imageKey, entry)

    // 2. Build prompt using PromptConstructionService (same as /extracted)
    const promptService = getPromptConstructionService()
    const menuItem: MenuItem = {
      id: menuItemId,
      name: entry.representative_item,
      description: `${entry.cuisine} ${entry.image_archetype} dish`,
      price: 0,
      available: true,
      category: entry.image_archetype,
      order: 0,
      imageSource: 'none',
    }

    const promptResult = promptService.buildPromptV2(menuItem, {
      angle: '45',
      lighting: 'natural',
      resolution: '1k',
      establishmentType: body.establishmentType || 'casual-dining',
      primaryCuisine: body.cuisine || entry.cuisine.toLowerCase(),
      itemCategory: entry.image_archetype,
    })

    // 3. Enqueue via the same pipeline (bypasses quota for admin)
    const batchId = crypto.randomUUID()
    const job: QueuedImageGenerationJobInsert = {
      user_id: user.id,
      menu_id: menuId,
      menu_item_id: menuItemId,
      batch_id: batchId,
      status: 'queued',
      prompt: promptResult.prompt,
      negative_prompt: promptResult.negativePrompt,
      api_params: {
        prompt: promptResult.prompt,
        negative_prompt: promptResult.negativePrompt,
        aspect_ratio: '1:1',
        number_of_images: 1,
        safety_filter_level: 'block_some',
        person_generation: 'dont_allow',
        context: 'food',
        style_params: {
          angle: '45',
          lighting: 'natural',
          resolution: '1k',
        },
        placeholder_image_key: body.imageKey,
      },
      number_of_variations: 1,
      estimated_cost: null,
      priority: 200, // higher priority than regular users
      available_at: null, // set after quota
    }

    const { insertedJobs } = await insertQueuedImageJobsConsumeQuotaAndRelease(
      supabase,
      {
        userId: user.id,
        jobs: [job],
        totalVariationUnits: 1,
      }
    )

    const insertedJob = insertedJobs[0]

    logger.info(`[Placeholder Gen] Enqueued job ${insertedJob.id} for ${body.imageKey}`)

    return NextResponse.json({
      success: true,
      data: {
        imageKey: body.imageKey,
        jobId: insertedJob.id,
        menuItemId,
        prompt: promptResult.prompt,
      },
    })
  } catch (error) {
    logger.error(`[Placeholder Gen] Error:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
