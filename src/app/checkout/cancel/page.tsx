'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'

function CheckoutCancelContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  return (
    <Card className="max-w-2xl w-full">
      <CardHeader>
        <CardTitle className="text-center text-2xl">
          Payment Cancelled
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="rounded-full bg-secondary-100 p-4">
              <svg
                className="w-16 h-16 text-secondary-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <p className="text-lg font-semibold text-secondary-900">
              Your payment was cancelled
            </p>
            <p className="text-secondary-700">
              No charges were made to your account.
            </p>
            <p className="text-sm text-secondary-600">
              You can try again whenever you're ready to upgrade.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 space-y-3">
            <Link href="/upgrade">
              <Button variant="primary" className="w-full sm:w-auto">
                Try Again
              </Button>
            </Link>
            <div>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full sm:w-auto">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-8 pt-6 border-t border-secondary-200">
          <div className="text-sm text-secondary-600 space-y-2">
            <p className="font-medium text-secondary-900">Why upgrade?</p>
            <ul className="list-disc list-inside space-y-1 text-secondary-700">
              <li>Create unlimited menus with Grid+ Premium</li>
              <li>Generate AI images for your menu items</li>
              <li>Access premium templates and themes</li>
              <li>Priority support</li>
            </ul>
            <p className="pt-4">
              Have questions?{' '}
              <a
                href="mailto:support@gridmenu.app"
                className="text-primary-600 hover:text-primary-700 underline"
              >
                Contact support
              </a>
            </p>
            {sessionId && (
              <p className="text-xs text-secondary-500 pt-2">
                Reference ID: {sessionId}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
      <Suspense fallback={
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              Loading...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600"></div>
            </div>
          </CardContent>
        </Card>
      }>
        <CheckoutCancelContent />
      </Suspense>
    </div>
  )
}
