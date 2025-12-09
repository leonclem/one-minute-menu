'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { UXSection, UXButton, UXCard } from '@/components/ux'
import { MenuThumbnailBadge } from '@/components/ux/MenuThumbnailBadge'
import { useToast } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import type { Menu, MenuItem } from '@/types'
import type { ExtractionResultType as Stage1ExtractionResult } from '@/lib/extraction/schema-stage1'
import type { ExtractionResultV2Type as Stage2ExtractionResult } from '@/lib/extraction/schema-stage2'
import { ImageUp, Sparkles, QrCode, Pencil } from 'lucide-react'
import AIImageGeneration from '@/components/AIImageGeneration'
import BatchAIImageGeneration from '@/components/BatchAIImageGeneration'
import ImageVariationsManager from '@/components/ImageVariationsManager'
import ZoomableImageModal from '@/components/ZoomableImageModal'
import ImageUpload from '@/components/ImageUpload'

interface UXMenuExtractedClientProps {
  menuId: string
}

export default function UXMenuExtractedClient({ menuId }: UXMenuExtractedClientProps) {
  const [demoMenu, setDemoMenu] = useState<Menu | null>(null)
  const [authResult, setAuthResult] = useState<Stage1ExtractionResult | Stage2ExtractionResult | null>(null)
  const [authMenu, setAuthMenu] = useState<Menu | null>(null)
  const [loading, setLoading] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set())
  const [controlPanelOpen, setControlPanelOpen] = useState(true)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [activeImageItemId, setActiveImageItemId] = useState<string | null>(null)
  const [activeImageItemName, setActiveImageItemName] = useState<string | undefined>(undefined)
  const [activeImageMode, setActiveImageMode] = useState<'generate' | 'manage'>('generate')
  const [showBatchGeneration, setShowBatchGeneration] = useState(false)
  const [demoGenerating, setDemoGenerating] = useState(false)
  const [previewImage, setPreviewImage] = useState<{ url: string; alt: string } | null>(null)
  const [editingMenuName, setEditingMenuName] = useState(false)
  const [menuNameDraft, setMenuNameDraft] = useState('')
  const [showLogoUpload, setShowLogoUpload] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { showToast } = useToast()
  const appliedRef = useRef(false)
  
  // Client-side mount detection for portal
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Demo image assets
  const DEMO_IMAGES = {
    breakfast: {
      'Breakfast Sandwich': '/ux/sample-menus/generated/breakfast/breakfast-sandwich.webp',
      'Country Tartine': '/ux/sample-menus/generated/breakfast/country-tartine.webp',
      'Eggs Benedict': '/ux/sample-menus/generated/breakfast/eggs-benedict.webp',
      'French Toast': '/ux/sample-menus/generated/breakfast/french-toast.webp',
      'Le Parfait': '/ux/sample-menus/generated/breakfast/le-parfait.webp',
      'Morning Tartine': '/ux/sample-menus/generated/breakfast/morning-tartine.webp',
      'Parisian Omelette': '/ux/sample-menus/generated/breakfast/parisian-omelette.webp',
      'Provençal Eggs': '/ux/sample-menus/generated/breakfast/provencal-eggs.webp',
      'Three Organic Eggs Your Way!': '/ux/sample-menus/generated/breakfast/three-organic-eggs-your-way.webp',
      'Two Soft-Boiled Eggs & \'Mouillettes\'': '/ux/sample-menus/generated/breakfast/two-soft-boiled-eggs-mouillettes.webp'
    },
    fine_dining: {
      'Crispy Duck in Port Cherry Sauce': '/ux/sample-menus/generated/fine-dining/crispy-duck-in-port-cherry-sauce.webp',
      'Grilled Faroe Island Salmon': '/ux/sample-menus/generated/fine-dining/grilled-faroe-island-salmon.webp',
      'House Made Ice Cream': '/ux/sample-menus/generated/fine-dining/house-made-ice-cream.webp',
      'Key Lime Pudding': '/ux/sample-menus/generated/fine-dining/key-lime-pudding.webp',
      'Marinated Local Oyster Mushroom Salad': '/ux/sample-menus/generated/fine-dining/marinated-local-oyster-mushroom-salad.webp',
      'Pan Roasted Duck Breast': '/ux/sample-menus/generated/fine-dining/pan-roasted-duck-breast.webp',
      'Rutabaga and Toasted Hazelnut Soup': '/ux/sample-menus/generated/fine-dining/rutabaga-and-toasted-hazelnut-soup.webp',
      'Tenderloin of Beef Wellington': '/ux/sample-menus/generated/fine-dining/tenderloin-of-beef-wellington.webp',
      'Tres Leches Cake': '/ux/sample-menus/generated/fine-dining/tres-leches-cake.webp'
    }
  }

  useEffect(() => {
    // Check if this is a demo menu
    if (menuId.startsWith('demo-')) {
      const storedDemoMenu = sessionStorage.getItem('demoMenu')
      if (storedDemoMenu) {
        try {
          const parsedMenu = JSON.parse(storedDemoMenu)
          setDemoMenu(parsedMenu)
          setThumbnailUrl(parsedMenu?.imageUrl ?? null)
          setLogoUrl(parsedMenu?.logoUrl ?? null)
        } catch (error) {
          console.error('Error parsing demo menu:', error)
          router.push('/ux/demo/sample')
        }
      } else {
        // No demo menu data found, redirect back to sample selection
        router.push('/ux/demo/sample')
      }
    } else {
      // Handle authenticated user menu
      // First, try to load the menu from the database to check if it has extracted data
      let cancelled = false

      ;(async () => {
        const loadMenuFromDatabase = async () => {
          try {
            const menuResp = await fetch(`/api/menus/${menuId}`)
            const menuJson = await menuResp.json()
            
            if (!menuResp.ok) {
              throw new Error(menuJson?.error || 'Failed to load menu')
            }
            
            const loadedMenu = menuJson.data as Menu
            
            // Check if menu has extracted data (items or extractionMetadata)
            console.log('[Extracted Page] Loaded menu from database:', {
              menuId: loadedMenu.id,
              itemsCount: loadedMenu.items?.length || 0,
              hasExtractionMetadata: !!loadedMenu.extractionMetadata,
              items: loadedMenu.items
            })
            
            if ((loadedMenu.items && loadedMenu.items.length > 0) || loadedMenu.extractionMetadata) {
              // Menu already has extracted data, use it directly
              console.log('[Extracted Page] Menu has existing data, using it')
              setAuthMenu(loadedMenu)
              setThumbnailUrl(loadedMenu.imageUrl ?? null)
              setLogoUrl(loadedMenu.logoUrl ?? null)
              return true
            }
            
            return false
          } catch (err) {
            console.error('Failed to load menu from database:', err)
            return false
          }
        }

        // Try loading from database first
        const hasExistingData = await loadMenuFromDatabase()
        
        if (hasExistingData) {
          // Menu already has data, no need to check extraction job
          return
        }

        // If no existing data, check for active extraction job in sessionStorage
        const jobId = sessionStorage.getItem(`extractionJob:${menuId}`)
        if (!jobId) {
          // No extraction job and no existing data - redirect to extract
          showToast({
            type: 'info',
            title: 'No menu items found',
            description: 'Please extract items from your menu image first.'
          })
          router.push(`/ux/menus/${menuId}/extract`)
          return
        }

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

                // Apply extraction results to the menu once and get the updated menu items
                if (!appliedRef.current) {
                  appliedRef.current = true
                  try {
                    const applyResp = await fetch(`/api/menus/${menuId}/apply-extraction`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        result: json.data.result,
                        schemaVersion: (json.data.schemaVersion || 'stage2') as 'stage1' | 'stage2',
                        promptVersion: json.data.promptVersion,
                        jobId,
                      }),
                    })
                    const applyJson = await applyResp.json()
                    if (!applyResp.ok) {
                      throw new Error(applyJson?.error || 'Failed to save extracted items to menu')
                    }
                    console.log('[Extracted Page] Applied extraction to menu:', {
                      menuId: applyJson.data?.id,
                      itemsCount: applyJson.data?.items?.length || 0,
                      items: applyJson.data?.items
                    })
                    setAuthMenu(applyJson.data as Menu)
                    setThumbnailUrl(applyJson.data?.imageUrl ?? null)
                    setLogoUrl((applyJson.data as Menu)?.logoUrl ?? null)
                  } catch (err) {
                    console.error('Failed to apply extraction to menu', err)
                    showToast({
                      type: 'error',
                      title: 'Could not save items',
                      description: 'Please try again from the extraction step.',
                    })
                    router.push(`/ux/menus/${menuId}/extract`)
                    return true
                  }
                }
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

        // Poll for completion if needed
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

  const handleDemoGenerateImages = async () => {
    if (!demoMenu) return
    
    setDemoGenerating(true)
    
    // Determine which image set to use based on menu name/content
    const isBreakfast = demoMenu.name.toLowerCase().includes('breakfast')
    const images = isBreakfast ? DEMO_IMAGES.breakfast : DEMO_IMAGES.fine_dining
    
    // Select all items to generate images for
    const itemsToUpdate = [...(demoMenu.items || [])]
    const updatedItems = [...itemsToUpdate]
    
    // Simulate progressive generation
    for (let i = 0; i < itemsToUpdate.length; i++) {
      // Random delay between 800ms and 2000ms to feel organic
      await new Promise(r => setTimeout(r, 800 + Math.random() * 1200))
      
      const item = itemsToUpdate[i]
      // Look up specific image for this item
      // @ts-ignore - we know the keys exist for demo data
      const imageUrl = images[item.name]
      
      if (imageUrl) {
        updatedItems[i] = {
          ...item,
          customImageUrl: imageUrl,
          imageSource: 'ai'
        }
        
        // Update state incrementally to show progress
        const inProgressMenu = {
          ...demoMenu,
          items: [...updatedItems]
        }
        setDemoMenu(inProgressMenu)
        // Update session storage so it persists
        sessionStorage.setItem('demoMenu', JSON.stringify(inProgressMenu))
      }
    }
    
    setDemoGenerating(false)
    showToast({
      type: 'success',
      title: 'Images Generated',
      description: 'AI has created photos for your menu items.'
    })
  }

  const handleProceedToTemplate = () => {
    setLoading(true)
    
    // Navigate to template selection
    router.push(`/ux/menus/${menuId}/template`)
  }

  const handleBackToExtraction = () => {
    router.push(`/ux/menus/${menuId}/extract`)
  }

  const refreshMenu = async () => {
    try {
      const resp = await fetch(`/api/menus/${menuId}`)
      if (!resp.ok) return
      const json = await resp.json()
      setAuthMenu(json?.data as Menu)
      setThumbnailUrl(json?.data?.imageUrl ?? null)
      setLogoUrl(json?.data?.logoUrl ?? null)
    } catch {
      // best-effort refresh
    }
  }

  const handleUpdateMenuName = async () => {
    const newName = menuNameDraft.trim()
    if (!newName || newName === baseMenu?.name) {
      setEditingMenuName(false)
      return
    }

    try {
      const response = await fetch(`/api/menus/${menuId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.error || 'Failed to update menu name')
      }
      setAuthMenu(json.data as Menu)
      setEditingMenuName(false)
      showToast({
        type: 'success',
        title: 'Menu renamed',
        description: undefined,
      })
    } catch (error) {
      console.error('Error updating menu name:', error)
      showToast({
        type: 'error',
        title: 'Update failed',
        description: 'Please try again.',
      })
      setEditingMenuName(false)
    }
  }

  const handleLogoImageSelected = async (file: File, _preview: string) => {
    setUploadingLogo(true)
    setLogoUploadError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch(`/api/menus/${menuId}/logo`, {
        method: 'POST',
        body: formData,
      })
      const json = await response.json()
      if (!response.ok) {
        const message =
          json?.error ||
          (json?.code === 'PLAN_LIMIT_EXCEEDED'
            ? 'You have reached your monthly upload limit.'
            : 'Failed to upload logo. Please try again.')
        setLogoUploadError(message)
        showToast({
          type: json?.code === 'PLAN_LIMIT_EXCEEDED' ? 'info' : 'error',
          title: 'Logo upload failed',
          description: message,
        })
        return
      }

      const updatedMenu = (json?.data?.menu || json?.data) as Menu
      setAuthMenu(updatedMenu)
      setLogoUrl(updatedMenu.logoUrl ?? json?.data?.logoUrl ?? null)
      showToast({
        type: 'success',
        title: 'Logo added',
        description: 'Your logo will appear on compatible templates.',
      })
      setShowLogoUpload(false)
    } catch (error) {
      console.error('Error uploading logo from extracted page:', error)
      const message = 'Network error while uploading logo. Please try again.'
      setLogoUploadError(message)
      showToast({
        type: 'error',
        title: 'Logo upload failed',
        description: message,
      })
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleAIImageGenerated = async (itemId: string, imageUrl: string) => {
    try {
      const response = await fetch(`/api/menus/${menuId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customImageUrl: imageUrl, imageSource: 'ai' }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.error || 'Failed to update item image')
      }
      setAuthMenu(json.data as Menu)
      showToast({
        type: 'success',
        title: 'Photo added',
        description: 'AI-generated image has been added to your menu item.',
      })
    } catch (error) {
      console.error('Error updating item with AI image from UX page:', error)
      showToast({
        type: 'error',
        title: 'Update failed',
        description: 'Please try again.',
      })
    } finally {
      setActiveImageItemId(null)
    }
  }

  // Helper: compute items grouped by category for menus
  const groupDemoItemsByCategory = (menu: Menu | { items?: MenuItem[] }) => {
    const items: MenuItem[] = Array.isArray((menu as any).items)
      ? ((menu as any).items as MenuItem[])
      : []

    return items.reduce((acc, item) => {
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

  // Loading state if neither demo nor authenticated menu are present
  if (!demoMenu && !authMenu) {
    return (
      <UXSection>
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Loading...
          </h1>
          <p className="mt-2 text-white/90 text-hero-shadow-strong">
            Loading your extracted menu items
          </p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ux-primary"></div>
        </div>
      </UXSection>
    )
  }

  // Compute grouping and totals depending on flow
  const isDemo = !!demoMenu
  const baseMenu: Menu | null = isDemo ? (demoMenu as Menu) : authMenu

  let itemsByCategory: Record<string, AnyItem[] | MenuItem[]> = {}

  if (isDemo && baseMenu) {
    itemsByCategory = groupDemoItemsByCategory(baseMenu)
  } else if (!isDemo) {
    if (authMenu && Array.isArray((authMenu as any).items) && (authMenu as any).items.length > 0) {
      itemsByCategory = groupDemoItemsByCategory(authMenu as Menu)
    } else if (authResult) {
      // Fallback: derive items directly from extraction result if menu items are not yet available
      itemsByCategory = groupExtractedItemsByCategory(authResult)
    }
  }

  const categories = Object.keys(itemsByCategory)
  const totalItems = categories.reduce((sum, c) => sum + (itemsByCategory[c]?.length || 0), 0)
  
  // Debug logging
  console.log('[Extracted Page Debug]', {
    isDemo,
    hasAuthMenu: !!authMenu,
    hasAuthResult: !!authResult,
    authMenuItems: authMenu?.items?.length || 0,
    categories: categories.length,
    totalItems,
    itemsByCategory: Object.keys(itemsByCategory).map(cat => ({
      category: cat,
      itemCount: itemsByCategory[cat]?.length || 0
    }))
  })

  // Compute an overall confidence indicator based on per-item confidences,
  // using the same default (0.95) we show in the item list when confidence is missing.
  let confidenceTotal = 0
  let confidenceCount = 0
  for (const category of categories) {
    for (const item of itemsByCategory[category] as AnyItem[] | MenuItem[]) {
      const conf = (item as any).confidence as number | undefined
      const value = typeof conf === 'number' && isFinite(conf) ? conf : 0.95
      confidenceTotal += value
      confidenceCount += 1
    }
  }
  const overallConfidence = confidenceCount > 0
    ? Math.round((confidenceTotal / confidenceCount) * 100)
    : 95

  const selectedCount = selectedItemKeys.size

  const makeItemKey = (category: string, item: AnyItem | MenuItem, index: number) => {
    const rawId = (item as any).id as string | undefined
    const name = (item as any).name as string | undefined
    return rawId || `${category}:${name || 'item'}:${index}`
  }

  const toggleItemSelected = (key: string, selected: boolean) => {
    setSelectedItemKeys(prev => {
      const next = new Set(prev)
      if (selected) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
  }

  const handleToggleSelectAll = () => {
    // If all items are already selected, deselect all
    if (selectedCount === totalItems && totalItems > 0) {
      setSelectedItemKeys(new Set())
      return
    }

    // Otherwise select all
    const newSelected = new Set<string>()
    categories.forEach((category) => {
      const items = itemsByCategory[category]
      if (Array.isArray(items)) {
        items.forEach((item, index) => {
          newSelected.add(makeItemKey(category, item, index))
        })
      }
    })
    setSelectedItemKeys(newSelected)
  }

  return (
    <UXSection>
      {/* Page heading styled like the sample page */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
          Review Extracted Items
        </h1>
        <p className="mt-2 text-white/90 text-hero-shadow-strong">
          We found {totalItems} items across {categories.length} {categories.length === 1 ? 'category' : 'categories'}
        </p>
      </div>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Summary Card */}
        <UXCard>
          <MenuThumbnailBadge imageUrl={thumbnailUrl} position="right" />
          <div className="p-6 relative z-10">
            <div className="mb-4">
              {editingMenuName && !isDemo ? (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-1.5 text-lg font-semibold bg-ux-background border border-ux-border rounded-lg text-ux-text focus:outline-none focus:ring-2 focus:ring-ux-primary"
                    value={menuNameDraft}
                    onChange={(e) => setMenuNameDraft(e.target.value)}
                    onBlur={handleUpdateMenuName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateMenuName()
                      if (e.key === 'Escape') {
                        setEditingMenuName(false)
                        setMenuNameDraft(baseMenu?.name || '')
                      }
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="group inline-flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-ux-text">
                    {baseMenu?.name || 'Extracted Menu'}
                  </h3>
                  {!isDemo && (
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-ux-text-secondary hover:text-ux-primary p-1 rounded"
                      onClick={() => {
                        setMenuNameDraft(baseMenu?.name || '')
                        setEditingMenuName(true)
                      }}
                      aria-label="Edit menu name"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ux-text-secondary">
                <span>{totalItems} items</span>
                <span>{categories.length} {categories.length === 1 ? 'category' : 'categories'}</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-ux-success/10 text-ux-success">
                  <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {overallConfidence}% confidence
                </span>
              </div>
            </div>
            <p className="text-ux-text">
              Please review the extracted items below. All items look good and are ready for template selection.
            </p>
          </div>
        </UXCard>

        {/* Control Panel – authenticated menus only */}
        {(!isDemo || isDemo) && (
          <UXCard>
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-ux-text">
                    Menu control panel
                  </h3>
                  <p className="text-sm text-ux-text-secondary mt-1">
                    {isDemo 
                      ? 'Try out our AI image generation tools. In the full version, you can customize styles and regenerate images until they are perfect.'
                      : 'Shortcuts to update your menu image or open the full editor for batch photos, item tools, and QR codes.'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <p className="text-xs text-ux-text-secondary">
                      {selectedCount > 0
                        ? `${selectedCount} item${selectedCount === 1 ? '' : 's'} selected.`
                        : 'No items selected yet.'}
                    </p>
                    {!isDemo && totalItems > 0 && (
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-xs font-medium text-ux-primary hover:text-ux-primary/80 transition-colors flex items-center gap-1.5"
                        aria-label={selectedCount === totalItems ? "Deselect all items" : "Select all items"}
                      >
                        {selectedCount === totalItems ? (
                          <>
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-[3px] bg-ux-primary text-white">
                              <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </span>
                            Deselect all
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-[3px] border border-ux-primary/50"></span>
                            Select all
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-primary transition-colors mt-1"
                  onClick={() => setControlPanelOpen(open => !open)}
                  aria-expanded={controlPanelOpen}
                  aria-label={controlPanelOpen ? 'Collapse control panel' : 'Expand control panel'}
                >
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${controlPanelOpen ? '' : '-rotate-90'}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M7 5a1 1 0 00-.707 1.707L9.586 10l-3.293 3.293A1 1 0 108.707 14.707l4-4a1 1 0 000-1.414l-4-4A1 1 0 007 5z" />
                  </svg>
                </button>
              </div>

              {controlPanelOpen && (
                <>
                      {isDemo ? (
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                          <UXButton
                            variant="warning"
                            size="md"
                            onClick={handleDemoGenerateImages}
                            disabled={demoGenerating || (demoMenu?.items?.some(i => i.customImageUrl) ?? false)}
                            className="w-full sm:w-auto"
                          >
                            {demoGenerating ? (
                              <>
                                <div className="animate-spin mr-2 h-4 w-4 border-b-2 border-white"></div>
                                Generating Photos...
                              </>
                            ) : (demoMenu?.items?.some(i => i.customImageUrl) ? (
                              <>
                                <Sparkles className="hidden sm:inline-block h-4 w-4 mr-2" />
                                Photos Generated
                              </>
                            ) : (
                              <>
                                <Sparkles className="hidden sm:inline-block h-4 w-4 mr-2" />
                                Auto-Generate Photos (Demo)
                              </>
                            ))}
                          </UXButton>
                          <div className="flex items-center justify-center sm:justify-start text-xs text-ux-text-secondary">
                            <span className="mr-1 not-italic">ℹ️</span> 
                            <span className="italic">Simulates AI generation with sample images</span>
                          </div>
                        </div>
                      ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <UXButton
                          variant="warning"
                          size="md"
                          onClick={() => router.push(`/menus/${menuId}/upload`)}
                          disabled={loading}
                        >
                          <ImageUp className="hidden sm:inline-block h-4 w-4 mr-2" />
                          Upload a menu image
                        </UXButton>
                        {!isDemo && (
                          <UXButton
                            variant="warning"
                            size="md"
                            onClick={() => setShowLogoUpload(true)}
                            disabled={loading}
                          >
                            <ImageUp className="hidden sm:inline-block h-4 w-4 mr-2" />
                            Upload logo
                          </UXButton>
                        )}
                        <UXButton
                          variant="warning"
                          size="md"
                          onClick={() => {
                            if (!authMenu) return
                            const selected = authMenu.items.filter(item => selectedItemKeys.has(item.id))
                            if (selected.length === 0) {
                              showToast({
                                type: 'info',
                                title: 'Select items first',
                                description: 'Choose one or more items to create photos for.',
                              })
                              return
                            }
                            setShowBatchGeneration(true)
                          }}
                          disabled={loading}
                        >
                          <Sparkles className="hidden sm:inline-block h-4 w-4 mr-2" />
                          Batch Create Photos
                        </UXButton>
                        <UXButton
                          variant="warning"
                          size="md"
                          onClick={() => router.push(`/dashboard/menus/${menuId}`)}
                          disabled={loading}
                        >
                          <QrCode className="hidden sm:inline-block h-4 w-4 mr-2" />
                          Add QR / manage items
                        </UXButton>
                      </div>
                      {!isDemo && logoUrl && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-ux-text-secondary">
                          <span>Current logo:</span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={logoUrl}
                            alt={baseMenu?.name || 'Restaurant logo'}
                            className="h-8 w-8 rounded-full border border-ux-border object-cover bg-white"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      )}
                    </>
                  )}
                  {!isDemo && thumbnailUrl && (
                    <p className="text-xs text-ux-text-secondary">
                      You&apos;ve already uploaded a menu image. Uploading a new one will replace the existing image and you may need to re-run extraction.
                    </p>
                  )}
                </>
              )}
            </div>
          </UXCard>
        )}

        {/* Extracted Items by Category */}
        <div className="space-y-6">
          {categories.map((category) => {
            const items = itemsByCategory[category] as (AnyItem | MenuItem)[]
            const selectedInCategory = items.reduce((count, item, index) => {
              const key = makeItemKey(category, item, index)
              return count + (selectedItemKeys.has(key) ? 1 : 0)
            }, 0)
            const isCollapsed = collapsedCategories.has(category)
            return (
              <UXCard key={category}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4 border-b-2 border-ux-border pb-2 gap-3">
                    <h4 className="text-lg font-semibold text-ux-text">
                      {category}
                    </h4>
                    <div className="flex items-center gap-2">
                      {items.length > 0 && (
                        <span className="inline-flex items-center px-3 py-1 rounded-lg bg-ux-primary text-white text-xs font-semibold shadow-sm whitespace-nowrap">
                          {items.length} {items.length === 1 ? 'item' : 'items'}
                          {selectedInCategory > 0 && (
                            <span className="ml-1">
                              · {selectedInCategory} selected
                            </span>
                          )}
                        </span>
                      )}
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-primary transition-colors"
                        onClick={() => {
                          setCollapsedCategories(prev => {
                            const next = new Set(prev)
                            if (next.has(category)) next.delete(category)
                            else next.add(category)
                            return next
                          })
                        }}
                        aria-expanded={!isCollapsed}
                        aria-label={isCollapsed ? `Expand ${category}` : `Collapse ${category}`}
                      >
                        <svg
                          className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M7 5a1 1 0 00-.707 1.707L9.586 10l-3.293 3.293A1 1 0 108.707 14.707l4-4a1 1 0 000-1.414l-4-4A1 1 0 007 5z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className={isCollapsed ? 'hidden' : 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}>
                    {items.map((item, index) => {
                      const key = makeItemKey(category, item, index)
                      const selected = selectedItemKeys.has(key)
                      const raw = item as any
                      const imageSrc =
                        (raw.customImageUrl as string | undefined)
                        || (raw.imageUrl as string | undefined)
                      const hasImage = typeof imageSrc === 'string' && imageSrc.length > 0
                      const price =
                        typeof raw.price === 'number'
                          ? raw.price
                          : Array.isArray(raw.variants) && raw.variants.length > 0 && typeof raw.variants[0]?.price === 'number'
                            ? (raw.variants[0].price as number)
                            : undefined
                      const confidence = Math.round(((raw.confidence as number | undefined) || 0.95) * 100)

                      return (
                        <div
                          key={key}
                          className={`relative flex flex-col justify-between gap-3 p-3 bg-ux-background rounded-lg border border-ux-border transition-shadow h-full ${
                            selected ? 'ring-2 ring-ux-primary/60 shadow-md' : ''
                          }`}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={selected}
                                aria-label={`Select ${raw.name || 'item'}`}
                                onClick={() => toggleItemSelected(key, !selected)}
                                className="mt-1 h-4 w-4 min-h-[1rem] min-w-[1rem] p-0 rounded border border-ux-border flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ux-primary transition-colors shrink-0"
                                style={{
                                  backgroundColor: selected ? 'rgb(var(--ux-primary) / 1)' : 'transparent',
                                }}
                              >
                                {selected && (
                                  <svg
                                    className="h-3 w-3 text-white"
                                    viewBox="0 0 20 20"
                                    fill="none"
                                  >
                                    <path
                                      d="M5 10.5L8 13.5L15 6.5"
                                      stroke="currentColor"
                                      strokeWidth="3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}
                              </button>
                              <h5 className="font-medium text-ux-text leading-tight pt-0.5">
                                {raw.name}
                              </h5>
                            </div>
                            {raw.description && (
                              <p className="text-xs text-ux-text-secondary leading-relaxed line-clamp-3">
                                {raw.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-end gap-3 mt-auto pt-2">
                            <button
                              type="button"
                              className="h-16 w-16 rounded-md border border-dashed border-ux-border bg-ux-background-secondary overflow-hidden flex items-center justify-center text-[11px] text-ux-text-secondary focus:outline-none focus:ring-2 focus:ring-ux-primary"
                              onClick={() => {
                                if (isDemo) {
                                  if (hasImage && typeof imageSrc === 'string') {
                                    setPreviewImage({
                                      url: imageSrc,
                                      alt: (raw.name as string) || 'Menu item photo',
                                    })
                                  }
                                  return
                                }
                                if (!authMenu) return
                                const id = (raw as MenuItem).id
                                if (!id) return
                                setActiveImageItemId(id)
                                setActiveImageItemName(raw.name as string | undefined)
                                setActiveImageMode(hasImage ? 'manage' : 'generate')
                              }}
                              aria-label={hasImage ? `Manage photos for ${raw.name}` : `Create photo for ${raw.name}`}
                              disabled={(!isDemo && !authMenu) || (isDemo && !hasImage)}
                            >
                              {hasImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imageSrc}
                                alt={raw.name || 'Menu item photo'}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              demoGenerating ? (
                                <div className="flex items-center justify-center w-full h-full bg-ux-background-secondary">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-ux-primary"></div>
                                </div>
                              ) : (
                                <span>No photo</span>
                              )
                            )}
                            </button>
                            <div className="flex-1 flex flex-col items-end text-right gap-1">
                              <div className="font-semibold text-ux-text">
                                {typeof price === 'number' ? formatCurrency(price) : '—'}
                              </div>
                              <div className="text-xs text-ux-text-secondary">
                                {confidence}% confidence
                              </div>
                            </div>
                          </div>

                          {/* Action row reserved for future wiring (manage photos, stock, delete) */}
                          {!isDemo && (
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-dashed border-ux-border/60 mt-1">
                              <span className="text-[11px] text-ux-text-secondary">
                                Bulk tools will use your current selection.
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </UXCard>
            )
          })}
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
            Proceed to GridMenu layout →
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

      {/* Single-item AI image generation modal */}
      {!isDemo && activeImageItemId && activeImageMode === 'generate' && authMenu && (
        <AIImageGeneration
          menuId={menuId}
          menuItem={authMenu.items.find(i => i.id === activeImageItemId)!}
          onImageGenerated={handleAIImageGenerated}
          onCancel={() => setActiveImageItemId(null)}
        />
      )}

      {/* Single-item image variations manager */}
      {!isDemo && activeImageItemId && activeImageMode === 'manage' && (
        <ImageVariationsManager
          itemId={activeImageItemId}
          itemName={activeImageItemName}
          onClose={async () => {
            setActiveImageItemId(null)
            await refreshMenu()
          }}
        />
      )}

      {/* Batch image generation modal */}
      {!isDemo && showBatchGeneration && authMenu && (
        <BatchAIImageGeneration
          menuId={menuId}
          items={authMenu.items
            .filter(item => selectedItemKeys.has(item.id))
            .map(item => ({ id: item.id, name: item.name, description: item.description }))}
          onClose={async () => {
            setShowBatchGeneration(false)
            await refreshMenu()
          }}
          onItemImageGenerated={handleAIImageGenerated}
        />
      )}

      {/* Demo thumbnail zoom modal (demo flow only) */}
      {isDemo && previewImage && (
        <ZoomableImageModal
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          url={previewImage.url}
          alt={previewImage.alt}
        />
      )}

      {/* Logo upload modal (authenticated menus only) */}
      {!isDemo && showLogoUpload && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <UXCard>
              <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-ux-border/60">
                <h3 className="text-sm font-semibold text-ux-text">
                  Upload logo
                </h3>
                <button
                  type="button"
                  className="h-7 w-7 flex items-center justify-center rounded-full text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-primary transition-colors"
                  onClick={() => !uploadingLogo && setShowLogoUpload(false)}
                  aria-label="Close logo upload"
                  disabled={uploadingLogo}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 pt-3 space-y-3">
                {logoUploadError && (
                  <div className="p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-800">
                    {logoUploadError}
                  </div>
                )}
                <p className="text-xs text-ux-text-secondary">
                  Upload a small JPEG or PNG logo (up to 8MB). For best results, use a square logo with a transparent or solid background.
                </p>
                <ImageUpload
                  onImageSelected={handleLogoImageSelected}
                  onCancel={() => !uploadingLogo && setShowLogoUpload(false)}
                  noWrapper={true}
                />
                {logoUrl && (
                  <div className="flex items-center gap-3 pt-2 border-t border-dashed border-ux-border/60">
                    <span className="text-xs text-ux-text-secondary">
                      Current logo preview:
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt={baseMenu?.name || 'Restaurant logo'}
                      className="h-9 w-9 rounded-full border border-ux-border object-cover bg-white"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
              </div>
            </UXCard>
          </div>
        </div>,
        document.body
      )}
    </UXSection>
  )
}