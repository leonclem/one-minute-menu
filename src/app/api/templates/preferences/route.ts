import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { templateOperations, DatabaseError } from '@/lib/database'
import type { UserCustomization } from '@/types/templates'
import { z } from 'zod'

// Validation schema for preference update
const updatePreferenceSchema = z.object({
  menuId: z.string().uuid(),
  templateId: z.string().uuid(),
  customization: z.object({
    colors: z.object({
      primary: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      secondary: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      accent: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    }).optional(),
    fonts: z.object({
      heading: z.string().optional(),
      body: z.string().optional(),
    }).optional(),
    priceDisplayMode: z.enum(['symbol', 'amount-only']).optional(),
  }),
  isDefault: z.boolean().optional(),
})

// GET /api/templates/preferences - Get user template preferences
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const menuId = searchParams.get('menuId')
    
    if (!menuId) {
      return NextResponse.json(
        { error: 'menuId query parameter is required' },
        { status: 400 }
      )
    }
    
    const preference = await templateOperations.getUserPreference(user.id, menuId)
    
    if (!preference) {
      return NextResponse.json(
        { 
          success: true,
          data: null,
          message: 'No preference found for this menu'
        }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: preference
    })
    
  } catch (error) {
    console.error('Error getting user preference:', error)
    
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

// PUT /api/templates/preferences - Update user template preferences
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validation = updatePreferenceSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          errors: validation.error.errors 
        },
        { status: 400 }
      )
    }
    
    const { menuId, templateId, customization, isDefault } = validation.data
    
    // Update or create preference
    const preference = await templateOperations.updateUserPreference(
      user.id,
      menuId,
      templateId,
      customization as UserCustomization,
      isDefault || false
    )
    
    return NextResponse.json({
      success: true,
      data: preference
    })
    
  } catch (error) {
    console.error('Error updating user preference:', error)
    
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

// DELETE /api/templates/preferences - Delete user template preferences
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const menuId = searchParams.get('menuId')
    
    if (!menuId) {
      return NextResponse.json(
        { error: 'menuId query parameter is required' },
        { status: 400 }
      )
    }
    
    await templateOperations.deleteUserPreference(user.id, menuId)
    
    return NextResponse.json({
      success: true,
      message: 'Preference deleted successfully'
    })
    
  } catch (error) {
    console.error('Error deleting user preference:', error)
    
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
