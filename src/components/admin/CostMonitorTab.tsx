'use client'

/**
 * Cost Monitor Tab
 * 
 * Wraps the existing CostMonitorDashboard component
 * Adds cost controls and spending cap management
 */

import { CostMonitorDashboard } from './CostMonitorDashboard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

import { useState, useEffect } from 'react'

interface SpendingCaps {
  dailyCapPerUser: number
  monthlyCapPerUser: number
  dailyCapGlobal: number
  monthlyCapGlobal: number
}

export function CostMonitorTab() {
  const [caps, setCaps] = useState<SpendingCaps | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCaps()
  }, [])

  async function fetchCaps() {
    try {
      const res = await fetch('/api/admin/costs')
      if (res.ok) {
        const data = await res.json()
        setCaps(data.caps)
      }
    } catch (err) {
      console.error('Error fetching caps:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cost Monitor Dashboard */}
      <CostMonitorDashboard />

      {/* Cost Controls Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Cost Controls Active</h3>
              {loading ? (
                <p className="mt-2 text-sm text-blue-700">Loading caps...</p>
              ) : caps ? (
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Daily global cap: ${caps.dailyCapGlobal.toFixed(2)}</li>
                    <li>Monthly global cap: ${caps.monthlyCapGlobal.toFixed(2)}</li>
                    <li>Daily per-user cap: ${caps.dailyCapPerUser.toFixed(2)}</li>
                    <li>Monthly per-user cap: ${caps.monthlyCapPerUser.toFixed(2)}</li>
                    <li>Automatic service disable when caps exceeded</li>
                    <li>Alerts sent at 75% and 90% thresholds</li>
                  </ul>
                </div>
              ) : (
                <p className="mt-2 text-sm text-blue-700">Failed to load caps</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Optimization Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Optimization Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start">
              <span className="font-medium text-gray-900 mr-2">•</span>
              <p>
                <strong>Image preprocessing:</strong> Images are automatically resized and compressed to reduce token usage while maintaining quality
              </p>
            </div>
            <div className="flex items-start">
              <span className="font-medium text-gray-900 mr-2">•</span>
              <p>
                <strong>Idempotency:</strong> Duplicate image submissions are detected via SHA-256 hash and return cached results
              </p>
            </div>
            <div className="flex items-start">
              <span className="font-medium text-gray-900 mr-2">•</span>
              <p>
                <strong>Prompt optimization:</strong> Prompts use temperature=0 for deterministic results, minimizing wasted tokens
              </p>
            </div>
            <div className="flex items-start">
              <span className="font-medium text-gray-900 mr-2">•</span>
              <p>
                <strong>Target cost:</strong> ≤$0.03 per extraction with 50-80x ROI on time savings
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
