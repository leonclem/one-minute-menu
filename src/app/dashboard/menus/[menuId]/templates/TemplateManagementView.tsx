'use client'

import { useState, useCallback } from 'react'
import type { Menu } from '@/types'
import type { TemplateMetadata, UserTemplatePreference, UserCustomization } from '@/types/templates'
import { TemplateSelector } from '@/components/templates/TemplateSelector'
import { TemplatePreview } from '@/components/templates/TemplatePreview'
import { TemplateCustomizer } from '@/components/templates/TemplateCustomizer'
import { ExportDialog } from '@/components/templates/ExportDialog'

interface TemplateManagementViewProps {
  menu: Menu
  templates: TemplateMetadata[]
  userPreference: UserTemplatePreference | null
}

export default function TemplateManagementView({
  menu,
  templates,
  userPreference,
}: TemplateManagementViewProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    userPreference?.templateId || templates[0]?.id || ''
  )
  const [customization, setCustomization] = useState<UserCustomization>(
    userPreference?.customization || {}
  )
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleTemplateSelect = useCallback(async (templateId: string) => {
    setSelectedTemplateId(templateId)
    
    // Save preference
    setIsSaving(true)
    try {
      await fetch('/api/templates/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuId: menu.id,
          templateId,
          customization,
        }),
      })
    } catch (error) {
      console.error('Failed to save template preference:', error)
    } finally {
      setIsSaving(false)
    }
  }, [menu.id, customization])

  const handleCustomizationChange = useCallback(async (newCustomization: UserCustomization) => {
    setCustomization(newCustomization)
    
    // Save preference
    setIsSaving(true)
    try {
      await fetch('/api/templates/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuId: menu.id,
          templateId: selectedTemplateId,
          customization: newCustomization,
        }),
      })
    } catch (error) {
      console.error('Failed to save customization:', error)
    } finally {
      setIsSaving(false)
    }
  }, [menu.id, selectedTemplateId])

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Menu Templates</h1>
              <p className="mt-1 text-sm text-gray-500">
                Choose a template and customize it for {menu.name}
              </p>
            </div>
            <button
              onClick={() => setIsExportDialogOpen(true)}
              disabled={!selectedTemplateId}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export Menu
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Template Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Select Template
              </h2>
              <TemplateSelector
                menuId={menu.id}
                currentTemplateId={selectedTemplateId}
                onTemplateSelect={handleTemplateSelect}
              />
            </div>

            {/* Customization Panel */}
            {selectedTemplate && (
              <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Customize
                </h2>
                <TemplateCustomizer
                  templateId={selectedTemplateId}
                  currentCustomization={customization}
                  onChange={handleCustomizationChange}
                />
                {isSaving && (
                  <p className="mt-2 text-xs text-gray-500">Saving...</p>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Preview
              </h2>
              {selectedTemplateId ? (
                <TemplatePreview
                  templateId={selectedTemplateId}
                  menuId={menu.id}
                  customization={customization}
                />
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-400">
                  Select a template to preview
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Export Dialog */}
      {isExportDialogOpen && selectedTemplateId && (
        <ExportDialog
          isOpen={isExportDialogOpen}
          menuId={menu.id}
          templateId={selectedTemplateId}
          menuData={{ categories: (menu.categories || []) as any }}
          onClose={() => setIsExportDialogOpen(false)}
        />
      )}
    </div>
  )
}
