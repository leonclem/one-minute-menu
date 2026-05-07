import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NanoBananaError } from '@/lib/nano-banana'
import { quotaOperations } from '@/lib/quota-management'
import { analyticsOperations } from '@/lib/analytics-server'
import {
  getImageGenerationQueuePriority,
  insertQueuedImageJobsConsumeQuotaAndRelease,
  parseReferenceImagesForEnqueue,
} from '@/lib/image-generation/enqueue-helpers'
import { getPromptConstructionService } from '@/lib/prompt-construction'
import { DatabaseError, assertUserCanEditMenu, userOperations } from '@/lib/database'
import { getItemDailyGenerationLimit } from '@/lib/image-generation-limits'
import { checkRateLimit } from '@/lib/rate-limiting'
import type { 
  ImageGenerationRequest, 
  NanoBananaParams,
  MenuItem,
  UserPlan
} from '@/types'
import { PLAN_CONFIGS } from '@/types'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// POST /api/generate-image - Generate AI image for menu item
export async function POST(request: NextRequest) {
  logger.info('🎨 [Generate Image] API called')
  
  try {
    // Feature flag (generation runs on the worker; web app only enqueues jobs)
    const disabled = process.env.AI_IMAGE_GENERATION_DISABLED === 'true'
    if (disabled) {
      logger.warn('🛑 [Generate Image] Disabled via flag')
      return NextResponse.json(
        {
          error: 'Image creation is temporarily unavailable',
          code: 'FEATURE_DISABLED',
        },
        { status: 503 }
      )
    }

    logger.debug('🔧 [Generate Image] Creating Supabase client...')
    const supabase = createServerSupabaseClient()
    
    // Authenticate user
    logger.debug('🔐 [Generate Image] Authenticating user...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.error('❌ [Generate Image] Auth failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    logger.info('✅ [Generate Image] User authenticated:', user.id)
    
    // Parse request body
    logger.debug('📦 [Generate Image] Parsing request body...')
    const body = await request.json() as {
      menuId: string
      menuItemId: string
      styleParams?: ImageGenerationRequest['styleParams']
      numberOfVariations?: number
      generationNotes?: string
      referenceImages?: Array<{ dataUrl: string; comment?: string; role?: string; name?: string }>
      referenceMode?: 'style_match' | 'composite'
      batchIndex?: number
    }
    
    logger.debug('📝 [Generate Image] Request:', { 
      menuItemId: body.menuItemId, 
      styleParams: body.styleParams,
      numberOfVariations: body.numberOfVariations,
      referenceImageCount: body.referenceImages?.length || 0,
      referenceMode: body.referenceMode,
      batchIndex: body.batchIndex
    })
    
    if (!body.menuItemId || !body.menuId) {
      logger.error('❌ [Generate Image] Missing menuItemId')
      return NextResponse.json(
        { error: 'Menu ID and menu item ID are required' },
        { status: 400 }
      )
    }
    
    // Get menu and verify ownership, then locate the item in menu JSON
    const { data: menuRow, error: menuErr } = await supabase
      .from('menus')
      .select('*')
      .eq('id', body.menuId)
      .eq('user_id', user.id)
      .single()
    if (menuErr || !menuRow) {
      return NextResponse.json(
        { error: 'Menu not found or unauthorized' },
        { status: 404 }
      )
    }

    // Generating images for a menu item is an "edit" because this route may normalize IDs
    // and because the intended UX is to apply the generated image back onto the menu.
    const profile = await userOperations.getProfile(user.id, supabase)
    const createdAt = new Date((menuRow as any).created_at || (menuRow as any).createdAt || Date.now())
    await assertUserCanEditMenu({
      userId: user.id,
      menuCreatedAt: createdAt,
      profile,
      supabaseClient: supabase,
    })

    const items: Array<any> = menuRow.menu_data?.items || []
    const menuItem = items.find((it: any) => it.id === body.menuItemId)
    if (!menuItem) {
      return NextResponse.json(
        { error: 'Menu item not found in menu' },
        { status: 404 }
      )
    }

    // Normalize menu item ID to UUID to satisfy relational tables
    const isUuid = (val: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(val)
    let normalizedMenuItemId = body.menuItemId
    if (!isUuid(body.menuItemId)) {
      try {
        // Generate a UUID and update this item in menu JSON
        const newUuid = (globalThis as any).crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`
        const updatedItems = items.map((it: any) => it.id === body.menuItemId ? { ...it, id: newUuid } : it)
        const { error: updateErr } = await supabase
          .from('menus')
          .update({
            menu_data: { ...menuRow.menu_data, items: updatedItems },
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.menuId)
          .eq('user_id', user.id)
        if (updateErr) {
          logger.error('❌ [Generate Image] Failed to normalize item id:', updateErr)
          return NextResponse.json(
            { error: 'Failed to normalize item identifier' },
            { status: 500 }
          )
        }
        normalizedMenuItemId = newUuid
        // Note: triggers (if installed) will sync JSON to menu_items with the UUID id
      } catch (normErr) {
        logger.error('❌ [Generate Image] Normalization error:', normErr)
        return NextResponse.json(
          { error: 'Failed to prepare image generation' },
          { status: 500 }
        )
      }
    }

    // Ensure a corresponding menu_items row exists (in case sync triggers weren't installed)
    try {
      const { data: existingMenuItem } = await supabase
        .from('menu_items')
        .select('id')
        .eq('id', normalizedMenuItemId)
        .maybeSingle()
      if (!existingMenuItem) {
        // Determine a safe order_index that will not violate unique(menu_id, order_index)
        // Prefer menu JSON order if valid; otherwise append after current max
        let orderIndex = typeof (menuItem.order) === 'number' && Number.isFinite(menuItem.order)
          ? menuItem.order
          : (() => {
              const idx = items.findIndex((it: any) => it.id === normalizedMenuItemId)
              return idx >= 0 ? idx : 0
            })()
        // Ensure uniqueness by bumping to max+1 if this order is already taken in normalized table
        const { data: maxOrderRow } = await supabase
          .from('menu_items')
          .select('order_index')
          .eq('menu_id', body.menuId)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle()
        const nextIndex = (maxOrderRow && typeof (maxOrderRow as any).order_index === 'number')
          ? (maxOrderRow as any).order_index + 1
          : 0
        if (typeof orderIndex !== 'number' || orderIndex < 0) orderIndex = nextIndex
        // If chosen order collides, append to end
        if (maxOrderRow && typeof (maxOrderRow as any).order_index === 'number' && orderIndex <= (maxOrderRow as any).order_index) {
          orderIndex = nextIndex
        }
        const { error: insertMiErr } = await supabase
          .from('menu_items')
          .insert({
            id: normalizedMenuItemId,
            menu_id: body.menuId,
            name: menuItem.name || 'Unnamed Item',
            description: menuItem.description || null,
            price: typeof menuItem.price === 'number' ? menuItem.price : 0,
            category: menuItem.category || null,
            available: typeof menuItem.available === 'boolean' ? menuItem.available : true,
            order_index: orderIndex,
            image_source: menuItem.imageSource || 'none',
            custom_image_url: menuItem.customImageUrl || null,
          })
        if (insertMiErr) {
          logger.error('❌ [Generate Image] Failed to ensure menu_items row:', insertMiErr)
          // Not fatal if FK checks are relaxed, but in our schema this is required
          return NextResponse.json(
            { error: 'Failed to prepare menu item for generation' },
            { status: 500 }
          )
        }
      }
    } catch (ensureErr) {
      logger.error('❌ [Generate Image] Error ensuring menu_items row:', ensureErr)
      return NextResponse.json(
        { error: 'Failed to prepare menu item' },
        { status: 500 }
      )
    }
    
    // Enforce per-minute rate limit (database-backed, plan-based)
    const plan = (profile?.plan ?? 'free') as UserPlan
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

    // Enforce per-item daily regeneration limit (plan-based)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const { count: todaysAttempts, error: attemptsError } = await supabase
      .from('image_generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('menu_item_id', normalizedMenuItemId)
      .gte('created_at', startOfToday.toISOString())

    const DAILY_LIMIT = getItemDailyGenerationLimit(plan, profile?.role)
    const remainingForToday = Math.max(0, DAILY_LIMIT - (todaysAttempts || 0))

    if (attemptsError) {
      logger.warn('❌ [Generate Image] Failed to count daily attempts:', attemptsError)
    } else if (remainingForToday <= 0) {
      return NextResponse.json(
        {
          error: 'Daily limit reached for this item. Try again tomorrow.',
          code: 'ITEM_DAILY_LIMIT',
          limit: DAILY_LIMIT,
          remaining: 0
        },
        { status: 429 }
      )
    }

    // Check quota before proceeding
    const quotaStatus = await quotaOperations.checkQuota(user.id)
    const requestedVariations = body.numberOfVariations || 1
    
    if (quotaStatus.remaining < requestedVariations) {
      return NextResponse.json(
        {
          error: quotaStatus.remaining === 0 
            ? `You've used all ${quotaStatus.limit} generations this month. Upgrade to continue.`
            : `Insufficient quota. You have ${quotaStatus.remaining} generations remaining, but requested ${requestedVariations}.`,
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

    const { data: activeForItem, error: activeJobCheckError } = await supabase
      .from('image_generation_jobs')
      .select('id, menu_item_id, status')
      .eq('menu_item_id', normalizedMenuItemId)
      .in('status', ['queued', 'processing'])

    if (activeJobCheckError) {
      logger.warn('❌ [Generate Image] Failed to check active jobs:', activeJobCheckError)
      return NextResponse.json(
        { error: 'Failed to check image generation status', code: 'ACTIVE_JOB_CHECK_FAILED' },
        { status: 500 }
      )
    }

    if (activeForItem && activeForItem.length > 0) {
      return NextResponse.json(
        {
          error: 'Image generation is already in progress for this item.',
          code: 'IMAGE_GENERATION_ALREADY_ACTIVE',
          activeJobs: activeForItem,
        },
        { status: 409 }
      )
    }

    // Phase 3.5: Validate requested resolution against plan limits
    const requestedResolution = (body.styleParams as any)?.resolution || '1k'
    const planConfig = PLAN_CONFIGS[plan]
    if (requestedResolution === '4k' && planConfig.maxImageResolution !== '4k') {
      logger.warn('[Generate Image] User requested 4K but plan does not support it', { userId: user.id, plan })
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
    
    // Construct generation request
    const generationRequest: ImageGenerationRequest = {
      userId: user.id,
      menuItemId: normalizedMenuItemId,
      itemName: menuItem.name,
      itemDescription: menuItem.description,
      category: menuItem.category,
      generationNotes: body.generationNotes,
      styleParams: body.styleParams || {},
      numberOfVariations: requestedVariations
    }

    const reference_images = parseReferenceImagesForEnqueue(body.referenceImages)
    if (body.referenceImages?.length) {
      logger.info(`📸 [Generate Image] Parsed ${reference_images?.length ?? 0} reference image(s)`)
    }
    
    // Build prompt using prompt construction service
    const promptConstructionService = getPromptConstructionService()
    
    // Check if we should use V2 narrative structure (Phase 1.2)
    // We use buildPromptV2 if the request includes the new PhotoGenerationParams fields
    const useV2 = !!(body.styleParams as any)?.angle && !!(body.styleParams as any)?.lighting
    
    const promptResult = useV2 
      ? promptConstructionService.buildPromptV2(
          {
            id: menuItem.id,
            name: menuItem.name,
            description: menuItem.description,
            price: menuItem.price ?? 0,
            available: menuItem.available ?? true,
            category: menuItem.category,
            order: menuItem.order ?? 0,
            imageSource: menuItem.imageSource ?? 'none'
          } as MenuItem,
          {
            ...(body.styleParams as any),
            settingReferenceImage: body.referenceImages?.find(r => r.role === 'scene')?.dataUrl,
            establishmentType: menuRow.establishment_type,
            primaryCuisine: menuRow.primary_cuisine,
            itemCategory: menuItem.category
          }
        )
      : promptConstructionService.buildPrompt(
          {
            id: menuItem.id,
            name: menuItem.name,
            description: menuItem.description,
            price: menuItem.price ?? 0,
            available: menuItem.available ?? true,
            category: menuItem.category,
            order: menuItem.order ?? 0,
            imageSource: menuItem.imageSource ?? 'none'
          } as MenuItem,
          {
            ...generationRequest.styleParams,
            establishmentType: menuRow.establishment_type,
            primaryCuisine: menuRow.primary_cuisine
          }
        )
    
    // Estimate cost
    const costEstimate = await quotaOperations.estimateCost(generationRequest)
    
    const apiParams: NanoBananaParams = {
      prompt: promptResult.prompt,
      negative_prompt: promptResult.negativePrompt,
      aspect_ratio: generationRequest.styleParams.aspectRatio || '1:1',
      number_of_images: requestedVariations,
      safety_filter_level: 'block_some',
      person_generation: 'dont_allow',
      context: 'food',
      reference_images,
      reference_mode: body.referenceMode || (reference_images ? 'composite' : undefined)
    }

    const priority = getImageGenerationQueuePriority(plan)

    const { insertedJobs, quotaAfter } = await insertQueuedImageJobsConsumeQuotaAndRelease(supabase, {
      userId: user.id,
      jobs: [
        {
          user_id: user.id,
          menu_id: body.menuId,
          menu_item_id: normalizedMenuItemId,
          batch_id: null,
          status: 'queued',
          prompt: promptResult.prompt,
          negative_prompt: promptResult.negativePrompt,
          api_params: {
            ...apiParams,
            batch_index: body.batchIndex,
            style_params: body.styleParams || {},
            generation_notes: body.generationNotes,
          },
          number_of_variations: requestedVariations,
          estimated_cost: costEstimate.estimatedTotal,
          priority,
          available_at: null,
        },
      ],
      totalVariationUnits: requestedVariations,
    })

    const jobRow = insertedJobs[0]
    const jobId = jobRow.id

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        job: {
          id: jobId,
          userId: user.id,
          menuItemId: normalizedMenuItemId,
          menuId: body.menuId,
          status: 'queued',
          numberOfVariations: requestedVariations,
          createdAt: jobRow.created_at,
        },
        menuItemId: normalizedMenuItemId,
        prompt: promptResult.prompt,
        negativePrompt: promptResult.negativePrompt,
        estimatedCost: costEstimate.estimatedTotal,
        quota: {
          ...quotaAfter,
          itemDailyRemaining: remainingForToday - requestedVariations,
          itemDailyLimit: DAILY_LIMIT,
        },
      },
    }, { status: 202 })
    
  } catch (error) {
    logger.error('❌ [Generate Image] Error:', error)

    // Map known DB errors
    if (error instanceof DatabaseError) {
      logger.error('❌ [Generate Image] Database error:', error.code, error.message)
      if (error.code === 'QUOTA_EXCEEDED') {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: 429 }
        )
      }
      if (error.code === 'EDIT_WINDOW_EXPIRED') {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            upgrade: {
              cta: 'View Pricing',
              href: '/pricing',
              reason: 'Subscribe to Grid+ or purchase a Creator Pack to continue editing.',
            },
          },
          { status: 403 }
        )
      }
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      )
    }

    // Map upstream generation errors with suggestions and retryability
    if (error instanceof NanoBananaError) {
      const payload = {
        error: error.message,
        code: error.code,
        retryAfter: error.retryAfter,
        suggestions: error.suggestions,
        filterReason: error.filterReason,
      }
      const status =
        error.code === 'AUTHENTICATION_ERROR' ? 401 :
        error.code === 'CONTENT_POLICY_VIOLATION' ? 403 :
        error.code === 'RATE_LIMIT_EXCEEDED' ? 429 :
        error.code === 'SERVICE_UNAVAILABLE' ? 503 :
        400
      logger.warn('⚠️ [Generate Image] Upstream error mapped:', { status, ...payload })
      // Best-effort failure analytics
      try {
        const supabase = createServerSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await analyticsOperations.recordGenerationFailure(user.id, {
            code: error.code,
            filter_reason: error.filterReason,
          })
          await analyticsOperations.checkGenerationCostThresholds()
        }
      } catch (e) {
        logger.warn('Failed to record failure analytics', e)
      }
      return NextResponse.json(payload, { status })
    }

    // Unknown error path - record failure analytics (best-effort)
    try {
      const supabase = createServerSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await analyticsOperations.recordGenerationFailure(user.id, { code: 'UNKNOWN' })
        await analyticsOperations.checkGenerationCostThresholds()
      }
    } catch (e) {
      logger.warn('Failed to record failure analytics (unknown error)', e)
    }
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}