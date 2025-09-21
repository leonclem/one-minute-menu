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
        // Handle modern implicit flow with code
        if (code) {
          console.log('Using implicit flow - exchanging code for session...')
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          
          if (error) {
            console.error('Implicit auth exchange error:', error)
            router.replace('/auth/auth-code-error?type=magiclink')
            return
          }
          
          if (data.session) {
            console.log('Implicit session created successfully, redirecting to:', next)
            router.replace(next)
            return
          }
          
          console.error('Implicit: No session created')
          router.replace('/auth/auth-code-error?type=no_session')
          return
        }

        // Handle legacy token format (still being generated)
        if (token && type === 'magiclink') {
          console.log('Legacy token format detected - verifying OTP...')
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'magiclink'
          })
          
          if (error) {
            console.error('Legacy token verification error:', error)
            router.replace('/auth/auth-code-error?type=magiclink')
            return
          }
          
          if (data.session) {
            console.log('Legacy session created successfully, redirecting to:', next)
            router.replace(next)
            return
          }
          
          console.error('Legacy: Token verified but no session created')
          router.replace('/auth/auth-code-error?type=no_session')
          return
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