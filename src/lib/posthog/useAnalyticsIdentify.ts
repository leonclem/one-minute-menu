'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { identifyUser, resetAnalytics, captureEvent } from './helper'
import { ANALYTICS_EVENTS } from './events'

/**
 * Supabase auth-state listener that wires PostHog user identification.
 *
 * - SIGNED_IN: fetches the full profile via a direct browser-client query
 *   (avoids importing database.ts which pulls in supabase-server.ts /
 *   next/headers — incompatible with client components) and calls
 *   identifyUser with the 6-key allow-list (role, plan,
 *   subscription_status, is_admin, is_approved, created_at).
 *   Also fires login_completed for returning users (new-user signup_completed
 *   is fired from the onboarding client where ?new_signup=true is present).
 * - SIGNED_OUT: calls resetAnalytics() to clear the PostHog distinct id and
 *   session data, preventing cross-user data leakage.
 *
 * Mounted once by PostHogBootstrap. Unsubscribes on cleanup.
 *
 * Implements: 6.1, 6.3, 6.5, 4.3 (login_completed)
 */
export function useAnalyticsIdentify(): void {
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            // Fetch profile directly via the browser Supabase client.
            // We intentionally do NOT import userOperations from database.ts
            // because that module imports supabase-server.ts (next/headers),
            // which is incompatible with client components.
            const { data: profileRow } = await supabase
              .from('profiles')
              .select(
                'role, plan, subscription_status, is_approved, created_at',
              )
              .eq('id', session.user.id)
              .single()

            if (profileRow) {
              identifyUser(session.user.id, {
                role: profileRow.role ?? undefined,
                plan: profileRow.plan ?? undefined,
                subscription_status:
                  profileRow.subscription_status ?? undefined,
                is_admin: profileRow.role === 'admin',
                is_approved: profileRow.is_approved ?? false,
                created_at: profileRow.created_at ?? undefined,
              })
            }

            // Fire login_completed for returning users.
            // New-user signup_completed is fired from the onboarding client
            // (where ?new_signup=true is present in the URL), so we emit
            // login_completed here for all SIGNED_IN events. The onboarding
            // client guards against double-counting by only firing
            // signup_completed when isNewSignup is true.
            captureEvent(ANALYTICS_EVENTS.LOGIN_COMPLETED)
          } catch {
            // Swallow profile-fetch errors — analytics identification is
            // best-effort and must never break the auth flow.
          }
        } else if (event === 'SIGNED_OUT') {
          resetAnalytics()
        }
      },
    )

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])
}
