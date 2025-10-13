'use client'

/**
 * Metrics Dashboard Component
 * 
 * Admin dashboard for viewing extraction metrics:
 * - Overall extraction statistics
 * - Cost tracking and spending
 * - Performance metrics (processing time, confidence)
 * - Prompt version comparison
 * 
 * Requirements: 8.1, 8.2, 8.4
 */

import { useState, useEffect } from 'react'
import type { ExtractionMetrics, DailyMetrics } from '@/lib/extraction/metrics-collector'

// ============================================================================
// Types
// ============================================================================

interface MetricsDashboardProps {
  dateRange?: {
    start: string
    end: string
  }
}

interface MetricCard {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

// ============================================================================
// Component
// ============================================================================

export function MetricsDashboard({ dateRange }: MetricsDashboardProps) {
  const [metrics, setMetrics] = useState<ExtractionMetrics | null>(null)
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Default to last 30 days
  const defaultEnd = new Date().toISOString().split('T')[0]
  const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  const startDate = dateRange?.start || defaultStart
  const endDate = dateRange?.end || defaultEnd

  useEffect(() => {
    loadMetrics()
  }, [startDate, endDate])

  const loadMetrics = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/admin/metrics?start=${startDate}&end=${endDate}`
      )

      if (!response.ok) {
        throw new Error('Failed to load metrics')
      }

      const data = await response.json()
      setMetrics(data.overall)
      setDailyMetrics(data.daily || [])
    } catch (err) {
      console.error('Error loading metrics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading metrics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Error: {error}</p>
        <button
          onClick={loadMetrics}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600">No metrics available for this date range</p>
      </div>
    )
  }

  const metricCards: MetricCard[] = [
    {
      title: 'Total Extractions',
      value: metrics.totalExtractions.toLocaleString(),
      subtitle: `${startDate} to ${endDate}`
    },
    {
      title: 'Total Cost',
      value: `$${metrics.totalCost.toFixed(4)}`,
      subtitle: `Avg: $${metrics.averageCostPerExtraction.toFixed(4)} per extraction`
    },
    {
      title: 'Average Confidence',
      value: `${(metrics.averageConfidence * 100).toFixed(1)}%`,
      trend: metrics.averageConfidence >= 0.85 ? 'up' : metrics.averageConfidence >= 0.75 ? 'neutral' : 'down'
    },
    {
      title: 'Processing Time (Avg)',
      value: `${(metrics.averageProcessingTime / 1000).toFixed(1)}s`,
      subtitle: `P95: ${(metrics.p95ProcessingTime / 1000).toFixed(1)}s`
    },
    {
      title: 'Failure Rate',
      value: `${(metrics.failureRate * 100).toFixed(1)}%`,
      trend: metrics.failureRate <= 0.05 ? 'up' : metrics.failureRate <= 0.10 ? 'neutral' : 'down'
    },
    {
      title: 'Uncertain Items',
      value: `${(metrics.uncertainItemRate * 100).toFixed(1)}%`,
      subtitle: 'Extractions with uncertain items'
    },
    {
      title: 'Total Tokens',
      value: metrics.totalTokensUsed.toLocaleString(),
      subtitle: `${Math.round(metrics.totalTokensUsed / metrics.totalExtractions).toLocaleString()} avg per extraction`
    },
    {
      title: 'User Satisfaction',
      value: metrics.feedbackCount > 0 
        ? `${(metrics.positiveRating * 100).toFixed(0)}%` 
        : 'N/A',
      subtitle: `${metrics.feedbackCount} feedback responses`,
      trend: metrics.positiveRating >= 0.8 ? 'up' : metrics.positiveRating >= 0.6 ? 'neutral' : 'down'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Extraction Metrics</h2>
        <button
          onClick={loadMetrics}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, index) => (
          <MetricCardComponent key={index} {...card} />
        ))}
      </div>

      {/* Daily Metrics Chart */}
      {dailyMetrics.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Trends</h3>
          <DailyMetricsChart data={dailyMetrics} />
        </div>
      )}

      {/* Performance Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Time Distribution</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">P50 (Median):</span>
              <span className="font-medium">{(metrics.p50ProcessingTime / 1000).toFixed(2)}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">P95:</span>
              <span className="font-medium">{(metrics.p95ProcessingTime / 1000).toFixed(2)}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">P99:</span>
              <span className="font-medium">{(metrics.p99ProcessingTime / 1000).toFixed(2)}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Average:</span>
              <span className="font-medium">{(metrics.averageProcessingTime / 1000).toFixed(2)}s</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Metrics</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Average Confidence:</span>
              <span className="font-medium">{(metrics.averageConfidence * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Uncertain Items Rate:</span>
              <span className="font-medium">{(metrics.uncertainItemRate * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Failure Rate:</span>
              <span className="font-medium">{(metrics.failureRate * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Positive Feedback:</span>
              <span className="font-medium">
                {metrics.feedbackCount > 0 
                  ? `${(metrics.positiveRating * 100).toFixed(0)}%` 
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Metric Card Component
// ============================================================================

function MetricCardComponent({ title, value, subtitle, trend }: MetricCard) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-yellow-600'
  }

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→'
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {trend && (
          <span className={`text-lg ${trendColors[trend]}`}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      )}
    </div>
  )
}

// ============================================================================
// Daily Metrics Chart Component
// ============================================================================

function DailyMetricsChart({ data }: { data: DailyMetrics[] }) {
  const maxCost = Math.max(...data.map(d => d.totalCost))
  const maxExtractions = Math.max(...data.map(d => d.totalExtractions))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span>Extractions</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span>Cost</span>
        </div>
      </div>

      <div className="space-y-2">
        {data.map((day, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{day.date}</span>
              <div className="flex items-center gap-4">
                <span className="text-blue-600">{day.totalExtractions} extractions</span>
                <span className="text-green-600">${day.totalCost.toFixed(4)}</span>
              </div>
            </div>
            <div className="flex gap-1 h-2">
              <div
                className="bg-blue-500 rounded"
                style={{ width: `${(day.totalExtractions / maxExtractions) * 50}%` }}
              ></div>
              <div
                className="bg-green-500 rounded"
                style={{ width: `${(day.totalCost / maxCost) * 50}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
