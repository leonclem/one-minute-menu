'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UXSection, UXButton, UXCard } from '@/components/ux'
import { MenuThumbnailBadge } from '@/components/ux/MenuThumbnailBadge'
import { useToast } from '@/components/ui'
import type { Menu } from '@/types'
import { CompatibilityBadge } from '@/components/templates'
import type { LayoutInstance, TileContentInstance } from '@/lib/templates/engine-types'

interface UXMenuTemplateClientProps {
  menuId: string
}

interface TemplateWithCompatibility {
  template: {
    id: string
    name: string
    description: string
    thumbnailUrl: string
    capabilities: {
      supportsImages: boolean
      supportsTextOnlyMode: boolean
      supportsResponsiveWeb: boolean
      supportsLogoPlaceholder: boolean
      supportsColourPalettes: boolean
      autoFillerTiles: boolean
    }
  }
  status: 'OK' | 'WARNING' | 'INCOMPATIBLE'
  message?: string
  warnings: string[]
}

export default function UXMenuTemplateClient({ menuId }: UXMenuTemplateClientProps) {
  const [demoMenu, setDemoMenu] = useState<Menu | null>(null)
  const [authMenu, setAuthMenu] = useState<Menu | null>(null)
  const [availableTemplates, setAvailableTemplates] = useState<TemplateWithCompatibility[]>([])
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0)
  const [layoutInstance, setLayoutInstance] = useState<LayoutInstance | null>(null)
  const [loading, setLoading] = useState(false)
  const [isDemoUser, setIsDemoUser] = useState(false)
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState<number>(1) // 0: left blank, 1: design, 2: right blank
  const [animPhase, setAnimPhase] = useState<'idle' | 'leaving' | 'entering'>('idle')
  const [animDirection, setAnimDirection] = useState<'left' | 'right' | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const router = useRouter()
  const { showToast } = useToast()

  // Load menu data
  useEffect(() => {
    const loadMenuData = async () => {
      // Check if this is a demo menu
      if (menuId.startsWith('demo-')) {
        setIsDemoUser(true)
        const storedDemoMenu = sessionStorage.getItem('demoMenu')
        if (storedDemoMenu) {
          try {
            const parsedMenu = JSON.parse(storedDemoMenu)
            setDemoMenu(parsedMenu)
            setThumbnailUrl(parsedMenu?.imageUrl ?? null)
          } catch (error) {
            console.error('Error parsing demo menu:', error)
            router.push('/ux/demo/sample')
          }
        } else {
          // No demo menu data found, redirect back to sample selection
          router.push('/ux/demo/sample')
        }
      } else {
        // Authenticated user: load menu
        try {
          setIsDemoUser(false)
          const resp = await fetch(`/api/menus/${menuId}`, { method: 'GET' })
          const data = await resp.json()
          if (!resp.ok) {
            if (resp.status === 401) {
              showToast({
                type: 'error',
                title: 'Sign in required',
                description: 'Please sign in to preview templates for your menu.'
              })
              router.push('/auth/signin')
              return
            }
            throw new Error(data?.error || 'Failed to load menu')
          }
          const loadedMenu: Menu = data.data
          setAuthMenu(loadedMenu)
          setThumbnailUrl(loadedMenu?.imageUrl ?? null)

          // Ensure the menu has either extraction metadata or items
          let hasLocalExtractionResult = false
          try {
            const stored = sessionStorage.getItem(`extractionResult:${menuId}`)
            if (stored) {
              hasLocalExtractionResult = true
            }
          } catch {
            // ignore sessionStorage errors
          }

          if (!loadedMenu?.extractionMetadata && (!loadedMenu?.items || loadedMenu.items.length === 0) && !hasLocalExtractionResult) {
            showToast({
              type: 'info',
              title: 'Extraction required',
              description: 'Please extract items before selecting a template.'
            })
            router.push(`/ux/menus/${menuId}/extract`)
            return
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
    }

    loadMenuData()
  }, [menuId, router, showToast])

  // Fetch available templates
  useEffect(() => {
    const fetchTemplates = async () => {
      if (!menuId) return

      setTemplatesLoading(true)
      setTemplatesError(null)

      try {
        const resp = await fetch(`/api/templates/available?menuId=${menuId}`)
        const data = await resp.json()

        if (!resp.ok) {
          throw new Error(data?.error || 'Failed to fetch templates')
        }

        setAvailableTemplates(data.data || [])
      } catch (e) {
        console.error('Error fetching templates:', e)
        setTemplatesError(e instanceof Error ? e.message : 'Failed to load templates')
      } finally {
        setTemplatesLoading(false)
      }
    }

    fetchTemplates()
  }, [menuId])

  // Fetch layout preview when template is selected
  useEffect(() => {
    const fetchLayoutPreview = async () => {
      if (!menuId || availableTemplates.length === 0) return

      const selectedTemplate = availableTemplates[selectedTemplateIndex]
      if (!selectedTemplate) return

      // Don't fetch preview for INCOMPATIBLE templates
      if (selectedTemplate.status === 'INCOMPATIBLE') {
        setLayoutInstance(null)
        setPreviewError(selectedTemplate.message || 'This template is not compatible with your menu')
        return
      }

      setPreviewLoading(true)
      setPreviewError(null)

      try {
        const resp = await fetch(
          `/api/menus/${menuId}/layout?templateId=${selectedTemplate.template.id}`
        )
        const data = await resp.json()

        if (!resp.ok) {
          throw new Error(data?.error || 'Failed to generate layout')
        }

        setLayoutInstance(data.data)
      } catch (e) {
        console.error('Error fetching layout:', e)
        setPreviewError(e instanceof Error ? e.message : 'Failed to load preview')
      } finally {
        setPreviewLoading(false)
      }
    }

    fetchLayoutPreview()
  }, [menuId, availableTemplates, selectedTemplateIndex])

  const rotateLeft = () => {
    if (availableTemplates.length === 0) return
    setAnimDirection('left')
    setAnimPhase('leaving')
    setTimeout(() => {
      setSelectedTemplateIndex((prev) => (prev - 1 + availableTemplates.length) % availableTemplates.length)
      setActiveIndex((prev) => (prev + 2) % 3)
      setAnimPhase('entering')
      setTimeout(() => setAnimPhase('idle'), 180)
    }, 160)
  }
  
  const rotateRight = () => {
    if (availableTemplates.length === 0) return
    setAnimDirection('right')
    setAnimPhase('leaving')
    setTimeout(() => {
      setSelectedTemplateIndex((prev) => (prev + 1) % availableTemplates.length)
      setActiveIndex((prev) => (prev + 1) % 3)
      setAnimPhase('entering')
      setTimeout(() => setAnimPhase('idle'), 180)
    }, 160)
  }

  const handleSelectTemplate = async () => {
    // Only allow selecting when the design is centered
    if (activeIndex !== 1) return
    if (availableTemplates.length === 0) return

    const selectedTemplate = availableTemplates[selectedTemplateIndex]
    if (!selectedTemplate) return

    // Don't allow selecting INCOMPATIBLE templates
    if (selectedTemplate.status === 'INCOMPATIBLE') {
      showToast({
        type: 'error',
        title: 'Template not compatible',
        description: selectedTemplate.message || 'This template cannot be used with your menu. Please choose another template.'
      })
      return
    }

    setLoading(true)
    try {
      if (isDemoUser) {
        if (!demoMenu) return
        // For demo users, store template selection in sessionStorage
        sessionStorage.setItem('demoTemplateSelection', JSON.stringify({
          templateId: selectedTemplate.template.id,
          configuration: { textOnly: false }
        }))
        // Navigate to export for demo users
        router.push(`/ux/menus/${menuId}/export`)
      } else {
        // Authenticated users: save template selection via API
        const resp = await fetch(`/api/menus/${menuId}/template-selection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId: selectedTemplate.template.id,
            configuration: { textOnly: false }
          })
        })

        if (!resp.ok) {
          const data = await resp.json()
          throw new Error(data?.error || 'Failed to save template selection')
        }

        // Navigate to export page
        router.push(`/ux/menus/${menuId}/export`)
      }
    } catch (error) {
      console.error('Error applying template:', error)
      showToast({
        type: 'error',
        title: 'Template selection failed',
        description: error instanceof Error ? error.message : 'Please try again or contact support.'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBackToExtracted = () => {
    router.push(`/ux/menus/${menuId}/extracted`)
  }

  if ((!demoMenu && isDemoUser) || templatesLoading) {
    return (
      <UXSection>
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Loading...
          </h1>
          <p className="mt-2 text-white/90 text-hero-shadow-strong">
            Loading template options
          </p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ux-primary"></div>
        </div>
      </UXSection>
    )
  }

  if (templatesError) {
    return (
      <UXSection>
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Error Loading Templates
          </h1>
          <p className="mt-2 text-white/90 text-hero-shadow-strong">
            {templatesError}
          </p>
        </div>
        <div className="flex justify-center">
          <UXButton onClick={() => router.push(`/ux/menus/${menuId}/extracted`)}>
            ← Back to Items
          </UXButton>
        </div>
      </UXSection>
    )
  }

  const selectedTemplate = availableTemplates[selectedTemplateIndex]

  return (
    <UXSection>
      {/* Page heading styled like earlier steps */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
          Choose Menu Design
        </h1>
        <p className="mt-2 text-white/90 text-hero-shadow-strong">
          Rotate between designs and select the one you like
        </p>
      </div>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Menu Summary */}
        {(demoMenu || authMenu) && (
          <UXCard>
            <MenuThumbnailBadge imageUrl={thumbnailUrl} position="right" />
            <div className="p-6 relative z-10">
              <h3 className="text-lg font-semibold text-ux-text mb-2">
                {(demoMenu || authMenu)?.name}
              </h3>
              <p className="text-ux-text-secondary">
                {(demoMenu || authMenu)?.items?.length || 0} items ready for template application
              </p>
            </div>
          </UXCard>
        )}

        {/* Carousel-style selection frame */}
        <div className="relative">
          {/* Center active panel */}
          <div className="mx-auto w-full md:w-[720px]">
            <UXCard className="rounded-2xl overflow-hidden shadow-xl">
              <div className="relative p-4 md:p-6 bg-neutral-900">
                {/* Left arrow */}
                <button
                  type="button"
                  aria-label="Previous design"
                  className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-ux-primary text-white shadow hover:opacity-90 focus:outline-none"
                  onClick={rotateLeft}
                  disabled={availableTemplates.length <= 1}
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L8.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Carousel with three panels */}
                <div className="relative h-[420px] overflow-visible">
                  {[0, 1, 2].map((i) => {
                    const rel = (i - activeIndex + 3) % 3 // 0 center, 1 right, 2 left
                    const translate =
                      rel === 0 ? '0%' : rel === 1 ? '110%' : '-110%'
                    const scale = rel === 0 ? 1 : 0.92
                    const opacity = rel === 0 ? 1 : 0.45
                    const z = rel === 0 ? 10 : 5
                    return (
                      <div
                        key={i}
                        className="absolute inset-0 rounded-xl ring-1 ring-white/10 bg-neutral-900 text-white"
                        style={{
                          transform: `translateX(${translate}) scale(${scale})`,
                          transition: 'transform 280ms ease, opacity 280ms ease',
                          opacity,
                          zIndex: z,
                        }}
                        aria-hidden={i !== 1}
                      >
                        {i === 1 && selectedTemplate ? (
                          <div className="w-full h-full bg-white overflow-auto">
                            {previewLoading && (
                              <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ux-primary"></div>
                              </div>
                            )}
                            {previewError && (
                              <div className="p-4 rounded border border-red-200 bg-red-50 text-red-800 text-sm">
                                {previewError}
                              </div>
                            )}
                            {!previewLoading && !previewError && layoutInstance && (
                              <LayoutInstanceRenderer
                                layout={layoutInstance}
                                menuName={(demoMenu || authMenu)?.name || 'Menu'}
                              />
                            )}
                            {!previewLoading && !previewError && !layoutInstance && (
                              <div className="placeholder-ux w-full h-full mb-2 flex items-center justify-center">
                                <span className="text-ux-text-secondary">No preview available</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-full h-full bg-neutral-800/60 flex items-center justify-center">
                            <span className="text-white/60">
                              {availableTemplates.length > 1 ? 'Navigate to see more templates' : 'Loading...'}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Right arrow */}
                <button
                  type="button"
                  aria-label="Next design"
                  className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-ux-primary text-white shadow hover:opacity-90 focus:outline-none"
                  onClick={rotateRight}
                  disabled={availableTemplates.length <= 1}
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </UXCard>
          </div>
        </div>

        {/* Template Info and Compatibility */}
        {selectedTemplate && (
          <UXCard>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-ux-text mb-1">
                    {selectedTemplate.template.name}
                  </h3>
                  <p className="text-ux-text-secondary">
                    {selectedTemplate.template.description}
                  </p>
                </div>
                <CompatibilityBadge
                  status={selectedTemplate.status}
                  message={selectedTemplate.message}
                  warnings={selectedTemplate.warnings}
                />
              </div>

              {/* Warnings */}
              {selectedTemplate.warnings.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      {selectedTemplate.warnings.map((warning, idx) => (
                        <p key={idx} className="text-sm text-yellow-800">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Capabilities */}
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedTemplate.template.capabilities.supportsImages && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Images
                  </span>
                )}
                {selectedTemplate.template.capabilities.supportsTextOnlyMode && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Text-only mode
                  </span>
                )}
                {selectedTemplate.template.capabilities.supportsResponsiveWeb && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Responsive
                  </span>
                )}
              </div>
            </div>
          </UXCard>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <UXButton
            variant="outline"
            size="lg"
            onClick={handleBackToExtracted}
            className="bg-white/20 border-white/40 text-white hover:bg-white/30"
            disabled={loading}
          >
            ← Back to Items
          </UXButton>
          
          <UXButton
            variant="primary"
            size="lg"
            onClick={handleSelectTemplate}
            loading={loading}
            disabled={
              loading || 
              activeIndex !== 1 || 
              !selectedTemplate || 
              selectedTemplate.status === 'INCOMPATIBLE' ||
              (!layoutInstance && !isDemoUser)
            }
          >
            {isDemoUser ? 'Select and Export' : 'Select and Export'}
          </UXButton>
        </div>

        {/* Template Count Notice */}
        {availableTemplates.length > 0 && (
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-lg bg-ux-primary/10 text-ux-primary text-sm">
              <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Showing {availableTemplates.length} template{availableTemplates.length !== 1 ? 's' : ''} compatible with your menu
            </div>
          </div>
        )}
      </div>
    </UXSection>
  )
}

// Simple Layout Instance Renderer
// This is a minimal renderer for LayoutInstance preview
// TODO: Create a proper LayoutInstanceRenderer component
function LayoutInstanceRenderer({ layout, menuName }: { layout: LayoutInstance; menuName: string }) {
  const renderTile = (tile: TileContentInstance) => {
    if (tile.type === 'ITEM' && 'item' in tile) {
      const item = tile.item as { name: string; description?: string; price: number }
      return (
        <div>
          <div className="font-medium">{item.name}</div>
          {item.description && (
            <div className="text-sm text-gray-600">{item.description}</div>
          )}
          <div className="text-sm font-semibold">${item.price.toFixed(2)}</div>
        </div>
      )
    }
    
    if (tile.type === 'SECTION_HEADER' && 'label' in tile) {
      return <div className="font-semibold text-lg">{String(tile.label)}</div>
    }
    
    if (tile.type === 'TITLE' && 'text' in tile) {
      return <div className="font-bold text-xl">{String(tile.text)}</div>
    }
    
    return null
  }

  return (
    <div className="p-4 bg-white">
      <h1 className="text-2xl font-bold mb-4">{menuName}</h1>
      {layout.pages.map((page, pageIndex) => (
        <div key={pageIndex} className="mb-8">
          <div className="text-sm text-gray-500 mb-2">Page {pageIndex + 1}</div>
          <div className="space-y-4">
            {page.tiles.map((tile: TileContentInstance, tileIndex: number) => (
              <div key={tileIndex} className="p-2 border border-gray-200 rounded">
                <div className="text-xs text-gray-500">{tile.type}</div>
                {renderTile(tile)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
