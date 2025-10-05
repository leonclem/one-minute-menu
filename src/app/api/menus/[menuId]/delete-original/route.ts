import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations } from '@/lib/database'

/**
 * Delete original menu photo after publishing
 * POST /api/menus/[menuId]/delete-original
 * 
 * This implements the "Delete originals after publish" data retention control
 * for PDPA compliance
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { menuId } = params
    
    // Verify the user owns this menu
    const menu = await menuOperations.getMenu(menuId)
    if (!menu || menu.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Menu not found or access denied' },
        { status: 404 }
      )
    }
    
    // Check if menu is published
    if (menu.status !== 'published') {
      return NextResponse.json(
        { success: false, error: 'Menu must be published before deleting original' },
        { status: 400 }
      )
    }
    
    // Check if there's an image to delete
    if (!menu.imageUrl) {
      return NextResponse.json(
        { success: false, error: 'No original image to delete' },
        { status: 400 }
      )
    }
    
    // Extract the file path from the URL
    const imageUrl = menu.imageUrl
    const urlParts = imageUrl.split('/storage/v1/object/public/')
    if (urlParts.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Invalid image URL format' },
        { status: 400 }
      )
    }
    
    const filePath = urlParts[1]
    
    // Delete the file from storage
    const { error: deleteError } = await supabase.storage
      .from('menu-images')
      .remove([filePath])
    
    if (deleteError) {
      console.error('Error deleting image from storage:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete image from storage' },
        { status: 500 }
      )
    }
    
    // Update the menu to remove the imageUrl
    await menuOperations.updateMenu(menuId, user.id, { imageUrl: undefined })
    
    return NextResponse.json({
      success: true,
      message: 'Original image deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting original image:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete original image' },
      { status: 500 }
    )
  }
}
