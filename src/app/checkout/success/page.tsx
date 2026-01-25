'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { User, UserPlan } from '@/types'

type PollingStatus = 'polling' | 'success' | 'timeout' | 'error'
type PurchaseType = 'subscription' | 'creator_pack'

function CheckoutSuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const router = useRouter()

  const [status, setStatus] = useState<PollingStatus>('polling')
  const [currentPlan, setCurrentPlan] = useState<UserPlan>('free')
  const [initialPlan, setInitialPlan] = useState<UserPlan>('free')
  const [pollingAttempts, setPollingAttempts] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [purchaseType, setPurchaseType] = useState<PurchaseType | null>(null)
  const [redirectSeconds, setRedirectSeconds] = useState<number | null>(null)

  const MAX_POLLING_ATTEMPTS = 15 // 15 attempts over 30 seconds
  const POLLING_INTERVALS = [2000, 2000, 2000, 2000, 2000, 3000, 3000, 3000, 4000, 4000, 5000, 5000, 5000, 5000, 5000] // Progressive backoff

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch('/api/profile')
      if (!response.ok) {
        throw new Error('Failed to fetch profile')
      }
      const data = await response.json()
      const profile: User = data.data
      
      return profile.plan
    } catch (err) {
      console.error('Error fetching profile:', err)
      throw err
    }
  }, [])

  const checkPlanUpdate = useCallback(async () => {
    try {
      // First try manual verification if we have a sessionId
      if (sessionId) {
        try {
          console.log(`[success] Triggering manual verification for session ${sessionId}`)
          const vResp = await fetch(`/api/checkout/verify?session_id=${sessionId}`)
          const vData = await vResp.json()
          console.log(`[success] Verification result:`, vData)
          if (vData?.processed && vData?.product_type === 'creator_pack') {
            setPurchaseType('creator_pack')
            setStatus('success')
            return true
          }
        } catch (vErr) {
          console.error('[success] Manual verification call failed:', vErr)
        }
      }

      const plan = await fetchProfile()
      console.log(`[success] Current plan: ${plan}, Initial plan: ${initialPlan}`)
      
      // Check if plan has been updated from initial plan
      if (plan !== initialPlan && plan !== 'free') {
        setCurrentPlan(plan)
        setPurchaseType('subscription')
        setStatus('success')
        return true
      }
      
      return false
    } catch (err) {
      console.error('Polling error:', err)
      return false
    }
  }, [fetchProfile, initialPlan, sessionId])

  useEffect(() => {
    // Fetch initial plan on mount
    const initializePolling = async () => {
      try {
        const plan = await fetchProfile()
        setInitialPlan(plan)
        setCurrentPlan(plan)
        
        // If already on a paid plan, show success immediately
        if (plan !== 'free') {
          setStatus('success')
          setPurchaseType('subscription')
        }
      } catch (err) {
        setError('Failed to load your profile. Please try refreshing the page.')
        setStatus('error')
      }
    }

    initializePolling()
  }, [fetchProfile])

  useEffect(() => {
    // Only start polling if we're in polling status
    if (status !== 'polling') {
      return
    }

    // Don't poll if we've exceeded max attempts
    if (pollingAttempts >= MAX_POLLING_ATTEMPTS) {
      setStatus('timeout')
      return
    }

    const interval = POLLING_INTERVALS[pollingAttempts] || 5000
    
    console.log(`[success] Polling attempt ${pollingAttempts + 1}/${MAX_POLLING_ATTEMPTS} in ${interval}ms`)

    const timeoutId = setTimeout(async () => {
      const updated = await checkPlanUpdate()
      
      if (!updated) {
        setPollingAttempts(prev => prev + 1)
      }
    }, interval)

    return () => clearTimeout(timeoutId)
  }, [status, pollingAttempts, checkPlanUpdate, MAX_POLLING_ATTEMPTS, POLLING_INTERVALS])

  useEffect(() => {
    if (status !== 'success') {
      setRedirectSeconds(null)
      return
    }

    setRedirectSeconds(5)
    const intervalId = setInterval(() => {
      setRedirectSeconds(prev => {
        if (prev === null) return prev
        if (prev <= 1) {
          clearInterval(intervalId)
          router.push('/dashboard')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalId)
  }, [status, router])

  const getPlanDisplayName = (plan: UserPlan): string => {
    switch (plan) {
      case 'grid_plus':
        return 'Grid+'
      case 'grid_plus_premium':
        return 'Grid+ Premium'
      case 'free':
        return 'Free'
      default:
        return plan
    }
  }

  const isCreatorPackSuccess = purchaseType === 'creator_pack'

  const handleManualVerify = async () => {
    setStatus('polling')
    setPollingAttempts(0)
    const updated = await checkPlanUpdate()
    if (!updated) {
      setStatus('timeout')
    }
  }

  return (
    <Card className="max-w-2xl w-full">
      <CardHeader>
        <CardTitle className="text-center text-2xl">
          {status === 'polling' && 'Processing your purchase...'}
          {status === 'success' && (isCreatorPackSuccess ? '🎉 Creator Pack activated!' : '🎉 Purchase successful!')}
          {status === 'timeout' && 'Purchase is being processed'}
          {status === 'error' && 'Something went wrong'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Polling State */}
        {status === 'polling' && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600"></div>
            </div>
            <div className="space-y-2">
              <p className="text-secondary-700">
                We're confirming your payment with Stripe...
              </p>
              <p className="text-sm text-secondary-500">
                This usually takes just a few seconds.
              </p>
              {sessionId && (
                <p className="text-xs text-secondary-400 font-mono">
                  Session: {sessionId.substring(0, 20)}...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="text-center space-y-6">
            {purchaseType === 'subscription' && (
              <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-ux-primary/15 px-4 py-2 text-sm font-semibold text-ux-primary shadow-sm">
                <span className="inline-flex h-2 w-2 rounded-full bg-ux-primary" />
                Subscription confirmed
              </div>
            )}
            {purchaseType === 'creator_pack' && (
              <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-ux-primary/15 px-4 py-2 text-sm font-semibold text-ux-primary shadow-sm">
                <span className="inline-flex h-2 w-2 rounded-full bg-ux-primary" />
                Creator Pack added to your account
              </div>
            )}
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 p-4">
                <svg
                  className="w-16 h-16 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            {isCreatorPackSuccess ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold text-secondary-900">
                  Your Creator Pack is ready to use.
                </p>
                <p className="text-secondary-700">
                  You now have access to Creator Pack features.
                </p>
                <p className="text-sm text-secondary-600">
                  You'll receive a confirmation email shortly with your receipt.
                </p>
                {redirectSeconds !== null && (
                  <p className="text-sm text-secondary-500">
                    You'll be returned to the dashboard in {redirectSeconds} seconds...
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-semibold text-secondary-900">
                  Welcome to {getPlanDisplayName(currentPlan)}!
                </p>
                <p className="text-secondary-700">
                  Your account has been upgraded successfully.
                </p>
                <p className="text-sm text-secondary-600">
                  You'll receive a confirmation email shortly with your receipt and plan details.
                </p>
                {redirectSeconds !== null && (
                  <p className="text-sm text-secondary-500">
                    You'll be returned to the dashboard in {redirectSeconds} seconds...
                  </p>
                )}
              </div>
            )}
            <div className="pt-4">
              <Link href="/dashboard">
                <Button variant="primary" className="w-full sm:w-auto">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Timeout State */}
        {status === 'timeout' && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-blue-100 p-4">
                <svg
                  className="w-16 h-16 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-secondary-900">
                Your purchase is being processed
              </p>
              <p className="text-secondary-700">
                Payment confirmation is taking a bit longer than usual.
              </p>
              <p className="text-sm text-secondary-600">
                You'll receive an email confirmation shortly. Your account will be upgraded automatically once the payment is confirmed.
              </p>
            </div>
            <div className="pt-4 space-y-3">
              <Link href="/dashboard">
                <Button variant="primary" className="w-full sm:w-auto">
                  Go to Dashboard
                </Button>
              </Link>
              <div>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={handleManualVerify}
                >
                  Verify Purchase Now
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-red-100 p-4">
                <svg
                  className="w-16 h-16 text-red-600"
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
            <div className="space-y-2">
              <p className="text-lg font-semibold text-secondary-900">
                Unable to verify purchase
              </p>
              <p className="text-secondary-700">
                {error || 'We encountered an error while checking your purchase status.'}
              </p>
              <p className="text-sm text-secondary-600">
                If you completed the payment, your account will be upgraded automatically. Please check your email for confirmation.
              </p>
            </div>
            <div className="pt-4 space-y-3">
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
              <div>
                <Link href="/dashboard">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Additional Information */}
        <div className="mt-8 pt-6 border-t border-secondary-200">
          <div className="text-sm text-secondary-600 space-y-2">
            <p className="font-medium text-secondary-900">Need help?</p>
            <p>
              If you have any questions about your purchase, please contact us at{' '}
              <a
                href="mailto:support@gridmenu.app"
                className="text-primary-600 hover:text-primary-700 underline"
              >
                support@gridmenu.app
              </a>
            </p>
            {sessionId && (
              <p className="text-xs text-secondary-500">
                Reference ID: {sessionId}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CheckoutSuccessPage() {
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
        <CheckoutSuccessContent />
      </Suspense>
    </div>
  )
}
