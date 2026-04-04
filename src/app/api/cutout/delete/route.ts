import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

/**
 * POST /api/cutout/delete
 * Delete the cutout for an image and reset it to not_requested.
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

    // Verify user owns this image
    const { data: image, error: imageError } = await supabase
      .from('ai_generated_images')
      .select(`
        id,
        cutout_status,
        menu_items!inner(menus!inner(user_id))
      `)
      .eq('id', imageId)
      .single()

    if (imageError || !image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    // Verify user owns the menu
    const menuUserId = (image.menu_items as any)?.menus?.user_id
    if (menuUserId !== user.id) {
      logger.warn('[Cutout Delete] Unauthorized access attempt', { imageId, userId: user.id })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Reset cutout status to not_requested
    const { error: updateErr } = await adminSupabase
      .from('ai_generated_images')
      .update({
        cutout_status: 'not_requested',
        cutout_failure_reason: null,
        cutout_completed_at: null,
      })
      .eq('id', imageId)

    if (updateErr) {
      logger.error('[Cutout Delete] Failed to delete cutout', { imageId, error: updateErr })
      return NextResponse.json(
        { error: 'Failed to delete cutout' },
        { status: 500 }
      )
    }

    logger.info('[Cutout Delete] Cutout deleted', { imageId, userId: user.id })

    return NextResponse.json({
      success: true,
      imageId,
      status: 'not_requested'
    })
  } catch (error: any) {
    logger.error('[Cutout Delete] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
