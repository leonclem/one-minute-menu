import { NextRequest, NextResponse } from 'next/server'
import { assertUserCanEditMenu, DatabaseError, userOperations } from '@/lib/database'
import {
  getImageGenerationQueuePriority,
  insertQueuedImageJobsConsumeQuotaAndRelease,
  parseReferenceImagesForEnqueue,
} from '@/lib/image-generation/enqueue-helpers'
import type { QueuedImageGenerationJobInsert } from '@/lib/image-generation/enqueue-helpers'
import { getItemDailyGenerationLimit } from '@/lib/image-generation-limits'
import { logger } from '@/lib/logger'
import { getPromptConstructionService } from '@/lib/prompt-construction'
import { quotaOperations } from '@/lib/quota-management'
import { checkRateLimit, getBatchLimits } from '@/lib/rate-limiting'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PLAN_CONFIGS, type ImageGenerationRequest, type MenuItem, type NanoBananaParams, type UserPlan } from '@/types'

export const runtime = 'nodejs'

type BatchImageGenerationRequest = {
  menuId: string
  itemIds?: string[]
  items?: Array<{ id: string }>
  styleParams?: ImageGenerationRequest['styleParams']
  numberOfVariations?: number
  generationNotes?: string
  referenceImages?: Array<{ dataUrl: string; comment?: string; role?: string; name?: string }>
  referenceMode?: 'style_match' | 'composite'
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(v => v.trim()).filter(Boolean)))
}

function getRequestedItemIds(body: BatchImageGenerationRequest): string[] {
  const fromItemIds = Array.isArray(body.itemIds) ? body.itemIds : []
  const fromItems = Array.isArray(body.items) ? body.items.map(item => item.id) : []
  return uniqueStrings([...fromItemIds, ...fromItems])
}

function findMenuItem(menuData: any, itemId: string): any | null {
  const flatItems = Array.isArray(menuData?.items) ? menuData.items : []
  const flatMatch = flatItems.find((item: any) => item?.id === itemId)
  if (flatMatch) return flatMatch

  const categories = Array.isArray(menuData?.categories) ? menuData.categories : []
  for (const category of categories) {
    const items = Array.isArray(category?.items) ? category.items : []
    const match = items.find((item: any) => item?.id === itemId)
    if (match) return { ...match, category: match.category || category.name }
  }

  return null
}

