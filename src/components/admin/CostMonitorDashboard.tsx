'use client'

/**
 * Cost Monitor Dashboard Component
 * 
 * Admin dashboard for monitoring extraction costs:
 * - Daily and monthly spending
 * - Spending caps and alerts
 * - Per-user cost tracking
 * - Budget utilization
 * 
 * Requirements: 8.3, 12.1, 12.4
 */

import { useState, useEffect } from 'react'
import type { CostAlert } from '@/lib/extraction/cost-monitor'

// ============================================================================
// Types
// ============================================================================

interface SpendingSummary {
  daily: {
    current: number
    cap: number
    percentage: number
  }
  monthly: {
    current: number
    cap: number
    percentage: number
  }
  alerts: CostAlert[]
}

interface TopSpender {
  userId: string
  email: string
  dailySpending: number
  monthlySpending: number
  totalExtractions: number
}

// ============================================================================
// Component
// ============================================================================

export function CostMonitorDashboard() {
  const [summary, setSummary] = useState<SpendingSummary | null>(null)
  const [topSpenders, setTopSpenders] = useState<TopSpender[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCostData()
    
    // Refresh every 5 minutes
    const interval = setInterval(loadCostData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadCostData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/costs')
      if (!response.ok) {
        throw new Error('Failed to load cost data')
      }

      const data = await response.json()
      setSummary(data.summary)
      setTopSpenders(data.topSpenders || [])
    } catch (err) {
      console.error('Error loading cost data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load cost data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading cost data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Error: {error}</p>
        <button
          onClick={loadCostData}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600">No cost data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Cost Monitoring</h2>
        <button
          onClick={loadCostData}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {summary.alerts.length > 0 && (
        <div className="space-y-2">
          {summary.alerts.map((alert, index) => (
            <AlertCard key={index} alert={alert} />
          ))}
        </div>
      )}

      {/* Spending Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SpendingCard
          title="Daily Spending"
          current={summary.daily.current}
          cap={summary.daily.cap}
          percentage={summary.daily.percentage}
        />
        <SpendingCard
          title="Monthly Spending"
          current={summary.monthly.current}
          cap={summary.monthly.cap}
          percentage={summary.monthly.percentage}
        />
      </div>

      {/* Top Spenders */}
      {topSpenders.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Spenders (This Month)</h3>
          <div className="space-y-3">
            {topSpenders.map((spender, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{spender.email}</p>
                  <p className="text-sm text-gray-500">
                    {spender.totalExtractions} extractions
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    ${spender.monthlySpending.toFixed(4)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Today: ${spender.dailySpending.toFixed(4)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost Breakdown */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Utilization</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Daily Budget</span>
              <span className="font-medium">
                ${summary.daily.current.toFixed(4)} / ${summary.daily.cap.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  summary.daily.percentage >= 90
                    ? 'bg-red-500'
                    : summary.daily.percentage >= 75
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(summary.daily.percentage, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {summary.daily.percentage.toFixed(1)}% used
            </p>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Monthly Budget</span>
              <span className="font-medium">
                ${summary.monthly.current.toFixed(4)} / ${summary.monthly.cap.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  summary.monthly.percentage >= 90
                    ? 'bg-red-500'
                    : summary.monthly.percentage >= 75
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(summary.monthly.percentage, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {summary.monthly.percentage.toFixed(1)}% used
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Alert Card Component
// ============================================================================

function AlertCard({ alert }: { alert: CostAlert }) {
  const severityStyles = {
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    critical: 'bg-red-50 border-red-200 text-red-800'
  }

  const severityIcons = {
    warning: '⚠️',
    critical: '🚨'
  }

  return (
    <div className={`p-4 border rounded-lg ${severityStyles[alert.severity]}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{severityIcons[alert.severity]}</span>
        <div className="flex-1">
          <p className="font-semibold">{alert.message}</p>
          <p className="text-sm mt-1">
            Current: ${alert.current.toFixed(4)} / Cap: ${alert.cap.toFixed(2)}
          </p>
          <p className="text-xs mt-1 opacity-75">
            {alert.type === 'global' ? 'Global' : 'User'} {alert.metric} spending
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Spending Card Component
// ============================================================================

function SpendingCard({
  title,
  current,
  cap,
  percentage
}: {
  title: string
  current: number
  cap: number
  percentage: number
}) {
  const getStatusColor = () => {
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 75) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getStatusText = () => {
    if (percentage >= 90) return 'Critical'
    if (percentage >= 75) return 'Warning'
    return 'Healthy'
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">
            ${current.toFixed(4)}
          </span>
          <span className="text-gray-500">/ ${cap.toFixed(2)}</span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              percentage >= 90
                ? 'bg-red-500'
                : percentage >= 75
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          ></div>
        </div>

        <p className="text-sm text-gray-600">
          {percentage.toFixed(1)}% of budget used
        </p>

        <p className="text-sm text-gray-500">
          Remaining: ${(cap - current).toFixed(4)}
        </p>
      </div>
    </div>
  )
}
