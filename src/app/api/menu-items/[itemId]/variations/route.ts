import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { GeneratedImage } from '@/types'

// Helper function to check if a string is a valid UUID
const isUuid = (val: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(val)

// Helper function to generate deterministic UUID v5 from a string
async function generateDeterministicUuid(itemId: string, menuId: string): Promise<string> {
  const namespace = isUuid(menuId) ? menuId : '00000000-0000-0000-0000-000000000000'
  const encoder = new TextEncoder()
  const data = encoder.encode(namespace + itemId)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  
  // Format as UUID v5 (set version and variant bits)
  hashArray[6] = (hashArray[6] & 0x0f) | 0x50 // Version 5
  hashArray[8] = (hashArray[8] & 0x3f) | 0x80 // Variant
  
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

// GET /api/menu-items/[itemId]/variations - Get all image variations for a menu item
export async function GET(
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
    
    if (!itemId) {
      return NextResponse.json(
        { error: 'Menu item ID is required' },
        { status: 400 }
      )
    }
    
    // Handle non-UUID item IDs by generating the tracking UUID
    let trackingUuid = itemId
    let menuIdForUuid: string | null = null
    
    if (!isUuid(itemId)) {
      // Search through all user's menus to find the one containing this item
      const { data: allMenus } = await supabase
        .from('menus')
        .select('id, menu_data')
        .eq('user_id', user.id)
      
      if (allMenus && allMenus.length > 0) {
        for (const menu of allMenus) {
          const items = menu.menu_data?.items || []
          const menuItem = items.find((it: any) => it.id === itemId)
          if (menuItem) {
            menuIdForUuid = menu.id
            trackingUuid = await generateDeterministicUuid(itemId, menu.id)
            break
          }
        }
      }
    }

    // Try to get the menu item from menu_items table
    // Note: This table is only populated when images are generated
    const { data: menuItem, error: itemError } = await supabase
      .from('menu_items')
      .select(`
        id,
        name,
        menus!inner(user_id)
      `)
      .eq('id', trackingUuid)
      .single()
    
    // If menu item doesn't exist in menu_items table yet, verify ownership via menus table
    if (itemError || !menuItem) {
      // Search through all user's menus to find the one containing this item
      const { data: allMenus, error: menusError } = await supabase
        .from('menus')
        .select('id, user_id, menu_data')
        .eq('user_id', user.id)
      
      if (menusError || !allMenus || allMenus.length === 0) {
        return NextResponse.json(
          { error: 'No menus found' },
          { status: 404 }
        )
      }
      
      // Find the menu containing this item
      let foundMenu = null
      let foundItem = null
      
      for (const menu of allMenus) {
        const items = menu.menu_data?.items || []
        const item = items.find((it: any) => it.id === itemId)
        if (item) {
          foundMenu = menu
          foundItem = item
          break
        }
      }
      
      if (!foundMenu || !foundItem) {
        return NextResponse.json(
          { error: 'Menu item not found' },
          { status: 404 }
        )
      }
      
      // Item exists but no images generated yet - return empty variations
      return NextResponse.json({
        success: true,
        data: {
          menuItemId: itemId,
          menuItemName: foundItem.name || 'Unnamed Item',
          totalVariations: 0,
          selectedImageId: null,
          variations: []
        }
      })
    }
    
    // Verify user owns the menu
    if ((menuItem.menus as any).user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to menu item' },
        { status: 403 }
      )
    }
    
    // Get all generated images for this menu item (use trackingUuid for database query)
    const { data: images, error: imagesError } = await supabase
      .from('ai_generated_images')
      .select(`
        id,
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
        created_at
      `)
      .eq('menu_item_id', trackingUuid)
      .order('created_at', { ascending: false })
    
    if (imagesError) {
      console.error('Failed to fetch image variations:', imagesError)
      return NextResponse.json(
        { error: 'Failed to fetch image variations' },
        { status: 500 }
      )
    }
    
    // Transform to GeneratedImage format (use original itemId, not trackingUuid)
    const variations: GeneratedImage[] = (images || []).map(image => ({
      id: image.id,
      menuItemId: itemId,
      generationJobId: image.generation_job_id,
      originalUrl: image.original_url,
      thumbnailUrl: image.thumbnail_url,
      mobileUrl: image.mobile_url,
      desktopUrl: image.desktop_url,
      webpUrl: image.webp_url || image.original_url,
      prompt: image.prompt,
      negativePrompt: image.negative_prompt,
      aspectRatio: image.aspect_ratio,
      width: image.width,
      height: image.height,
      fileSize: image.file_size,
      selected: image.selected,
      metadata: image.metadata,
      createdAt: new Date(image.created_at)
    }))
    
    // Get the currently selected image
    const selectedImage = variations.find(img => img.selected)
    
    return NextResponse.json({
      success: true,
      data: {
        menuItemId: itemId,
        menuItemName: menuItem.name,
        totalVariations: variations.length,
        selectedImageId: selectedImage?.id || null,
        variations
      }
    })
    
  } catch (error) {
    console.error('Error in variations API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}