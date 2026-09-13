'use client'

import Link from 'next/link'
import { UXCard } from '@/components/ux'
import { AuthOTPForm } from '@/components/auth/AuthOTPForm'
import { AuthMagicLinkBenefits } from '@/components/auth/AuthMagicLinkBenefits'

export default function SignInClient() {
  return (
    <div className="mx-auto w-full max-w-md">
      <UXCard className="mb-8">
        <AuthOTPForm
          type="signin"
          title="Sign in with email"
          subtitle="We'll send you a secure magic link to access your account"
          buttonText="Send magic link"
          trackingSource="signin_page"
        />
        <AuthMagicLinkBenefits />
      </UXCard>

      <div className="space-y-4 text-center">
        <p className="text-sm text-white/70">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-semibold text-[var(--studio-link,#5fd3da)] hover:text-[#7fdee4]"
          >
            Sign up free
          </Link>
        </p>

        <Link
          href="/"
          className="inline-flex items-center rounded-[9px] border border-white/20 px-4 py-2 text-sm text-white transition-colors hover:bg-white/5"
        >
          <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>
      </div>
    </div>
  )
}
