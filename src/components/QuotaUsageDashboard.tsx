"use client"

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { UpgradePrompt } from '@/components/ui'

interface QuotaData {
  quota: {
    plan: 'free' | 'premium' | 'enterprise'
    limit: number
    used: number
    remaining: number
    resetDate: string | Date
    warningThreshold: number
    needsUpgrade: boolean
  }
  usage: {
    currentMonth: { total: number; successful: number; failed: number; variations: number }
    previousMonth: { total: number; successful: number }
    allTime: { total: number; estimatedCost: number }
  }
}

export default function QuotaUsageDashboard({ 
  variant = 'full' as 'full' | 'summary',
  showAdminLink = false,
  unstyled = false,
  hideTitle = false
}: { 
  variant?: 'full' | 'summary'
  showAdminLink?: boolean
  /**
   * When true, renders only the inner content without the legacy Card wrapper,
   * so parents (e.g., UXCard) can control surface and headings.
   */
  unstyled?: boolean
  /** When true, omits the internal title header */
  hideTitle?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<QuotaData | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchQuota() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/quota', { cache: 'no-store' })
        const json = await res.json()
        if (!json.success) {
          throw new Error(json.error || 'Failed to load quota')
        }
        if (!cancelled) setData(json.data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load quota')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchQuota()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      unstyled ? (
        <div className="h-16 animate-pulse rounded bg-white/50" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-secondary-600">AI Image Generation Quota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-16 animate-pulse rounded bg-secondary-100" />
          </CardContent>
        </Card>
      )
    )
  }

  if (error || !data) {
    return (
      unstyled ? (
        <div className="text-sm text-red-700">{error || 'Failed to load quota'}</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-secondary-600">AI Image Generation Quota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-red-700">{error || 'Failed to load quota'}</div>
          </CardContent>
        </Card>
      )
    )
  }

  const { quota, usage } = data
  const percentUsed = quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0
  const approachingLimit = quota.used >= quota.warningThreshold && quota.remaining > 0
  const exceeded = quota.remaining === 0

  if (variant === 'summary') {
    return (
      unstyled ? (
        <div>
          {!hideTitle && (
            <div className="text-sm font-medium text-secondary-600 mb-3">AI Image Generation</div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-secondary-900">{quota.used}/{quota.limit}</div>
              <div className="text-xs text-secondary-600">Used this month</div>
            </div>
            <div className="w-40">
              <div className="h-2 w-full overflow-hidden rounded bg-secondary-100">
                <div
                  className={`h-full ${exceeded ? 'bg-red-500' : approachingLimit ? 'bg-amber-500' : 'bg-primary-500'}`}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
              <div className="mt-1 text-right text-xs text-secondary-600">Resets {new Date(quota.resetDate).toLocaleDateString()}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            {exceeded ? (
              <span className="text-red-700">Limit reached</span>
            ) : approachingLimit ? (
              <span className="text-amber-700">Approaching limit</span>
            ) : (
              <span className="text-secondary-600">Within limit</span>
            )}
            {showAdminLink && (
              <a href="/admin?tab=image-generation" className="text-primary-600 hover:text-primary-500">View details →</a>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-secondary-600">AI Image Generation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-secondary-900">{quota.used}/{quota.limit}</div>
                <div className="text-xs text-secondary-600">Used this month</div>
              </div>
              <div className="w-40">
                <div className="h-2 w-full overflow-hidden rounded bg-secondary-100">
                  <div
                    className={`h-full ${exceeded ? 'bg-red-500' : approachingLimit ? 'bg-amber-500' : 'bg-primary-500'}`}
                    style={{ width: `${percentUsed}%` }}
                  />
                </div>
                <div className="mt-1 text-right text-xs text-secondary-600">Resets {new Date(quota.resetDate).toLocaleDateString()}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              {exceeded ? (
                <span className="text-red-700">Limit reached</span>
              ) : approachingLimit ? (
                <span className="text-amber-700">Approaching limit</span>
              ) : (
                <span className="text-secondary-600">Within limit</span>
              )}
              {showAdminLink && (
                <a href="/admin?tab=image-generation" className="text-primary-600 hover:text-primary-500">View details →</a>
              )}
            </div>
          </CardContent>
        </Card>
      )
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-secondary-600">AI Image Generation Quota</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-secondary-900">{quota.used}/{quota.limit}</div>
              <div className="text-xs text-secondary-600">Used this month</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-secondary-900">{quota.remaining}</div>
              <div className="text-xs text-secondary-600">Remaining</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full overflow-hidden rounded bg-secondary-100">
            <div
              className={`h-full ${exceeded ? 'bg-red-500' : approachingLimit ? 'bg-amber-500' : 'bg-primary-500'}`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-secondary-600">
            <span>{percentUsed}% used</span>
            <span>Resets on {new Date(quota.resetDate).toLocaleDateString()}</span>
          </div>

          {/* Current Month Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded border bg-white p-3">
              <div className="text-xs text-secondary-600">This month</div>
              <div className="mt-1 text-lg font-semibold">{usage.currentMonth.total}</div>
            </div>
            <div className="rounded border bg-white p-3">
              <div className="text-xs text-secondary-600">Successful</div>
              <div className="mt-1 text-lg font-semibold text-green-700">{usage.currentMonth.successful}</div>
            </div>
            <div className="rounded border bg-white p-3">
              <div className="text-xs text-secondary-600">Failed</div>
              <div className="mt-1 text-lg font-semibold text-red-700">{usage.currentMonth.failed}</div>
            </div>
          </div>

          {/* Notices */}
          {exceeded ? (
            <UpgradePrompt
              title="AI image generation limit reached"
              message={`You've used all ${quota.limit} generations for this month.`}
              cta="Upgrade to continue"
              href="/upgrade"
              reason={quota.plan === 'free' ? 'Premium includes up to 100 monthly AI generations.' : 'Enterprise includes higher limits.'}
              className="mt-2"
            />
          ) : approachingLimit ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              You have used {quota.used} of {quota.limit} this month ({percentUsed}%). Consider upgrading if you expect more usage.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}


