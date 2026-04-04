import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

/**
 * POST /api/cutout/request
 * User-facing endpoint to request cutout generation/retry for a specific image.
 * Resets a failed/timed-out cutout back to pending so the worker will process it.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { imageId } = await request.json().catch(() => ({})) as { imageId?: string }
    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminSupabaseClient()

    // Verify user owns this image - first get the basic image
    const { data: image, error: imageError } = await supabase
      .from('ai_generated_images')
      .select(`
        id,
        menu_item_id,
        cutout_status,
        cutout_generation_log_id
      `)
      .eq('id', imageId)
      .single()

    if (imageError || !image) {
      logger.warn('[Cutout Request] Image not found', { imageId, userId: user.id })
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    // Then verify the menu_item exists and user owns it
    const { data: menuItem, error: menuItemError } = await supabase
      .from('menu_items')
      .select('id, menus!inner(id, user_id)')
      .eq('id', image.menu_item_id)
      .single()

    if (menuItemError || !menuItem) {
      logger.warn('[Cutout Request] Menu item not found for image', { imageId, menuItemId: image.menu_item_id, userId: user.id })
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    // Verify user owns the menu
    const menuUserId = (menuItem.menus as any)?.user_id
    if (menuUserId !== user.id) {
      logger.warn('[Cutout Request] Unauthorized access attempt', { imageId, userId: user.id })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const currentStatus = image.cutout_status
    const hasExistingLog = Boolean(image.cutout_generation_log_id)
    const shouldCreateNewJob =
      !currentStatus ||
      currentStatus === 'not_requested' ||
      !hasExistingLog

    // If already pending/processing with a valid log, do nothing.
    if ((currentStatus === 'pending' || currentStatus === 'processing') && hasExistingLog) {
      logger.info('[Cutout Request] Cutout already in progress', { imageId, status: currentStatus })
    } else if (shouldCreateNewJob) {
      // Create a fresh log/job when there is no existing trackable request.
      const { CutoutGenerationService } = await import('@/lib/background-removal/cutout-service')
      const { getBackgroundRemovalProvider } = await import('@/lib/background-removal/provider-factory')

      const { data: fullImage } = await adminSupabase
        .from('ai_generated_images')
        .select('original_url, menu_item_id')
        .eq('id', imageId)
        .single()

      if (!fullImage) {
        logger.warn('[Cutout Request] Source image row missing when creating cutout job', { imageId, userId: user.id })
        return NextResponse.json(
          { error: 'Image not found' },
          { status: 404 }
        )
      }

      const provider = getBackgroundRemovalProvider()
      const service = new CutoutGenerationService(provider, adminSupabase)

      try {
        await service.requestCutout({
          imageId,
          imageUrl: fullImage.original_url,
          userId: user.id,
          menuId: (menuItem.menus as any).id,
          menuItemId: fullImage.menu_item_id,
        })
        logger.info('[Cutout Request] New cutout job created', {
          imageId,
          userId: user.id,
          previousStatus: currentStatus ?? null,
          previousLogMissing: !hasExistingLog,
        })
      } catch (err) {
        logger.warn('[Cutout Request] Failed to create cutout job', { imageId, error: err })
        return NextResponse.json(
          { error: 'Failed to request cutout' },
          { status: 500 }
        )
      }
    } else if (currentStatus && !['pending', 'processing', 'not_requested'].includes(currentStatus)) {
      const { error: updateErr } = await adminSupabase
        .from('ai_generated_images')
        .update({
          cutout_status: 'pending',
          cutout_requested_at: new Date().toISOString(),
          cutout_failure_reason: null,
          cutout_completed_at: null,
        })
        .eq('id', imageId)

      if (updateErr) {
        logger.error('[Cutout Request] Failed to reset image cutout', { imageId, error: updateErr })
        return NextResponse.json(
          { error: 'Failed to request cutout' },
          { status: 500 }
        )
      }

      // Also reset the log entry if it exists
      if (image.cutout_generation_log_id) {
        await adminSupabase
          .from('cutout_generation_logs')
          .update({
            status: 'pending',
            error_category: null,
            error_code: null,
            error_message: null,
            completed_at: null
          })
          .eq('id', image.cutout_generation_log_id)
          .in('status', ['failed', 'timed_out'])
      }

      logger.info('[Cutout Request] Cutout reset to pending', { imageId, userId: user.id, previousStatus: currentStatus })
    } else {
      // Already pending or processing
      logger.info('[Cutout Request] Cutout already in progress', { imageId, status: currentStatus })
    }

    return NextResponse.json({
      success: true,
      imageId,
      status: 'pending',
      message: 'Cutout request queued for processing'
    })
  } catch (error: any) {
    logger.error('[Cutout Request] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
