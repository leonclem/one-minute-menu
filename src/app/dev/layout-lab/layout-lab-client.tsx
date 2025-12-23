'use client'

/**
 * Layout Lab Client Component
 * 
 * Main client-side component that orchestrates the layout lab interface.
 * Manages state for fixture selection, template selection, and rendering options.
 */

import { useState, useCallback } from 'react'
import { LayoutLabControls } from './layout-lab-controls'
import { LayoutLabPreview } from './layout-lab-preview'
import type { LayoutDocumentV2 } from '@/lib/templates/v2/engine-types-v2'
import type { EngineVersion } from '@/lib/templates/engine-selector'

export interface LayoutLabState {
  // Selection
  fixtureId: string
  templateId: string
  engineVersion: EngineVersion
  
  // Options
  showGridOverlay: boolean
  showRegionBounds: boolean
  showTileIds: boolean
  fillersEnabled: boolean
  
  // Data
  layoutDocument: LayoutDocumentV2 | null
  isGenerating: boolean
  error: string | null
}

const initialState: LayoutLabState = {
  fixtureId: 'tiny',
  templateId: 'classic-cards-v2',
  engineVersion: 'v2',
  showGridOverlay: false,
  showRegionBounds: false,
  showTileIds: false,
  fillersEnabled: false,
  layoutDocument: null,
  isGenerating: false,
  error: null
}

export function LayoutLabClient() {
  const [state, setState] = useState<LayoutLabState>(initialState)
  
  const updateState = useCallback((updates: Partial<LayoutLabState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])
  
  const generateLayout = useCallback(async () => {
    updateState({ isGenerating: true, error: null })
    
    try {
      const response = await fetch('/api/dev/layout-lab/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fixtureId: state.fixtureId,
          templateId: state.templateId,
          engineVersion: state.engineVersion,
          options: {
            fillersEnabled: state.fillersEnabled,
            showRegionBounds: state.showRegionBounds
          }
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate layout')
      }
      
      const layoutDocument = await response.json()
      updateState({ layoutDocument, isGenerating: false })
    } catch (error) {
      updateState({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        isGenerating: false 
      })
    }
  }, [state.fixtureId, state.templateId, state.engineVersion, state.fillersEnabled, updateState])
  
  const exportPdf = useCallback(async () => {
    if (!state.layoutDocument) return
    
    try {
      const response = await fetch('/api/dev/layout-lab/export-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fixtureId: state.fixtureId,
          templateId: state.templateId,
          engineVersion: state.engineVersion,
          options: {
            fillersEnabled: state.fillersEnabled,
            showRegionBounds: state.showRegionBounds
          }
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to export PDF')
      }
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `layout-${state.fixtureId}-${state.templateId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      updateState({ 
        error: error instanceof Error ? error.message : 'Failed to export PDF'
      })
    }
  }, [state.layoutDocument, state.fixtureId, state.templateId, state.engineVersion, state.fillersEnabled, updateState])
  
  const downloadJson = useCallback(() => {
    if (!state.layoutDocument) return
    
    const dataStr = JSON.stringify(state.layoutDocument, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `layout-${state.fixtureId}-${state.templateId}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [state.layoutDocument, state.fixtureId, state.templateId])
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Controls Panel */}
      <div className="lg:col-span-1">
        <LayoutLabControls
          state={state}
          onStateChange={updateState}
          onGenerate={generateLayout}
          onExportPdf={exportPdf}
          onDownloadJson={downloadJson}
        />
      </div>
      
      {/* Preview Panel */}
      <div className="lg:col-span-3">
        <LayoutLabPreview
          layoutDocument={state.layoutDocument}
          isGenerating={state.isGenerating}
          error={state.error}
          showGridOverlay={state.showGridOverlay}
          showRegionBounds={state.showRegionBounds}
          showTileIds={state.showTileIds}
        />
      </div>
    </div>
  )
}