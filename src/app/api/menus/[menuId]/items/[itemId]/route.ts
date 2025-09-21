import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuItemOperations, DatabaseError } from '@/lib/database'
import { validateMenuItem } from '@/lib/validation'
import type { MenuItemFormData } from '@/types'

// PUT /api/menus/[menuId]/items/[itemId] - Update menu item
export async function PUT(
  request: NextRequest,
  { params }: { params: { menuId: string; itemId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json() as Partial<MenuItemFormData>
    
    // Validate input if provided
    if (Object.keys(body).length > 0) {
      const validation = validateMenuItem(body)
      if (!validation.isValid) {
        return NextResponse.json(
          { error: 'Validation failed', errors: validation.errors },
          { status: 400 }
        )
      }
    }
    
    const menu = await menuItemOperations.updateItem(
      params.menuId, 
      user.id, 
      params.itemId, 
      body
    )
    
    return NextResponse.json({
      success: true,
      data: menu
    })
    
  } catch (error) {
    console.error('Error updating menu item:', error)
    
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

// DELETE /api/menus/[menuId]/items/[itemId] - Delete menu item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { menuId: string; itemId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const menu = await menuItemOperations.deleteItem(
      params.menuId, 
      user.id, 
      params.itemId
    )
    
    return NextResponse.json({
      success: true,
      data: menu
    })
    
  } catch (error) {
    console.error('Error deleting menu item:', error)
    
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