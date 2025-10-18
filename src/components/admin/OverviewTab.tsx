'use client'

/**
 * Admin Overview Tab
 * 
 * Quick stats and alerts dashboard
 * Shows key metrics at a glance
 */

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

interface OverviewData {
  costs: {
    dailySpending: number
    monthlySpending: number
    dailyCap: number
    monthlyCap: number
  }
  metrics: {
    totalExtractions: number
    averageConfidence: number
    successRate: number
  }
  alerts: Array<{
    type: 'warning' | 'error' | 'info'
    message: string
  }>
}

export function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOverviewData()
  }, [])

  async function fetchOverviewData() {
    try {
      setLoading(true)
      setError(null)

      // Fetch cost data
      const costsRes = await fetch('/api/admin/costs')
      if (!costsRes.ok) {
        const errorText = await costsRes.text()
        throw new Error(`Failed to fetch cost data: ${errorText}`)
      }
      const costsData = await costsRes.json()
      console.log('Costs data:', costsData)

      // Fetch metrics data
      const metricsRes = await fetch('/api/admin/metrics')
      if (!metricsRes.ok) {
        const errorText = await metricsRes.text()
        throw new Error(`Failed to fetch metrics: ${errorText}`)
      }
      const metricsData = await metricsRes.json()
      console.log('Metrics data:', metricsData)

      // Build overview
      const overview: OverviewData = {
        costs: {
          dailySpending: costsData.summary?.daily?.current || 0,
          monthlySpending: costsData.summary?.monthly?.current || 0,
          dailyCap: costsData.caps?.dailyCapGlobal || 50,
          monthlyCap: costsData.caps?.monthlyCapGlobal || 500,
        },
        metrics: {
          totalExtractions: metricsData.overall?.totalExtractions || 0,
          averageConfidence: metricsData.overall?.averageConfidence || 0,
          successRate: metricsData.overall?.failureRate !== undefined 
            ? 1 - metricsData.overall.failureRate 
            : 0,
        },
        alerts: [],
      }

      // Generate alerts
      const dailyUsage = (overview.costs.dailySpending / overview.costs.dailyCap) * 100
      const monthlyUsage = (overview.costs.monthlySpending / overview.costs.monthlyCap) * 100

      if (dailyUsage >= 90) {
        overview.alerts.push({
          type: 'error',
          message: `Daily spending at ${dailyUsage.toFixed(0)}% of cap ($${overview.costs.dailySpending.toFixed(2)} / $${overview.costs.dailyCap})`,
        })
      } else if (dailyUsage >= 75) {
        overview.alerts.push({
          type: 'warning',
          message: `Daily spending at ${dailyUsage.toFixed(0)}% of cap ($${overview.costs.dailySpending.toFixed(2)} / $${overview.costs.dailyCap})`,
        })
      }

      if (monthlyUsage >= 90) {
        overview.alerts.push({
          type: 'error',
          message: `Monthly spending at ${monthlyUsage.toFixed(0)}% of cap ($${overview.costs.monthlySpending.toFixed(2)} / $${overview.costs.monthlyCap})`,
        })
      } else if (monthlyUsage >= 75) {
        overview.alerts.push({
          type: 'warning',
          message: `Monthly spending at ${monthlyUsage.toFixed(0)}% of cap ($${overview.costs.monthlySpending.toFixed(2)} / $${overview.costs.monthlyCap})`,
        })
      }

      if (overview.metrics.averageConfidence < 0.7 && overview.metrics.totalExtractions > 0) {
        overview.alerts.push({
          type: 'warning',
          message: `Average extraction confidence is low (${(overview.metrics.averageConfidence * 100).toFixed(0)}%)`,
        })
      }

      if (overview.metrics.successRate < 0.9 && overview.metrics.totalExtractions > 5) {
        overview.alerts.push({
          type: 'warning',
          message: `Extraction success rate is below target (${(overview.metrics.successRate * 100).toFixed(0)}%)`,
        })
      }

      if (overview.alerts.length === 0) {
        overview.alerts.push({
          type: 'info',
          message: 'All systems operating normally',
        })
      }

      setData(overview)
    } catch (err) {
      console.error('Error fetching overview:', err)
      setError(err instanceof Error ? err.message : 'Failed to load overview')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading overview...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchOverviewData}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const dailyUsagePercent = (data.costs.dailySpending / data.costs.dailyCap) * 100
  const monthlyUsagePercent = (data.costs.monthlySpending / data.costs.monthlyCap) * 100

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-3">
          {data.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`
                rounded-lg p-4 border
                ${
                  alert.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : alert.type === 'warning'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }
              `}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {alert.type === 'error' && (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {alert.type === 'warning' && (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {alert.type === 'info' && (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{alert.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Daily Spending */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Daily Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              ${data.costs.dailySpending.toFixed(2)}
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>{dailyUsagePercent.toFixed(0)}% of cap</span>
                <span>${data.costs.dailyCap}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    dailyUsagePercent >= 90
                      ? 'bg-red-500'
                      : dailyUsagePercent >= 75
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(dailyUsagePercent, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Spending */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Monthly Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              ${data.costs.monthlySpending.toFixed(2)}
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>{monthlyUsagePercent.toFixed(0)}% of cap</span>
                <span>${data.costs.monthlyCap}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    monthlyUsagePercent >= 90
                      ? 'bg-red-500'
                      : monthlyUsagePercent >= 75
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(monthlyUsagePercent, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Extractions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Extractions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {data.metrics.totalExtractions}
            </div>
            <p className="text-xs text-gray-500 mt-2">Last 30 days</p>
          </CardContent>
        </Card>

        {/* Average Confidence */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {(data.metrics.averageConfidence * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Success rate: {(data.metrics.successRate * 100).toFixed(0)}%
            </p>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
