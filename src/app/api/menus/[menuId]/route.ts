import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError } from '@/lib/database'
import { validateMenu } from '@/lib/validation'
import type { MenuFormData, ColorPalette } from '@/types'
import { applyTheme as applyThemeFromPalette, buildPaletteFromColors, validateAccessibility, getAvailableThemes } from '@/lib/themes'
import { createServerSupabaseClient as supa } from '@/lib/supabase-server'

// GET /api/menus/[menuId] - Get specific menu
export async function GET(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const menu = await menuOperations.getMenu(params.menuId, user.id)
    
    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      data: menu
    })
  } catch (error) {
    console.error('Error fetching menu:', error)
    
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

// PUT /api/menus/[menuId] - Update menu
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
    
    const body = await request.json() as Partial<MenuFormData>
    
    // Validate input if provided
    if (Object.keys(body).length > 0) {
      const validation = validateMenu(body)
      if (!validation.isValid) {
        return NextResponse.json(
          { error: 'Validation failed', errors: validation.errors },
          { status: 400 }
        )
      }
    }
    // Ensure payment disclaimer default if paymentInfo provided
    if (body.paymentInfo) {
      const required = 'Payment handled by your bank app; platform does not process funds'
      if (!body.paymentInfo.disclaimer) {
        body.paymentInfo.disclaimer = required
      }
    }

    const menu = await menuOperations.updateMenu(params.menuId, user.id, body)
    
    return NextResponse.json({
      success: true,
      data: menu
    })
  } catch (error) {
    console.error('Error updating menu:', error)
    
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

// POST /api/menus/[menuId]?action=applyTheme
export async function POST(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = supa()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    if (action !== 'applyTheme') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({})) as {
      templateId?: string
      palette?: Partial<ColorPalette> & { colors?: string[] }
    }

    const templateId = body.templateId || 'modern'
    // Fetch current menu to preserve colors if none are provided
    const currentMenu = await menuOperations.getMenu(params.menuId, user.id)
    if (!currentMenu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    let palette: ColorPalette
    if (body.palette?.colors && Array.isArray(body.palette.colors) && body.palette.colors.length > 0) {
      palette = buildPaletteFromColors(body.palette.colors as string[])
    } else {
      // Preserve current menu colors when changing template only
      palette = currentMenu.theme.colors
    }

    const theme = applyThemeFromPalette(templateId, palette)
    const updated = await menuOperations.updateMenu(params.menuId, user.id, { theme })

    const accessibility = validateAccessibility(updated.theme.colors)
    return NextResponse.json({ success: true, data: { menu: updated, accessibility, templates: getAvailableThemes() } })
  } catch (error) {
    console.error('Error applying theme:', error)
    if (error instanceof DatabaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/menus/[menuId] - Delete menu
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
    
    await menuOperations.deleteMenu(params.menuId, user.id)
    
    return NextResponse.json({
      success: true,
      message: 'Menu deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting menu:', error)
    
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