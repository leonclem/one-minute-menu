'use client'

/**
 * Layout Lab Preview Component
 * 
 * Displays the generated layout with optional overlays and page navigation.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import type { LayoutDocumentV2, PageLayoutV2, PageSpecV2 } from '@/lib/templates/v2/engine-types-v2'
import { LayoutRenderer } from '@/lib/templates/export/layout-renderer'
import { TEMPLATE_REGISTRY } from '@/lib/templates/template-definitions'
import type { LayoutInstance } from '@/lib/templates/engine-types'
import { PageRenderer } from '@/lib/templates/v2/renderer-web-v2'
import { PALETTES_V2 } from '@/lib/templates/v2/renderer-v2'

interface LayoutLabPreviewProps {
  layoutDocument: (LayoutDocumentV2 | LayoutInstance) | null
  isGenerating: boolean
  error: string | null
  paletteId: string
  showGridOverlay: boolean
  showRegionBounds: boolean
  showTileIds: boolean
}

export function LayoutLabPreview({
  layoutDocument,
  isGenerating,
  error,
  paletteId,
  showGridOverlay,
  showRegionBounds,
  showTileIds
}: LayoutLabPreviewProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [zoom, setZoom] = useState(0.9) // Default to 90%
  const [layoutInfoCollapsed, setLayoutInfoCollapsed] = useState(true) // Default collapsed
  
  const palette = PALETTES_V2.find(p => p.id === paletteId) || PALETTES_V2[0]
  
  if (isGenerating) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Generating layout...</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-red-600 mb-4">⚠️</div>
            <p className="text-red-600 font-medium">Generation Failed</p>
            <p className="text-sm text-gray-600 mt-2">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  if (!layoutDocument) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-gray-400 mb-4">📄</div>
            <p className="text-gray-600">Select options and click "Generate Layout" to preview</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Distinguish between V1 and V2
  const isV2 = 'pageSpec' in layoutDocument
  const totalPages = layoutDocument.pages.length
  
  if (!isV2) {
    // V1 Preview
    const v1Layout = layoutDocument as LayoutInstance
    const template = TEMPLATE_REGISTRY[v1Layout.templateId]
    
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader 
            className="cursor-pointer select-none"
            onClick={() => setLayoutInfoCollapsed(!layoutInfoCollapsed)}
          >
            <CardTitle className="flex items-center justify-between">
              V1 Layout Information
              <span className="text-sm text-gray-500">
                {layoutInfoCollapsed ? '▶' : '▼'}
              </span>
            </CardTitle>
          </CardHeader>
          {!layoutInfoCollapsed && (
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Template:</span> {v1Layout.templateId}
                </div>
                <div>
                  <span className="font-medium">Version:</span> {v1Layout.templateVersion}
                </div>
                <div>
                  <span className="font-medium">Orientation:</span> {v1Layout.orientation}
                </div>
                <div>
                  <span className="font-medium">Total Pages:</span> {totalPages}
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>V1 Preview</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto bg-gray-100 flex justify-center" style={{ height: '800px', width: '100%' }}>
            <div className="shadow-2xl scale-90 origin-top mt-5">
              <LayoutRenderer 
                layout={v1Layout}
                template={template}
                fixedPageSize={true}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // V2 Preview
  const v2Layout = layoutDocument as LayoutDocumentV2
  const currentPage = v2Layout.pages[currentPageIndex]
  
  return (
    <div className="space-y-4">
      {/* Layout Info */}
      <Card>
        <CardHeader 
          className="cursor-pointer select-none"
          onClick={() => setLayoutInfoCollapsed(!layoutInfoCollapsed)}
        >
          <CardTitle className="flex items-center justify-between">
            Layout Information
            <span className="text-sm text-gray-500">
              {layoutInfoCollapsed ? '▶' : '▼'}
            </span>
          </CardTitle>
        </CardHeader>
        {!layoutInfoCollapsed && (
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Template:</span> {v2Layout.templateId}
              </div>
              <div>
                <span className="font-medium">Version:</span> {v2Layout.templateVersion}
              </div>
              <div>
                <span className="font-medium">Page Size:</span> {v2Layout.pageSpec.width}×{v2Layout.pageSpec.height}pt
              </div>
              <div>
                <span className="font-medium">Total Pages:</span> {totalPages}
              </div>
              <div>
                <span className="font-medium">Current Page:</span> {currentPage.pageType}
              </div>
              <div>
                <span className="font-medium">Tiles on Page:</span> {currentPage.tiles.length}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
      
      {/* Page Preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle>Page Preview</CardTitle>
          {totalPages > 1 && (
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                disabled={currentPageIndex === 0}
                variant="outline"
                size="sm"
                className="h-8 px-3"
              >
                ← Prev
              </Button>
              
              <span className="text-xs font-medium text-gray-500 whitespace-nowrap min-w-[80px] text-center">
                Page {currentPageIndex + 1} / {totalPages}
                <span className="block text-[9px] uppercase opacity-60 font-bold">{currentPage.pageType}</span>
              </span>
              
              <Button
                onClick={() => setCurrentPageIndex(Math.min(totalPages - 1, currentPageIndex + 1))}
                disabled={currentPageIndex === totalPages - 1}
                variant="outline"
                size="sm"
                className="h-8 px-3"
              >
                Next →
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="relative bg-white border rounded-lg overflow-auto bg-gray-50 flex justify-center" style={{ height: '800px', width: '100%' }}>
            <div
              className="origin-top transition-transform duration-200"
              style={{
                width: v2Layout.pageSpec.width,
                height: v2Layout.pageSpec.height,
                transform: `scale(${zoom})`,
                marginTop: '20px',
              }}
            >
              <PageRenderer
                page={currentPage}
                pageSpec={v2Layout.pageSpec}
                options={{
                  scale: 1.0,
                  palette,
                  showGridOverlay,
                  showRegionBounds,
                  showTileIds,
                  isExport: false
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Page Preview Controls */}
      <Card>
        <CardContent className="flex items-center space-x-6 py-4">
          <div className="flex items-center space-x-2 flex-1">
            <span className="text-sm font-medium text-gray-700 min-w-[60px]">Zoom:</span>
            <input
              type="range"
              min="0.25"
              max="2.0"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.max(0.25, zoom - 0.1))}
            >
              -
            </Button>
            <span className="text-sm font-mono w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.min(2.0, zoom + 0.1))}
            >
              +
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(0.9)}
              className="text-xs"
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Debug Information */}
      {v2Layout.debug && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle>Debug Information</CardTitle>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const debugInfo = {
                    engineVersion: v2Layout.debug?.engineVersion,
                    generatedAt: v2Layout.debug?.generatedAt,
                    inputHash: v2Layout.debug?.inputHash,
                    placementLog: v2Layout.debug?.placementLog
                  }
                  navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
                }}
                className="text-xs"
              >
                Copy Debug Info
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(v2Layout, null, 2))
                }}
                className="text-xs"
              >
                Copy Full Config
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <div>
                <span className="font-medium">Engine Version:</span> {v2Layout.debug.engineVersion}
              </div>
              <div>
                <span className="font-medium">Generated At:</span> {v2Layout.debug.generatedAt}
              </div>
              <div>
                <span className="font-medium">Input Hash:</span> {v2Layout.debug.inputHash}
              </div>
              {v2Layout.debug.placementLog && (
                <details className="mt-4">
                  <summary className="font-medium cursor-pointer">Placement Log</summary>
                  <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(v2Layout.debug.placementLog, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
