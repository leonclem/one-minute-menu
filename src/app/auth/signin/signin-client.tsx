'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { UXHeader, UXFooter, UXCard } from '@/components/ux'
import { AuthOTPForm } from '@/components/auth/AuthOTPForm'

export default function SignInClient() {
  const isLocalDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  return (
    <div className="ux-implementation min-h-screen flex flex-col overflow-x-hidden relative">
      {/* Background image + soft overlay */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/backgrounds/kung-pao-chicken.png)`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 30%'
        }}
      />

      <UXHeader />

      <main className="container-ux py-10 md:py-12 grid place-items-center">
        <div className="w-full max-w-md space-y-8">
          {/* Hero heading */}
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
              Welcome Back
            </h1>
            <p className="mt-2 text-white/90 text-hero-shadow-strong">
              Sign in to manage your digital menus
            </p>
          </div>

          <UXCard>
            <div className="p-6">
              <AuthOTPForm 
                type="signin"
                title="Sign in with email"
                subtitle="We'll send you a secure magic link to access your account"
                buttonText="Send magic link"
                trackingSource="signin_page"
              />
            </div>
          </UXCard>

          {/* Sign Up Link */}
          <div className="text-center">
            <p className="text-sm text-white text-hero-shadow">
              Don&apos;t have an account?{' '}
              <Link 
                href="/register" 
                className="font-medium text-ux-primary hover:text-ux-primary-dark transition-colors"
              >
                Sign up free
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