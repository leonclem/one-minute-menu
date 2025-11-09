'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UXSection, UXButton, UXCard } from '@/components/ux'
import { MenuThumbnailBadge } from '@/components/ux/MenuThumbnailBadge'
import { useToast } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import type { Menu, MenuItem } from '@/types'
import type { ExtractionResultType as Stage1ExtractionResult } from '@/lib/extraction/schema-stage1'
import type { ExtractionResultV2Type as Stage2ExtractionResult } from '@/lib/extraction/schema-stage2'

interface UXMenuExtractedClientProps {
  menuId: string
}

export default function UXMenuExtractedClient({ menuId }: UXMenuExtractedClientProps) {
  const [demoMenu, setDemoMenu] = useState<Menu | null>(null)
  const [authResult, setAuthResult] = useState<Stage1ExtractionResult | Stage2ExtractionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    // Check if this is a demo menu
    if (menuId.startsWith('demo-')) {
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
      // Handle authenticated user menu by reading the job id and fetching results
      const jobId = sessionStorage.getItem(`extractionJob:${menuId}`)
      if (!jobId) {
        showToast({
          type: 'error',
          title: 'No extraction found',
          description: 'Please extract items first.'
        })
        router.push(`/ux/menus/${menuId}/extract`)
        return
      }

      let cancelled = false

      const fetchStatus = async () => {
        try {
          const resp = await fetch(`/api/extraction/status/${jobId}`)
          const json = await resp.json()
          if (!resp.ok) {
            throw new Error(json?.error || 'Failed to get extraction status')
          }
          const status = json?.data?.status
          if (status === 'completed' && json?.data?.result) {
            if (!cancelled) {
              setAuthResult(json.data.result as Stage1ExtractionResult | Stage2ExtractionResult)
            }
            return true
          }
          if (status === 'failed') {
            showToast({
              type: 'error',
              title: 'Extraction failed',
              description: json?.data?.error || 'Please try again.'
            })
            router.push(`/ux/menus/${menuId}/extract`)
            return true
          }
          return false
        } catch (e) {
          console.error('Failed to fetch extraction status', e)
          showToast({
            type: 'error',
            title: 'Could not load results',
            description: 'Please try again from the extraction step.'
          })
          router.push(`/ux/menus/${menuId}/extract`)
          return true
        }
      }

      // Also, fetch menu once for thumbnail (non-blocking)
      ;(async () => {
        try {
          const resp = await fetch(`/api/menus/${menuId}`)
          if (!resp.ok) return
          const json = await resp.json()
          setThumbnailUrl(json?.data?.imageUrl ?? null)
        } catch {}
      })()

      // Poll for completion if needed
      ;(async () => {
        const maxAttempts = 20
        const delayMs = 2000
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const done = await fetchStatus()
          if (done) break
          await new Promise((r) => setTimeout(r, delayMs))
          if (cancelled) break
        }
      })()

      return () => {
        cancelled = true
      }
    }
  }, [menuId, router, showToast])

  const handleProceedToTemplate = () => {
    setLoading(true)
    
    // Navigate to template selection
    router.push(`/ux/menus/${menuId}/template`)
  }

  const handleBackToExtraction = () => {
    router.push(`/ux/menus/${menuId}/extract`)
  }

  // Helper: compute items grouped by category for demo menus
  const groupDemoItemsByCategory = (menu: Menu) => {
    return menu.items.reduce((acc, item) => {
      const category = (item as MenuItem).category || 'Uncategorized'
      if (!acc[category]) acc[category] = []
      acc[category].push(item as MenuItem)
      return acc
    }, {} as Record<string, MenuItem[]>)
  }

  // Helper: traverse stage1/stage2 categories into map of category -> items
  type AnyItem =
    | {
        name: string
        price?: number
        description?: string
        confidence?: number
        variants?: Array<{ price?: number }>
        type?: string
        [k: string]: unknown
      }

  const groupExtractedItemsByCategory = (
    result: Stage1ExtractionResult | Stage2ExtractionResult
  ) => {
    const map: Record<string, AnyItem[]> = {}

    const visitCategory = (cat: any) => {
      const catName = cat?.name || 'Uncategorized'
      const items: AnyItem[] = Array.isArray(cat?.items) ? cat.items : []
      if (!map[catName]) map[catName] = []
      for (const it of items) {
        map[catName].push(it)
      }
      const subs = Array.isArray(cat?.subcategories) ? cat.subcategories : []
      for (const sub of subs) visitCategory(sub)
    }

    const categories = (result as any)?.menu?.categories || []
    for (const c of categories) visitCategory(c)
    return map
  }

  // Loading state if neither demo nor auth results are present
  if (!demoMenu && !authResult) {
    return (
      <UXSection 
        title="Loading..."
        subtitle="Loading your extracted menu items"
      >
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ux-primary"></div>
        </div>
      </UXSection>
    )
  }

  // Compute grouping and totals depending on flow
  const isDemo = !!demoMenu
  const itemsByCategory: Record<string, AnyItem[] | MenuItem[]> = isDemo
    ? groupDemoItemsByCategory(demoMenu as Menu)
    : groupExtractedItemsByCategory(authResult as Stage1ExtractionResult | Stage2ExtractionResult)

  const categories = Object.keys(itemsByCategory)
  const totalItems = categories.reduce((sum, c) => sum + (itemsByCategory[c]?.length || 0), 0)

  return (
    <UXSection>
      {/* Page heading styled like the sample page */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
          Review Extracted Items
        </h1>
        <p className="mt-2 text-white/90 text-hero-shadow-strong">
          We found {totalItems} items across {categories.length} categories
        </p>
      </div>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Summary Card */}
        <UXCard>
          <MenuThumbnailBadge imageUrl={thumbnailUrl} position="right" />
          <div className="p-6 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-ux-text">
                {isDemo ? (demoMenu as Menu).name : 'Extracted Menu'}
              </h3>
              <div className="flex items-center space-x-4 text-sm text-ux-text-secondary">
                <span>{totalItems} items</span>
                <span>{categories.length} {categories.length === 1 ? 'category' : 'categories'}</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-ux-success/10 text-ux-success">
                  <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  95% confidence
                </span>
              </div>
            </div>
            <p className="text-ux-text">
              Please review the extracted items below. All items look good and are ready for template selection.
            </p>
          </div>
        </UXCard>

        {/* Extracted Items by Category */}
        <div className="space-y-6">
          {categories.map((category) => (
            <UXCard key={category}>
              <div className="p-6">
                <h4 className="text-lg font-semibold text-ux-text mb-4 border-b-2 border-ux-border pb-2">
                  {category}
                </h4>
                <div className="space-y-3">
                  {itemsByCategory[category].map((item: any) => (
                    <div 
                      key={(item as any).id || `${category}:${(item as any).name}`}
                      className="flex items-start justify-between p-3 bg-ux-background rounded-lg border border-ux-border"
                    >
                      <div className="flex-1">
                        <h5 className="font-medium text-ux-text">
                          {item.name}
                        </h5>
                        {item.description && (
                          <p className="text-sm text-ux-text-secondary mt-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="ml-4 text-right">
                        <div className="font-semibold text-ux-text">
                          {typeof item.price === 'number'
                            ? formatCurrency(item.price)
                            : Array.isArray(item.variants) && item.variants.length > 0 && typeof item.variants[0]?.price === 'number'
                              ? formatCurrency(item.variants[0].price as number)
                              : '—'}
                        </div>
                        <div className="text-xs text-ux-text-secondary">
                          {Math.round(((item.confidence as number | undefined) || 0.95) * 100)}% confidence
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </UXCard>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <UXButton
            variant="outline"
            size="lg"
            className="bg-white/20 border-white/40 text-white hover:bg-white/30"
            onClick={handleBackToExtraction}
            disabled={loading}
          >
            ← Back to Extraction
          </UXButton>
          
          <UXButton
            variant="primary"
            size="lg"
            onClick={handleProceedToTemplate}
            loading={loading}
            disabled={loading}
          >
            Proceed to Image Generation and GridMenu layout →
          </UXButton>
        </div>

        {/* Demo Notice */}
        {isDemo && (
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-lg bg-ux-primary/10 text-ux-primary text-sm">
              <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              This is a demo with sample data. Sign up to process your own menus!
            </div>
          </div>
        )}
      </div>
    </UXSection>
  )
}