'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const params = useSearchParams()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const handleAuth = async () => {
      const code = params.get('code')
      const token = params.get('token')
      const type = params.get('type')
      const next = params.get('next') || '/dashboard'

      console.log('Auth callback received:', { 
        code: !!code, 
        token: !!token,
        type,
        next,
        allParams: Object.fromEntries(params.entries()),
        fullUrl: window.location.href 
      })

      try {
        // 1) If a session already exists (e.g., handled by Supabase automatically), redirect
        const { data: { session: existingSession } } = await supabase.auth.getSession()
        if (existingSession) {
          console.log('Existing session found, ensuring cookies are set, redirecting to:', next)
          try {
            await supabase.auth.setSession({
              access_token: existingSession.access_token,
              refresh_token: existingSession.refresh_token,
            })
          } catch (_) {}
          // Use full reload to guarantee cookies are sent to the server
          window.location.replace(next)
          return
        }

        // 2) Handle PKCE code exchange (SafeLinks-friendly)
        if (code) {
          console.log('Exchanging PKCE code for session...')
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          
          if (error) {
            console.error('PKCE exchange error:', error)
            router.replace('/auth/auth-code-error?type=magiclink')
            return
          }
          
          if (data.session) {
            console.log('Session created successfully, redirecting to:', next)
            window.location.replace(next)
            return
          }
          
          console.error('No session created after code exchange')
          router.replace('/auth/auth-code-error?type=no_session')
          return
        }

        // Handle legacy token format (still being generated)
        if (token && type === 'magiclink') {
          console.log('Legacy token format detected - using session approach...')
          
          // For legacy magic links, the session should be established automatically
          // Let's wait and check for it
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          const { data: { session }, error } = await supabase.auth.getSession()
          
          if (error) {
            console.error('Session check error:', error)
            router.replace('/auth/auth-code-error?type=magiclink')
            return
          }
          
          if (session) {
            console.log('Legacy session found, redirecting to:', next)
            router.replace(next)
            return
          }
          
          console.error('Legacy: No session found after magic link')
          router.replace('/auth/auth-code-error?type=no_session')
          return
        }

        // 4) Final fallback: check URL hash for tokens (in case an email client rewrites URLs)
        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
        if (hash) {
          const hashParams = new URLSearchParams(hash)
          const access_token = hashParams.get('access_token')
          const refresh_token = hashParams.get('refresh_token')
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token })
            if (!error) {
              window.location.replace(next)
              return
            }
          }
        }

        console.error('No valid auth parameters provided')
        router.replace('/auth/auth-code-error?type=missing_code')
      } catch (err) {
        console.error('Auth callback exception:', err)
        router.replace('/auth/auth-code-error?type=exception')
      }
    }

    handleAuth()
  }, [params, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-secondary-600">Signing you in...</p>
      </div>
    </div>
  )
}