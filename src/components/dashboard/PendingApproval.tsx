'use client'

import { UXCard, UXButton } from '@/components/ux'

export function PendingApproval({ email }: { email?: string }) {
  const handleSignOut = async () => {
    try {
      await fetch('/auth/signout', { method: 'POST' })
      window.location.href = '/'
    } catch (error) {
      console.error('Sign out failed:', error)
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <UXCard className="max-w-lg w-full">
        <div className="p-8 text-center">
          {/* Celebration icon with primary brand color */}
          <div className="w-16 h-16 bg-[#01B3BF] text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <h1 className="mb-2 text-2xl font-bold text-ux-text">Your account is being reviewed</h1>
          <p className="mb-6 text-lg font-semibold text-[var(--studio-teal,#01B3BF)]">
            Your registration request has been sent to GridMenu
          </p>
          
          <div className="mb-8 space-y-4 rounded-lg border border-[var(--studio-teal,#01B3BF)]/25 bg-[var(--studio-teal-tint,rgba(1,179,191,0.09))] p-6 text-left text-ux-text-secondary">
            <p className="flex items-start">
              <svg className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--studio-teal,#01B3BF)]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>
                <strong className="text-ux-text">Welcome to GridMenu!</strong> We've received your registration for <strong className="text-ux-text">{email}</strong>
              </span>
            </p>
            <p className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#01B3BF' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>
                Our team is reviewing your registration request to ensure the best experience for all users
              </span>
            </p>
            <p className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: '#01B3BF' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>
                <strong>You'll receive an email notification</strong> as soon as your account is approved — usually within 24 hours!
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <UXButton
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Check Status Again
            </UXButton>
            
            <button
              onClick={handleSignOut}
              className="text-sm text-ux-text-secondary transition-colors hover:text-ux-text"
            >
              Sign out
            </button>
          </div>
          
          <div className="mt-8 border-t border-ux-border pt-6">
            <p className="mb-2 text-sm text-ux-text-secondary">Need urgent access?</p>
            <a 
              href="mailto:support@gridmenu.ai" 
              className="text-sm font-semibold text-[var(--studio-link,#5fd3da)] transition-colors hover:underline"
            >
              Contact us at support@gridmenu.ai
            </a>
          </div>
        </div>
      </UXCard>
    </div>
  )
}
