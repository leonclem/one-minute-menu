'use client'

/**
 * Image Generation Tab
 * 
 * AI image generation statistics and analytics
 * Shows generation counts, success rates, costs, and breakdowns
 */

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

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

export function ImageGenerationTab() {
  const [data, setData] = useState<GenerationAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchGenerationData()
  }, [])

  async function fetchGenerationData() {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/admin/analytics')
      if (!res.ok) {
        throw new Error('Failed to fetch generation data')
      }

      const analyticsData = await res.json()
      setData(analyticsData.generationData)
    } catch (err) {
      console.error('Error fetching generation data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load generation data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading generation data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchGenerationData}
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
      {/* Overview */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            AI Image Generation Stats
          </h2>
          <p className="text-sm text-gray-500 mt-1">Usage and performance metrics for the last 30 days</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/admin/image-generator"
            className="text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md font-medium transition-colors"
          >
            Launch Imagen 4.0
          </a>
          <a
            href="/admin/gemini-image-generator"
            className="text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md font-medium transition-colors"
          >
            Launch Gemini 2.5
          </a>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Generations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {data.totals.totalGenerations}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(data.totals.successRate * 100)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Variations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {data.totals.totalVariations}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Estimated Cost (USD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              ${data.totals.estimatedCost.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Processing Time */}
      {data.totals.avgProcessingTime && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-600">
              Average Processing Time: <span className="font-semibold">{data.totals.avgProcessingTime} ms</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Breakdown by Plan */}
      {data.totals.byPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Breakdown by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Plan</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">Generations</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">Estimated Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.totals.byPlan).map(([plan, stats]) => (
                    <tr key={plan} className="border-b border-gray-100">
                      <td className="py-2 px-2 text-gray-900 capitalize">{plan}</td>
                      <td className="py-2 px-2 text-gray-900 text-right">{stats.generations}</td>
                      <td className="py-2 px-2 text-gray-900 text-right">${stats.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
                {data.rows.slice(-30).reverse().map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="py-2 px-2 text-gray-900">
                      {new Date(row.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </td>
                    <td className="text-right py-2 px-2 text-gray-900">{row.successful_generations}</td>
                    <td className="text-right py-2 px-2 text-gray-900">{row.failed_generations}</td>
                    <td className="text-right py-2 px-2 text-gray-900">{row.total_variations}</td>
                    <td className="text-right py-2 px-2 text-gray-900">
                      ${Number(row.estimated_cost || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* No Data State */}
      {data.totals.totalGenerations === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No image generations yet
            </h3>
            <p className="text-gray-600">
              AI image generation statistics will appear here as users generate images
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
