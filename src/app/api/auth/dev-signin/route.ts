import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Development-only endpoint to create user sessions
export async function POST(request: NextRequest) {
  // Security checks - only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost')) {
    return NextResponse.json({ error: 'Only available for localhost' }, { status: 403 })
  }
  
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH !== 'true') {
    return NextResponse.json({ error: 'Dev auth not enabled' }, { status: 403 })
  }

  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    
    // First, try to get or create the user using admin API
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password: 'dev-password-123',
      email_confirm: true, // Skip email confirmation
      user_metadata: {
        dev_user: true
      }
    })
    
    if (userError && !userError.message.includes('already exists')) {
      console.error('Error creating user:', userError)
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }
    
    // Get the user (either newly created or existing)
    let userId = userData?.user?.id
    
    if (!userId) {
      // User might already exist, try to find them
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const existingUser = existingUsers.users.find(u => u.email === email)
      userId = existingUser?.id
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Failed to create or find user' }, { status: 500 })
    }
    
    // Create a session for the user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${request.nextUrl.origin}/auth/callback?next=/dashboard`
      }
    })
    
    if (sessionError) {
      console.error('Error creating session:', sessionError)
      return NextResponse.json({ error: sessionError.message }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      user: { id: userId, email },
      redirect_url: sessionData.properties?.action_link
    })
    
  } catch (error) {
    console.error('Dev signin error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}