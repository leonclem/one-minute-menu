'use client'

import { useState, useEffect } from 'react'
import type { CategoryV2 } from '@/types/templates'
import type { UserCustomization } from '@/types/templates'

export interface TemplatePreviewProps {
  templateId: string
  menuData: { categories: CategoryV2[] }
  customization?: UserCustomization
}

export function TemplatePreview({
  templateId,
  menuData,
  customization,
}: TemplatePreviewProps) {
  const [html, setHtml] = useState<string>('')
  const [css, setCss] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function renderTemplate() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/templates/render', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            templateId,
            menuData,
            customization,
            format: 'html',
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to render template')
        }

        const data = await response.json()
        setHtml(data.render.renderData.html)
        setCss(data.render.renderData.css)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render template')
      } finally {
        setLoading(false)
      }
    }

    if (templateId && menuData.categories.length > 0) {
      renderTemplate()
    }
  }, [templateId, menuData, customization])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Rendering template...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border-2 border-red-200 rounded-lg">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="font-semibold text-red-900 mb-1">Render Error</h3>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!html) {
    return (
      <div className="flex items-center justify-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-600">Select a template to preview</p>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      {/* Preview Container */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        {/* Preview Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Preview</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {menuData.categories.length} categories
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">
              {menuData.categories.reduce((sum, cat) => sum + (cat.items?.length || 0), 0)} items
            </span>
          </div>
        </div>

        {/* Rendered Content */}
        <div className="p-6 bg-gray-100 overflow-auto max-h-[800px]">
          <div className="bg-white shadow-xl mx-auto" style={{ maxWidth: '210mm' }}>
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </div>

      {/* Zoom Controls (Optional Enhancement) */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md border border-gray-200 p-2 flex gap-2">
        <button
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Zoom out"
          onClick={() => {
            // Future enhancement: implement zoom
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>
        <button
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Zoom in"
          onClick={() => {
            // Future enhancement: implement zoom
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
