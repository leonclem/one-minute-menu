'use client'

/**
 * Layout Lab Controls Component
 * 
 * Provides the control panel for selecting fixtures, templates, and rendering options.
 */

import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import type { LayoutLabState } from './layout-lab-client'

interface LayoutLabControlsProps {
  state: LayoutLabState
  onStateChange: (updates: Partial<LayoutLabState>) => void
  onGenerate: () => void
  onExportPdf: () => void
  onDownloadJson: () => void
}

const FIXTURES = [
  { id: 'tiny', name: 'Tiny (1-3 items)', description: 'Minimal data for basic testing' },
  { id: 'images', name: 'Images (placeholder)', description: 'Tests image layout and wrapping' },
  { id: 'medium', name: 'Medium (20-40 items)', description: 'Mixed sections with images' },
  { id: 'large', name: 'Large (100+ items)', description: 'Tests pagination behavior' },
  { id: 'nasty', name: 'Nasty (edge cases)', description: 'Long text, missing data, many indicators' }
]

const V1_TEMPLATES = [
  { id: 'classic-grid-cards', name: 'Classic Grid Cards', description: 'Photo-forward 4-column grid' },
  { id: 'two-column-text', name: 'Two-Column Text', description: 'Elegant text-focused 2-column layout' },
  { id: 'simple-rows', name: 'Simple Rows', description: 'Clean single-column layout' }
]

const V2_TEMPLATES = [
  { id: 'classic-cards-v2', name: 'Classic Cards V2', description: '4-column grid layout' }
]

const ENGINE_VERSIONS = [
  { id: 'v1' as const, name: 'V1 (Legacy)', description: 'Current production engine' },
  { id: 'v2' as const, name: 'V2 (New)', description: 'PDF-first streaming engine' }
]

export function LayoutLabControls({
  state,
  onStateChange,
  onGenerate,
  onExportPdf,
  onDownloadJson
}: LayoutLabControlsProps) {
  const templates = state.engineVersion === 'v1' ? V1_TEMPLATES : V2_TEMPLATES

  return (
    <div className="space-y-6">
      {/* Fixture Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Test Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {FIXTURES.map(fixture => (
            <label key={fixture.id} className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="fixture"
                value={fixture.id}
                checked={state.fixtureId === fixture.id}
                onChange={(e) => onStateChange({ fixtureId: e.target.value })}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-sm">{fixture.name}</div>
                <div className="text-xs text-gray-500">{fixture.description}</div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>
      
      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.map(template => (
            <label key={template.id} className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="template"
                value={template.id}
                checked={state.templateId === template.id}
                onChange={(e) => onStateChange({ templateId: e.target.value })}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-sm">{template.name}</div>
                <div className="text-xs text-gray-500">{template.description}</div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>
      
      {/* Engine Version */}
      <Card>
        <CardHeader>
          <CardTitle>Engine Version</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ENGINE_VERSIONS.map(version => (
            <label key={version.id} className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="engine"
                value={version.id}
                checked={state.engineVersion === version.id}
                onChange={(e) => {
                  const newVersion = e.target.value as any
                  const newTemplates = newVersion === 'v1' ? V1_TEMPLATES : V2_TEMPLATES
                  onStateChange({ 
                    engineVersion: newVersion,
                    templateId: newTemplates[0].id
                  })
                }}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-sm">{version.name}</div>
                <div className="text-xs text-gray-500">{version.description}</div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>
      
      {/* Display Options */}
      <Card>
        <CardHeader>
          <CardTitle>Display Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.showGridOverlay}
              onChange={(e) => onStateChange({ showGridOverlay: e.target.checked })}
            />
            <span className="text-sm">Grid/bounds overlay</span>
          </label>
          
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.showRegionBounds}
              onChange={(e) => onStateChange({ showRegionBounds: e.target.checked })}
            />
            <span className="text-sm">Region rectangles</span>
          </label>
          
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.showTileIds}
              onChange={(e) => onStateChange({ showTileIds: e.target.checked })}
            />
            <span className="text-sm">Tile IDs and coordinates</span>
          </label>
          
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.fillersEnabled}
              onChange={(e) => onStateChange({ fillersEnabled: e.target.checked })}
            />
            <span className="text-sm">Fillers on/off</span>
          </label>
        </CardContent>
      </Card>
      
      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={onGenerate}
            disabled={state.isGenerating}
            className="w-full"
          >
            {state.isGenerating ? 'Generating...' : 'Generate Layout'}
          </Button>
          
          <Button
            onClick={onExportPdf}
            disabled={!state.layoutDocument || state.isGenerating}
            variant="outline"
            className="w-full"
          >
            Export PDF
          </Button>
          
          <Button
            onClick={onDownloadJson}
            disabled={!state.layoutDocument || state.isGenerating}
            variant="outline"
            className="w-full"
          >
            Download Layout JSON
          </Button>
        </CardContent>
      </Card>
      
      {/* Error Display */}
      {state.error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600">{state.error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}