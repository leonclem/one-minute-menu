import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuItemOperations, DatabaseError } from '@/lib/database'
import { validateMenuItem } from '@/lib/validation'
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
    
    const body = await request.json() as MenuItemFormData
    
    // Validate input
    const validation = validateMenuItem(body)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      )
    }
    
    const menu = await menuItemOperations.addItem(params.menuId, user.id, body)
    
    return NextResponse.json({
      success: true,
      data: menu
    }, { status: 201 })
    
  } catch (error) {
    console.error('Error adding menu item:', error)
    
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