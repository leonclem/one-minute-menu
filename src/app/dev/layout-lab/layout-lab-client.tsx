'use client'

/**
 * Layout Lab Client Component
 * 
 * Main client-side component that orchestrates the layout lab interface.
 * Manages state for fixture selection, template selection, and rendering options.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { LayoutLabControls } from './layout-lab-controls'
import { LayoutLabPreview } from './layout-lab-preview'
import type { LayoutDocumentV2, ImageModeV2 } from '@/lib/templates/v2/engine-types-v2'
import type { EngineVersion } from '@/lib/templates/engine-selector'

export interface LayoutLabState {
  // Selection
  fixtureId: string
  templateId: string
  paletteId: string
  engineVersion: EngineVersion
  
  // Options
  showGridOverlay: boolean
  showRegionBounds: boolean
  showTileIds: boolean
  fillersEnabled: boolean
  textOnly: boolean
  texturesEnabled: boolean
  showMenuTitle: boolean
  imageMode: ImageModeV2
  
  // Data
  layoutDocument: LayoutDocumentV2 | null
  isGenerating: boolean
  isAutoGenerating: boolean
  error: string | null
}

const initialState: LayoutLabState = {
  fixtureId: 'tiny',
  templateId: 'classic-cards-v2',
  paletteId: 'midnight-gold',
  engineVersion: 'v2',
  showGridOverlay: false,
  showRegionBounds: false,
  showTileIds: false,
  fillersEnabled: false,
  textOnly: false,
  texturesEnabled: true, // Enable textures by default to showcase the feature
  showMenuTitle: false, // Hide menu title by default
  imageMode: 'stretch',
  layoutDocument: null,
  isGenerating: false,
  isAutoGenerating: false,
  error: null
}

export function LayoutLabClient() {
  const [state, setState] = useState<LayoutLabState>(initialState)
  const isInitialMount = useRef(true)
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)
  
  const updateState = useCallback((updates: Partial<LayoutLabState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])
  
  const generateLayoutWithCurrentState = useCallback(async (isAuto = false, currentState = state) => {
    setState(prev => ({ ...prev, isGenerating: true, isAutoGenerating: isAuto, error: null }))
    
    try {
      const response = await fetch('/api/dev/layout-lab/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fixtureId: currentState.fixtureId,
          templateId: currentState.templateId,
          paletteId: currentState.paletteId,
          engineVersion: currentState.engineVersion,
          options: {
            fillersEnabled: currentState.fillersEnabled,
            textOnly: currentState.textOnly,
            texturesEnabled: currentState.texturesEnabled,
            showRegionBounds: currentState.showRegionBounds,
            showMenuTitle: currentState.showMenuTitle,
            imageMode: currentState.imageMode
          }
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate layout')
      }
      
      const layoutDocument = await response.json()
      setState(prev => ({ ...prev, layoutDocument, isGenerating: false, isAutoGenerating: false }))
    } catch (error) {
      setState(prev => ({ 
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isGenerating: false,
        isAutoGenerating: false
      }))
    }
  }, []) // No dependencies - we pass state as parameter
  
  // Manual generation function
  const generateLayoutManual = useCallback(() => {
    generateLayoutWithCurrentState(false, state)
  }, [generateLayoutWithCurrentState, state])
  
  // Auto-generate layout when key controls change
  useEffect(() => {
    // Don't auto-generate if already generating
    if (state.isGenerating) return
    
    // Handle initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      generateLayoutWithCurrentState(true, state)
      return
    }
    
    // Clear existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }
    
    // Create a debounced version to avoid excessive API calls
    debounceTimeout.current = setTimeout(() => {
      generateLayoutWithCurrentState(true, state)
    }, 500) // 500ms debounce
    
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [
    // Only trigger on changes that affect layout generation, not display options
    state.fixtureId, 
    state.templateId, 
    state.engineVersion, 
    state.fillersEnabled, 
    state.textOnly, 
    state.texturesEnabled,
    state.paletteId,
    state.showMenuTitle
    // Removed state.isGenerating from dependencies to prevent loops
  ])
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [])
  
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
          paletteId: state.paletteId,
          engineVersion: state.engineVersion,
          options: {
            fillersEnabled: state.fillersEnabled,
            texturesEnabled: state.texturesEnabled,
            textOnly: state.textOnly,
            showRegionBounds: state.showRegionBounds,
            showMenuTitle: state.showMenuTitle
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
  }, [state.layoutDocument, state.fixtureId, state.templateId, state.engineVersion, state.fillersEnabled, state.textOnly, updateState])
  
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
          onGenerate={generateLayoutManual}
          onExportPdf={exportPdf}
          onDownloadJson={downloadJson}
        />
      </div>
      
      {/* Preview Panel */}
      <div className="lg:col-span-3">
        <LayoutLabPreview
          layoutDocument={state.layoutDocument}
          isGenerating={state.isGenerating}
          isAutoGenerating={state.isAutoGenerating}
          error={state.error}
          paletteId={state.paletteId}
          showGridOverlay={state.showGridOverlay}
          showRegionBounds={state.showRegionBounds}
          showTileIds={state.showTileIds}
          texturesEnabled={state.texturesEnabled}
          imageMode={state.imageMode}
        />
      </div>
    </div>
  )
}