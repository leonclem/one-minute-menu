'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { UXHeader, UXFooter, UXButton, UXInput, UXCard } from '@/components/ux'
import { isValidEmail } from '@/lib/utils'
import { trackConversionEvent } from '@/lib/conversion-tracking'

export default function SignUpClient() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSignUp = async (e: React.FormEvent) => {
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
      // Track registration start when the user submits a valid email
      trackConversionEvent({
        event: 'registration_start',
        metadata: {
          path: '/auth/signup',
          source: 'signup_form',
        },
      })

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      })

      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email for the magic link to sign in!')

        // Treat successful magic link dispatch as a signup conversion
        trackConversionEvent({
          event: 'signup_completed',
          metadata: {
            path: '/auth/signup',
            source: 'signup_form',
          },
        })
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ux-implementation min-h-screen flex flex-col overflow-x-hidden relative">
      {/* Background image + soft overlay, aligned with UX auth styling */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/backgrounds/kung-pao-chicken.png)',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 30%',
        }}
      />

      <UXHeader />

      <main className="container-ux py-10 md:py-12 grid place-items-center">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
              Get Started Free
            </h1>
            <p className="mt-2 text-white/90 text-hero-shadow-strong">
              Create your digital menu in under 5 minutes
            </p>
          </div>

          {/* Sign Up Form */}
          <UXCard>
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-ux-text mb-2">Sign up with email</h3>
                <p className="text-sm text-ux-text-secondary">
                  We&apos;ll send you a secure magic link to get started
                </p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-6">
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
                  {loading ? 'Sending magic link...' : 'Send magic link'}
                </UXButton>

                {message && (
                  <div className="rounded-lg bg-ux-success/10 border border-ux-success/20 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-ux-success" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 01-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-ux-success">{message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </form>

              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-ux-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-3 text-ux-text-secondary">Why magic links?</span>
                  </div>
                </div>

                <div className="mt-4 text-sm text-ux-text-secondary">
                  <ul className="space-y-1">
                    <li className="flex items-center">
                      <svg
                        className="h-4 w-4 text-ux-success mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      No passwords to remember
                    </li>
                    <li className="flex items-center">
                      <svg className="h-4 w-4 text-ux-success mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      More secure than traditional login
                    </li>
                    <li className="flex items-center">
                      <svg className="h-4 w-4 text-ux-success mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Perfect for mobile devices
                    </li>
                    <li className="flex items-center">
                      <svg className="h-4 w-4 text-ux-success mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      One-click access from your email
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </UXCard>

          {/* Sign In Link */}
          <div className="text-center">
            <p className="text-sm text-white text-hero-shadow">
              Already have an account?{' '}
              <Link
                href="/auth/signin"
                className="font-medium text-ux-primary hover:text-ux-primary-dark transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Back to Home glass button */}
          <div className="text-center">
            <Link
              href="/"
              className="inline-flex items-center text-sm rounded-full bg-white/20 border border-white/40 text-white hover:bg-white/30 px-4 py-2 transition-colors"
            >
              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>
      </main>

      <UXFooter />
    </div>
  )
}