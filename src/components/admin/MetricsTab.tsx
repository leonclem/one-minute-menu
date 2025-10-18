'use client'

/**
 * Metrics Tab
 * 
 * Wraps the existing MetricsDashboard component
 * Shows extraction performance and quality metrics
 */

import { MetricsDashboard } from './MetricsDashboard'

export function MetricsTab() {
  return (
    <div className="space-y-6">
      <MetricsDashboard />
    </div>
  )
}
