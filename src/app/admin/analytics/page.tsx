import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { analyticsOperations } from '@/lib/analytics-server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

export const dynamic = 'force-dynamic'

/**
 * Admin analytics dashboard
 * Shows platform-wide metrics for monitoring
 */
export default async function AdminAnalyticsPage() {
  const supabase = createServerSupabaseClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/auth/signin')
  }
  
  // TODO: Add proper admin role check
  // For now, this is accessible to all authenticated users
  // In production, add: if (!user.app_metadata?.role === 'admin') redirect('/dashboard')
  
  // Fetch platform analytics
  const platformData = await analyticsOperations.getPlatformAnalytics(30)

  // Fetch generation analytics (admin view)
  const generationAdmin = await analyticsOperations.getGenerationAnalyticsAdmin(30)
  
  // Group metrics by type
  const metricsByType = platformData.reduce((acc, metric) => {
    if (!acc[metric.metric_name]) {
      acc[metric.metric_name] = []
    }
    acc[metric.metric_name].push(metric)
    return acc
  }, {} as Record<string, typeof platformData>)
  
  // Calculate totals
  const totalMetrics = Object.entries(metricsByType).map(([name, data]) => ({
    name,
    total: data.reduce((sum, d) => sum + d.metric_value, 0),
    recent: data.slice(-7).reduce((sum, d) => sum + d.metric_value, 0),
  }))
  
  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-secondary-900">
              Platform Analytics
            </h1>
            <a
              href="/dashboard"
              className="text-sm text-secondary-500 hover:text-secondary-700"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-mobile py-8">
        <div className="space-y-8">
          {/* Overview Cards */}
          <div>
            <h2 className="text-xl font-semibold text-secondary-900 mb-4">
              Platform Overview
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {totalMetrics.map((metric) => (
                <Card key={metric.name}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-secondary-600 capitalize">
                      {metric.name.replace(/_/g, ' ')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-secondary-900">
                      {metric.total}
                    </div>
                    <p className="text-xs text-secondary-500 mt-1">
                      Last 7 days: {metric.recent}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Detailed Metrics */}
          {Object.entries(metricsByType).map(([metricName, data]) => (
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
                      <tr className="border-b border-secondary-200">
                        <th className="text-left py-2 px-2 font-medium text-secondary-600">
                          Date
                        </th>
                        <th className="text-right py-2 px-2 font-medium text-secondary-600">
                          Value
                        </th>
                        <th className="text-left py-2 px-2 font-medium text-secondary-600">
                          Metadata
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.slice(-30).reverse().map((metric) => (
                        <tr key={metric.id} className="border-b border-secondary-100">
                          <td className="py-2 px-2 text-secondary-900">
                            {new Date(metric.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="text-right py-2 px-2 text-secondary-900">
                            {metric.metric_value}
                          </td>
                          <td className="py-2 px-2 text-secondary-600 text-xs">
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

          {/* Generation Analytics Section */}
          <Card>
            <CardHeader>
              <CardTitle>AI Image Generation - Last 30 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                <div>
                  <div className="text-xs text-secondary-600 mb-1">Total Generations</div>
                  <div className="text-2xl font-bold text-secondary-900">{generationAdmin.totals.totalGenerations}</div>
                </div>
                <div>
                  <div className="text-xs text-secondary-600 mb-1">Success Rate</div>
                  <div className="text-2xl font-bold text-secondary-900">{Math.round(generationAdmin.totals.successRate * 100)}%</div>
                </div>
                <div>
                  <div className="text-xs text-secondary-600 mb-1">Total Variations</div>
                  <div className="text-2xl font-bold text-secondary-900">{generationAdmin.totals.totalVariations}</div>
                </div>
                <div>
                  <div className="text-xs text-secondary-600 mb-1">Estimated Cost (USD)</div>
                  <div className="text-2xl font-bold text-secondary-900">${generationAdmin.totals.estimatedCost.toFixed(2)}</div>
                </div>
              </div>

              {generationAdmin.totals.avgProcessingTime && (
                <p className="text-sm text-secondary-600 mb-4">Avg Processing Time: {generationAdmin.totals.avgProcessingTime} ms</p>
              )}

              {/* Optional breakdown by plan */}
              {generationAdmin.totals.byPlan && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm mb-6">
                    <thead>
                      <tr className="border-b border-secondary-200">
                        <th className="text-left py-2 px-2 font-medium text-secondary-600">Plan</th>
                        <th className="text-right py-2 px-2 font-medium text-secondary-600">Generations</th>
                        <th className="text-right py-2 px-2 font-medium text-secondary-600">Estimated Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(generationAdmin.totals.byPlan).map(([plan, stats]) => (
                        <tr key={plan} className="border-b border-secondary-100">
                          <td className="py-2 px-2 text-secondary-900 capitalize">{plan}</td>
                          <td className="py-2 px-2 text-secondary-900 text-right">{stats.generations}</td>
                          <td className="py-2 px-2 text-secondary-900 text-right">${stats.cost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Raw rows table for debugging/visibility */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-secondary-200">
                      <th className="text-left py-2 px-2 font-medium text-secondary-600">Date</th>
                      <th className="text-right py-2 px-2 font-medium text-secondary-600">Success</th>
                      <th className="text-right py-2 px-2 font-medium text-secondary-600">Failed</th>
                      <th className="text-right py-2 px-2 font-medium text-secondary-600">Variations</th>
                      <th className="text-right py-2 px-2 font-medium text-secondary-600">Cost</th>
                      <th className="text-left py-2 px-2 font-medium text-secondary-600">Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generationAdmin.rows.slice(-30).reverse().map((row) => (
                      <tr key={row.id} className="border-b border-secondary-100">
                        <td className="py-2 px-2 text-secondary-900">
                          {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="text-right py-2 px-2 text-secondary-900">{row.successful_generations}</td>
                        <td className="text-right py-2 px-2 text-secondary-900">{row.failed_generations}</td>
                        <td className="text-right py-2 px-2 text-secondary-900">{row.total_variations}</td>
                        <td className="text-right py-2 px-2 text-secondary-900">${Number(row.estimated_cost || 0).toFixed(2)}</td>
                        <td className="py-2 px-2 text-secondary-600 text-xs">
                          {row.metadata && Object.keys(row.metadata).length > 0 ? JSON.stringify(row.metadata) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* No Data State */}
          {totalMetrics.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <div className="mx-auto h-12 w-12 text-secondary-400 mb-4">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-secondary-900 mb-2">
                  No analytics data yet
                </h3>
                <p className="text-secondary-600">
                  Platform metrics will appear here as users interact with the system
                </p>
              </CardContent>
            </Card>
          )}

          {/* Privacy Notice */}
          <Card className="bg-secondary-50">
            <CardContent className="py-4">
              <p className="text-xs text-secondary-600">
                <strong>Privacy-compliant monitoring:</strong> All platform analytics 
                are aggregated and anonymized. No personally identifiable information 
                is collected or stored. This dashboard is for operational monitoring only.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
