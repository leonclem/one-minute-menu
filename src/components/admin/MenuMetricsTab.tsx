'use client'

/**
 * Menu Metrics Tab
 * 
 * Platform-wide menu statistics (excluding image generation)
 * Shows menu creation, usage, and other platform metrics
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

interface MenuMetricsData {
  platformData: PlatformMetric[]
  metricsByType: Record<string, PlatformMetric[]>
  totalMetrics: Array<{ name: string; total: number; recent: number }>
}

export function MenuMetricsTab() {
  const [data, setData] = useState<MenuMetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMetrics()
  }, [])

  async function fetchMetrics() {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/admin/analytics')
      if (!res.ok) {
        throw new Error('Failed to fetch metrics')
      }

      const analyticsData = await res.json()
      
      // Extract only menu-related data (exclude generation data)
      setData({
        platformData: analyticsData.platformData,
        metricsByType: analyticsData.metricsByType,
        totalMetrics: analyticsData.totalMetrics
      })
    } catch (err) {
      console.error('Error fetching menu metrics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load menu metrics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading menu metrics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchMetrics}
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
          Platform Menu Statistics
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
              No menu metrics yet
            </h3>
            <p className="text-gray-600">
              Platform metrics will appear here as users create and manage menus
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
