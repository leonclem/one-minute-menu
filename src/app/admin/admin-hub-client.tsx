'use client'

/**
 * Admin Hub Client Component
 * 
 * Tabbed interface for all admin functionality:
 * - Overview: Quick stats and alerts
 * - Cost Monitoring: Spending, caps, top spenders
 * - Extraction Metrics: Performance and quality
 * - Platform Analytics: Usage and generation stats
 * - User Feedback: Extraction feedback review
 */

import { useState, useEffect } from 'react'
import {
  CostMonitorTab,
  MetricsTab,
  FeedbackTab,
  OverviewTab,
  MenuMetricsTab,
  ImageGenerationTab,
  AnalyticsTab,
} from '@/components/admin'

type TabId = 'overview' | 'menu-metrics' | 'costs' | 'metrics' | 'image-generation' | 'feedback' | 'analytics'

const tabs: { id: TabId; label: string; description: string }[] = [
  { id: 'overview', label: 'Overview', description: 'Quick stats and alerts' },
  { id: 'menu-metrics', label: 'Menu Metrics', description: 'Platform menu statistics' },
  { id: 'costs', label: 'Cost Monitoring', description: 'Spending and controls' },
  { id: 'metrics', label: 'Extraction Metrics', description: 'Performance and quality' },
  { id: 'image-generation', label: 'Image Generation', description: 'AI image generation stats' },
  { id: 'analytics', label: 'Platform Analytics', description: 'Conversion and platform analytics' },
  { id: 'feedback', label: 'User Feedback', description: 'Extraction feedback' },
]

export function AdminHubClient() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Check URL params for initial tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab') as TabId
    if (tab && tabs.some(t => t.id === tab)) {
      setActiveTab(tab)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Hub</h1>
              <p className="text-sm text-gray-600 mt-1">
                Central dashboard for monitoring and management
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/admin/image-generator"
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Imagen 4.0 Generator
              </a>
              <a
                href="/admin/gemini-image-generator"
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Gemini 2.5 Flash Image
              </a>
              <a
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Back to Dashboard
              </a>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex space-x-8 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'menu-metrics' && <MenuMetricsTab />}
        {activeTab === 'costs' && <CostMonitorTab />}
        {activeTab === 'metrics' && <MetricsTab />}
        {activeTab === 'image-generation' && <ImageGenerationTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'feedback' && <FeedbackTab />}
      </main>
    </div>
  )
}
