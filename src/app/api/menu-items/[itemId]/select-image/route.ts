import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { isCutoutFeatureEnabled } from '@/lib/background-removal/feature-flag'
import { getBackgroundRemovalProvider } from '@/lib/background-removal/provider-factory'
import { CutoutGenerationService } from '@/lib/background-removal/cutout-service'
import { syncMenuItemImageToJsonb } from '@/lib/menu-item-image-sync'

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
      imageId?: string | null
      imageSource?: 'ai' | 'custom' | 'none'
    }
    
    logger.debug('📝 [Select Image API] Request:', { itemId, imageId: body.imageId, imageSource: body.imageSource })
    
    // Handle "none" — deselect all images without deleting them
    if (body.imageSource === 'none') {
      return await handleDeselectImage(supabase, user.id, itemId)
    }
    
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
          const imageUpdate = {
            aiImageId: body.imageId,
            imageSource: 'ai' as const,
            // Do NOT null customImageUrl here — uploaded images stored there should persist
            // so they remain visible in the gallery when the user switches back.
          }

          // Update the specific item in the flat items array
          const updatedItems = items.map((item: any) => {
            if (item.id === itemId) {
              return { ...item, ...imageUpdate }
            }
            return item
          })

          // Also update the same item inside categories (template preview uses categories when present)
          const categories = menuData.categories || []
          const updatedCategories = categories.map((cat: any) => {
            if (!cat.items || !Array.isArray(cat.items)) return cat
            return {
              ...cat,
              items: cat.items.map((item: any) =>
                item.id === itemId ? { ...item, ...imageUpdate } : item
              )
            }
          })

          // Update the menu with both items and categories in sync
          const { error: updateError } = await supabase
            .from('menus')
            .update({
              menu_data: {
                ...menuData,
                items: updatedItems,
                categories: updatedCategories
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
    
    // For custom/uploaded images
    if (body.imageSource === 'custom') {
      // Check if imageId is a UUID (uploaded_item_images record) or a URL (legacy custom image)
      const isUuid = (val: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(val)

      if (isUuid(body.imageId)) {
        // New path: selecting a tracked uploaded image via its UUID
        // Verify the uploaded image belongs to this menu item and user
        const { data: uploadedImage, error: uploadedImageError } = await supabase
          .from('uploaded_item_images')
          .select('id, original_url, menu_item_id, user_id')
          .eq('id', body.imageId)
          .eq('menu_item_id', itemId)
          .single()

        if (uploadedImageError || !uploadedImage) {
          return NextResponse.json(
            { error: 'Uploaded image not found or does not belong to this menu item' },
            { status: 404 }
          )
        }

        if (uploadedImage.user_id !== user.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Use the DB function to atomically select the uploaded image
        const { error: selectError } = await supabase.rpc('select_uploaded_image_for_menu_item', {
          p_menu_item_id: itemId,
          p_image_id: body.imageId
        })

        if (selectError) {
          logger.error('Failed to select uploaded image:', selectError)
          return NextResponse.json(
            { error: 'Failed to select uploaded image' },
            { status: 500 }
          )
        }

        // Sync JSONB menu data
        await syncMenuJsonbForCustomImage(supabase, itemId, menuItem.menu_id, uploadedImage.original_url)

        return NextResponse.json({
          success: true,
          data: {
            menuItemId: itemId,
            selectedImageId: body.imageId,
            imageSource: 'custom',
            message: 'Uploaded image selected successfully'
          }
        })
      }

      // Legacy path: imageId is a raw URL (kept for backward compatibility)
      // First, unselect all AI images for this menu item
      await supabase
        .from('ai_generated_images')
        .update({ selected: false })
        .eq('menu_item_id', itemId)

      // Invalidate cutouts for AI images on this item — user is replacing with uploaded image
      try {
        const cutoutEnabled = isCutoutFeatureEnabled()
        if (cutoutEnabled) {
          const { data: aiImages } = await supabase
            .from('ai_generated_images')
            .select('id, cutout_status')
            .eq('menu_item_id', itemId)
            .neq('cutout_status', 'not_requested')

          if (aiImages && aiImages.length > 0) {
            const cutoutProvider = getBackgroundRemovalProvider()
            const cutoutService = new CutoutGenerationService(cutoutProvider, supabase)
            for (const img of aiImages) {
              try {
                await cutoutService.invalidateCutout(img.id)
                logger.info(`✂️ [Select Image API] Invalidated cutout for image ${img.id} (replaced by custom upload)`)
              } catch (invErr) {
                logger.warn(`⚠️ [Select Image API] Failed to invalidate cutout for image ${img.id}`, invErr)
              }
            }
          }
        }
      } catch (invErr) {
        logger.warn('⚠️ [Select Image API] Cutout invalidation error (non-blocking)', invErr)
      }

      // Update menu item to use custom image
      const { error: updateError } = await supabase
        .from('menu_items')
        .update({
          custom_image_url: body.imageId,
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

      await syncMenuJsonbForCustomImage(supabase, itemId, menuItem.menu_id, body.imageId)

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
      { error: 'Invalid image source. Must be "ai", "custom", or "none"' },
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

/**
 * Deselect all images for a menu item (set imageSource to 'none')
 * without deleting any generated images — they remain available for re-selection.
 */
async function handleDeselectImage(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  userId: string,
  itemId: string
) {
  // Find the menu item in the relational table
  const { data: menuItem, error: itemError } = await supabase
    .from('menu_items')
    .select('id, menu_id, menus!inner(user_id)')
    .eq('id', itemId)
    .single()

  if (itemError || !menuItem) {
    return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
  }

  if ((menuItem.menus as any).user_id !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Unselect all AI images for this item (keep them for future re-selection)
  await supabase
    .from('ai_generated_images')
    .update({ selected: false })
    .eq('menu_item_id', itemId)

  // Unselect all uploaded images for this item (keep them for future re-selection)
  await supabase
    .from('uploaded_item_images')
    .update({ selected: false })
    .eq('menu_item_id', itemId)

  // Set image_source to 'none' in relational table
  const { error: updateError } = await supabase
    .from('menu_items')
    .update({
      image_source: 'none',
      ai_image_id: null,
    })
    .eq('id', itemId)

  if (updateError) {
    logger.error('❌ [Select Image API] Failed to deselect image:', updateError)
    return NextResponse.json({ error: 'Failed to deselect image' }, { status: 500 })
  }

  // Sync JSONB projection from the authoritative menu_items state. This
  // also clears the JSONB customImageUrl so stale thumbnails (e.g. on the
  // /extracted page) don't render a broken reference after "Set no photo".
  await syncMenuItemImageToJsonb(supabase, itemId)

  logger.info('✅ [Select Image API] Image deselected for item:', itemId)

  return NextResponse.json({
    success: true,
    data: {
      menuItemId: itemId,
      selectedImageId: null,
      imageSource: 'none',
      message: 'Image deselected successfully. Generated images are preserved.',
    },
  })
}

/**
 * Sync the JSONB menu_data to reflect a custom (uploaded) image selection.
 * Keeps the flat items array and categories in sync.
 */
async function syncMenuJsonbForCustomImage(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  itemId: string,
  menuId: string,
  imageUrl: string
) {
  const { data: currentMenu } = await supabase
    .from('menus')
    .select('menu_data')
    .eq('id', menuId)
    .single()

  if (!currentMenu) return

  const menuData = currentMenu.menu_data || {}
  const imageUpdate = {
    imageSource: 'custom' as const,
    customImageUrl: imageUrl,
    aiImageId: null as string | null
  }

  const updatedItems = (menuData.items || []).map((item: any) =>
    item.id === itemId ? { ...item, ...imageUpdate } : item
  )
  const updatedCategories = (menuData.categories || []).map((cat: any) => ({
    ...cat,
    items: (cat.items || []).map((item: any) =>
      item.id === itemId ? { ...item, ...imageUpdate } : item
    )
  }))

  await supabase
    .from('menus')
    .update({
      menu_data: { ...menuData, items: updatedItems, categories: updatedCategories },
      updated_at: new Date().toISOString()
    })
    .eq('id', menuId)
}
