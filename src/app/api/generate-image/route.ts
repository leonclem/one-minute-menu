import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getNanoBananaClient, NanoBananaError } from '@/lib/nano-banana'
import { quotaOperations } from '@/lib/quota-management'
import { analyticsOperations } from '@/lib/analytics-server'
import { getPromptConstructionService } from '@/lib/prompt-construction'
import { imageProcessingService } from '@/lib/image-processing'
import { DatabaseError } from '@/lib/database'
import type { 
  ImageGenerationRequest, 
  NanoBananaParams,
  MenuItem 
} from '@/types'

// POST /api/generate-image - Generate AI image for menu item
export async function POST(request: NextRequest) {
  console.log('🎨 [Generate Image] API called')
  
  try {
    // Feature flag and fail-closed guard
    const disabled = process.env.AI_IMAGE_GENERATION_DISABLED === 'true'
    const hasApiKey = !!process.env.NANO_BANANA_API_KEY
    if (disabled || !hasApiKey) {
      console.warn('🛑 [Generate Image] Disabled via flag or missing API key', {
        disabled,
        hasApiKey
      })
      return NextResponse.json(
        {
          error: 'Image creation is temporarily unavailable',
          code: 'FEATURE_DISABLED',
        },
        { status: 503 }
      )
    }

    console.log('🔧 [Generate Image] Creating Supabase client...')
    const supabase = createServerSupabaseClient()
    
    // Authenticate user
    console.log('🔐 [Generate Image] Authenticating user...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('❌ [Generate Image] Auth failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('✅ [Generate Image] User authenticated:', user.id)
    
    // Parse request body
    console.log('📦 [Generate Image] Parsing request body...')
    const body = await request.json() as {
      menuId: string
      menuItemId: string
      styleParams?: ImageGenerationRequest['styleParams']
      numberOfVariations?: number
      generationNotes?: string
    }
    
    console.log('📝 [Generate Image] Request:', { 
      menuItemId: body.menuItemId, 
      styleParams: body.styleParams,
      numberOfVariations: body.numberOfVariations 
    })
    
    if (!body.menuItemId || !body.menuId) {
      console.error('❌ [Generate Image] Missing menuItemId')
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
          console.error('❌ [Generate Image] Failed to normalize item id:', updateErr)
          return NextResponse.json(
            { error: 'Failed to normalize item identifier' },
            { status: 500 }
          )
        }
        normalizedMenuItemId = newUuid
        // Note: triggers (if installed) will sync JSON to menu_items with the UUID id
      } catch (normErr) {
        console.error('❌ [Generate Image] Normalization error:', normErr)
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
        const orderIndex = typeof (menuItem.order) === 'number' ? menuItem.order : (items.findIndex((it: any) => it.id === normalizedMenuItemId) >= 0 ? items.findIndex((it: any) => it.id === normalizedMenuItemId) : 0)
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
          console.error('❌ [Generate Image] Failed to ensure menu_items row:', insertMiErr)
          // Not fatal if FK checks are relaxed, but in our schema this is required
          return NextResponse.json(
            { error: 'Failed to prepare menu item for generation' },
            { status: 500 }
          )
        }
      }
    } catch (ensureErr) {
      console.error('❌ [Generate Image] Error ensuring menu_items row:', ensureErr)
      return NextResponse.json(
        { error: 'Failed to prepare menu item' },
        { status: 500 }
      )
    }
    
    // Enforce per-item daily regeneration limit (5 attempts per item per day)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const { count: todaysAttempts, error: attemptsError } = await supabase
      .from('image_generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('menu_item_id', normalizedMenuItemId)
      .gte('created_at', startOfToday.toISOString())

    if (attemptsError) {
      console.error('❌ [Generate Image] Failed to count daily attempts:', attemptsError)
    } else if ((todaysAttempts || 0) >= 5) {
      return NextResponse.json(
        {
          error: 'Daily limit reached for this item. Try again tomorrow.',
          code: 'ITEM_DAILY_LIMIT',
          limit: 5,
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
            cta: 'Upgrade to Premium',
            href: '/upgrade',
            reason: `Increase monthly AI image generations from ${quotaStatus.limit} to ${quotaStatus.plan === 'free' ? '100' : '1000'}`
          } : undefined
        },
        { status: 429 }
      )
    }
    
    // Construct generation request
    const generationRequest: ImageGenerationRequest = {
      userId: user.id,
      menuItemId: normalizedMenuItemId,
      itemName: menuItem.name,
      itemDescription: menuItem.description,
      generationNotes: body.generationNotes,
      styleParams: body.styleParams || {},
      numberOfVariations: requestedVariations
    }
    
    // Build prompt using prompt construction service
    const promptConstructionService = getPromptConstructionService()
    const promptResult = promptConstructionService.buildPrompt(
      {
        id: menuItem.id,
        name: menuItem.name,
        description: menuItem.description,
        price: menuItem.price ?? 0,
        available: menuItem.available ?? true,
        order: menuItem.order ?? 0,
        imageSource: menuItem.imageSource ?? 'none'
      } as MenuItem,
      generationRequest.styleParams
    )
    
    // Estimate cost
    const costEstimate = await quotaOperations.estimateCost(generationRequest)
    
    // Synchronous generation path to support JSON-backed items (no UUID dependency)
    const apiParams: NanoBananaParams = {
      prompt: promptResult.prompt,
      negative_prompt: promptResult.negativePrompt,
      aspect_ratio: generationRequest.styleParams.aspectRatio || '1:1',
      number_of_images: requestedVariations,
      safety_filter_level: 'block_some',
      person_generation: 'dont_allow'
    }

    // Create a job record to track this attempt (synchronous path)
    const { data: jobRow, error: jobInsertError } = await supabase
      .from('image_generation_jobs')
      .insert({
        user_id: user.id,
        menu_item_id: normalizedMenuItemId,
        status: 'processing',
        prompt: promptResult.prompt,
        negative_prompt: promptResult.negativePrompt,
        api_params: apiParams,
        number_of_variations: requestedVariations,
        estimated_cost: costEstimate.estimatedTotal,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (jobInsertError || !jobRow) {
      console.error('❌ [Generate Image] Failed to create job record:', jobInsertError)
      return NextResponse.json(
        { error: 'Failed to start image generation' },
        { status: 500 }
      )
    }

    const startTime = Date.now()
    const genResult = await getNanoBananaClient().generateImage(apiParams)
    const processingTime = Date.now() - startTime

    const images = [] as Array<{ id: string; originalUrl: string; thumbnailUrl: string; mobileUrl: string; desktopUrl: string; webpUrl?: string; jpegUrl?: string }>
    for (const base64Image of genResult.images) {
      const processed = await imageProcessingService.processGeneratedImage(
        base64Image,
        {
          menuItemId: generationRequest.menuItemId,
          generationJobId: jobRow.id,
          originalPrompt: promptResult.prompt,
          aspectRatio: generationRequest.styleParams.aspectRatio || '1:1',
          generatedAt: new Date()
        },
        user.id
      )

      // Persist metadata so previous images can be fetched for comparison
      await imageProcessingService.storeImageMetadata(processed)

      images.push({
        id: processed.id,
        originalUrl: processed.originalUrl,
        thumbnailUrl: processed.thumbnailUrl,
        mobileUrl: processed.mobileUrl,
        desktopUrl: processed.desktopUrl,
        webpUrl: processed.webpUrl,
        jpegUrl: processed.jpegUrl
      })
    }

    // Mark first image as selected for convenience
    if (images[0]) {
      await supabase
        .from('ai_generated_images')
        .update({ selected: true })
        .eq('id', images[0].id)
    }

    // Consume quota immediately for synchronous generation
    await quotaOperations.consumeQuota(user.id, requestedVariations)

    // Update job as completed
    await supabase
      .from('image_generation_jobs')
      .update({
        status: 'completed',
        result_count: genResult.images.length,
        processing_time: processingTime,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobRow.id)

    // Record generation analytics (best-effort)
    try {
      await analyticsOperations.recordGenerationSuccess(
        user.id,
        genResult.images.length,
        costEstimate.estimatedTotal,
        processingTime,
        {
          aspect_ratio: apiParams.aspect_ratio,
          number_of_images: apiParams.number_of_images,
          menu_item_id: normalizedMenuItemId,
        }
      )
      // Check cost thresholds for alerts
      await analyticsOperations.checkGenerationCostThresholds()
    } catch (e) {
      console.warn('Failed to record generation analytics', e)
    }

    return NextResponse.json({
      success: true,
      data: {
        menuItemId: normalizedMenuItemId,
        images,
        prompt: promptResult.prompt,
        negativePrompt: promptResult.negativePrompt,
        processingTime,
        estimatedCost: costEstimate.estimatedTotal,
        quota: {
          remaining: quotaStatus.remaining - requestedVariations,
          used: quotaStatus.used + requestedVariations,
          limit: quotaStatus.limit
        }
      }
    }, { status: 201 })
    
  } catch (error) {
    console.error('❌ [Generate Image] Error:', error)
    console.error('❌ [Generate Image] Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    // Map known DB errors
    if (error instanceof DatabaseError) {
      console.error('❌ [Generate Image] Database error:', error.code, error.message)
      if (error.code === 'QUOTA_EXCEEDED') {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: 429 }
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
      console.warn('⚠️ [Generate Image] Upstream error mapped:', { status, ...payload })
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
        console.warn('Failed to record failure analytics', e)
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
      console.warn('Failed to record failure analytics (unknown error)', e)
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

/**
 * Process image generation in the background
 * This runs asynchronously after the API response is sent
 */
async function processImageGeneration(
  jobId: string,
  request: ImageGenerationRequest,
  prompt: string,
  negativePrompt?: string
): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  try {
    // Update job status to processing
    await supabase
      .from('image_generation_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    // Get Nano Banana client and generate images
    const nanoBananaClient = getNanoBananaClient()
    const startTime = Date.now()
    
    const apiParams: NanoBananaParams = {
      prompt,
      negative_prompt: negativePrompt,
      aspect_ratio: request.styleParams.aspectRatio || '1:1',
      number_of_images: request.numberOfVariations || 1,
      safety_filter_level: 'block_some',
      person_generation: 'dont_allow'
    }
    
    const result = await nanoBananaClient.generateImage(apiParams)
    const processingTime = Date.now() - startTime
    
    // Process and store generated images
    const imageRecords = []
    
    for (let i = 0; i < result.images.length; i++) {
      const base64Image = result.images[i]
      
      try {
        // Process the base64 image using the image processing service
        const processedImage = await imageProcessingService.processGeneratedImage(
          base64Image,
          {
            menuItemId: request.menuItemId,
            generationJobId: jobId,
            originalPrompt: prompt,
            aspectRatio: request.styleParams.aspectRatio || '1:1',
            generatedAt: new Date()
          },
          request.userId
        )
        
        // Store the processed image metadata in the database
        await imageProcessingService.storeImageMetadata(processedImage)
        
        // Update the processed image record to mark first image as selected
        if (i === 0) {
          await supabase
            .from('ai_generated_images')
            .update({ selected: true })
            .eq('id', processedImage.id)
        }
        
        imageRecords.push({
          id: processedImage.id,
          urls: {
            original: processedImage.originalUrl,
            thumbnail: processedImage.thumbnailUrl,
            mobile: processedImage.mobileUrl,
            desktop: processedImage.desktopUrl,
            webp: processedImage.webpUrl,
            jpeg: processedImage.jpegUrl
          },
          sizes: processedImage.sizes,
          selected: i === 0
        })
        
        console.log(`Processed image ${i + 1}/${result.images.length} for job ${jobId}`)
        
      } catch (imageError) {
        console.error(`Failed to process image ${i + 1} for job ${jobId}:`, imageError)
        throw new Error(`Failed to process image ${i + 1}: ${imageError instanceof Error ? imageError.message : 'Unknown error'}`)
      }
    }
    
    // Note: Persisting to normalized table is skipped in JSON-backed model.
    // The client updates the menu JSON with the chosen image URL via select-image.
    
    // Update job as completed
    await supabase
      .from('image_generation_jobs')
      .update({
        status: 'completed',
        result_count: result.images.length,
        processing_time: processingTime,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    // Consume quota
    await quotaOperations.consumeQuota(request.userId, request.numberOfVariations || 1)
    
    console.log(`Image generation completed for job ${jobId}: ${result.images.length} images in ${processingTime}ms`)
    
  } catch (error) {
    console.error(`Image generation failed for job ${jobId}:`, error)
    
    let errorMessage = 'Unknown error occurred'
    let errorCode = 'UNKNOWN_ERROR'
    let shouldRetry = false
    
    if (error instanceof NanoBananaError) {
      errorMessage = error.message
      errorCode = error.code
      shouldRetry = ['RATE_LIMIT_EXCEEDED', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR'].includes(error.code)
    } else if (error instanceof Error) {
      errorMessage = error.message
    }
    
    // Update job as failed
    await supabase
      .from('image_generation_jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        error_code: errorCode,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    // TODO: Implement retry logic for retryable errors
    if (shouldRetry) {
      console.log(`Job ${jobId} failed with retryable error: ${errorCode}. Retry logic not yet implemented.`)
    }
  }
}