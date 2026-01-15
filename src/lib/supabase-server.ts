import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Server-side Supabase client that persists auth using Next.js cookies
export const createServerSupabaseClient = () => {
  const cookieStore = cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch (_) {
          // ignore - setting cookies may fail in some edge contexts
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch (_) {
          // ignore
        }
      },
    },
  })
}

/**
 * Admin Supabase client that bypasses RLS using the service role key.
 * 
 * IMPORTANT: This client should ONLY be used in secure server-side contexts
 * (like Admin API routes) that have already performed their own authorization checks.
 */
export const createAdminSupabaseClient = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseServiceKey) {
    console.error('[supabase-server] SUPABASE_SERVICE_ROLE_KEY is missing')
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing from environment variables')
  }

  // Use the standard createClient for admin tasks to ensure RLS bypass works correctly
  // without SSR cookie interference.
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
