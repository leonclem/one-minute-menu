'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UXSection, UXButton, UXCard } from '@/components/ux'
import { MenuThumbnailBadge } from '@/components/ux/MenuThumbnailBadge'
import { useToast } from '@/components/ui'
import type { Menu } from '@/types'
import MenuTile from '@/components/templates/MenuTile'
import FillerTile from '@/components/templates/FillerTile'
import { isItemTile, isFillerTile } from '@/lib/templates/types'
import type { GridLayout, OutputContext } from '@/lib/templates/types'

interface UXMenuTemplateClientProps {
  menuId: string
}

interface Template {
  id: string
  name: string
  description: string
  preview: string
  features: string[]
}

// Available templates (MVP: single template)
const AVAILABLE_TEMPLATES: Template[] = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean, contemporary design with excellent readability',
    preview: '/placeholder-template-modern.jpg',
    features: [
      'Mobile-optimized layout',
      'Clear typography',
      'Category organization',
      'Price highlighting',
      'Professional appearance'
    ]
  }
]

export default function UXMenuTemplateClient({ menuId }: UXMenuTemplateClientProps) {
  const [demoMenu, setDemoMenu] = useState<Menu | null>(null)
  const [authMenu, setAuthMenu] = useState<Menu | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(AVAILABLE_TEMPLATES[0])
  const [loading, setLoading] = useState(false)
  const [isDemoUser, setIsDemoUser] = useState(false)
  const [previewContext] = useState<OutputContext>('desktop')
  const [gridLayout, setGridLayout] = useState<GridLayout | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState<number>(1) // 0: left blank, 1: design, 2: right blank
  const [animPhase, setAnimPhase] = useState<'idle' | 'leaving' | 'entering'>('idle')
  const [animDirection, setAnimDirection] = useState<'left' | 'right' | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
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
      // Authenticated user: load menu and generate a preview layout using existing backend
      ;(async () => {
        try {
          setIsDemoUser(false)
          setPreviewLoading(true)
          setPreviewError(null)

          // Load menu to ensure it exists and has extraction data/items
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

          // Ensure the menu has either extraction metadata or items, or a recent extraction result in session storage
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

          // Generate layout preview using existing backend
          const genResp = await fetch('/api/templates/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              menuId: loadedMenu.id,
              context: previewContext,
              // MVP: let backend auto-select preset; could pass a fixed presetId here
            }),
          })
          if (!genResp.ok) {
            const err = await genResp.json().catch(() => ({}))
            throw new Error(err?.error || 'Failed to generate template preview')
          }
          const genData = await genResp.json()
          const layout: GridLayout = genData?.data?.layout
          setGridLayout(layout || null)
        } catch (e) {
          console.error('Template preview error:', e)
          setPreviewError(e instanceof Error ? e.message : 'Failed to load template preview')
        } finally {
          setPreviewLoading(false)
        }
      })()
    }
  }, [menuId, router, showToast])

  const rotateLeft = () => {
    setAnimDirection('left')
    setAnimPhase('leaving')
    setTimeout(() => {
      setActiveIndex((prev) => (prev + 2) % 3)
      setAnimPhase('entering')
      setTimeout(() => setAnimPhase('idle'), 180)
    }, 160)
  }
  const rotateRight = () => {
    setAnimDirection('right')
    setAnimPhase('leaving')
    setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % 3)
      setAnimPhase('entering')
      setTimeout(() => setAnimPhase('idle'), 180)
    }, 160)
  }

  const handleSelectTemplate = async () => {
    setLoading(true)
    try {
      // Only allow selecting when the design is centered
      if (activeIndex !== 1) return
      if (isDemoUser) {
        if (!demoMenu) return
        // Apply the selected template to the demo menu
        const updatedDemoMenu = {
          ...demoMenu,
          theme: {
            ...demoMenu.theme,
            id: selectedTemplate.id,
            name: selectedTemplate.name
          }
        }
        // Store updated demo menu
        sessionStorage.setItem('demoMenu', JSON.stringify(updatedDemoMenu))
        // Navigate to export for demo users
        router.push(`/ux/menus/${menuId}/export`)
      } else {
        // Authenticated users: navigate to the full dashboard preview
        router.push(`/dashboard/menus/${menuId}/templates`)
      }
    } catch (error) {
      console.error('Error applying template:', error)
      showToast({
        type: 'error',
        title: 'Template application failed',
        description: 'Please try again or contact support.'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBackToExtracted = () => {
    router.push(`/ux/menus/${menuId}/extracted`)
  }

  if (!demoMenu && isDemoUser) {
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
                        {i === 1 ? (
                          isDemoUser ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-white/70">
                                {selectedTemplate.name} Template Preview
                              </span>
                            </div>
                          ) : (
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
                              {!previewLoading && !previewError && gridLayout && (
                                <SimpleGridPreview layout={gridLayout} menuTitle={authMenu?.name || 'Menu'} />
                              )}
                              {!previewLoading && !previewError && !gridLayout && (
                                <div className="placeholder-ux w-full h-full mb-2 flex items-center justify-center">
                                  <span className="text-ux-text-secondary">No preview available</span>
                                </div>
                              )}
                            </div>
                          )
                        ) : (
                          <div className="w-full h-full bg-neutral-800/60 flex items-center justify-center">
                            <span className="text-white/60">Design preview coming soon</span>
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
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </UXCard>
          </div>
        </div>

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
            disabled={loading || activeIndex !== 1 || (!isDemoUser && !gridLayout) || (isDemoUser && !demoMenu)}
          >
            {isDemoUser ? 'Select and Export' : 'Select and Preview'}
          </UXButton>
        </div>

        {/* MVP Notice */}
        <div className="text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-lg bg-ux-primary/10 text-ux-primary text-sm">
            <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            More templates coming soon! Currently showing our Modern template.
          </div>
        </div>
      </div>
    </UXSection>
  )
}

// Minimal grid layout preview adapted for UX styling
function SimpleGridPreview({ layout, menuTitle }: { layout: GridLayout; menuTitle: string }) {
  const preset = layout.preset
  const columns = preset.gridConfig.columns[layout.context]
  const gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`
  const currency = '$'

  return (
    <main className="menu-layout bg-white rounded-lg p-4" aria-label={`${menuTitle} menu preview`}>
      <header className="menu-header mb-6">
        <h1 className="text-2xl font-bold text-ux-text">{menuTitle}</h1>
      </header>
      {layout.sections.map((section, sectionIndex) => (
        <section
          key={`section-${sectionIndex}`}
          className={`menu-section ${preset.gridConfig.sectionSpacing}`}
          aria-labelledby={`section-heading-${sectionIndex}`}
        >
          <h2
            id={`section-heading-${sectionIndex}`}
            className="text-xl font-semibold text-ux-text mb-4"
          >
            {section.name}
          </h2>
          <ul
            className={`grid ${preset.gridConfig.gap}`}
            style={{ gridTemplateColumns }}
            role="list"
            aria-label={`${section.name} items`}
          >
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