'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UXButton, UXInput } from '@/components/ux'
import { isValidEmail } from '@/lib/utils'
import { trackConversionEvent } from '@/lib/conversion-tracking'

interface AuthOTPFormProps {
  type: 'signin' | 'signup'
  title: string
  subtitle: string
  buttonText: string
  onSuccess?: (email: string) => void
  redirectTo?: string
  trackingSource?: string
}

export function AuthOTPForm({
  type,
  title,
  subtitle,
  buttonText,
  onSuccess,
  redirectTo,
  trackingSource
}: AuthOTPFormProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  
  // Robust localhost check
  const isLocalDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError('Email is required')
      return
    }
    
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      // Track start if it's a signup/registration
      if (type === 'signup') {
        trackConversionEvent({
          event: 'registration_start',
          metadata: {
            path: window.location.pathname,
            source: trackingSource || 'auth_form',
          },
        })
      }

      // Default to /onboarding which handles redirection to dashboard if menus exist
      const finalRedirectTo = redirectTo || `${window.location.origin}/auth/callback?next=/onboarding`
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: finalRedirectTo,
        },
      })

      if (error) {
        setError(error.message)
      } else {
        if (isLocalDev) {
           setMessage('Development mode: Check the Supabase logs or MailDev at http://localhost:54324 for the magic link!')
        } else {
           setMessage('Check your email for the magic link to sign in!')
        }
        
        if (type === 'signup') {
          trackConversionEvent({
            event: 'signup_completed',
            metadata: {
              path: window.location.pathname,
              source: trackingSource || 'auth_form',
            },
          })
        }
        
        onSuccess?.(email)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {isLocalDev && (
        <div className="rounded-lg bg-ux-warning/40 border border-ux-warning/30 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-ux-warning" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-4h2v2H9v-2zm0-8h2v6H9V6z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-ux-text">
                <strong>Development Mode:</strong> Magic links will appear in the email testing interface at{' '}
                <a href="http://localhost:54324" target="_blank" className="underline">localhost:54324</a>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-semibold text-ux-text mb-2">
          {title}
        </h3>
        <p className="text-sm text-ux-text-secondary">
          {subtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <UXInput
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@restaurant.com"
          error={error}
          disabled={loading}
          autoComplete="email"
          autoFocus
        />

        <UXButton
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          {loading ? 'Sending magic link...' : buttonText}
        </UXButton>

        {message && (
          <div className="rounded-lg bg-ux-success/10 border border-ux-success/20 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-ux-success" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-ux-success">
                  {message}
                </p>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
