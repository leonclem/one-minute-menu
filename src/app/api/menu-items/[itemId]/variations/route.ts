import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations } from '@/lib/database'
import { getItemDailyGenerationLimit } from '@/lib/image-generation-limits'
import type { GeneratedImage } from '@/types'

// GET /api/menu-items/[itemId]/variations - Get all image variations for a menu item
// Returns both AI-generated images and user-uploaded images, merged into a single list.
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
        image_source,
        ai_image_id,
        custom_image_url,
        menus!inner(user_id)
      `)
      .eq('id', itemId)
      .single()
    
    if (itemError || !menuItem) {
      // Item may only exist in JSONB (not yet in the relational table).
      // Check JSONB for a custom image that was set via the upload fallback path.
      const { data: userMenus } = await supabase
        .from('menus')
        .select('id, menu_data')
        .eq('user_id', user.id)

      let jsonbItem: any = null
      if (userMenus) {
        for (const m of userMenus) {
          const items = m.menu_data?.items || []
          const found = items.find((item: any) => item.id === itemId)
          if (found) { jsonbItem = found; break }
        }
      }

      // If the JSONB item has a custom image URL, surface it as a variation.
      // selected is only true when imageSource is still 'custom' — if the user
      // has since switched to AI, the uploaded image should show as unselected.
      const variations: GeneratedImage[] = []
      let selectedImageId: string | null = null
      if (jsonbItem?.customImageUrl) {
        const syntheticId = `custom-${itemId}`
        const isSelected = jsonbItem?.imageSource === 'custom'
        if (isSelected) selectedImageId = syntheticId
        variations.push({
          id: syntheticId,
          menuItemId: itemId,
          generationJobId: undefined,
          originalUrl: jsonbItem.customImageUrl,
          thumbnailUrl: jsonbItem.customImageUrl,
          mobileUrl: jsonbItem.customImageUrl,
          desktopUrl: jsonbItem.customImageUrl,
          webpUrl: jsonbItem.customImageUrl,
          prompt: '',
          negativePrompt: undefined,
          aspectRatio: '1:1',
          width: undefined,
          height: undefined,
          fileSize: undefined,
          selected: isSelected,
          metadata: {
            imageType: 'uploaded' as const,
            cutoutStatus: 'not_requested',
            cutoutUrl: null
          },
          createdAt: new Date()
        })
      }

      return NextResponse.json({
        success: true,
        data: {
          menuItemId: itemId,
          menuItemName: jsonbItem?.name || undefined,
          totalVariations: variations.length,
          selectedImageId,
          variations,
          dailyStats: { limit: 0, remaining: 0, used: 0 }
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
    
    // Fetch AI-generated images and uploaded images in parallel
    const [aiImagesResult, uploadedImagesResult] = await Promise.all([
      supabase
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
          cutout_status,
          cutout_url,
          created_at
        `)
        .eq('menu_item_id', itemId)
        .order('created_at', { ascending: false }),

      supabase
        .from('uploaded_item_images')
        .select(`
          id,
          original_url,
          file_name,
          file_size,
          mime_type,
          selected,
          created_at
        `)
        .eq('menu_item_id', itemId)
        .order('created_at', { ascending: false })
    ])

    if (aiImagesResult.error) {
      console.error('Failed to fetch AI image variations:', aiImagesResult.error)
      return NextResponse.json(
        { error: 'Failed to fetch image variations' },
        { status: 500 }
      )
    }

    // Transform AI-generated images
    const aiVariations: GeneratedImage[] = (aiImagesResult.data || []).map(image => ({
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
      metadata: {
        ...image.metadata,
        cutoutStatus: image.cutout_status,
        cutoutUrl: image.cutout_url,
        imageType: 'ai' as const
      },
      createdAt: new Date(image.created_at)
    }))

    // Transform uploaded images into the same GeneratedImage shape so the gallery
    // can render them uniformly. We use sentinel values for AI-only fields.
    // If the uploaded_item_images table doesn't exist yet (migration pending), fall back
    // to the custom_image_url stored directly on the menu_items row.
    let uploadedVariations: GeneratedImage[] = []

    if (uploadedImagesResult.error) {
      // Table likely doesn't exist yet — fall back to menu_items.custom_image_url.
      // Only mark as selected when imageSource is still 'custom'.
      console.warn('[Variations] uploaded_item_images query failed (migration may be pending):', uploadedImagesResult.error.message)
      if (menuItem.custom_image_url) {
        const isSelected = menuItem.image_source === 'custom'
        uploadedVariations = [{
          id: `custom-${itemId}`,
          menuItemId: itemId,
          generationJobId: undefined,
          originalUrl: menuItem.custom_image_url,
          thumbnailUrl: menuItem.custom_image_url,
          mobileUrl: menuItem.custom_image_url,
          desktopUrl: menuItem.custom_image_url,
          webpUrl: menuItem.custom_image_url,
          prompt: '',
          negativePrompt: undefined,
          aspectRatio: '1:1',
          width: undefined,
          height: undefined,
          fileSize: undefined,
          selected: isSelected,
          metadata: {
            imageType: 'uploaded' as const,
            cutoutStatus: 'not_requested',
            cutoutUrl: null
          },
          createdAt: new Date()
        }]
      }
    } else {
      uploadedVariations = (uploadedImagesResult.data || []).map(image => ({
        id: image.id,
        menuItemId: itemId,
        generationJobId: undefined,
        originalUrl: image.original_url,
        thumbnailUrl: image.original_url,
        mobileUrl: image.original_url,
        desktopUrl: image.original_url,
        webpUrl: image.original_url,
        prompt: '',
        negativePrompt: undefined,
        aspectRatio: '1:1',
        width: undefined,
        height: undefined,
        fileSize: image.file_size,
        selected: image.selected,
        metadata: {
          imageType: 'uploaded' as const,
          fileName: image.file_name,
          cutoutStatus: 'not_requested',
          cutoutUrl: null
        },
        createdAt: new Date(image.created_at)
      }))

      // If the table exists but is empty, still surface a custom_image_url that was set
      // via the fallback path (direct menu_items update) so it appears in the gallery.
      // Only mark as selected when imageSource is still 'custom'.
      if (uploadedVariations.length === 0 && menuItem.custom_image_url) {
        const isSelected = menuItem.image_source === 'custom'
        uploadedVariations = [{
          id: `custom-${itemId}`,
          menuItemId: itemId,
          generationJobId: undefined,
          originalUrl: menuItem.custom_image_url,
          thumbnailUrl: menuItem.custom_image_url,
          mobileUrl: menuItem.custom_image_url,
          desktopUrl: menuItem.custom_image_url,
          webpUrl: menuItem.custom_image_url,
          prompt: '',
          negativePrompt: undefined,
          aspectRatio: '1:1',
          width: undefined,
          height: undefined,
          fileSize: undefined,
          selected: isSelected,
          metadata: {
            imageType: 'uploaded' as const,
            cutoutStatus: 'not_requested',
            cutoutUrl: null
          },
          createdAt: new Date()
        }]
      }
    }

    // Merge: uploaded images first (most recent first), then AI images
    const variations: GeneratedImage[] = [...uploadedVariations, ...aiVariations]
    
    // Determine the currently selected image across both sets.
    // We check image_source on the menu item to decide which set to look in.
    let selectedImageId: string | null = null
    if (menuItem.image_source === 'ai' && menuItem.ai_image_id) {
      selectedImageId = menuItem.ai_image_id
    } else if (menuItem.image_source === 'custom') {
      // For custom source, find the uploaded variation that is marked selected.
      // If none are marked selected (legacy), fall back to the synthetic custom ID.
      const selectedUploaded = uploadedVariations.find(img => img.selected)
      if (selectedUploaded) {
        selectedImageId = selectedUploaded.id
      } else if (menuItem.custom_image_url) {
        selectedImageId = `custom-${itemId}`
      }
    }

    // Get daily attempt stats for AI generation
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
        selectedImageId,
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