function replaceMenuItemId(menuData: any, oldId: string, newId: string): any {
  const updatedItems = Array.isArray(menuData?.items)
    ? menuData.items.map((item: any) => item?.id === oldId ? { ...item, id: newId } : item)
    : menuData?.items

  const updatedCategories = Array.isArray(menuData?.categories)
    ? menuData.categories.map((category: any) => ({
        ...category,
        items: Array.isArray(category?.items)
          ? category.items.map((item: any) => item?.id === oldId ? { ...item, id: newId } : item)
          : category?.items,
      }))
    : menuData?.categories

  return {
    ...menuData,
    items: updatedItems,
    categories: updatedCategories,
  }
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.AI_IMAGE_GENERATION_DISABLED === 'true') {
      return NextResponse.json(
        { error: 'Image creation is temporarily unavailable', code: 'FEATURE_DISABLED' },
        { status: 503 }
      )
    }

    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as BatchImageGenerationRequest
    const itemIds = getRequestedItemIds(body)
    const requestedVariations = body.numberOfVariations || 1

    if (!body.menuId || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'Menu ID and at least one menu item ID are required', code: 'INVALID_REQUEST' },
        { status: 400 }
      )
    }

    if (requestedVariations !== 1) {
      return NextResponse.json(
        { error: 'Batch generation currently supports one photo per item', code: 'UNSUPPORTED_VARIATIONS' },
        { status: 400 }
      )
    }

    const { data: menuRow, error: menuError } = await supabase
      .from('menus')
      .select('*')
      .eq('id', body.menuId)
      .eq('user_id', user.id)
      .single()

    if (menuError || !menuRow) {
      return NextResponse.json({ error: 'Menu not found or unauthorized' }, { status: 404 })
    }

    const profile = await userOperations.getProfile(user.id, supabase)
    const plan = (profile?.plan ?? 'free') as UserPlan
    const batchLimits = getBatchLimits(plan)

    if (itemIds.length > batchLimits.maxBatchSize) {
      return NextResponse.json(
        {
          error: `You can generate up to ${batchLimits.maxBatchSize} photos in one batch on your plan.`,
          code: 'BATCH_LIMIT_EXCEEDED',
          maxBatchSize: batchLimits.maxBatchSize,
        },
        { status: 422 }
      )
    }

    const createdAt = new Date((menuRow as any).created_at || (menuRow as any).createdAt || Date.now())
    await assertUserCanEditMenu({
      userId: user.id,
      menuCreatedAt: createdAt,
      profile,
      supabaseClient: supabase,
    })

    const rateLimitCheck = await checkRateLimit(user.id, 'image_generation', plan)
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Please wait a moment before generating more images.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimitCheck.retryAfterSeconds,
          resetAt: rateLimitCheck.resetAt.toISOString(),
        },
        { status: 429 }
      )
    }

    const requestedResolution = (body.styleParams as any)?.resolution || '1k'
    const planConfig = PLAN_CONFIGS[plan]
    if (requestedResolution === '4k' && planConfig.maxImageResolution !== '4k') {
      return NextResponse.json(
        {
          error: '4K resolution is not available on your plan',
          code: 'RESOLUTION_NOT_SUPPORTED',
          upgrade: {
            cta: 'View Pricing',
            href: '/pricing',
            reason: 'Upgrade to Grid+ or Grid+Premium to access 4K image generation'
          }
        },
        { status: 403 }
      )
    }

    let menuData = menuRow.menu_data || {}
    const preparedItems: Array<{ originalId: string; normalizedId: string; item: any }> = []

    for (const itemId of itemIds) {
      const menuItem = findMenuItem(menuData, itemId)
      if (!menuItem) {
        return NextResponse.json(
          { error: `Menu item not found: ${itemId}`, code: 'MENU_ITEM_NOT_FOUND' },
          { status: 404 }
        )
      }

      const normalizedId = isUuid(itemId) ? itemId : crypto.randomUUID()
      if (normalizedId !== itemId) {
        menuData = replaceMenuItemId(menuData, itemId, normalizedId)
      }

      preparedItems.push({
        originalId: itemId,
        normalizedId,
        item: { ...menuItem, id: normalizedId },
      })
    }

    const normalizedIds = preparedItems.map(item => item.normalizedId)
    if (preparedItems.some(item => item.originalId !== item.normalizedId)) {
      const { error: updateMenuError } = await supabase
        .from('menus')
        .update({
          menu_data: menuData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.menuId)
        .eq('user_id', user.id)

      if (updateMenuError) {
        logger.error('[Batch Image Generation] Failed to normalize menu item IDs:', updateMenuError)
        return NextResponse.json(
          { error: 'Failed to prepare menu items for image generation', code: 'MENU_ITEM_NORMALIZATION_FAILED' },
          { status: 500 }
        )
      }
    }

    const { data: existingMenuItems, error: existingMenuItemsError } = await supabase
      .from('menu_items')
      .select('id')
      .in('id', normalizedIds)

    if (existingMenuItemsError) {
      return NextResponse.json(
        { error: 'Failed to check menu items', code: 'MENU_ITEM_CHECK_FAILED' },
        { status: 500 }
      )
    }

    const existingMenuItemIds = new Set((existingMenuItems || []).map((item: any) => item.id as string))
    const missingMenuItems = preparedItems.filter(item => !existingMenuItemIds.has(item.normalizedId))

    if (missingMenuItems.length > 0) {
      const { data: maxOrderRow } = await supabase
        .from('menu_items')
        .select('order_index')
        .eq('menu_id', body.menuId)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle()

      let nextOrderIndex = typeof maxOrderRow?.order_index === 'number' ? maxOrderRow.order_index + 1 : 0
      const rows = missingMenuItems.map(({ normalizedId, item }) => ({
        id: normalizedId,
        menu_id: body.menuId,
        name: item.name || 'Unnamed Item',
        description: item.description || null,
        price: typeof item.price === 'number' ? item.price : 0,
        category: item.category || null,
        available: typeof item.available === 'boolean' ? item.available : true,
        order_index: nextOrderIndex++,
        image_source: item.imageSource || 'none',
        custom_image_url: item.customImageUrl || null,
      }))

      const { error: insertMenuItemsError } = await supabase
        .from('menu_items')
        .insert(rows)

      if (insertMenuItemsError) {
        logger.error('[Batch Image Generation] Failed to create menu_items rows:', insertMenuItemsError)
        return NextResponse.json(
          { error: 'Failed to prepare menu items for generation', code: 'MENU_ITEM_INSERT_FAILED' },
          { status: 500 }
        )
      }
    }

    const { data: activeJobs, error: activeJobsError } = await supabase
      .from('image_generation_jobs')
      .select('id, menu_item_id, status')
      .in('menu_item_id', normalizedIds)
      .in('status', ['queued', 'processing'])

    if (activeJobsError) {
      return NextResponse.json(
        { error: 'Failed to check active image jobs', code: 'ACTIVE_JOB_CHECK_FAILED' },
        { status: 500 }
      )
    }

    if (activeJobs && activeJobs.length > 0) {
      return NextResponse.json(
        {
          error: 'One or more selected items already have image generation in progress.',
          code: 'IMAGE_GENERATION_ALREADY_ACTIVE',
          activeJobs,
        },
        { status: 409 }
      )
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const { data: todaysJobs, error: todaysJobsError } = await supabase
      .from('image_generation_jobs')
      .select('menu_item_id')
      .eq('user_id', user.id)
      .in('menu_item_id', normalizedIds)
      .gte('created_at', startOfToday.toISOString())

    if (todaysJobsError) {
      logger.warn('[Batch Image Generation] Failed to count daily attempts:', todaysJobsError)
    } else {
      const dailyLimit = getItemDailyGenerationLimit(plan, profile?.role)
      const attemptsByItem = new Map<string, number>()
      for (const job of todaysJobs || []) {
        const key = job.menu_item_id as string
        attemptsByItem.set(key, (attemptsByItem.get(key) || 0) + 1)
      }

      const limitedItem = normalizedIds.find(id => (attemptsByItem.get(id) || 0) >= dailyLimit)
      if (limitedItem) {
        const originalItem = preparedItems.find(item => item.normalizedId === limitedItem)
        return NextResponse.json(
          {
            error: 'Daily limit reached for one or more selected items. Try again tomorrow.',
            code: 'ITEM_DAILY_LIMIT',
            itemId: originalItem?.originalId || limitedItem,
            limit: dailyLimit,
            remaining: 0,
          },
          { status: 429 }
        )
      }
    }

    const totalRequested = preparedItems.length * requestedVariations
    const quotaStatus = await quotaOperations.checkQuota(user.id)
    if (quotaStatus.remaining < totalRequested) {
      return NextResponse.json(
        {
          error: quotaStatus.remaining === 0
            ? `You've used all ${quotaStatus.limit} generations this month. Upgrade to continue.`
            : `Insufficient quota. You have ${quotaStatus.remaining} generations remaining, but requested ${totalRequested}.`,
          code: 'QUOTA_EXCEEDED',
          quota: quotaStatus,
          upgrade: quotaStatus.needsUpgrade ? {
            cta: 'View Pricing',
            href: '/pricing',
            reason: `Increase monthly AI image generations from ${quotaStatus.limit} to ${quotaStatus.plan === 'free' ? '100' : '1000'}`
          } : undefined
        },
        { status: 429 }
      )
    }

    const referenceImages = parseReferenceImagesForEnqueue(body.referenceImages)
    const promptConstructionService = getPromptConstructionService()
    const batchId = crypto.randomUUID()
    const priority = getImageGenerationQueuePriority(plan)
    const jobsToInsert: QueuedImageGenerationJobInsert[] = []

    for (let index = 0; index < preparedItems.length; index++) {
      const { normalizedId, item } = preparedItems[index]
      const generationRequest: ImageGenerationRequest = {
        userId: user.id,
        menuItemId: normalizedId,
        itemName: item.name,
        itemDescription: item.description,
        category: item.category,
        generationNotes: body.generationNotes,
        styleParams: body.styleParams || {},
        numberOfVariations: requestedVariations,
      }

      const useV2 = !!(body.styleParams as any)?.angle && !!(body.styleParams as any)?.lighting
      const promptResult = useV2
        ? promptConstructionService.buildPromptV2(
            {
              id: normalizedId,
              name: item.name,
              description: item.description,
              price: item.price ?? 0,
              available: item.available ?? true,
              category: item.category,
              order: item.order ?? 0,
              imageSource: item.imageSource ?? 'none',
            } as MenuItem,
            {
              ...(body.styleParams as any),
              settingReferenceImage: body.referenceImages?.find(ref => ref.role === 'scene')?.dataUrl,
              establishmentType: menuRow.establishment_type,
              primaryCuisine: menuRow.primary_cuisine,
              itemCategory: item.category,
            }
          )
        : promptConstructionService.buildPrompt(
            {
              id: normalizedId,
              name: item.name,
              description: item.description,
              price: item.price ?? 0,
              available: item.available ?? true,
              category: item.category,
              order: item.order ?? 0,
              imageSource: item.imageSource ?? 'none',
            } as MenuItem,
            {
              ...(generationRequest.styleParams as any),
              establishmentType: menuRow.establishment_type,
              primaryCuisine: menuRow.primary_cuisine,
            }
          )

      const costEstimate = await quotaOperations.estimateCost(generationRequest)
      const apiParams: NanoBananaParams = {
        prompt: promptResult.prompt,
        negative_prompt: promptResult.negativePrompt,
        aspect_ratio: generationRequest.styleParams.aspectRatio || '1:1',
        number_of_images: requestedVariations,
        safety_filter_level: 'block_some',
        person_generation: 'dont_allow',
        context: 'food',
        reference_images: referenceImages,
        reference_mode: body.referenceMode || (referenceImages ? 'composite' : undefined),
      }

      jobsToInsert.push({
        user_id: user.id,
        menu_id: body.menuId,
        menu_item_id: normalizedId,
        batch_id: batchId,
        status: 'queued',
        prompt: promptResult.prompt,
        negative_prompt: promptResult.negativePrompt,
        api_params: {
          ...apiParams,
          batch_index: index,
          style_params: body.styleParams || {},
          generation_notes: body.generationNotes,
        },
        number_of_variations: requestedVariations,
        estimated_cost: costEstimate.estimatedTotal,
        priority,
        // Keep jobs unclaimable until quota has been consumed successfully.
        available_at: null,
      })
    }

    const { insertedJobs, quotaAfter: quotaAfterSubmission } =
      await insertQueuedImageJobsConsumeQuotaAndRelease(supabase, {
        userId: user.id,
        jobs: jobsToInsert,
        totalVariationUnits: totalRequested,
      })

    return NextResponse.json({
      success: true,
      data: {
        batchId,
        total: insertedJobs?.length || 0,
        jobs: (insertedJobs || []).map((job: any) => ({
          id: job.id,
          batchId: job.batch_id,
          menuId: job.menu_id,
          menuItemId: job.menu_item_id,
          status: job.status,
          createdAt: job.created_at,
        })),
        quota: quotaAfterSubmission,
      },
    }, { status: 202 })
  } catch (error) {
    logger.error('[Batch Image Generation] Error:', error)

    if (error instanceof DatabaseError) {
      const status = error.code === 'QUOTA_EXCEEDED'
        ? 429
        : error.code === 'EDIT_WINDOW_EXPIRED'
          ? 403
          : 400

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status }
      )
    }

    return NextResponse.json(
      { error: 'Failed to start batch image generation', code: 'BATCH_IMAGE_GENERATION_FAILED' },
      { status: 500 }
    )
  }
}
