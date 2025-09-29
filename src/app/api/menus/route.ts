import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError } from '@/lib/database'
import { validateCreateMenu, generateSlugFromName } from '@/lib/validation'
import { sanitizeMenuPayload } from '@/lib/security'
import type { CreateMenuFormData } from '@/types'

// GET /api/menus - Get user's menus
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const menus = await menuOperations.getUserMenus(user.id)
    
    return NextResponse.json({ 
      success: true, 
      data: menus 
    })
  } catch (error) {
    console.error('Error fetching menus:', error)
    
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

// POST /api/menus - Create new menu
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = sanitizeMenuPayload(await request.json() as CreateMenuFormData)
    
    // Validate input
    const validation = validateCreateMenu(body)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      )
    }
    
    // Generate slug if not provided
    const slug = body.slug || generateSlugFromName(body.name)
    
    // Ensure slug is unique for this user
    const uniqueSlug = await menuOperations.generateUniqueSlug(user.id, slug)
    
    const menu = await menuOperations.createMenu(user.id, {
      name: body.name,
      slug: uniqueSlug,
    })
    
    return NextResponse.json({
      success: true,
      data: menu
    }, { status: 201 })
    
  } catch (error) {
    console.error('Error creating menu:', error)
    
    if (error instanceof DatabaseError) {
      if (error.code === 'PLAN_LIMIT_EXCEEDED') {
        return NextResponse.json(
          {
            error: 'You have reached your plan limit for menus. Please upgrade to create more.',
            code: 'PLAN_LIMIT_EXCEEDED',
            upgrade: {
              cta: 'Upgrade to Premium',
              href: '/upgrade',
              reason: 'Increase menu limit from 1 to 10 menus',
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