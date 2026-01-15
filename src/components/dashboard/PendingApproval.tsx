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
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Pending Approval</h1>
          
          <div className="space-y-4 text-gray-600 mb-8 text-left">
            <p>
              Welcome to the GridMenu Pilot! We've received your registration for <strong>{email}</strong>.
            </p>
            <p>
              To ensure the best experience for our pilot users, we are currently reviewing and approving new accounts manually.
            </p>
            <p>
              You'll receive an email notification as soon as your account is ready. This usually takes less than 24 hours.
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
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Sign out
            </button>
          </div>
          
          <p className="mt-8 text-xs text-gray-400">
            Need urgent access? Contact us at support@gridmenu.ai
          </p>
        </div>
      </UXCard>
    </div>
  )
}
