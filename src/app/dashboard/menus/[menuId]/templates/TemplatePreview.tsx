'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Card, CardHeader, CardTitle, CardContent, useToast } from '@/components/ui'
import { LAYOUT_PRESETS } from '@/lib/templates/presets'
import MenuTile from '@/components/templates/MenuTile'
import FillerTile from '@/components/templates/FillerTile'
import { isItemTile, isFillerTile } from '@/lib/templates/types'
import type { Menu } from '@/types'
import type { OutputContext, GridLayout } from '@/lib/templates/types'

interface TemplatePreviewProps {
  menu: Menu
}

type ExportFormat = 'html' | 'pdf' | 'png' | 'jpg'

interface ExportState {
  format: ExportFormat | null
  loading: boolean
  error: string | null
}

export default function TemplatePreview({ menu }: TemplatePreviewProps) {
  const router = useRouter()
  const { showToast } = useToast()
  
  // Layout state
  const [gridLayout, setGridLayout] = useState<GridLayout | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('balanced')
  const [selectedContext, setSelectedContext] = useState<OutputContext>('desktop')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Export state
  const [exportState, setExportState] = useState<ExportState>({
    format: null,
    loading: false,
    error: null
  })

  // Available presets for selection
  const availablePresets = Object.values(LAYOUT_PRESETS).filter(p => p.id !== 'text-only')

  // Fetch layout data on mount
  useEffect(() => {
    async function fetchLayout() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/templates/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            menuId: menu.id,
            context: selectedContext,
            presetId: selectedPresetId
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to generate layout')
        }

        const result = await response.json()
        
        // Extract grid layout from the response
        const layout: GridLayout = result.data.layout
        setGridLayout(layout)

        // If we got a different preset, update selection
        if (layout.preset.id !== selectedPresetId) {
          setSelectedPresetId(layout.preset.id)
        }

      } catch (err) {
        console.error('Error fetching layout:', err)
        setError(err instanceof Error ? err.message : 'Failed to load template preview')
        showToast({
          type: 'error',
          title: 'Preview failed',
          description: 'Could not load template preview'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchLayout()
  }, [menu.id, selectedContext, selectedPresetId, showToast])

  // Handle preset change
  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId)
  }

  // Handle context change
  const handleContextChange = (context: OutputContext) => {
    setSelectedContext(context)
  }

  // Handle export
  const handleExport = async (format: ExportFormat) => {
    try {
      setExportState({ format, loading: true, error: null })

      // Determine endpoint and request body based on format
      let endpoint: string
      let requestBody: any

      if (format === 'html') {
        endpoint = '/api/templates/export/html'
        requestBody = {
          menuId: menu.id,
          context: selectedContext,
          presetId: selectedPresetId,
          options: {
            includeDoctype: true,
            includeMetaTags: true,
            includeStyles: true,
            pageTitle: menu.name
          }
        }
      } else if (format === 'pdf') {
        endpoint = '/api/templates/export/pdf'
        requestBody = {
          menuId: menu.id,
          presetId: selectedPresetId,
          options: {
            orientation: 'portrait',
            title: menu.name,
            includePageNumbers: true
          }
        }
      } else {
        // PNG or JPG
        endpoint = '/api/templates/export/image'
        requestBody = {
          menuId: menu.id,
          context: selectedContext,
          presetId: selectedPresetId,
          options: {
            format: format,
            width: 1200,
            height: 1600,
            quality: format === 'jpg' ? 90 : undefined
          }
        }
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to export ${format.toUpperCase()}`)
      }

      // Get the blob
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${menu.name}-menu.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      showToast({
        type: 'success',
        title: 'Export successful',
        description: `Menu exported as ${format.toUpperCase()}`
      })

      setExportState({ format: null, loading: false, error: null })

    } catch (err) {
      console.error('Export error:', err)
      const errorMessage = err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()}`
      
      setExportState({ format, loading: false, error: errorMessage })
      
      showToast({
        type: 'error',
        title: 'Export failed',
        description: errorMessage
      })
    }
  }

  // Get estimated export time
  const getEstimatedTime = (format: ExportFormat): string => {
    switch (format) {
      case 'html':
        return 'Instant'
      case 'pdf':
        return '~5 seconds'
      case 'png':
      case 'jpg':
        return '~4 seconds'
      default:
        return ''
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href={`/dashboard/menus/${menu.id}`}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Menu
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                Template Preview
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Preset Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Layout Preset</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {availablePresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetChange(preset.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                        selectedPresetId === preset.id
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className="font-medium">{preset.name}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {preset.family}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Output Context */}
            <Card>
              <CardHeader>
                <CardTitle>Output Context</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(['mobile', 'tablet', 'desktop', 'print'] as OutputContext[]).map((context) => (
                    <button
                      key={context}
                      onClick={() => handleContextChange(context)}
                      className={`w-full text-left px-4 py-2 rounded-lg border-2 transition-colors capitalize ${
                        selectedContext === context
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {context}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Export Options */}
            <Card>
              <CardHeader>
                <CardTitle>Export</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(['html', 'pdf', 'png', 'jpg'] as ExportFormat[]).map((format) => (
                    <div key={format}>
                      <Button
                        onClick={() => handleExport(format)}
                        disabled={exportState.loading || loading || !gridLayout}
                        className="w-full"
                        variant={exportState.format === format && exportState.loading ? 'primary' : 'outline'}
                      >
                        {exportState.format === format && exportState.loading ? (
                          <>
                            <span className="inline-block animate-spin mr-2">⏳</span>
                            Exporting...
                          </>
                        ) : (
                          <>Export as {format.toUpperCase()}</>
                        )}
                      </Button>
                      <div className="text-xs text-gray-500 mt-1 text-center">
                        {getEstimatedTime(format)}
                      </div>
                    </div>
                  ))}
                </div>
                
                {exportState.error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{exportState.error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview Area */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="inline-block animate-spin text-4xl mb-4">⏳</div>
                      <p className="text-gray-600">Loading preview...</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="text-lg font-semibold text-red-900 mb-2">
                      Preview Error
                    </h3>
                    <p className="text-red-800">{error}</p>
                    <Button
                      onClick={() => router.refresh()}
                      className="mt-4"
                      variant="outline"
                    >
                      Retry
                    </Button>
                  </div>
                )}

                {!loading && !error && gridLayout && (
                  <div className="bg-white rounded-lg overflow-auto" style={{ maxHeight: '80vh' }}>
                    <GridLayoutPreview
                      layout={gridLayout}
                      menuTitle={menu.name}
                    />
                  </div>
                )}

                {!loading && !error && !gridLayout && (
                  <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800">
                      No menu data available. Please ensure your menu has been extracted.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}


// Helper component to render a GridLayout directly
interface GridLayoutPreviewProps {
  layout: GridLayout
  menuTitle: string
}

function GridLayoutPreview({ layout, menuTitle }: GridLayoutPreviewProps) {
  const preset = layout.preset
  const columns = preset.gridConfig.columns[layout.context]
  const gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`

  // Extract currency from first item with a price
  let currency = '$'
  for (const section of layout.sections) {
    for (const tile of section.tiles) {
      if (isItemTile(tile) && tile.item.price) {
        // Currency is already in the layout data
        currency = '$' // Default, could be extracted from menu metadata
        break
      }
    }
    if (currency !== '$') break
  }

  return (
    <main className="menu-layout" aria-label={`${menuTitle} menu`}>
      {/* Menu Title */}
      <header className="menu-header mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {menuTitle}
        </h1>
      </header>

      {/* Sections */}
      {layout.sections.map((section, sectionIndex) => (
        <section
          key={`section-${sectionIndex}`}
          id={`section-${sectionIndex}`}
          className={`menu-section ${preset.gridConfig.sectionSpacing}`}
          aria-labelledby={`section-heading-${sectionIndex}`}
        >
          {/* Section Header */}
          <h2
            id={`section-heading-${sectionIndex}`}
            className="text-2xl font-semibold text-gray-800 mb-4"
          >
            {section.name}
          </h2>

          {/* Grid Container */}
          <ul
            className={`grid ${preset.gridConfig.gap}`}
            style={{
              gridTemplateColumns
            }}
            role="list"
            aria-label={`${section.name} items`}
          >
            {/* Render Tiles */}
            {section.tiles.map((tile, tileIndex) => {
              const key = `tile-${sectionIndex}-${tileIndex}`

              if (isItemTile(tile)) {
                return (
                  <li key={key} role="listitem">
                    <MenuTile
                      item={tile.item}
                      preset={preset}
                      context={layout.context}
                      currency={currency}
                    />
                  </li>
                )
              }

              if (isFillerTile(tile)) {
                return (
                  <li key={key} role="presentation" aria-hidden="true">
                    <FillerTile
                      style={tile.style}
                      content={tile.content}
                      preset={preset}
                    />
                  </li>
                )
              }

              return null
            })}
          </ul>
        </section>
      ))}
    </main>
  )
}
