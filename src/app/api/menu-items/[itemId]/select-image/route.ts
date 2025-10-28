import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// POST /api/menu-items/[itemId]/select-image - Select an image variation for a menu item
export async function POST(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  logger.info('🖼️ [Select Image API] Called')
  
  try {
    const supabase = createServerSupabaseClient()
    
    // Authenticate user
    logger.debug('🔐 [Select Image API] Authenticating...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.error('❌ [Select Image API] Auth failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    logger.info('✅ [Select Image API] User:', user.id)
    
    const { itemId } = params
    
    if (!itemId) {
      return NextResponse.json(
        { error: 'Menu item ID is required' },
        { status: 400 }
      )
    }
    
    // Parse request body
    const body = await request.json() as {
      imageId: string
      imageSource?: 'ai' | 'custom'
    }
    
    logger.debug('📝 [Select Image API] Request:', { itemId, imageId: body.imageId, imageSource: body.imageSource })
    
    if (!body.imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      )
    }
    
    // Verify user owns the menu item
    const { data: menuItem, error: itemError } = await supabase
      .from('menu_items')
      .select(`
        id,
        name,
        ai_image_id,
        image_source,
        menus!inner(user_id)
      `)
      .eq('id', itemId)
      .single()
    
    if (itemError || !menuItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      )
    }
    
    // Verify user owns the menu
    if ((menuItem.menus as any).user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to menu item' },
        { status: 403 }
      )
    }
    
    // If selecting an AI-generated image, verify it belongs to this menu item
    if (body.imageSource === 'ai' || !body.imageSource) {
      const { data: aiImage, error: aiImageError } = await supabase
        .from('ai_generated_images')
        .select('id, menu_item_id')
        .eq('id', body.imageId)
        .eq('menu_item_id', itemId)
        .single()
      
      if (aiImageError || !aiImage) {
        return NextResponse.json(
          { error: 'AI-generated image not found or does not belong to this menu item' },
          { status: 404 }
        )
      }
      
      // Start a transaction to update image selection
      const { error: transactionError } = await supabase.rpc('select_ai_image_for_menu_item', {
        p_menu_item_id: itemId,
        p_image_id: body.imageId
      })
      
      if (transactionError) {
        logger.error('Failed to select AI image:', transactionError)
        return NextResponse.json(
          { error: 'Failed to select image' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        data: {
          menuItemId: itemId,
          selectedImageId: body.imageId,
          imageSource: 'ai',
          message: 'AI-generated image selected successfully'
        }
      })
    }
    
    // For custom images, just update the menu item
    if (body.imageSource === 'custom') {
      // First, unselect all AI images for this menu item
      await supabase
        .from('ai_generated_images')
        .update({ selected: false })
        .eq('menu_item_id', itemId)
      
      // Update menu item to use custom image
      const { error: updateError } = await supabase
        .from('menu_items')
        .update({
          custom_image_url: body.imageId, // Assuming imageId is the URL for custom images
          ai_image_id: null,
          image_source: 'custom'
        })
        .eq('id', itemId)
      
      if (updateError) {
        logger.error('Failed to select custom image:', updateError)
        return NextResponse.json(
          { error: 'Failed to select custom image' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        data: {
          menuItemId: itemId,
          selectedImageId: body.imageId,
          imageSource: 'custom',
          message: 'Custom image selected successfully'
        }
      })
    }
    
    return NextResponse.json(
      { error: 'Invalid image source. Must be "ai" or "custom"' },
      { status: 400 }
    )
    
  } catch (error) {
    logger.error('❌ [Select Image API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to select image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}