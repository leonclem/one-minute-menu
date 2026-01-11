'use client'

import Link from 'next/link'
import { UXCard } from '@/components/ux'
import { AuthOTPForm } from '@/components/auth/AuthOTPForm'

export default function UXRegisterClient() {
  return (
    <div className="w-full max-w-md mx-auto">
      {/* Registration Form */}
      <UXCard className="mb-8">
        <div className="p-6">
          <AuthOTPForm 
            type="signup"
            title="Sign up with email"
            subtitle="We'll send you a secure magic link to get started"
            buttonText="Send magic link"
            trackingSource="register_page"
          />

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ux-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-3 text-ux-text-secondary">
                  Why magic links?
                </span>
              </div>
            </div>

            <div className="mt-4 text-sm text-ux-text-secondary">
              <ul className="space-y-1">
                <li className="flex items-center">
                  <svg className="h-4 w-4 text-ux-success mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  No passwords to remember
                </li>
                <li className="flex items-center">
                  <svg className="h-4 w-4 text-ux-success mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  More secure than traditional login
                </li>
                <li className="flex items-center">
                  <svg className="h-4 w-4 text-ux-success mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Perfect for mobile devices
                </li>
                <li className="flex items-center">
                  <svg className="h-4 w-4 text-ux-success mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  One-click access from your email
                </li>
              </ul>
            </div>
          </div>
        </div>
      </UXCard>

      {/* Navigation Links */}
      <div className="text-center space-y-4">
        <p className="text-sm text-white text-hero-shadow">
          Already have an account?{' '}
          <Link 
            href="/auth/signin" 
            className="font-medium text-ux-primary hover:text-ux-primary-dark transition-colors"
          >
            Sign in
          </Link>
        </p>

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
  )
}