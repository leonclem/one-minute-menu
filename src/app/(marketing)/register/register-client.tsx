'use client'

import Link from 'next/link'
import { UXCard } from '@/components/ux'
import { AuthOTPForm } from '@/components/auth/AuthOTPForm'

interface UXRegisterClientProps {
  requireAdminApproval?: boolean
}

export default function UXRegisterClient({ requireAdminApproval = false }: UXRegisterClientProps) {
  return (
    <div className="mx-auto w-full max-w-md">
      {requireAdminApproval && (
        <div
          className="mb-6 rounded-[16px] border p-5"
          style={{
            borderColor: 'rgba(1, 179, 191, 0.45)',
            backgroundColor: 'var(--studio-panel, #0f1c1f)',
          }}
        >
          <h3 className="mb-1 font-bold text-white">Sign up for GridMenu</h3>
          <p className="text-sm leading-relaxed text-white/65">
            Your account may need a short review before Studio opens.{' '}
            <strong className="text-white">Most applications are approved within 24 hours.</strong>
          </p>
        </div>
      )}

      <UXCard className="mb-8">
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
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-[var(--studio-panel,#0f1c1f)] px-3 text-white/45">
                Why magic links?
              </span>
            </div>
          </div>

          <ul className="mt-4 space-y-2 text-sm text-white/65">
            {[
              'No passwords to remember',
              'More secure than traditional login',
              'Perfect for mobile devices',
              'One-click access from your email',
            ].map((item) => (
              <li key={item} className="flex items-center">
                <svg
                  className="mr-2 h-4 w-4 shrink-0 text-[var(--studio-teal,#01b3bf)]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </UXCard>

      <div className="space-y-4 text-center">
        <p className="text-sm text-white/70">
          Already have an account?{' '}
          <Link
            href="/auth/signin"
            className="font-semibold text-[var(--studio-link,#5fd3da)] hover:text-[#7fdee4]"
          >
            Sign in
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
