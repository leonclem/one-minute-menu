'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { UXSection, UXButton, UXCard } from '@/components/ux'
import { MenuThumbnailBadge } from '@/components/ux/MenuThumbnailBadge'
import { useToast } from '@/components/ui'
import type { Menu } from '@/types'
import { PageRenderer } from '@/lib/templates/v2/renderer-web-v2'
import { PALETTES_V2 } from '@/lib/templates/v2/renderer-v2'
import type { LayoutDocumentV2 } from '@/lib/templates/v2/engine-types-v2'
import { trackConversionEvent } from '@/lib/conversion-tracking'

interface UXMenuTemplateClientProps {
  menuId: string
}

const V2_TEMPLATES = [
  { id: 'classic-cards-v2', name: 'Classic Cards', description: 'Photo-forward 4-column grid' },
  { id: 'italian-v2', name: 'Italian Classic', description: 'Elegant 2-column text-focused layout' }
]

export default function UXMenuTemplateClient({ menuId }: UXMenuTemplateClientProps) {
  const [menu, setMenu] = useState<Menu | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemoUser, setIsDemoUser] = useState(false)
  
  // Selection State
  const [templateId, setTemplateId] = useState('classic-cards-v2')
  const [paletteId, setPaletteId] = useState('clean-modern')
  const [fillersEnabled, setFillersEnabled] = useState(false)
  const [textOnly, setTextOnly] = useState(false)
  const [texturesEnabled, setTexturesEnabled] = useState(true)
  const [showMenuTitle, setShowMenuTitle] = useState(false)
  
  // Preview State
  const [layoutDocument, setLayoutDocument] = useState<LayoutDocumentV2 | null>(null)
  const [isPreviewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [zoom, setZoom] = useState(0.8)
  
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const router = useRouter()
  const { showToast } = useToast()
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)

  // Load menu data
  useEffect(() => {
    const loadMenuData = async () => {
      setLoading(true)
      if (menuId.startsWith('demo-')) {
        setIsDemoUser(true)
        const storedDemoMenu = sessionStorage.getItem('demoMenu')
        if (storedDemoMenu) {
          try {
            const parsedMenu = JSON.parse(storedDemoMenu)
            setMenu(parsedMenu)
          } catch (error) {
            console.error('Error parsing demo menu:', error)
            router.push('/demo/sample')
          }
        } else {
          router.push('/demo/sample')
        }
      } else {
        try {
          setIsDemoUser(false)
          const resp = await fetch(`/api/menus/${menuId}`)
          const data = await resp.json()
          if (!resp.ok) {
            if (resp.status === 401) {
              showToast({ type: 'error', title: 'Sign in required' })
              router.push('/auth/signin')
              return
            }
            throw new Error(data?.error || 'Failed to load menu')
          }
          setMenu(data.data)
          
          // Load existing selection if any
          const selectionResp = await fetch(`/api/menus/${menuId}/template-selection`)
          if (selectionResp.ok) {
            const selectionData = await selectionResp.json()
            if (selectionData.data) {
              const config = selectionData.data.configuration || {}
              
              // Map legacy V1 template IDs to V2 for UI consistency
              const savedTemplateId = selectionData.data.templateId || 'classic-cards-v2'
              const mappedTemplateId = 
                savedTemplateId === 'classic-grid-cards' ? 'classic-cards-v2' :
                savedTemplateId === 'two-column-text' ? 'italian-v2' :
                savedTemplateId === 'simple-rows' ? 'classic-cards-v2' :
                savedTemplateId;
                
              setTemplateId(mappedTemplateId)
              
              // Map legacy V1 palette IDs to V2
              const savedPaletteId = config.colourPaletteId || config.paletteId || 'clean-modern'
              const mappedPaletteId = 
                savedPaletteId === 'elegant-dark' ? 'midnight-gold' :
                savedPaletteId === 'simple-dark' ? 'midnight-gold' :
                savedPaletteId === 'elegant-warm' || savedPaletteId === 'classic-cream' || savedPaletteId === 'classic-ivory' ? 'elegant-cream' :
                savedPaletteId === 'elegant-light' || savedPaletteId === 'classic-sage' || savedPaletteId === 'simple-clean' ? 'clean-modern' :
                savedPaletteId;
                
              setPaletteId(mappedPaletteId)
              
              setFillersEnabled(config.fillersEnabled || false)
              setTextOnly(config.textOnly || false)
              setTexturesEnabled(config.texturesEnabled !== false)
              setShowMenuTitle(config.showMenuTitle || false)
            }
          }
        } catch (e) {
          console.error('Menu loading error:', e)
          showToast({
            type: 'error',
            title: 'Failed to load menu',
            description: e instanceof Error ? e.message : 'Unknown error'
          })
        }
      }
      setLoading(false)
    }

    loadMenuData()
  }, [menuId, router, showToast])

  // Fetch layout preview
  const fetchLayoutPreview = useCallback(async () => {
    if (!menu) return

    setPreviewLoading(true)
    setPreviewError(null)

    try {
      let resp
      const config = {
        paletteId,
        fillersEnabled,
        textOnly,
        texturesEnabled,
        showMenuTitle,
        engineVersion: 'v2'
      }

      if (isDemoUser) {
        resp = await fetch(`/api/menus/${menuId}/layout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu,
            templateId,
            configuration: config
          })
        })
      } else {
        const params = new URLSearchParams({
          templateId,
          paletteId,
          fillersEnabled: fillersEnabled.toString(),
          textOnly: textOnly.toString(),
          texturesEnabled: texturesEnabled.toString(),
          showMenuTitle: showMenuTitle.toString(),
          engineVersion: 'v2'
        })
        resp = await fetch(`/api/menus/${menuId}/layout?${params.toString()}`)
      }
      
      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data?.error || 'Failed to generate layout')
      }

      setLayoutDocument(data.data)
      // Reset page index if current is out of bounds
      if (data.data.pages && currentPageIndex >= data.data.pages.length) {
        setCurrentPageIndex(0)
      }
    } catch (e) {
      console.error('Error fetching layout:', e)
      setPreviewError(e instanceof Error ? e.message : 'Failed to load preview')
    } finally {
      setPreviewLoading(false)
    }
  }, [menu, menuId, templateId, paletteId, fillersEnabled, textOnly, texturesEnabled, showMenuTitle, isDemoUser, currentPageIndex])

  // Debounced preview update
  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    debounceTimeout.current = setTimeout(() => {
      fetchLayoutPreview()
    }, 400)
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    }
  }, [fetchLayoutPreview])

  const handleSelectTemplate = async () => {
    if (!menu) return

    setIsSaving(true)
    try {
      const configuration = {
        textOnly,
        fillersEnabled,
        texturesEnabled,
        showMenuTitle,
        colourPaletteId: paletteId
      }

      if (isDemoUser) {
        sessionStorage.setItem(`templateSelection-${menuId}`, JSON.stringify({
          menuId,
          templateId,
          templateVersion: '2.0.0',
          configuration
        }))
        router.push(`/menus/${menuId}/export`)
      } else {
        const resp = await fetch(`/api/menus/${menuId}/template-selection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId,
            configuration
          })
        })

        if (!resp.ok) {
          const data = await resp.json()
          throw new Error(data?.error || 'Failed to save template selection')
        }

        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error applying template:', error)
      showToast({
        type: 'error',
        title: 'Selection failed',
        description: error instanceof Error ? error.message : 'Please try again.'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleExportPDF = async () => {
    if (!menu || !layoutDocument) return

    setIsExporting(true)
    
    // Track export start
    trackConversionEvent({
      event: 'export_start',
      metadata: {
        path: `/menus/${menuId}/template`,
        format: 'pdf',
        isDemo: isDemoUser,
      },
    })

    try {
      const configuration = {
        textOnly,
        fillersEnabled,
        texturesEnabled,
        showMenuTitle,
        colourPaletteId: paletteId
      }

      const body: any = isDemoUser 
        ? { menu, templateId, configuration }
        : { menuId, templateId, configuration }
      
      body.options = {
        orientation: 'portrait',
        includePageNumbers: true,
        title: menu.name
      }

      const resp = await fetch('/api/templates/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!resp.ok) {
        const errText = await resp.text().catch(() => 'Export failed')
        throw new Error(errText)
      }

      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const menuSlug = menu.name.replace(/\s+/g, '-').toLowerCase()
      a.download = `${menuSlug}-menu.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      showToast({
        type: 'success',
        title: 'PDF exported successfully',
        description: 'Your menu has been downloaded.'
      })

      trackConversionEvent({
        event: 'export_completed',
        metadata: {
          path: `/menus/${menuId}/template`,
          format: 'pdf',
          isDemo: isDemoUser,
        },
      })
    } catch (error) {
      console.error('Error exporting PDF:', error)
      showToast({
        type: 'error',
        title: 'Export failed',
        description: 'Failed to generate PDF. Please try again.'
      })
      
      trackConversionEvent({
        event: 'ux_error',
        metadata: {
          path: `/menus/${menuId}/template`,
          format: 'pdf',
          isDemo: isDemoUser,
        },
      })
    } finally {
      setIsExporting(false)
    }
  }

  if (loading) {
    return (
      <UXSection>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ux-primary"></div>
        </div>
      </UXSection>
    )
  }

  const palette = PALETTES_V2.find(p => p.id === paletteId) || PALETTES_V2[0]
  const totalPages = layoutDocument?.pages?.length || 0
  const currentPage = layoutDocument?.pages?.[currentPageIndex]

  return (
    <UXSection>
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
          Configure Your Menu Layout
        </h1>
        <p className="mt-2 text-white/90 text-hero-shadow-strong">
          Choose a style, colors, and options. See the live preview below.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1600px] mx-auto">
        {/* Left Column: Controls */}
        <div className="lg:col-span-4 space-y-6">
          <UXCard className="overflow-visible">
            <div className="p-6 space-y-8">
              {/* Menu Summary */}
              <div className="flex items-center space-x-4 border-b pb-6">
                <MenuThumbnailBadge imageUrl={menu?.imageUrl} size="sm" />
                <div>
                  <h3 className="font-semibold text-ux-text">{menu?.name}</h3>
                  <p className="text-xs text-ux-text-secondary">{menu?.items?.length || 0} items ready</p>
                </div>
              </div>

              {/* Template Selection */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">1. Choose Template</h4>
                <div className="grid grid-cols-1 gap-3">
                  {V2_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTemplateId(t.id)
                        if (t.id === 'italian-v2') setTextOnly(true)
                      }}
                      className={`flex flex-col p-4 rounded-xl border-2 transition-all text-left ${
                        templateId === t.id 
                          ? 'border-ux-primary bg-ux-primary/5 ring-1 ring-ux-primary/20' 
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      }`}
                    >
                      <span className="font-bold text-ux-text">{t.name}</span>
                      <span className="text-xs text-ux-text-secondary mt-1">{t.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Palette Selection */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">2. Color Palette</h4>
                <div className="grid grid-cols-2 gap-2">
                  {PALETTES_V2.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPaletteId(p.id)}
                      className={`flex items-center p-2 rounded-lg border transition-all ${
                        paletteId === p.id 
                          ? 'border-ux-primary bg-ux-primary/5' 
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      }`}
                    >
                      <div className="flex -space-x-1 mr-2">
                        <div className="w-4 h-4 rounded-full border border-white" style={{ backgroundColor: p.colors.background }} />
                        <div className="w-4 h-4 rounded-full border border-white" style={{ backgroundColor: p.colors.itemTitle }} />
                        <div className="w-4 h-4 rounded-full border border-white" style={{ backgroundColor: p.colors.itemPrice }} />
                      </div>
                      <span className="text-xs font-medium text-ux-text truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Options */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">3. Display Options</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Fillers (decorative icons)</span>
                    <input
                      type="checkbox"
                      checked={fillersEnabled}
                      onChange={(e) => setFillersEnabled(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Text only (no images)</span>
                    <input
                      type="checkbox"
                      checked={textOnly}
                      onChange={(e) => setTextOnly(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Textured backgrounds</span>
                    <input
                      type="checkbox"
                      checked={texturesEnabled}
                      onChange={(e) => setTexturesEnabled(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Show menu title</span>
                    <input
                      type="checkbox"
                      checked={showMenuTitle}
                      onChange={(e) => setShowMenuTitle(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                </div>
              </div>
            </div>
          </UXCard>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-8 space-y-4">
          <UXCard className="bg-neutral-100 min-h-[600px] flex flex-col">
            <div className="p-4 border-b bg-white flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isPreviewLoading ? 'bg-amber-400 animate-pulse' : 'bg-green-500'}`} />
                <span className="text-xs font-bold uppercase tracking-tighter text-ux-text-secondary">
                  {isPreviewLoading ? 'Updating Preview...' : 'Live Preview'}
                </span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center bg-neutral-100 rounded-lg p-1">
                  <button
                    onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                    disabled={currentPageIndex === 0}
                    className="p-1 px-3 hover:bg-white rounded-md disabled:opacity-30 transition-all text-xs font-bold"
                  >
                    ←
                  </button>
                  <span className="px-4 text-xs font-mono">
                    Page {currentPageIndex + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPageIndex(Math.min(totalPages - 1, currentPageIndex + 1))}
                    disabled={currentPageIndex === totalPages - 1}
                    className="p-1 px-3 hover:bg-white rounded-md disabled:opacity-30 transition-all text-xs font-bold"
                  >
                    →
                  </button>
                </div>
              )}

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-ux-text-secondary uppercase">Zoom</span>
                  <input
                    type="range"
                    min="0.3"
                    max="1.5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-24 h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-ux-primary"
                  />
                  <span className="text-[10px] font-mono w-8">{Math.round(zoom * 100)}%</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-8 flex justify-center items-start bg-neutral-200/50 relative">
              {previewError ? (
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center">
                  <div className="text-4xl mb-4">⚠️</div>
                  <h3 className="text-lg font-bold text-red-600 mb-2">Preview Generation Failed</h3>
                  <p className="text-sm text-ux-text-secondary mb-6">{previewError}</p>
                  <UXButton variant="outline" size="sm" onClick={fetchLayoutPreview}>Try Again</UXButton>
                </div>
              ) : layoutDocument?.pageSpec && currentPage ? (
                <div 
                  className="shadow-2xl bg-white origin-top transition-all duration-300 ease-out"
                  style={{
                    width: layoutDocument.pageSpec.width,
                    height: layoutDocument.pageSpec.height,
                    transform: `scale(${zoom})`,
                    marginBottom: `-${(1 - zoom) * 100}%`
                  }}
                >
                  <PageRenderer
                    page={currentPage}
                    pageSpec={layoutDocument.pageSpec}
                    options={{
                      scale: 1.0,
                      palette,
                      texturesEnabled,
                      showGridOverlay: false,
                      showRegionBounds: false,
                      showTileIds: false,
                      isExport: false
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full opacity-40 py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ux-primary mb-4"></div>
                  <p className="text-sm font-medium">Generating your preview...</p>
                </div>
              )}
            </div>
          </UXCard>
          
          <div className="text-center text-[10px] text-white/50 uppercase tracking-widest py-2">
            The preview accurately represents your final PDF export
          </div>
        </div>
      </div>

      {/* Action Buttons at bottom */}
      <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
        <UXButton
          variant="outline"
          size="lg"
          className="bg-white/20 border-white/40 text-white hover:bg-white/30 w-full sm:w-auto min-w-[200px]"
          onClick={() => router.push(`/menus/${menuId}/extracted`)}
          disabled={isSaving || isExporting}
        >
          ← Back to Items
        </UXButton>

        {!isDemoUser && (
          <UXButton
            variant="primary"
            size="lg"
            className="w-full sm:w-auto min-w-[200px] shadow-lg bg-white text-ux-primary hover:bg-white/90 border-none"
            onClick={handleExportPDF}
            loading={isExporting}
            disabled={!layoutDocument || !!previewError || isSaving}
          >
            <span className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export PDF
            </span>
          </UXButton>
        )}

        <UXButton
          variant="primary"
          size="lg"
          className="w-full sm:w-auto min-w-[200px] shadow-lg"
          onClick={handleSelectTemplate}
          loading={isSaving}
          disabled={!layoutDocument || !!previewError || isExporting}
        >
          {isDemoUser ? 'Confirm and Export →' : 'Confirm'}
        </UXButton>
      </div>
    </UXSection>
  )
}
