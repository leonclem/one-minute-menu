import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { imageOperations, userOperations } from '@/lib/database'

export async function POST(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // We intentionally don't look up the item in a separate table because
    // items are stored in the menu JSON. The client will update the menu JSON
    // with the returned URL after a successful upload.

    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.' 
      }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Please upload an image smaller than 10MB.' 
      }, { status: 400 })
    }

    // Enforce monthly upload limits using existing plan limits helper
    const { allowed, current, limit } = await userOperations.checkPlanLimits(user.id, 'monthlyUploads')
    if (!allowed) {
      return NextResponse.json(
        {
          error: `You have reached your monthly upload limit (${current}/${limit}).`,
          code: 'PLAN_LIMIT_EXCEEDED'
        },
        { status: 403 }
      )
    }

    // Upload image to Supabase Storage (reusing the shared helper)
    const imageUrl = await imageOperations.uploadMenuImage(user.id, file)

    // Log upload for quota tracking
    await supabase
      .from('uploads')
      .insert({ user_id: user.id, item_id: params.itemId, file_url: imageUrl })

    return NextResponse.json({
      success: true,
      data: {
        imageUrl
      }
    })

  } catch (error) {
    console.error('Menu item image upload error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { itemId } = params

    // Verify the menu item belongs to the user and get current image
    const { data: menuItem, error: itemError } = await supabase
      .from('menu_items')
      .select(`
        id,
        custom_image_url,
        menu_id,
        menus(user_id)
      `)
      .eq('id', itemId)
      .single()

    if (itemError || !menuItem) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    // Type assertion since we know menus is a single object from the relation
    const menu = menuItem.menus as any
    if (!menu || menu.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete image from storage if it exists
    if (menuItem.custom_image_url) {
      try {
        // Extract file path from URL
        const url = new URL(menuItem.custom_image_url)
        const pathParts = url.pathname.split('/')
        const filePath = pathParts.slice(-3).join('/') // Get last 3 parts: menu-items/userId/filename

        await supabase.storage
          .from('menu-images')
          .remove([filePath])
      } catch (error) {
        console.error('Error deleting image from storage:', error)
        // Continue with database update even if storage deletion fails
      }
    }

    // Update the menu item to remove the image URL
    const { error: updateError } = await supabase
      .from('menu_items')
      .update({ custom_image_url: null })
      .eq('id', itemId)

    if (updateError) {
      console.error('Failed to update menu item:', updateError)
      return NextResponse.json({ 
        error: 'Failed to remove image from database' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Image removed successfully'
    })

  } catch (error) {
    console.error('Menu item image deletion error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}