import { createClient } from '@supabase/supabase-js'

/**
 * Direct Supabase client for Worker environments.
 * Bypasses all Next.js/browser dependencies like cookies.
 */
export const createWorkerSupabaseClient = () => {
  // IMPORTANT: For Docker containers, we MUST use the internal URL if available
  // otherwise fetch will fail because 'localhost' refers to the container itself.
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('[supabase-worker] Supabase credentials missing')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
