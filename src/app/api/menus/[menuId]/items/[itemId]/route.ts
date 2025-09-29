import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuItemOperations, DatabaseError } from '@/lib/database'
import { VALIDATION_RULES } from '@/types'
import type { MenuItemFormData } from '@/types'
import { sanitizeMenuItemPayload } from '@/lib/security'

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
    
    const body = sanitizeMenuItemPayload(await request.json() as Partial<MenuItemFormData>)
    
    // Partial validation: only validate fields that are present in the request
    const errors: Array<{ field: string; message: string }> = []
    if (body.name !== undefined) {
      if (body.name.length < VALIDATION_RULES.menuItem.name.minLength) {
        errors.push({ field: 'name', message: 'Item name is too short' })
      } else if (body.name.length > VALIDATION_RULES.menuItem.name.maxLength) {
        errors.push({ field: 'name', message: 'Item name is too long' })
      }
    }
    if (body.description !== undefined) {
      if (body.description.length > VALIDATION_RULES.menuItem.description.maxLength) {
        errors.push({ field: 'description', message: 'Description is too long' })
      }
    }
    if (body.price !== undefined) {
      if (body.price < VALIDATION_RULES.menuItem.price.min) {
        errors.push({ field: 'price', message: 'Price cannot be negative' })
      } else if (body.price > VALIDATION_RULES.menuItem.price.max) {
        errors.push({ field: 'price', message: 'Price is too high' })
      }
    }
    // 'available' and 'category' require no validation here

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 })
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