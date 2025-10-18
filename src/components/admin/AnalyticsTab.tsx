'use client'

/**
 * Analytics Tab
 * 
 * Platform-wide analytics and usage statistics
 * Shows platform metrics and AI generation analytics
 */

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

interface PlatformMetric {
  id: string
  metric_name: string
  metric_value: number
  date: string
  metadata: any
}

interface GenerationAnalytics {
  totals: {
    totalGenerations: number
    successRate: number
    totalVariations: number
    estimatedCost: number
    avgProcessingTime?: number
    byPlan?: Record<string, { generations: number; cost: number }>
  }
  rows: Array<{
    id: string
    date: string
    successful_generations: number
    failed_generations: number
    total_variations: number
    estimated_cost: number
    metadata: any
  }>
}

interface AnalyticsData {
  platformData: PlatformMetric[]
  generationData: GenerationAnalytics
  metricsByType: Record<string, PlatformMetric[]>
  totalMetrics: Array<{ name: string; total: number; recent: number }>
}

export function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  async function fetchAnalytics() {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/admin/analytics')
      if (!res.ok) {
        throw new Error('Failed to fetch analytics')
      }

      const analyticsData = await res.json()
      setData(analyticsData)
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Platform Overview
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.totalMetrics.map((metric) => (
            <Card key={metric.name}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600 capitalize">
                  {metric.name.replace(/_/g, ' ')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {metric.total}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Last 7 days: {metric.recent}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Generation Analytics Section */}
      <Card>
        <CardHeader>
          <CardTitle>AI Image Generation - Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div>
              <div className="text-xs text-gray-600 mb-1">Total Generations</div>
              <div className="text-2xl font-bold text-gray-900">{data.generationData.totals.totalGenerations}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Success Rate</div>
              <div className="text-2xl font-bold text-gray-900">{Math.round(data.generationData.totals.successRate * 100)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Total Variations</div>
              <div className="text-2xl font-bold text-gray-900">{data.generationData.totals.totalVariations}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Estimated Cost (USD)</div>
              <div className="text-2xl font-bold text-gray-900">${data.generationData.totals.estimatedCost.toFixed(2)}</div>
            </div>
          </div>

          {data.generationData.totals.avgProcessingTime && (
            <p className="text-sm text-gray-600 mb-4">Avg Processing Time: {data.generationData.totals.avgProcessingTime} ms</p>
          )}

          {/* Optional breakdown by plan */}
          {data.generationData.totals.byPlan && (
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Plan</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">Generations</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">Estimated Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.generationData.totals.byPlan).map(([plan, stats]) => (
                    <tr key={plan} className="border-b border-gray-100">
                      <td className="py-2 px-2 text-gray-900 capitalize">{plan}</td>
                      <td className="py-2 px-2 text-gray-900 text-right">{stats.generations}</td>
                      <td className="py-2 px-2 text-gray-900 text-right">${stats.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Daily breakdown */}
          <div className="overflow-x-auto">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Daily Breakdown</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Date</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Success</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Failed</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Variations</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.generationData.rows.slice(-30).reverse().map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="py-2 px-2 text-gray-900">
                      {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="text-right py-2 px-2 text-gray-900">{row.successful_generations}</td>
                    <td className="text-right py-2 px-2 text-gray-900">{row.failed_generations}</td>
                    <td className="text-right py-2 px-2 text-gray-900">{row.total_variations}</td>
                    <td className="text-right py-2 px-2 text-gray-900">${Number(row.estimated_cost || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      {Object.entries(data.metricsByType).map(([metricName, metrics]) => (
        <Card key={metricName}>
          <CardHeader>
            <CardTitle className="capitalize">
              {metricName.replace(/_/g, ' ')} - Last 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">
                      Date
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">
                      Value
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">
                      Metadata
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.slice(-30).reverse().map((metric) => (
                    <tr key={metric.id} className="border-b border-gray-100">
                      <td className="py-2 px-2 text-gray-900">
                        {new Date(metric.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="text-right py-2 px-2 text-gray-900">
                        {metric.metric_value}
                      </td>
                      <td className="py-2 px-2 text-gray-600 text-xs">
                        {metric.metadata && Object.keys(metric.metadata).length > 0
                          ? JSON.stringify(metric.metadata)
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* No Data State */}
      {data.totalMetrics.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No analytics data yet
            </h3>
            <p className="text-gray-600">
              Platform metrics will appear here as users interact with the system
            </p>
          </CardContent>
        </Card>
      )}

      {/* Privacy Notice */}
      <Card className="bg-gray-50">
        <CardContent className="py-4">
          <p className="text-xs text-gray-600">
            <strong>Privacy-compliant monitoring:</strong> All platform analytics 
            are aggregated and anonymized. No personally identifiable information 
            is collected or stored. This dashboard is for operational monitoring only.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
