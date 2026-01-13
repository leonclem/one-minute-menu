import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { imageProcessingService } from '@/lib/image-processing'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// Admin client to bypass RLS for ownership verification
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// DELETE /api/images/[imageId] - Delete an AI-generated image
export async function DELETE(
  request: NextRequest,
  { params }: { params: { imageId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { imageId } = params
    
    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      )
    }
    
    // Verify user owns the image (through menu item ownership) using admin client to bypass RLS issues
    // Step 1: Fetch the image data
    const { data: imageData, error: imageError } = await supabaseAdmin
      .from('ai_generated_images')
      .select('*')
      .eq('id', imageId)
      .single()
    
    if (imageError || !imageData) {
      logger.error('Error fetching image for deletion:', imageError)
      return NextResponse.json(
        { error: 'AI-generated image not found' },
        { status: 404 }
      )
    }
    
    // Step 2: Fetch the menu item and its menu owner to verify ownership
    const { data: itemData, error: itemError } = await supabaseAdmin
      .from('menu_items')
      .select(`
        id,
        name,
        menus (user_id)
      `)
      .eq('id', imageData.menu_item_id)
      .single()
      
    if (itemError || !itemData) {
      logger.error('Error fetching menu item for image deletion:', itemError)
      return NextResponse.json(
        { error: 'Menu item associated with image not found' },
        { status: 404 }
      )
    }
    
    // Step 3: Verify ownership
    const menuData = Array.isArray(itemData.menus) ? itemData.menus[0] : itemData.menus as any
      
    if (!menuData || menuData.user_id !== user.id) {
      logger.warn('Unauthorized delete attempt:', { imageId, userId: user.id, ownerId: menuData?.user_id })
      return NextResponse.json(
        { error: 'Unauthorized access to image' },
        { status: 403 }
      )
    }
    
    try {
      // Delete image files from storage
      const imageUrls = [
        imageData.original_url,
        imageData.thumbnail_url,
        imageData.mobile_url,
        imageData.desktop_url,
        imageData.webp_url
      ].filter(Boolean) // Remove null/undefined URLs
      
      for (const url of imageUrls) {
        try {
          await imageProcessingService.deleteImageFromStorage(url)
        } catch (storageError) {
          logger.warn(`Failed to delete image from storage: ${url}`, storageError)
          // Continue with database cleanup even if storage deletion fails
        }
      }
      
      // Use database function to handle the deletion and cleanup using admin client
      const { error: deleteError } = await supabaseAdmin.rpc('delete_ai_generated_image', {
        p_image_id: imageId
      })
      
      if (deleteError) {
        logger.error('Failed to delete AI image:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete image' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        data: {
          imageId,
          menuItemId: imageData.menu_item_id,
          wasSelected: imageData.selected,
          message: 'Image deleted successfully'
        }
      })
      
    } catch (error) {
      logger.error('Error during image deletion:', error)
      return NextResponse.json(
        { error: 'Failed to delete image files' },
        { status: 500 }
      )
    }
    
  } catch (error) {
    logger.error('Error in delete image API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/images/[imageId] - Get details of a specific AI-generated image
export async function GET(
  request: NextRequest,
  { params }: { params: { imageId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { imageId } = params
    
    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      )
    }
    
    // Get image details with ownership verification using admin client to bypass RLS issues
    // Step 1: Fetch the image data
    const { data: imageData, error: imageError } = await supabaseAdmin
      .from('ai_generated_images')
      .select('*')
      .eq('id', imageId)
      .single()
    
    if (imageError || !imageData) {
      logger.error('Error fetching image details:', imageError)
      return NextResponse.json(
        { error: 'AI-generated image not found' },
        { status: 404 }
      )
    }
    
    // Step 2: Fetch the menu item and its menu owner to verify ownership
    const { data: itemData, error: itemError } = await supabaseAdmin
      .from('menu_items')
      .select(`
        id,
        name,
        menus (user_id)
      `)
      .eq('id', imageData.menu_item_id)
      .single()
      
    if (itemError || !itemData) {
      logger.error('Error fetching menu item for image details:', itemError)
      return NextResponse.json(
        { error: 'Menu item associated with image not found' },
        { status: 404 }
      )
    }
    
    // Step 3: Verify ownership
    const menuData = Array.isArray(itemData.menus) ? itemData.menus[0] : itemData.menus as any
      
    if (!menuData || menuData.user_id !== user.id) {
      logger.warn('Unauthorized access attempt:', { imageId, userId: user.id, ownerId: menuData?.user_id })
      return NextResponse.json(
        { error: 'Unauthorized access to image' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: imageData.id,
        menuItemId: imageData.menu_item_id,
        menuItemName: itemData.name,
        generationJobId: imageData.generation_job_id,
        urls: {
          original: imageData.original_url,
          thumbnail: imageData.thumbnail_url,
          mobile: imageData.mobile_url,
          desktop: imageData.desktop_url,
          webp: imageData.webp_url
        },
        prompt: imageData.prompt,
        negativePrompt: imageData.negative_prompt,
        aspectRatio: imageData.aspect_ratio,
        dimensions: {
          width: imageData.width,
          height: imageData.height
        },
        fileSize: imageData.file_size,
        selected: imageData.selected,
        metadata: imageData.metadata,
        createdAt: imageData.created_at
      }
    })
    
  } catch (error) {
    logger.error('Error in get image API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}