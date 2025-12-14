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
    
    // First, try to find the menu item in the relational table
    let { data: menuItem, error: itemError } = await supabase
      .from('menu_items')
      .select(`
        id,
        menu_id,
        name,
        ai_image_id,
        image_source,
        menus!inner(user_id)
      `)
      .eq('id', itemId)
      .single()
    
    // If not found in relational table, try to find it in JSONB and create it
    if (itemError || !menuItem) {
      logger.debug('🔍 [Select Image API] Menu item not found in relational table, checking JSONB...')
      
      // Find the menu and item in JSONB data
      const { data: menuData, error: menuError } = await supabase
        .from('menus')
        .select('id, user_id, menu_data')
        .eq('user_id', user.id)
        .single()
      
      if (menuError || !menuData) {
        return NextResponse.json(
          { error: 'Menu not found' },
          { status: 404 }
        )
      }
      
      // Find the item in JSONB
      const items = menuData.menu_data?.items || []
      const jsonbItem = items.find((item: any) => item.id === itemId)
      
      if (!jsonbItem) {
        return NextResponse.json(
          { error: 'Menu item not found' },
          { status: 404 }
        )
      }
      
      logger.debug('📝 [Select Image API] Creating menu item in relational table:', jsonbItem)
      
      // Create the menu item in the relational table
      const { data: createdItem, error: createError } = await supabase
        .from('menu_items')
        .insert({
          id: itemId,
          menu_id: menuData.id,
          name: jsonbItem.name || 'Unnamed Item',
          description: jsonbItem.description || null,
          price: typeof jsonbItem.price === 'number' ? jsonbItem.price : 0,
          category: jsonbItem.category || null,
          available: typeof jsonbItem.available === 'boolean' ? jsonbItem.available : true,
          order_index: jsonbItem.order || 0,
          image_source: jsonbItem.imageSource || 'none',
          custom_image_url: jsonbItem.customImageUrl || null,
        })
        .select(`
          id,
          menu_id,
          name,
          ai_image_id,
          image_source,
          menus!inner(user_id)
        `)
        .single()
      
      if (createError || !createdItem) {
        logger.error('❌ [Select Image API] Failed to create menu item in relational table:', createError)
        return NextResponse.json(
          { error: 'Failed to prepare menu item for image selection' },
          { status: 500 }
        )
      }
      
      menuItem = createdItem
      logger.info('✅ [Select Image API] Created menu item in relational table')
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
      logger.debug('🔄 [Select Image API] Calling select_ai_image_for_menu_item function')
      const { error: transactionError } = await supabase.rpc('select_ai_image_for_menu_item', {
        p_menu_item_id: itemId,
        p_image_id: body.imageId
      })
      
      if (transactionError) {
        logger.error('❌ [Select Image API] Failed to select AI image:', transactionError)
        return NextResponse.json(
          { error: 'Failed to select image' },
          { status: 500 }
        )
      }
      
      logger.info('✅ [Select Image API] Successfully called select_ai_image_for_menu_item')
      
      // Verify the update worked by checking the menu_items table
      const { data: updatedItem, error: verifyError } = await supabase
        .from('menu_items')
        .select('id, menu_id, ai_image_id, image_source, custom_image_url')
        .eq('id', itemId)
        .single()
      
      if (verifyError) {
        logger.error('❌ [Select Image API] Failed to verify update:', verifyError)
      } else {
        logger.info('✅ [Select Image API] Updated menu item:', updatedItem)
        
        // Manually update JSONB since sync function doesn't exist
        logger.debug('🔄 [Select Image API] Manually updating JSONB data')
        
        // Get current menu data
        const { data: currentMenu, error: menuError } = await supabase
          .from('menus')
          .select('menu_data')
          .eq('id', updatedItem.menu_id)
          .single()
        
        if (menuError) {
          logger.error('❌ [Select Image API] Failed to get current menu data:', menuError)
        } else {
          const menuData = currentMenu.menu_data || {}
          const items = menuData.items || []
          
          // Update the specific item in the JSONB array
          const updatedItems = items.map((item: any) => {
            if (item.id === itemId) {
              return {
                ...item,
                aiImageId: body.imageId,
                imageSource: 'ai',
                customImageUrl: null // Will be populated by enrichMenuItemsWithImageUrls
              }
            }
            return item
          })
          
          // Update the menu with the new items array
          const { error: updateError } = await supabase
            .from('menus')
            .update({
              menu_data: {
                ...menuData,
                items: updatedItems
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', updatedItem.menu_id)
          
          if (updateError) {
            logger.error('❌ [Select Image API] Failed to update JSONB:', updateError)
          } else {
            logger.info('✅ [Select Image API] Successfully updated JSONB data')
            
            // Verify the update
            const updatedItem = updatedItems.find((item: any) => item.id === itemId)
            logger.info('✅ [Select Image API] JSONB item after update:', {
              itemId,
              aiImageId: updatedItem?.aiImageId,
              imageSource: updatedItem?.imageSource,
              customImageUrl: updatedItem?.customImageUrl
            })
          }
        }
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