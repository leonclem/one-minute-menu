import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { syncMenuItemImageToJsonb } from '@/lib/menu-item-image-sync'

// DELETE /api/menu-items/[itemId]/uploaded-images/[imageId]
// Deletes a user-uploaded image record and its file from storage.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { itemId: string; imageId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { itemId, imageId } = params

    // Fetch the image record — RLS ensures only the owner can see it
    const { data: imageRecord, error: fetchError } = await supabase
      .from('uploaded_item_images')
      .select('id, original_url, menu_item_id, user_id, selected')
      .eq('id', imageId)
      .eq('menu_item_id', itemId)
      .single()

    if (fetchError || !imageRecord) {
      return NextResponse.json({ error: 'Uploaded image not found' }, { status: 404 })
    }

    if (imageRecord.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete the file from Supabase Storage
    try {
      const url = new URL(imageRecord.original_url)
      const pathParts = url.pathname.split('/')
      // Path format: /storage/v1/object/public/menu-images/<userId>/<filename>
      // We need the last 2 segments: userId/filename
      const filePath = pathParts.slice(-2).join('/')
      await supabase.storage.from('menu-images').remove([filePath])
    } catch (storageErr) {
      logger.warn('[Uploaded Image DELETE] Storage deletion failed (non-blocking):', storageErr)
    }

    // Delete the database record
    const { error: deleteError } = await supabase
      .from('uploaded_item_images')
      .delete()
      .eq('id', imageId)

    if (deleteError) {
      logger.error('[Uploaded Image DELETE] DB delete failed:', deleteError)
      return NextResponse.json({ error: 'Failed to delete image record' }, { status: 500 })
    }

    // If this was the selected image, clear the menu item's image and
    // sync the JSONB projection so thumbnails, template preview, and exports
    // all reflect the removal.
    if (imageRecord.selected) {
      const { error: clearError } = await supabase
        .from('menu_items')
        .update({ custom_image_url: null, ai_image_id: null, image_source: 'none' })
        .eq('id', itemId)

      if (clearError) {
        logger.error('[Uploaded Image DELETE] Failed to clear menu item image:', clearError)
      }

      await syncMenuItemImageToJsonb(supabase, itemId)
    }

    return NextResponse.json({
      success: true,
      data: { imageId, wasSelected: imageRecord.selected }
    })

  } catch (error) {
    logger.error('[Uploaded Image DELETE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
