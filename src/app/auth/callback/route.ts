import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { userOperations } from '@/lib/database'
import { sendAdminNewUserAlert } from '@/lib/notifications'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/onboarding'

  // If we have a preferred site URL configured and we're currently on the Vercel domain
  // (or any other domain that isn't the primary one), redirect to the primary domain
  // while keeping the code and other params. This ensures the session is established
  // on the correct domain (e.g., gridmenu.ai instead of one-minute-menu.vercel.app).
  const preferredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (preferredSiteUrl && process.env.NODE_ENV === 'production') {
    try {
      const preferredOrigin = new URL(preferredSiteUrl).origin
      if (url.origin !== preferredOrigin) {
        console.log(`[auth] Domain mismatch detected. Redirecting from ${url.origin} to ${preferredOrigin}`)
        const redirectUrl = new URL(url.pathname + url.search, preferredOrigin)
        return NextResponse.redirect(redirectUrl)
      }
    } catch (e) {
      console.error('[auth] Invalid NEXT_PUBLIC_SITE_URL:', preferredSiteUrl)
    }
  }

  const res = NextResponse.redirect(new URL(next, url.origin))

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return req.cookies.get(name)?.value
      },
      set(name, value, options) {
        res.cookies.set({ name, value, ...options })
      },
      remove(name, options) {
        res.cookies.set({ name, value: '', ...options })
      },
    },
  })

  if (code) {
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    // If session exchange was successful, handle admin notification for new users
    if (!sessionError) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Attempt to get the profile, with a small retry to account for DB trigger lag
          let profile = await userOperations.getProfile(user.id, supabase)
          
          if (!profile) {
            // Brief wait for the handle_new_user trigger to finish if it's a first-time signup
            await new Promise(resolve => setTimeout(resolve, 1500))
            profile = await userOperations.getProfile(user.id, supabase)
          }

          // Trigger admin alert if user is pending approval and hasn't notified admin yet
          // Only notify for non-admin users who aren't yet approved
          if (profile && !profile.isApproved && !profile.adminNotified && profile.role !== 'admin') {
            console.log(`[auth-callback] New unapproved user ${user.email} signed in. Triggering admin alert...`)
            const sent = await sendAdminNewUserAlert(profile)
            
            if (sent) {
              // Mark as notified using admin client to bypass RLS if necessary
              const adminSupabase = createAdminSupabaseClient()
              await userOperations.updateProfile(user.id, { adminNotified: true }, adminSupabase)
              console.log(`[auth-callback] Admin notified for user ${user.email}`)
            } else {
              console.warn(`[auth-callback] Failed to send admin alert for ${user.email}. Will retry on next login/access.`)
            }
          }
        }
      } catch (notifyError) {
        // We catch but don't block the redirect, as the notification is a side effect
        console.error('[auth-callback] Error in admin notification flow:', notifyError)
      }
    }
  }

  return res
}


