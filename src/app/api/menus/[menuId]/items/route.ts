import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuItemOperations, DatabaseError } from '@/lib/database'
import { validateMenuItem } from '@/lib/validation'
import { sanitizeMenuItemPayload } from '@/lib/security'
import type { MenuItemFormData } from '@/types'

// POST /api/menus/[menuId]/items - Add menu item
export async function POST(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const rawBody = await request.json() as MenuItemFormData & { isFlagship?: boolean }
    const { isFlagship, ...sanitizableFields } = rawBody
    const body = sanitizeMenuItemPayload(sanitizableFields as MenuItemFormData)
    
    // Validate input
    const validation = validateMenuItem(body)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      )
    }
    
    // Set default imageSource if not provided
    const itemData = {
      ...body,
      ...(isFlagship !== undefined ? { isFlagship } : {}),
      imageSource: body.imageSource || 'none' as const
    }
    
    const menu = await menuItemOperations.addItem(params.menuId, user.id, itemData)

    // Sync is_flagship to the menu_items table (source of truth for DB queries).
    // The new item is the last one in the flat items array.
    // We use upsert in case the sync trigger hasn't yet created the row.
    if (isFlagship === true) {
      const newItem = menu.items[menu.items.length - 1]
      const newItemId = newItem?.id
      if (newItemId) {
        // Clear any existing flagship for this menu first
        await supabase
          .from('menu_items')
          .update({ is_flagship: false })
          .eq('menu_id', params.menuId)
          .neq('id', newItemId)

        // Upsert the new item row with is_flagship=true so it works whether
        // the sync trigger has already created the row or not.
        await supabase
          .from('menu_items')
          .upsert({
            id: newItemId,
            menu_id: params.menuId,
            name: newItem.name,
            description: newItem.description ?? null,
            price: newItem.price,
            category: newItem.category ?? null,
            available: newItem.available ?? true,
            order_index: newItem.order ?? 0,
            image_source: newItem.imageSource ?? 'none',
            custom_image_url: newItem.customImageUrl ?? null,
            is_flagship: true,
          }, { onConflict: 'id' })
      }
    }
    
    return NextResponse.json({
      success: true,
      data: menu
    }, { status: 201 })
    
  } catch (error) {
    console.error('Error adding menu item:', error)
    
    if (error instanceof DatabaseError) {
      if (error.code === 'PLAN_LIMIT_EXCEEDED') {
        return NextResponse.json(
          {
            error: error.message,
            code: 'PLAN_LIMIT_EXCEEDED',
            upgrade: {
              cta: 'View Plans',
              href: '/upgrade',
              reason: 'Upgrade your plan to increase your menu item limit',
            }
          },
          { status: 403 }
        )
      }
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/menus/[menuId]/items - Reorder menu items
export async function PUT(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { itemIds } = await request.json() as { itemIds: string[] }
    
    if (!Array.isArray(itemIds)) {
      return NextResponse.json(
        { error: 'itemIds must be an array' },
        { status: 400 }
      )
    }
    
    const menu = await menuItemOperations.reorderItems(params.menuId, user.id, itemIds)
    
    return NextResponse.json({
      success: true,
      data: menu
    })
    
  } catch (error) {
    console.error('Error reordering menu items:', error)
    
    if (error instanceof DatabaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/menus/[menuId]/items - Clear all items or delete specific items
export async function DELETE(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if specific item IDs are provided in the request body
    const body = await request.json().catch(() => ({}))
    const { itemIds } = body as { itemIds?: string[] }

    let menu
    if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
      // Batch delete specific items
      menu = await menuItemOperations.deleteMultipleItems(params.menuId, user.id, itemIds)
    } else {
      // Clear all items
      menu = await menuItemOperations.clearItems(params.menuId, user.id)
    }

    return NextResponse.json({ success: true, data: menu })
  } catch (error) {
    console.error('Error deleting menu items:', error)
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}