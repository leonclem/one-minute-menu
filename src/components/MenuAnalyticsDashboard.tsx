'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

interface MenuAnalyticsDashboardProps {
  menuId: string
}

interface AnalyticsSummary {
  today: {
    pageViews: number
    uniqueVisitors: number
  }
  last7Days: {
    pageViews: number
    uniqueVisitors: number
  }
}

interface AnalyticsHistory {
  date: string
  page_views: number
  unique_visitors: number
}

/**
 * Analytics dashboard showing menu view statistics
 * Displays aggregated, cookieless analytics data
 */
export default function MenuAnalyticsDashboard({ menuId }: MenuAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [history, setHistory] = useState<AnalyticsHistory[]>([])
  
  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(`/api/analytics/menu/${menuId}?days=7`)
        const result = await response.json()
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch analytics')
        }
        
        setSummary(result.data.summary)
        setHistory(result.data.history)
      } catch (err) {
        console.error('Error fetching analytics:', err)
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }
    
    fetchAnalytics()
  }, [menuId])
  
  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-secondary-900">Analytics</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="py-8">
              <div className="animate-pulse">
                <div className="h-4 bg-secondary-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-secondary-200 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-8">
              <div className="animate-pulse">
                <div className="h-4 bg-secondary-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-secondary-200 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-secondary-900">Analytics</h3>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-secondary-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  if (!summary) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-secondary-900">Analytics</h3>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-secondary-600">No analytics data available yet</p>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-secondary-900">Analytics</h3>
        <p className="text-xs text-secondary-500">
          Privacy-friendly • No cookies • No tracking
        </p>
      </div>
      
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-secondary-600">
              Today's Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary-900">
              {summary.today.pageViews}
            </div>
            <p className="text-xs text-secondary-500 mt-1">
              Page views today
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-secondary-600">
              Today's Visitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary-900">
              {summary.today.uniqueVisitors}
            </div>
            <p className="text-xs text-secondary-500 mt-1">
              Unique visitors today
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-secondary-600">
              Last 7 Days Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary-900">
              {summary.last7Days.pageViews}
            </div>
            <p className="text-xs text-secondary-500 mt-1">
              Total page views
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-secondary-600">
              Last 7 Days Visitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary-900">
              {summary.last7Days.uniqueVisitors}
            </div>
            <p className="text-xs text-secondary-500 mt-1">
              Unique visitors
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* History Table */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-secondary-200">
                    <th className="text-left py-2 px-2 font-medium text-secondary-600">Date</th>
                    <th className="text-right py-2 px-2 font-medium text-secondary-600">Views</th>
                    <th className="text-right py-2 px-2 font-medium text-secondary-600">Visitors</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((day) => (
                    <tr key={day.date} className="border-b border-secondary-100">
                      <td className="py-2 px-2 text-secondary-900">
                        {new Date(day.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="text-right py-2 px-2 text-secondary-900">
                        {day.page_views}
                      </td>
                      <td className="text-right py-2 px-2 text-secondary-900">
                        {day.unique_visitors}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Privacy Notice */}
      <Card className="bg-secondary-50">
        <CardContent className="py-4">
          <p className="text-xs text-secondary-600">
            <strong>Privacy-friendly analytics:</strong> We use rotating daily identifiers 
            stored in your visitors' browsers (no cookies) to estimate unique visitors. 
            No IP addresses or personally identifiable information is collected. 
            All data is aggregated and anonymized.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
