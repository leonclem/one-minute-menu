import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations } from '@/lib/database'
import type { VenueInfo } from '@/types'

// POST /api/menus/bulk-update-venue - Update venue info for all user's menus
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const venueInfo: VenueInfo = body.venueInfo
    
    if (!venueInfo) {
      return NextResponse.json({ error: 'venueInfo is required' }, { status: 400 })
    }

    // Get all user's menus
    const menus = await menuOperations.getUserMenus(user.id)
    
    // Update each menu with the new venue info
    const updatePromises = menus.map(menu => 
      menuOperations.updateMenu(menu.id, user.id, { venueInfo })
    )
    
    await Promise.all(updatePromises)
    
    // Revalidate dashboard to show updated menus
    revalidatePath('/dashboard')
    
    return NextResponse.json({
      success: true,
      data: {
        updatedCount: menus.length
      }
    })
  } catch (error) {
    console.error('Error bulk updating venue info:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
