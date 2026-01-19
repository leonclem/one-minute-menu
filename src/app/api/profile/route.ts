import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations, DatabaseError } from '@/lib/database'
import { sanitizeProfilePayload } from '@/lib/security'

// GET /api/profile - Get current user profile
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const profile = await userOperations.getProfile(user.id)
    
    return NextResponse.json({ 
      success: true, 
      data: profile 
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    
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

// PATCH /api/profile - Update user profile
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = sanitizeProfilePayload(await request.json())
    
    // Security: only allow certain fields to be updated by the user
    const allowedUpdates = {
      username: body.username,
      onboardingCompleted: body.onboardingCompleted,
      location: body.location,
      restaurantName: body.restaurantName,
      establishmentType: body.establishmentType,
      primaryCuisine: body.primaryCuisine,
    }
    
    // Remove undefined fields
    Object.keys(allowedUpdates).forEach(key => 
      (allowedUpdates as any)[key] === undefined && delete (allowedUpdates as any)[key]
    )

    const updatedProfile = await userOperations.updateProfile(user.id, allowedUpdates)
    
    // Ensure layouts and pages see the updated profile immediately
    revalidatePath('/', 'layout')
    
    return NextResponse.json({
      success: true,
      data: updatedProfile
    })
    
  } catch (error) {
    console.error('Error updating profile:', error)
    
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
