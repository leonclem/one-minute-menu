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
  DeveloperTab,
} from '@/components/admin'

type TabId = 'overview' | 'menu-metrics' | 'costs' | 'metrics' | 'image-generation' | 'feedback' | 'analytics' | 'developer'

const tabs: { id: TabId; label: string; description: string; hidden?: boolean }[] = [
  { id: 'overview', label: 'Overview', description: 'Quick stats and alerts' },
  { id: 'menu-metrics', label: 'Menu Metrics', description: 'Platform menu statistics' },
  { id: 'costs', label: 'Cost Monitoring', description: 'Spending and controls' },
  { id: 'metrics', label: 'Extraction Metrics', description: 'Performance and quality' },
  { id: 'analytics', label: 'Platform Analytics', description: 'Conversion and platform analytics' },
  { id: 'image-generation', label: 'AI Usage Stats', description: 'AI image generation stats' },
  { id: 'feedback', label: 'User Feedback', description: 'Extraction feedback' },
  { 
    id: 'developer', 
    label: 'Developer', 
    description: 'Internal tools and utilities',
  },
]

export function AdminHubClient() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const visibleTabs = tabs

  // Check URL params for initial tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab') as TabId
    if (tab && visibleTabs.some(t => t.id === tab)) {
      setActiveTab(tab)
    }
  }, [visibleTabs])

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
                  href="/dev/layout-lab"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v1.244c0 .408-.114.807-.327 1.154L4.855 12.58a3.75 3.75 0 003.235 5.67h7.82a3.75 3.75 0 003.235-5.67l-4.568-7.078a1.996 1.996 0 01-.327-1.154V3.104c0-1.104-.896-2-2-2h-1c-1.104 0-2 .896-2 2z" />
                  </svg>
                  Layout Lab
                </a>
              <div className="relative group">
                <button
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                >
                  AI Image Tools
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {/* Invisible bridge to prevent dropdown from disappearing */}
                <div className="absolute right-0 top-full w-56 h-2 z-10 hidden group-hover:block"></div>
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-10 hidden group-hover:block border border-gray-200">
                  <a
                    href="/admin/image-generator"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Imagen 4.0 (2K/HQ)
                  </a>
                  <a
                    href="/admin/general-image-generator"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    General Purpose (Backup)
                  </a>
                  <a
                    href="/admin/gemini-image-generator"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Gemini 2.5 (Restaurant)
                  </a>
                  <a
                    href="/admin/gemini-3-pro-image-generator"
                    className="block px-4 py-2 text-sm text-purple-700 font-semibold hover:bg-purple-50"
                  >
                    Gemini 3.0 Pro (Test)
                  </a>
                </div>
              </div>
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
            {visibleTabs.map((tab) => (
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
        {activeTab === 'developer' && <DeveloperTab />}
      </main>
    </div>
  )
}
