import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { imageProcessingService } from '@/lib/image-processing'

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
    
    // Verify user owns the image (through menu item ownership)
    const { data: imageData, error: imageError } = await supabase
      .from('ai_generated_images')
      .select(`
        id,
        menu_item_id,
        original_url,
        thumbnail_url,
        mobile_url,
        desktop_url,
        webp_url,
        selected,
        menu_items!inner(
          menus!inner(user_id)
        )
      `)
      .eq('id', imageId)
      .single()
    
    if (imageError || !imageData) {
      return NextResponse.json(
        { error: 'AI-generated image not found' },
        { status: 404 }
      )
    }
    
    // Verify user owns the menu
    const menuData = imageData.menu_items as any
    if (menuData.menus.user_id !== user.id) {
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
          console.warn(`Failed to delete image from storage: ${url}`, storageError)
          // Continue with database cleanup even if storage deletion fails
        }
      }
      
      // Use database function to handle the deletion and cleanup
      const { error: deleteError } = await supabase.rpc('delete_ai_generated_image', {
        p_image_id: imageId
      })
      
      if (deleteError) {
        console.error('Failed to delete AI image:', deleteError)
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
      console.error('Error during image deletion:', error)
      return NextResponse.json(
        { error: 'Failed to delete image files' },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('Error in delete image API:', error)
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
    
    // Get image details with ownership verification
    const { data: imageData, error: imageError } = await supabase
      .from('ai_generated_images')
      .select(`
        id,
        menu_item_id,
        generation_job_id,
        original_url,
        thumbnail_url,
        mobile_url,
        desktop_url,
        webp_url,
        prompt,
        negative_prompt,
        aspect_ratio,
        width,
        height,
        file_size,
        selected,
        metadata,
        created_at,
        menu_items!inner(
          id,
          name,
          menus!inner(user_id)
        )
      `)
      .eq('id', imageId)
      .single()
    
    if (imageError || !imageData) {
      return NextResponse.json(
        { error: 'AI-generated image not found' },
        { status: 404 }
      )
    }
    
    // Verify user owns the menu
    const menuData = imageData.menu_items as any
    if (menuData.menus.user_id !== user.id) {
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
        menuItemName: menuData.name,
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
    console.error('Error in get image API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}