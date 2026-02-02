import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations } from '@/lib/database'
import { getItemDailyGenerationLimit } from '@/lib/image-generation-limits'
import type { GeneratedImage } from '@/types'

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
    
    // If non-UUID id is provided (older JSON short id), return empty set gracefully
    const isUuid = (val: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(val)
    if (!isUuid(itemId)) {
      return NextResponse.json({
        success: true,
        data: {
          menuItemId: itemId,
          menuItemName: undefined,
          totalVariations: 0,
          selectedImageId: null,
          variations: [] as GeneratedImage[]
        }
      })
    }

    // Verify user owns the menu item
    const { data: menuItem, error: itemError } = await supabase
      .from('menu_items')
      .select(`
        id,
        name,
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
    
    // Get all generated images for this menu item
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
      .eq('menu_item_id', itemId)
      .order('created_at', { ascending: false })
    
    if (imagesError) {
      console.error('Failed to fetch image variations:', imagesError)
      return NextResponse.json(
        { error: 'Failed to fetch image variations' },
        { status: 500 }
      )
    }
    
    // Transform to GeneratedImage format
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

    // Get daily attempt stats
    const profile = await userOperations.getProfile(user.id, supabase)
    const plan = (profile?.plan ?? 'free') as any
    const DAILY_LIMIT = getItemDailyGenerationLimit(plan, profile?.role)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const { count: todaysAttempts } = await supabase
      .from('image_generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('menu_item_id', itemId)
      .gte('created_at', startOfToday.toISOString())
    
    return NextResponse.json({
      success: true,
      data: {
        menuItemId: itemId,
        menuItemName: menuItem.name,
        totalVariations: variations.length,
        selectedImageId: selectedImage?.id || null,
        variations,
        dailyStats: {
          limit: DAILY_LIMIT,
          remaining: Math.max(0, DAILY_LIMIT - (todaysAttempts || 0)),
          used: todaysAttempts || 0
        }
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