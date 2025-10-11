'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, Button } from '@/components/ui'

interface TemplateMetadata {
  id: string
  name: string
  preview: string
  description?: string
}

interface TemplateSelectorProps {
  selectedTemplateId: string
  onTemplateSelect: (templateId: string) => void
  brandColors?: string[]
}

export function TemplateSelector({
  selectedTemplateId,
  onTemplateSelect,
  brandColors
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)

  // Load available templates on mount
  useEffect(() => {
    async function loadTemplates() {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch templates from API instead of using registry directly
        const response = await fetch('/api/templates')
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load templates')
        }
        
        setTemplates(data.data.templates)
      } catch (err) {
        console.error('Failed to load templates:', err)
        setError('Failed to load templates. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadTemplates()
  }, [])

  // Handle template selection
  const handleSelectTemplate = async (templateId: string) => {
    if (templateId === selectedTemplateId) {
      return // Already selected
    }

    try {
      setApplying(templateId)
      setError(null)
      await onTemplateSelect(templateId)
    } catch (err) {
      console.error('Failed to apply template:', err)
      setError('Failed to apply template. Please try again.')
    } finally {
      setApplying(null)
    }
  }

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading templates...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error && templates.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error message (non-blocking) */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => {
          const isSelected = template.id === selectedTemplateId
          const isApplying = applying === template.id

          return (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? 'ring-2 ring-primary-500 shadow-lg'
                  : 'hover:shadow-md'
              }`}
              onClick={() => !isApplying && handleSelectTemplate(template.id)}
            >
              <CardContent className="p-4">
                {/* Preview image */}
                <div className="relative mb-3 bg-gray-100 rounded-lg overflow-hidden aspect-[3/4]">
                  {template.preview ? (
                    <img
                      src={template.preview}
                      alt={`${template.name} template preview`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    /* Placeholder for preview image */
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg
                        className="w-16 h-16 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                  )}
                  
                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-primary-600 text-white rounded-full p-1">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Template info */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900">
                    {template.name}
                  </h3>
                  {template.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                </div>

                {/* Loading state for this template */}
                {isApplying && (
                  <div className="mt-3 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600 mr-2"></div>
                    <span className="text-sm text-gray-600">Applying...</span>
                  </div>
                )}

                {/* Selected badge */}
                {isSelected && !isApplying && (
                  <div className="mt-3 text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
                      Currently Selected
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Brand colors info */}
      {brandColors && brandColors.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-blue-800">
                Your brand colors will be used to inform the template styling and background generation.
              </p>
              <div className="flex gap-2 mt-2">
                {brandColors.slice(0, 5).map((color, index) => (
                  <div
                    key={index}
                    className="w-8 h-8 rounded border border-gray-300 shadow-sm"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
