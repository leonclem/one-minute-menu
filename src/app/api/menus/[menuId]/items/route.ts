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
    
    const body = sanitizeMenuItemPayload(await request.json() as MenuItemFormData)
    
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
      imageSource: body.imageSource || 'none' as const
    }
    
    const menu = await menuItemOperations.addItem(params.menuId, user.id, itemData)
    
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
            error: 'You have reached your plan limit for menu items. Please upgrade to add more.',
            code: 'PLAN_LIMIT_EXCEEDED',
            upgrade: {
              cta: 'Upgrade to Premium',
              href: '/upgrade',
              reason: 'Increase item limit from 20 to 500 items',
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

// DELETE /api/menus/[menuId]/items - Clear all items
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

    const menu = await menuItemOperations.clearItems(params.menuId, user.id)
    return NextResponse.json({ success: true, data: menu })
  } catch (error) {
    console.error('Error clearing menu items:', error)
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}