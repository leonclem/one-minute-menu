/**
 * Admin Extraction Metrics Page
 * 
 * Dashboard for viewing extraction metrics and cost monitoring
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 12.1, 12.5
 */

import { Metadata } from 'next'
import { MetricsDashboard } from '@/components/admin/MetricsDashboard'
import { CostMonitorDashboard } from '@/components/admin/CostMonitorDashboard'
import { requireAdmin } from '@/lib/auth-utils'

export const metadata: Metadata = {
  title: 'Extraction Metrics | Admin',
  description: 'Monitor extraction performance and costs'
}

export const dynamic = 'force-dynamic'

export default async function ExtractionMetricsPage() {
  // Require admin access - redirects to /dashboard if not admin
  await requireAdmin()
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Extraction Metrics</h1>
          <p className="mt-2 text-gray-600">
            Monitor extraction performance, costs, and quality metrics
          </p>
        </div>

        {/* Cost Monitoring Section */}
        <div className="mb-8">
          <CostMonitorDashboard />
        </div>

        {/* Metrics Section */}
        <div>
          <MetricsDashboard />
        </div>
      </div>
    </div>
  )
}
