// Development-only authentication bypass for local Supabase
// This creates a user session directly without email verification

import { supabase } from '@/lib/supabase'

export async function createDevUser(email: string) {
  // Multiple safety checks - NEVER allow in production
  if (!isLocalDevelopment()) {
    throw new Error('SECURITY: Dev auth blocked - not in local development')
  }
  
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY: Dev auth blocked - production environment detected')
  }
  
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    throw new Error('SECURITY: Dev auth blocked - not on localhost')
  }

  try {
    console.log('🔧 Dev auth: Creating dev session for:', email)
    
    // Use the simpler approach - just sign up and let Supabase handle it
    const { data, error } = await supabase.auth.signUp({
      email,
      password: 'dev-password-123',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        data: {
          dev_user: true // Mark as dev user
        }
      }
    })

    if (error) {
      // If user already exists, that's fine - try to sign them in
      if (error.message.includes('already registered') || error.message.includes('User already registered')) {
        console.log('🔧 Dev auth: User exists, attempting sign in...')
        
        // For local dev, we'll use a different approach - create a manual session
        // This bypasses the email verification requirement
        const response = await fetch('/api/auth/dev-signin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(`Failed to create dev session: ${errorData.error}`)
        }
        
        const result = await response.json()
        
        // If we got a redirect URL, navigate to it
        if (result.redirect_url) {
          window.location.href = result.redirect_url
          return result
        }
        
        return result
      }
      
      throw error
    }

    console.log('✅ Dev auth: User created/signed in successfully')
    return data
    
  } catch (error) {
    console.error('❌ Dev auth error:', error)
    throw error
  }
}

export function isLocalDevelopment(): boolean {
  // Multiple checks to ensure this NEVER runs in production
  const isDev = process.env.NODE_ENV === 'development'
  const isLocalhost = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost') ?? false
  const isNotVercel = !process.env.VERCEL
  const isNotRailway = !process.env.RAILWAY_ENVIRONMENT
  const hasDevFlag = process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === 'true'
  
  return isDev && isLocalhost && isNotVercel && isNotRailway && hasDevFlag
}