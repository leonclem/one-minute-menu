import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { imageOperations, userOperations } from '@/lib/database'

// Max upload size: 10 MB
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

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

    const { itemId } = params

    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      return NextResponse.json({
        error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.'
      }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({
        error: 'File too large. Please upload an image smaller than 10 MB.'
      }, { status: 400 })
    }

    // Enforce monthly upload limits
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

    // Upload image to Supabase Storage
    const imageUrl = await imageOperations.uploadMenuImage(user.id, file)

    // Ensure the menu item exists in the relational table so we can associate the image.
    // If it doesn't exist yet (JSONB-only item), we create a minimal row.
    let menuItemId: string = itemId
    const isUuid = (val: string) =>
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(val)

    if (isUuid(itemId)) {
      // Verify ownership via relational table
      const { data: menuItem, error: itemError } = await supabase
        .from('menu_items')
        .select('id, menu_id, menus!inner(user_id)')
        .eq('id', itemId)
        .single()

      if (!itemError && menuItem) {
        const menu = menuItem.menus as any
        if (!menu || menu.user_id !== user.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }
      }
      // If not found in relational table, we still proceed — the image record will be
      // created without a menu_item_id FK (graceful degradation for JSONB-only items).
    }

    // Insert a record into uploaded_item_images so the gallery can display it.
    // Only do this when itemId is a valid UUID (relational item).
    let uploadedImageId: string | null = null
    if (isUuid(itemId)) {
      const { data: imageRecord, error: insertError } = await supabase
        .from('uploaded_item_images')
        .insert({
          menu_item_id: itemId,
          user_id: user.id,
          original_url: imageUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          selected: false
        })
        .select('id')
        .single()

      if (!insertError && imageRecord) {
        uploadedImageId = imageRecord.id
      } else if (insertError) {
        console.warn('[Upload] uploaded_item_images insert failed (table may not exist yet):', insertError.message)
      }
    }

    // Fallback: if the uploaded_item_images table isn't available yet, directly update
    // menu_items.custom_image_url and sync JSONB so the image is immediately active.
    if (!uploadedImageId && isUuid(itemId)) {
      // Deselect any AI images for this item (safe to call even if no rows match)
      await supabase
        .from('ai_generated_images')
        .update({ selected: false })
        .eq('menu_item_id', itemId)

      // Try to find the item in the relational table first
      const { data: menuItemRow } = await supabase
        .from('menu_items')
        .select('id, menu_id')
        .eq('id', itemId)
        .single()

      if (menuItemRow) {
        // Item exists in relational table — update it directly
        await supabase
          .from('menu_items')
          .update({
            custom_image_url: imageUrl,
            ai_image_id: null,
            image_source: 'custom'
          })
          .eq('id', itemId)

        // Sync JSONB menu_data
        const { data: menuRow } = await supabase
          .from('menus')
          .select('menu_data')
          .eq('id', menuItemRow.menu_id)
          .single()

        if (menuRow) {
          const menuData = menuRow.menu_data || {}
          const imageUpdate = { imageSource: 'custom', customImageUrl: imageUrl, aiImageId: null }
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
            .eq('id', menuItemRow.menu_id)
        }
      } else {
        // Item only exists in JSONB (newly extracted) — find it there and update directly
        const { data: menus } = await supabase
          .from('menus')
          .select('id, menu_data')
          .eq('user_id', user.id)

        if (menus) {
          for (const menuRow of menus) {
            const menuData = menuRow.menu_data || {}
            const flatItems = menuData.items || []
            const found = flatItems.some((item: any) => item.id === itemId)
            if (!found) continue

            const imageUpdate = { imageSource: 'custom', customImageUrl: imageUrl, aiImageId: null }
            const updatedItems = flatItems.map((item: any) =>
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
              .eq('id', menuRow.id)
            break
          }
        }
      }
    }

    // Log upload for quota tracking
    await supabase
      .from('uploads')
      .insert({ user_id: user.id, item_id: itemId, file_url: imageUrl })

    return NextResponse.json({
      success: true,
      data: {
        imageUrl,
        uploadedImageId
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

    const menu = menuItem.menus as any
    if (!menu || menu.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete image from storage if it exists
    if (menuItem.custom_image_url) {
      try {
        const url = new URL(menuItem.custom_image_url)
        const pathParts = url.pathname.split('/')
        const filePath = pathParts.slice(-3).join('/')

        await supabase.storage
          .from('menu-images')
          .remove([filePath])
      } catch (error) {
        console.error('Error deleting image from storage:', error)
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
