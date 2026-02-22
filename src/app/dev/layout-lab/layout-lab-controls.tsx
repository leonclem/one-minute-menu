'use client'

/**
 * Layout Lab Controls Component
 * 
 * Provides the control panel for selecting fixtures, templates, and rendering options.
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import type { LayoutLabState } from './layout-lab-client'
import type { Menu } from '@/types'
import { PALETTES_V2, TEXTURE_IDS, TEXTURE_REGISTRY, FILLER_PATTERN_IDS, FILLER_PATTERN_REGISTRY } from '@/lib/templates/v2/renderer-v2'
import { V2_TEMPLATE_OPTIONS, V2_TEMPLATE_OPTIONS_EXTRA } from '@/lib/templates/v2/template-options'
import { PaletteDropdown, TemplateDropdown, ImageModeDropdown } from '@/components/ux'

interface LayoutLabControlsProps {
  state: LayoutLabState
  onStateChange: (updates: Partial<LayoutLabState>) => void
  onGenerate: () => void
  onExportPdf: () => void
  onDownloadJson: () => void
}

const FIXTURES = [
  { id: 'tiny', name: 'Tiny (1-3 items)', description: 'Minimal data for basic testing' },
  { id: 'medium', name: 'Medium (20-40 items)', description: 'Mixed sections with images' },
  { id: 'large', name: 'Large (100+ items)', description: 'Tests pagination behavior' },
  { id: 'nasty', name: 'Nasty (edge cases)', description: 'Long text, missing data, many indicators' }
]

const V1_TEMPLATES = [
  { id: 'classic-grid-cards', name: 'Classic Grid Cards', description: 'Photo-forward 4-column grid' },
  { id: 'two-column-text', name: 'Two-Column Text', description: 'Elegant text-focused 2-column layout' },
  { id: 'simple-rows', name: 'Simple Rows', description: 'Clean single-column layout' }
]

const V2_TEMPLATES = [...V2_TEMPLATE_OPTIONS, ...V2_TEMPLATE_OPTIONS_EXTRA]

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
  const [userMenus, setUserMenus] = useState<Menu[]>([])
  const [loadingMenus, setLoadingMenus] = useState(false)
  const templates = state.engineVersion === 'v1' ? V1_TEMPLATES : V2_TEMPLATES

  // Load user menus on component mount
  useEffect(() => {
    const loadUserMenus = async () => {
      setLoadingMenus(true)
      try {
        const response = await fetch('/api/menus')
        if (response.ok) {
          const result = await response.json()
          setUserMenus(result.data || [])
        }
      } catch (error) {
        console.error('Failed to load user menus:', error)
      } finally {
        setLoadingMenus(false)
      }
    }
    
    loadUserMenus()
  }, [])

  return (
    <div className="space-y-6">
      {/* Fixture Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Test Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fixture Data Options */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Fixture Data</h4>
            {FIXTURES.map(fixture => (
              <label key={fixture.id} className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="dataSource"
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
          </div>
          
          {/* Real Menu Options */}
          {userMenus.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700">Real Menus</h4>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Select Menu
                </label>
                <select
                  value={state.fixtureId.startsWith('menu-') ? state.fixtureId : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      onStateChange({ fixtureId: e.target.value })
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loadingMenus}
                >
                  <option value="">Choose a real menu...</option>
                  {userMenus.map(menu => (
                    <option key={menu.id} value={`menu-${menu.id}`}>
                      {menu.name} ({menu.items.length} items)
                    </option>
                  ))}
                </select>
                {loadingMenus && (
                  <p className="text-xs text-gray-500">Loading menus...</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* 1. Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle>1. Grid Layout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <TemplateDropdown
            templates={templates.map(t => ({ id: t.id, name: t.name, description: t.description }))}
            value={state.templateId}
            onChange={(newTemplateId) => {
              const updates: Partial<LayoutLabState> = { templateId: newTemplateId }
              if (newTemplateId === 'italian-v2') {
                updates.imageMode = 'stretch'
              }
              if (newTemplateId === 'valentines-v2') {
                updates.paletteId = 'valentines-rose'
              } else if (newTemplateId === 'lunar-new-year-v2') {
                updates.paletteId = 'lunar-red-gold'
                updates.texturesEnabled = true
              }
              onStateChange(updates)
            }}
            variant="neutral"
          />
        </CardContent>
      </Card>

      {/* 2. Color Palette Selection */}
      <Card>
        <CardHeader>
          <CardTitle>2. Color Palette</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PaletteDropdown
            palettes={PALETTES_V2}
            value={state.paletteId}
            onChange={(paletteId) => onStateChange({ paletteId })}
            variant="neutral"
          />
        </CardContent>
      </Card>

      {/* 3. Background texture (overlay on palette) */}
      <Card>
        <CardHeader>
          <CardTitle>3. Background texture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={state.textureId ?? ''}
            onChange={(e) => onStateChange({ textureId: e.target.value || null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">None</option>
            {TEXTURE_IDS.map((id) => (
              <option key={id} value={id}>
                {TEXTURE_REGISTRY.get(id)?.label ?? id}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">Overlays a pattern on the chosen palette.</p>
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

      {/* 4. Image Options */}
      <Card>
        <CardHeader>
          <CardTitle>4. Image Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ImageModeDropdown
            value={state.imageMode}
            onChange={(imageMode) => onStateChange({ imageMode })}
            variant="neutral"
          />
        </CardContent>
      </Card>

      {/* 5. Spacer Tiles */}
      <Card>
        <CardHeader>
          <CardTitle>5. Spacer Tiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={state.spacerTiles}
            onChange={(e) => onStateChange({ spacerTiles: e.target.value as 'template' | 'none' | string })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="template">Template default</option>
            <option value="none">None</option>
            <option value="mix">Mix</option>
            {FILLER_PATTERN_IDS.map((id) => (
              <option key={id} value={id}>
                {FILLER_PATTERN_REGISTRY.get(id)?.label ?? id}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            Decorative tiles in empty grid cells. Template default uses the layout&apos;s filler style; choose a pattern to override.
          </p>
        </CardContent>
      </Card>

      {/* 6. Display Options */}
      <Card>
        <CardHeader>
          <CardTitle>6. Display Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.showMenuTitle}
              onChange={(e) => onStateChange({ showMenuTitle: e.target.checked })}
            />
            <span className="text-sm">Show menu title</span>
          </label>
          <p className="text-xs text-gray-500 ml-6">
            Display the menu name in the title region. When disabled, space is redistributed to menu items.
          </p>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.showVignette}
              onChange={(e) => onStateChange({ showVignette: e.target.checked })}
            />
            <span className="text-sm">Vignette edges</span>
          </label>
          <p className="text-xs text-gray-500 ml-6">
            Adds a subtle darkened edge effect to page borders for a premium feel.
          </p>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.fillItemTiles}
              onChange={(e) => onStateChange({ fillItemTiles: e.target.checked })}
            />
            <span className="text-sm">Fill item tiles</span>
          </label>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.itemBorders}
              onChange={(e) => onStateChange({ itemBorders: e.target.checked })}
            />
            <span className="text-sm">Item borders</span>
          </label>
          <p className="text-xs text-gray-500 ml-6">
            Adds a very subtle border to every menu item tile.
          </p>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.itemDropShadow}
              onChange={(e) => onStateChange({ itemDropShadow: e.target.checked })}
            />
            <span className="text-sm">Item drop shadow</span>
          </label>
          <p className="text-xs text-gray-500 ml-6">
            Adds a subtle drop shadow to every menu item tile.
          </p>

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
            variant="outline"
            className="w-full"
          >
            {state.isGenerating ? 'Generating...' : 'Regenerate Now'}
          </Button>
          <p className="text-xs text-gray-500 text-center">
            Layout updates automatically when controls change
          </p>
          
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