import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError } from '@/lib/database'
import { validateMenu } from '@/lib/validation'
import { sanitizeMenuPayload } from '@/lib/security'
import type { MenuFormData, ColorPalette, Menu } from '@/types'
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
    
    // validate UUID format
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.menuId)
    if (!isUuid) {
      // If it's not a UUID, it might be a demo ID or invalid
      return NextResponse.json({ error: 'Invalid menu ID' }, { status: 400 })
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
    
    const body = sanitizeMenuPayload(await request.json() as Partial<MenuFormData>)
    
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

    // Exclude items from menu update - items are managed via separate endpoints
    const { items, ...menuUpdates } = body
    
    // Type assertion for theme - updateMenu handles partial theme merging internally
    const updatePayload = menuUpdates as Partial<Menu>
    const menu = await menuOperations.updateMenu(params.menuId, user.id, updatePayload)
    // Ensure related paths show up-to-date data on client navigation
    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/menus/${params.menuId}`)
    
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
    // Ensure dashboard reflects deletion immediately on client-side navigation
    revalidatePath('/dashboard')
    
    return NextResponse.json({
      success: true,
      message: 'Menu deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting menu:', error)
    
    if (error instanceof DatabaseError) {
      if (error.code === 'EDIT_WINDOW_EXPIRED') {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            upgrade: {
              cta: 'View Pricing',
              href: '/pricing',
              reason: 'Subscribe to Grid+ or purchase a Creator Pack to unlock editing again.',
            },
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