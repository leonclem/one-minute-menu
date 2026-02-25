'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname } from 'next/navigation'
import { UXSection, UXButton, UXCard, PaletteDropdown, TemplateDropdown, ImageModeDropdown } from '@/components/ux'
import { MenuThumbnailBadge } from '@/components/ux/MenuThumbnailBadge'
import { useToast } from '@/components/ui'
import type { Menu } from '@/types'
import { PageRenderer } from '@/lib/templates/v2/renderer-web-v2'
import { PALETTES_V2, DEFAULT_PALETTE_V2, TEXTURE_IDS, TEXTURE_REGISTRY, FILLER_PATTERN_IDS, FILLER_PATTERN_REGISTRY, SPACER_BLANK_ID } from '@/lib/templates/v2/renderer-v2'
import type { LayoutDocumentV2, ImageModeV2 } from '@/lib/templates/v2/engine-types-v2'
import { trackConversionEvent } from '@/lib/conversion-tracking'
import { markDashboardForRefresh } from '@/lib/dashboard-refresh'
import { V2_TEMPLATE_OPTIONS } from '@/lib/templates/v2/template-options'

interface UXMenuTemplateClientProps {
  menuId: string
}

export default function UXMenuTemplateClient({ menuId }: UXMenuTemplateClientProps) {
  const [menu, setMenu] = useState<Menu | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemoUser, setIsDemoUser] = useState(false)
  const [deliveryEmail, setDeliveryEmail] = useState<string | null>(null)
  
  // Selection State
  const [templateId, setTemplateId] = useState('4-column-portrait')
  const [paletteId, setPaletteId] = useState('elegant-cream')
  const [imageMode, setImageMode] = useState<ImageModeV2>('compact-rect')
  /** 'blank' = plain rectangle fillers, 'none' = no fillers, otherwise pattern ID */
  const [spacerTiles, setSpacerTiles] = useState<'blank' | 'none' | string>(SPACER_BLANK_ID)
  /** Derived: when imageMode is 'none', layout is text-only (no images). */
  const textOnly = imageMode === 'none'
  // Texture is applied as overlay when textureId is set; no separate "textures enabled" toggle
  const [textureId, setTextureId] = useState<string | null>('linen')
  const [showMenuTitle, setShowMenuTitle] = useState(false)
  const [showVignette, setShowVignette] = useState(true)
  const [itemBorders, setItemBorders] = useState(true)
  const [itemDropShadow, setItemDropShadow] = useState(true)
  const [fillItemTiles, setFillItemTiles] = useState(true)
  
  // Preview State
  const [layoutDocument, setLayoutDocument] = useState<LayoutDocumentV2 | null>(null)
  const [isPreviewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [zoom, setZoom] = useState(0.8)
  
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [exportSuccessModalOpen, setExportSuccessModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { showToast } = useToast()
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

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
          const resp = await fetch(`/api/menus/${menuId}`, { cache: 'no-store' })
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
              
              // Map legacy/saved template IDs to current option IDs for dropdown
              const savedTemplateId = selectionData.data.templateId || '4-column-portrait'
              const mappedTemplateId =
                savedTemplateId === 'classic-grid-cards' || savedTemplateId === 'simple-rows' || savedTemplateId === 'classic-cards-v2' ? '4-column-portrait' :
                savedTemplateId === 'two-column-text' || savedTemplateId === 'italian-v2' ? '2-column-portrait' :
                savedTemplateId === 'three-column-modern-v2' ? '3-column-portrait' :
                savedTemplateId === 'half-a4-tall-v2' ? '1-column-tall' :
                savedTemplateId === 'classic-cards-v2-landscape' ? '4-column-landscape' :
                savedTemplateId
                
              setTemplateId(mappedTemplateId)
              
              // Styling defaults (palette, texture, imageMode, spacer tiles) are set
              // via useState initializers and NOT restored from saved config —
              // the page always opens with the product defaults.
              // Only restore non-styling preferences from saved config.
              // Spacer Tiles: default to "Blank" unless saved preference is present.
              if (config.spacerTiles === 'none') setSpacerTiles('none')
              else if (config.spacerTiles === 'mix') setSpacerTiles('mix')
              else if (config.spacerTiles === SPACER_BLANK_ID) setSpacerTiles(SPACER_BLANK_ID)
              else if (config.spacerTiles && FILLER_PATTERN_REGISTRY.has(config.spacerTiles)) setSpacerTiles(config.spacerTiles)
              else if (config.spacerTilePatternId === SPACER_BLANK_ID) setSpacerTiles(SPACER_BLANK_ID)
              else if (config.spacerTilePatternId && FILLER_PATTERN_REGISTRY.has(config.spacerTilePatternId)) setSpacerTiles(config.spacerTilePatternId)
              else setSpacerTiles(SPACER_BLANK_ID)
              if (config.imageMode === 'none' || config.textOnly) setImageMode('none')
              else if (config.imageMode) setImageMode(config.imageMode as ImageModeV2)
              setShowMenuTitle(config.showMenuTitle || false)
              setShowVignette(config.showVignette !== false)
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
  }, [menuId, pathname, router, showToast])

  // Load user's email address for export notifications (best-effort)
  useEffect(() => {
    if (menuId.startsWith('demo-')) return
    let mounted = true

    ;(async () => {
      try {
        const resp = await fetch('/api/profile')
        if (!resp.ok) return
        const json = await resp.json().catch(() => ({}))
        const email = json?.data?.email
        if (!mounted) return
        if (typeof email === 'string' && email.includes('@')) {
          setDeliveryEmail(email)
        }
      } catch {
        // best-effort
      }
    })()

    return () => {
      mounted = false
    }
  }, [menuId])

  // Fetch layout preview
  const fetchLayoutPreview = useCallback(async () => {
    if (!menu) return

    setPreviewLoading(true)
    setPreviewError(null)

    try {
      let resp
      const config = {
        paletteId,
        imageMode,
        fillersEnabled: spacerTiles !== 'none',
        spacerTilePatternId: (spacerTiles !== 'none' ? spacerTiles : undefined),
        textOnly,
        texturesEnabled: !!textureId,
        textureId: textureId ?? undefined,
        showMenuTitle,
        showVignette,
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
          imageMode,
          fillersEnabled: (spacerTiles !== 'none').toString(),
          spacerTilePatternId: spacerTiles !== 'none' ? spacerTiles : '',
          textOnly: textOnly.toString(),
          texturesEnabled: (!!textureId).toString(),
          ...(textureId ? { textureId } : {}),
          showMenuTitle: showMenuTitle.toString(),
          showVignette: showVignette.toString(),
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
  }, [menu, menuId, templateId, paletteId, imageMode, spacerTiles, textOnly, textureId, showMenuTitle, showVignette, isDemoUser, currentPageIndex])

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
        fillersEnabled: spacerTiles !== 'none',
        spacerTiles,
        spacerTilePatternId: spacerTiles !== 'none' ? spacerTiles : undefined,
        texturesEnabled: !!textureId,
        textureId: textureId ?? undefined,
        showMenuTitle,
        showVignette,
        itemBorders,
        itemDropShadow,
        fillItemTiles,
        colourPaletteId: paletteId,
        imageMode
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
        markDashboardForRefresh()
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
    if (!menu || !layoutDocument || isExporting) return

    setIsExporting(true)
    setExportStatus('Submitting...')
    
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
        fillersEnabled: spacerTiles !== 'none',
        spacerTiles,
        spacerTilePatternId: spacerTiles !== 'none' ? spacerTiles : undefined,
        texturesEnabled: !!textureId,
        textureId: textureId ?? undefined,
        showMenuTitle,
        showVignette,
        itemBorders,
        itemDropShadow,
        fillItemTiles,
        palette: palette,
        imageMode
      }

      // 1. Create Export Job
      const jobResp = await fetch('/api/export/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_id: menuId,
          export_type: 'pdf',
          template_id: templateId,
          configuration,
          metadata: {
            format: 'A4',
            orientation: 'portrait'
          }
        })
      })

      if (!jobResp.ok) {
        const data = await jobResp.json()
        throw new Error(data?.error || 'Failed to create export job')
      }

      trackConversionEvent({
        event: 'export_submitted',
        metadata: {
          path: `/menus/${menuId}/template`,
          format: 'pdf',
          isDemo: isDemoUser,
        },
      })

      setExportStatus(null)
      setExportSuccessModalOpen(true)

    } catch (error) {
      console.error('Error exporting PDF:', error)
      showToast({
        type: 'error',
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'Failed to submit export request.'
      })
      
      trackConversionEvent({
        event: 'ux_error',
        metadata: {
          path: `/menus/${menuId}/template`,
          format: 'pdf',
          isDemo: isDemoUser,
        },
      })
      setIsExporting(false)
      setExportStatus(null)
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

  const palette = PALETTES_V2.find(p => p.id === paletteId) ?? DEFAULT_PALETTE_V2
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
                <h4 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">1. Grid Layout</h4>
                <TemplateDropdown
                  templates={V2_TEMPLATE_OPTIONS}
                  value={templateId}
                  onChange={setTemplateId}
                  variant="primary"
                />
              </div>

              {/* Palette Selection */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">2. Color Palette</h4>
                <PaletteDropdown
                  palettes={PALETTES_V2}
                  value={paletteId}
                  onChange={setPaletteId}
                  variant="primary"
                />
              </div>

              {/* Background texture (overlay on palette) */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">3. Background texture</h4>
                <select
                  value={textureId ?? ''}
                  onChange={(e) => setTextureId(e.target.value || null)}
                  className="w-full rounded border border-ux-border bg-white px-3 py-2 text-sm text-ux-text focus:ring-ux-primary focus:border-ux-primary"
                >
                  <option value="">None</option>
                  {TEXTURE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {TEXTURE_REGISTRY.get(id)?.label ?? id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Image Mode Selection */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">4. Image Options</h4>
                <ImageModeDropdown
                  value={imageMode}
                  onChange={setImageMode}
                  variant="primary"
                  showDescription={false}
                />
              </div>

              {/* Spacer Tiles */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">5. Spacer Tiles</h4>
                <select
                  value={spacerTiles}
                  onChange={(e) => setSpacerTiles(e.target.value as 'blank' | 'none' | string)}
                  className="w-full rounded border border-ux-border bg-white px-3 py-2 text-sm text-ux-text focus:ring-ux-primary focus:border-ux-primary"
                >
                  <option value={SPACER_BLANK_ID}>Blank</option>
                  <option value="none">None</option>
                  <option value="mix">Mix</option>
                  {FILLER_PATTERN_IDS.map((id) => (
                    <option key={id} value={id}>
                      {FILLER_PATTERN_REGISTRY.get(id)?.label ?? id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Display Options */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">6. Display Options</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Show menu title</span>
                    <input
                      type="checkbox"
                      checked={showMenuTitle}
                      onChange={(e) => setShowMenuTitle(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Vignette edges</span>
                    <input
                      type="checkbox"
                      checked={showVignette}
                      onChange={(e) => setShowVignette(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Fill item tiles</span>
                    <input
                      type="checkbox"
                      checked={fillItemTiles}
                      onChange={(e) => setFillItemTiles(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Item borders</span>
                    <input
                      type="checkbox"
                      checked={itemBorders}
                      onChange={(e) => setItemBorders(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Item drop shadow</span>
                    <input
                      type="checkbox"
                      checked={itemDropShadow}
                      onChange={(e) => setItemDropShadow(e.target.checked)}
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
                      texturesEnabled: !!textureId,
                      textureId: textureId ?? undefined,
                      imageMode: imageMode === 'none' ? 'stretch' : imageMode,
                      showVignette,
                      itemBorders,
                      itemDropShadow,
                      fillItemTiles,
                      showGridOverlay: false,
                      showRegionBounds: false,
                      showTileIds: false,
                      isExport: false,
                      spacerTilePatternId: spacerTiles !== 'none' ? spacerTiles : undefined
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
            variant="warning"
            size="lg"
            className="w-full sm:w-auto min-w-[200px] shadow-lg"
            onClick={handleExportPDF}
            loading={isExporting}
            disabled={!layoutDocument || !!previewError || isSaving || isExporting}
          >
            <span className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exportStatus || 'Export PDF'}
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
          {isDemoUser ? 'Confirm and Export →' : 'Go to Dashboard'}
        </UXButton>
      </div>

      {exportSuccessModalOpen && mounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-lg overflow-hidden my-8">
            <div className="px-4 py-3 border-b">
              <h3 className="font-medium text-secondary-900">Export started</h3>
            </div>
            <div className="px-4 py-3 text-sm text-secondary-700">
              Your PDF is being generated and will be emailed to you when it&apos;s ready. You can return to your dashboard now.
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2 bg-gray-50/50">
              <button
                className="px-3 py-2 text-sm rounded-md text-white shadow-sm bg-primary-600 hover:bg-primary-700"
                onClick={() => {
                  setExportSuccessModalOpen(false)
                  setIsExporting(false)
                  router.push('/dashboard')
                }}
              >
                Okay
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </UXSection>
  )
}
