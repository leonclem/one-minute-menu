'use client'

import { useState, useEffect } from 'react'
import type { TemplateMetadata, TemplateFilters } from '@/types/templates'
import { TemplateCard } from './TemplateCard'
import { Input } from '@/components/ui/Input'

export interface TemplateSelectorProps {
  menuId: string
  onTemplateSelect: (templateId: string) => void
  currentTemplateId?: string
}

export function TemplateSelector({
  menuId,
  onTemplateSelect,
  currentTemplateId,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedFormat, setSelectedFormat] = useState<string | undefined>()

  // Load templates
  useEffect(() => {
    async function loadTemplates() {
      try {
        setLoading(true)
        setError(null)

        const filters: TemplateFilters = {
          searchQuery: searchQuery || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          pageFormat: selectedFormat as any,
        }

        const params = new URLSearchParams()
        if (filters.searchQuery) params.append('search', filters.searchQuery)
        if (filters.tags) filters.tags.forEach(tag => params.append('tags', tag))
        if (filters.pageFormat) params.append('format', filters.pageFormat)

        const response = await fetch(`/api/templates?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to load templates')
        }

        const data = await response.json()
        setTemplates(data.templates || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates')
      } finally {
        setLoading(false)
      }
    }

    loadTemplates()
  }, [searchQuery, selectedTags, selectedFormat])

  // Extract unique tags from templates
  const allTags = Array.from(
    new Set(templates.flatMap(t => t.tags))
  ).sort()

  const formats = ['A4', 'US_LETTER', 'TABLOID', 'DIGITAL']

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading templates...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        <Input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />

        {/* Format Filter */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-gray-700">Format:</span>
          <button
            onClick={() => setSelectedFormat(undefined)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              !selectedFormat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {formats.map(format => (
            <button
              key={format}
              onClick={() => setSelectedFormat(format)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedFormat === format
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {format.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700">Tags:</span>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => {
                  setSelectedTags(prev =>
                    prev.includes(tag)
                      ? prev.filter(t => t !== tag)
                      : [...prev, tag]
                  )
                }}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Template Grid */}
      {templates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No templates found matching your criteria
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={template.id === currentTemplateId}
              onClick={() => onTemplateSelect(template.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
