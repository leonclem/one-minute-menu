'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { UXSection, UXButton, UXCard } from '@/components/ux'
import { useToast } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import type { Menu, MenuItem, MenuCategory } from '@/types'
import type { ExtractionResultType as Stage1ExtractionResult } from '@/lib/extraction/schema-stage1'
import type { ExtractionResultV2Type as Stage2ExtractionResult } from '@/lib/extraction/schema-stage2'
import { ImageUp, Sparkles, QrCode, Pencil } from 'lucide-react'
import AIImageGeneration from '@/components/AIImageGeneration'
import BatchAIImageGeneration from '@/components/BatchAIImageGeneration'
import ItemManagementModal from '@/components/ItemManagementModal'
import ZoomableImageModal from '@/components/ZoomableImageModal'
import ImageUpload from '@/components/ImageUpload'
import MenuItemActionsModal from '@/components/MenuItemActionsModal'
import BulkDeleteModal from '@/components/BulkDeleteModal'

// Constants for category management
const DEFAULT_CATEGORY = 'Uncategorized'

// Helper function to normalize category names
const normalizeCategory = (category: string | null | undefined): string => {
  return category && category.trim() ? category.trim() : DEFAULT_CATEGORY
}

interface UXMenuExtractedClientProps {
  menuId: string
}

export default function UXMenuExtractedClient({ menuId }: UXMenuExtractedClientProps) {
  const [demoMenu, setDemoMenu] = useState<Menu | null>(null)
  const [authResult, setAuthResult] = useState<Stage1ExtractionResult | Stage2ExtractionResult | null>(null)
  const [authMenu, setAuthMenu] = useState<Menu | null>(null)
  const [loading, setLoading] = useState(false)
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
  const [removingLogo, setRemovingLogo] = useState(false)
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  
  // Category management states
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showAddItem, setShowAddItem] = useState<string | null>(null) // category name
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [categoryNameDraft, setCategoryNameDraft] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [emptyCategories, setEmptyCategories] = useState<Set<string>>(() => new Set())
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null) // category name to delete
  const [newItemData, setNewItemData] = useState({
    name: '',
    description: '',
    price: '',
    available: true
  })
  const [showEditItem, setShowEditItem] = useState<MenuItem | null>(null)
  const [editItemData, setEditItemData] = useState({
    name: '',
    description: '',
    price: '',
    available: true
  })
  
  // Menu item actions states
  const [activeMenuItem, setActiveMenuItem] = useState<MenuItem | null>(null)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isManualEntry = searchParams.get('manual') === 'true'
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
      'Breakfast Sandwich': '/sample-menus/generated/breakfast/breakfast-sandwich.webp',
      'Country Tartine': '/sample-menus/generated/breakfast/country-tartine.webp',
      'Eggs Benedict': '/sample-menus/generated/breakfast/eggs-benedict.webp',
      'French Toast': '/sample-menus/generated/breakfast/french-toast.webp',
      'Le Parfait': '/sample-menus/generated/breakfast/le-parfait.webp',
      'Morning Tartine': '/sample-menus/generated/breakfast/morning-tartine.webp',
      'Parisian Omelette': '/sample-menus/generated/breakfast/parisian-omelette.webp',
      'Provençal Eggs': '/sample-menus/generated/breakfast/provencal-eggs.webp',
      'Three Organic Eggs Your Way!': '/sample-menus/generated/breakfast/three-organic-eggs-your-way.webp',
      'Two Soft-Boiled Eggs & \'Mouillettes\'': '/sample-menus/generated/breakfast/two-soft-boiled-eggs-mouillettes.webp'
    },
    fine_dining: {
      'Crispy Duck in Port Cherry Sauce': '/sample-menus/generated/fine-dining/crispy-duck-in-port-cherry-sauce.webp',
      'Grilled Faroe Island Salmon': '/sample-menus/generated/fine-dining/grilled-faroe-island-salmon.webp',
      'House Made Ice Cream': '/sample-menus/generated/fine-dining/house-made-ice-cream.webp',
      'Key Lime Pudding': '/sample-menus/generated/fine-dining/key-lime-pudding.webp',
      'Marinated Local Oyster Mushroom Salad': '/sample-menus/generated/fine-dining/marinated-local-oyster-mushroom-salad.webp',
      'Pan Roasted Duck Breast': '/sample-menus/generated/fine-dining/pan-roasted-duck-breast.webp',
      'Rutabaga and Toasted Hazelnut Soup': '/sample-menus/generated/fine-dining/rutabaga-and-toasted-hazelnut-soup.webp',
      'Tenderloin of Beef Wellington': '/sample-menus/generated/fine-dining/tenderloin-of-beef-wellington.webp',
      'Tres Leches Cake': '/sample-menus/generated/fine-dining/tres-leches-cake.webp'
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
          setLogoUrl(parsedMenu?.logoUrl ?? null)
        } catch (error) {
          console.error('Error parsing demo menu:', error)
          router.push('/demo/sample')
        }
      } else {
        // No demo menu data found, redirect back to sample selection
        router.push('/demo/sample')
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
            
            // Always set authMenu if we successfully loaded it from the database
            setAuthMenu(loadedMenu)
            setLogoUrl(loadedMenu.logoUrl ?? null)
            
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
          // If we're intentionally entering items manually, don't redirect
          if (isManualEntry) {
            console.log('[Extracted Page] Manual entry mode - staying on page despite no items')
            return
          }

          // No extraction job and no existing data - redirect to extract
          showToast({
            type: 'info',
            title: 'No menu items found',
            description: 'Please extract items from your menu image first.'
          })
          router.push(`/menus/${menuId}/extract`)
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
                    setLogoUrl((applyJson.data as Menu)?.logoUrl ?? null)
                  } catch (err) {
                    console.error('Failed to apply extraction to menu', err)
                    showToast({
                      type: 'error',
                      title: 'Could not save items',
                      description: 'Please try again from the extraction step.',
                    })
                    router.push(`/menus/${menuId}/extract`)
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
              router.push(`/menus/${menuId}/extract`)
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
            router.push(`/menus/${menuId}/extract`)
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
  }, [menuId, router, showToast, isManualEntry])

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
    router.push(`/menus/${menuId}/template`)
  }

  const handleBackToExtraction = () => {
    router.push(`/menus/${menuId}/extract`)
  }

  const refreshMenu = async () => {
    try {
      console.log('Refreshing menu data...')
      const resp = await fetch(`/api/menus/${menuId}`)
      if (!resp.ok) return
      const json = await resp.json()
      console.log('Menu refresh response:', json?.data)
      console.log('Menu items with images:', json?.data?.items?.map((item: any) => ({
        id: item.id,
        name: item.name,
        customImageUrl: item.customImageUrl,
        imageUrl: item.imageUrl,
        aiImageId: item.aiImageId,
        imageSource: item.imageSource
      })))
      setAuthMenu(json?.data as Menu)
      setLogoUrl(json?.data?.logoUrl ?? null)
    } catch (error) {
      console.error('Error refreshing menu:', error)
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

  const handleAddCategory = () => {
    const normalizedCategoryName = normalizeCategory(newCategoryName)
    if (normalizedCategoryName === DEFAULT_CATEGORY) {
      showToast({
        type: 'error',
        title: 'Invalid category name',
        description: 'Please enter a valid category name.',
      })
      return
    }

    try {
      // Check if category already exists
      const currentCategories = Object.keys(itemsByCategory || {})
      const existingEmptyCategories = Array.from(emptyCategories || new Set())
      
      if (currentCategories.includes(normalizedCategoryName) || existingEmptyCategories.includes(normalizedCategoryName)) {
        showToast({
          type: 'error',
          title: 'Category exists',
          description: `Category "${normalizedCategoryName}" already exists.`,
        })
        return
      }

      // Close modal and clear input
      setNewCategoryName('')
      setShowAddCategory(false)
      
      // Add to empty categories using a simple state update
      setEmptyCategories(prevSet => {
        if (prevSet.has(normalizedCategoryName)) return prevSet // Already exists
        const newSet = new Set(prevSet)
        newSet.add(normalizedCategoryName)
        return newSet
      })
      
      // Show success message
      setTimeout(() => {
        showToast({
          type: 'success',
          title: 'Category created',
          description: `"${normalizedCategoryName}" category has been created.`,
        })
      }, 100)
      
    } catch (error) {
      console.error('Error adding category:', error)
      showToast({
        type: 'error',
        title: 'Failed to create category',
        description: 'Please try again.',
      })
    }
  }

  const handleEditCategoryName = async (oldName: string, newName: string) => {
    const normalizedNewName = normalizeCategory(newName)
    
    if (normalizedNewName === oldName) {
      setEditingCategory(null)
      return
    }

    // Prevent renaming to the default category if it already exists
    if (normalizedNewName === DEFAULT_CATEGORY && oldName !== DEFAULT_CATEGORY) {
      const hasUncategorizedItems = categories.includes(DEFAULT_CATEGORY)
      if (hasUncategorizedItems) {
        showToast({
          type: 'error',
          title: 'Category name conflict',
          description: `Cannot rename to "${DEFAULT_CATEGORY}" as it already exists.`,
        })
        setEditingCategory(null)
        return
      }
    }

    try {
      // Update all items in this category to use the new category name
      // Find items that belong to this category (including those with empty/null categories if oldName is DEFAULT_CATEGORY)
      const itemsInCategory = authMenu?.items.filter(item => {
        const normalizedItemCategory = normalizeCategory(item.category)
        return normalizedItemCategory === oldName
      }) || []
      
      console.log('Renaming category:', { oldName, newName, itemsCount: itemsInCategory.length })
      
      if (itemsInCategory.length === 0) {
        // Handle empty category rename
        setEmptyCategories(prev => {
          const newSet = new Set(Array.from(prev))
          newSet.delete(oldName)
          newSet.add(normalizeCategory(newName))
          return newSet
        })
        setEditingCategory(null)
        showToast({
          type: 'success',
          title: 'Category renamed',
          description: `Category renamed from "${oldName}" to "${normalizedNewName}".`,
        })
        return
      }
      
      for (const item of itemsInCategory) {
        console.log('Updating item:', item.id, 'from category:', oldName, 'to:', newName.trim())
        const response = await fetch(`/api/menus/${menuId}/items/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: normalizeCategory(newName) }),
        })
        
        if (!response.ok) {
          const error = await response.json()
          console.error('API Error:', error)
          throw new Error(error.error || 'Failed to update category name')
        }
        
        const result = await response.json()
        console.log('Update result:', result)
      }

      await refreshMenu()
      setEditingCategory(null)
      
      showToast({
        type: 'success',
        title: 'Category renamed',
        description: `Category renamed from "${oldName}" to "${normalizedNewName}".`,
      })
    } catch (error) {
      console.error('Error renaming category:', error)
      showToast({
        type: 'error',
        title: 'Failed to rename category',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
      setEditingCategory(null)
    }
  }

  const handleDeleteCategory = async (categoryName: string) => {
    if (!categoryName || categoryName === DEFAULT_CATEGORY) {
      showToast({
        type: 'error',
        title: 'Cannot delete category',
        description: `The "${DEFAULT_CATEGORY}" category cannot be deleted.`,
      })
      return
    }

    try {
      // Find items that belong to this category
      const itemsInCategory = authMenu?.items.filter(item => {
        const normalizedItemCategory = normalizeCategory(item.category)
        return normalizedItemCategory === categoryName
      }) || []

      console.log('Deleting category:', { categoryName, itemsCount: itemsInCategory.length })

      if (itemsInCategory.length === 0) {
        // Handle empty category deletion - just remove from emptyCategories
        setEmptyCategories(prev => {
          const newSet = new Set(Array.from(prev))
          newSet.delete(categoryName)
          return newSet
        })
        setDeletingCategory(null)
        showToast({
          type: 'success',
          title: 'Category deleted',
          description: `"${categoryName}" category has been deleted.`,
        })
        return
      }

      // Delete all items in this category
      for (const item of itemsInCategory) {
        console.log('Deleting item:', item.id, item.name)
        const response = await fetch(`/api/menus/${menuId}/items/${item.id}`, {
          method: 'DELETE',
        })
        
        if (!response.ok) {
          const error = await response.json()
          console.error('API Error deleting item:', error)
          throw new Error(error.error || `Failed to delete item "${item.name}"`)
        }
      }

      await refreshMenu()
      setDeletingCategory(null)
      
      showToast({
        type: 'success',
        title: 'Category deleted',
        description: `"${categoryName}" and ${itemsInCategory.length} item${itemsInCategory.length === 1 ? '' : 's'} deleted.`,
      })
    } catch (error) {
      console.error('Error deleting category:', error)
      showToast({
        type: 'error',
        title: 'Failed to delete category',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
      setDeletingCategory(null)
    }
  }

  const handleAddItemToCategory = async (categoryName: string) => {
    const { name, description, price, available } = newItemData
    
    if (!name.trim()) {
      showToast({
        type: 'error',
        title: 'Item name required',
        description: 'Please enter a name for the menu item.',
      })
      return
    }

    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) {
      showToast({
        type: 'error',
        title: 'Invalid price',
        description: 'Please enter a valid price.',
      })
      return
    }

    try {
      const itemData = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: priceNum,
        category: normalizeCategory(categoryName),
        available,
        imageSource: 'none' as const
      }

      const response = await fetch(`/api/menus/${menuId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add item')
      }

      const result = await response.json()
      const newItem = result.data?.items?.[result.data.items.length - 1] // Get the newly created item
      
      // Remove from empty categories if it was there
      setEmptyCategories(prev => {
        const newSet = new Set(Array.from(prev))
        newSet.delete(categoryName)
        return newSet
      })
      
      await refreshMenu()
      setNewItemData({ name: '', description: '', price: '', available: true })
      setShowAddItem(null)
      
      showToast({
        type: 'success',
        title: 'Item added',
        description: `"${name}" has been added to ${categoryName}.`,
      })
    } catch (error) {
      console.error('Error adding item:', error)
      showToast({
        type: 'error',
        title: 'Failed to add item',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    }
  }

  const handleUpdateItem = async (itemId: string) => {
    const { name, description, price, available } = editItemData
    
    if (!name.trim()) {
      showToast({
        type: 'error',
        title: 'Item name required',
        description: 'Please enter a name for the menu item.',
      })
      return
    }

    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) {
      showToast({
        type: 'error',
        title: 'Invalid price',
        description: 'Please enter a valid price.',
      })
      return
    }

    try {
      const response = await fetch(`/api/menus/${menuId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          price: priceNum,
          available
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update item')
      }

      await refreshMenu()
      setShowEditItem(null)
      
      showToast({
        type: 'success',
        title: 'Item updated',
        description: `"${name}" has been updated.`,
      })
    } catch (error) {
      console.error('Error updating item:', error)
      showToast({
        type: 'error',
        title: 'Failed to update item',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
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

  const handleRemoveLogo = async () => {
    setRemovingLogo(true)
    setLogoUploadError(null)
    try {
      const response = await fetch(`/api/menus/${menuId}/logo`, {
        method: 'DELETE',
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json?.error || 'Failed to remove logo')
      }

      // The API returns the updated menu in json.data
      const updatedMenu = json.data as Menu
      setAuthMenu(updatedMenu)
      setLogoUrl(null)
      showToast({
        type: 'success',
        title: 'Logo removed',
        description: 'The logo has been removed from your menu.',
      })
      setShowLogoUpload(false)
    } catch (error) {
      console.error('Error removing logo:', error)
      const message = error instanceof Error ? error.message : 'Failed to remove logo. Please try again.'
      setLogoUploadError(message)
      showToast({
        type: 'error',
        title: 'Removal failed',
        description: message,
      })
    } finally {
      setRemovingLogo(false)
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

    const grouped = items.reduce((acc, item) => {
      // Normalize category: empty string, null, or undefined becomes DEFAULT_CATEGORY
      const rawCategory = (item as MenuItem).category
      const category = rawCategory && rawCategory.trim() ? rawCategory.trim() : DEFAULT_CATEGORY
      if (!acc[category]) acc[category] = []
      acc[category].push(item as MenuItem)
      return acc
    }, {} as Record<string, MenuItem[]>)

    // Ensure empty categories are preserved (categories that exist but have no items)
    // This can happen after deleting all items from a category or creating a new empty category
    return grouped
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

  // Compute grouping and totals depending on flow
  const isDemo = !!demoMenu
  const baseMenu: Menu | null = isDemo ? (demoMenu as Menu) : authMenu

  // Compute categories and totals with useMemo to prevent re-computation
  const { itemsByCategory, categories, totalItems, itemsWithImages } = useMemo(() => {
    try {
      let itemsGrouped: Record<string, AnyItem[] | MenuItem[]> = {}

      if (isDemo && baseMenu) {
        itemsGrouped = groupDemoItemsByCategory(baseMenu)
      } else if (!isDemo) {
        if (authMenu && Array.isArray((authMenu as any).items) && (authMenu as any).items.length > 0) {
          itemsGrouped = groupDemoItemsByCategory(authMenu as Menu)
        } else if (authResult) {
          // Fallback: derive items directly from extraction result if menu items are not yet available
          itemsGrouped = groupExtractedItemsByCategory(authResult)
        }
      }

      // Combine categories with items and empty categories
      const categoriesWithItems = Object.keys(itemsGrouped || {})
      const emptyArray = Array.from(emptyCategories)
      const allCategoriesSet = new Set([...categoriesWithItems, ...emptyArray])
      
      // Determine final category list and its order
      let allCategories: string[] = []
      
      if (authMenu?.categories && authMenu.categories.length > 0) {
        // Use stored category order if available
        const sortedStoredCategories = [...authMenu.categories].sort((a, b) => (a.order || 0) - (b.order || 0))
        const storedCategoryNames = sortedStoredCategories.map(c => c.name)
        
        // Include stored categories that still exist in our set
        allCategories = storedCategoryNames.filter(name => allCategoriesSet.has(name))
        
        // Append any new categories that aren't in stored order (e.g. just added)
        const newCategories = Array.from(allCategoriesSet)
          .filter(name => !storedCategoryNames.includes(name))
          .sort()
        
        allCategories = [...allCategories, ...newCategories]
      } else {
        // Default to alphabetical sort if no stored order
        allCategories = Array.from(allCategoriesSet).sort()
      }
      
      const total = categoriesWithItems.reduce((sum, c) => sum + ((itemsGrouped[c] || []).length), 0)
      const withImages = categoriesWithItems.reduce((sum, c) => {
        return sum + (itemsGrouped[c] || []).filter((item: any) => 
          (item.customImageUrl || item.imageUrl || (item.imageSource && item.imageSource !== 'none'))
        ).length
      }, 0)
      
      return {
        itemsByCategory: itemsGrouped,
        categories: allCategories,
        totalItems: total,
        itemsWithImages: withImages
      }
    } catch (error) {
      console.error('Error computing categories:', error)
      return {
        itemsByCategory: {},
        categories: [],
        totalItems: 0,
        itemsWithImages: 0
      }
    }
  }, [isDemo, baseMenu, authMenu, authResult, emptyCategories])

  const handleReorderCategory = async (categoryName: string, direction: 'up' | 'down') => {
    if (isDemo || !authMenu) return

    const currentIndex = categories.indexOf(categoryName)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= categories.length) return

    const newCategoriesOrder = [...categories]
    const [movedCategory] = newCategoriesOrder.splice(currentIndex, 1)
    newCategoriesOrder.splice(newIndex, 0, movedCategory)

    try {
      setLoading(true)
      
      // Prepare updated categories with new order
      const existingCategories = authMenu.categories || []
      const categoryMap = new Map<string, MenuCategory>(existingCategories.map(c => [c.name, c]))
      
      const updatedCategories: MenuCategory[] = newCategoriesOrder.map((name, index) => {
        const existing = categoryMap.get(name)
        // Ensure we use the latest items for this category from our grouped items
        const items = (itemsByCategory[name] || []) as MenuItem[]
        
        return {
          id: existing?.id || crypto.randomUUID(),
          name,
          order: index,
          items: items,
          subcategories: existing?.subcategories,
          confidence: existing?.confidence || 1.0
        }
      })

      // Also update the flat items array to match the new category order
      // This ensures consistent ordering in features that rely on the flat items list
      const updatedItems: MenuItem[] = []
      updatedCategories.forEach(cat => {
        cat.items.forEach(item => {
          updatedItems.push({
            ...item,
            order: updatedItems.length
          })
        })
      })

      // 1. Update categories order via the main menu endpoint
      const menuResponse = await fetch(`/api/menus/${menuId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: authMenu.name, // Include name to pass validation
          categories: updatedCategories 
        }),
      })

      if (!menuResponse.ok) {
        throw new Error('Failed to update category order')
      }

      // 2. Update flat items order via the items reorder endpoint
      // This ensures the flat items list is also consistently ordered
      const itemsResponse = await fetch(`/api/menus/${menuId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: updatedItems.map(i => i.id) }),
      })

      if (!itemsResponse.ok) {
        console.warn('Flat items reorder failed, but categories were updated')
      }

      await refreshMenu()
      showToast({
        type: 'success',
        title: 'Order updated',
        description: `Category order has been saved.`,
      })
    } catch (error) {
      console.error('Error reordering categories:', error)
      showToast({
        type: 'error',
        title: 'Update failed',
        description: 'Could not save category order. Please try again.',
      })
    } finally {
      setLoading(false)
    }
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
  
  // Debug logging
  console.log('[Extracted Page Debug]', {
    isDemo,
    hasAuthMenu: !!authMenu,
    hasAuthResult: !!authResult,
    authMenuItems: authMenu?.items?.length || 0,
    authMenuHasCategories: !!(authMenu?.categories?.length),
    categories: categories.length,
    totalItems,
    itemsByCategory: Object.keys(itemsByCategory).map(cat => ({
      category: cat,
      itemCount: itemsByCategory[cat]?.length || 0
    })),
    authMenuItemsWithCategories: authMenu?.items?.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category
    })) || []
  })

  // Compute an overall confidence indicator based on per-item confidences,
  // using the same default (0.95) we show in the item list when confidence is missing.
  let confidenceTotal = 0
  let confidenceCount = 0
  for (const category of categories) {
    const items = itemsByCategory[category] as AnyItem[] | MenuItem[]
    if (Array.isArray(items)) {
      for (const item of items) {
        const conf = (item as any).confidence as number | undefined
        const value = typeof conf === 'number' && isFinite(conf) ? conf : 0.95
        confidenceTotal += value
        confidenceCount += 1
      }
    }
  }
  const overallConfidence = confidenceCount > 0
    ? Math.round((confidenceTotal / confidenceCount) * 100)
    : 95

  const selectedCount = selectedItemKeys.size

  const makeItemKey = (category: string, item: AnyItem | MenuItem, index: number) => {
    const rawId = (item as any).id as string | undefined
    const name = (item as any).name as string | undefined
    // For authenticated menus, always use the item ID if available
    if (!isDemo && rawId) {
      return rawId
    }
    // For demo or items without IDs, use composite key
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
          {isDemo ? 'Review Extracted Items' : 'Configure Menu Content'}
        </h1>
      </div>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Summary Card */}
        <UXCard>
          <div className="p-6 relative z-10">
            <div className="flex flex-col md:flex-row md:justify-between gap-6">
              <div className="flex-1 min-w-0">
                {logoUrl && (
                  <div className="mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt={baseMenu?.name || 'Restaurant logo'}
                      className="max-h-20 w-auto object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
                
                <div className="mb-4">
                  {editingMenuName && !isDemo ? (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-semibold text-ux-text-secondary">Title:</span>
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
                        <span className="text-ux-text-secondary font-medium mr-1.5">Title:</span>
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
                </div>

                {((!isDemo && authResult) || (isDemo && demoGenerating)) && (
                  <p className="text-ux-text max-w-xl">
                    Please review the extracted items below. All items look good and are ready for template selection.
                  </p>
                )}
              </div>

              {totalItems > 0 && (
                <div className="flex flex-row md:flex-col gap-6 md:gap-4 shrink-0 md:text-right md:border-l md:border-ux-border/40 md:pl-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] md:text-xs text-ux-text-secondary uppercase tracking-wider font-semibold">Total Items</span>
                    <span className="text-base md:text-lg font-bold text-ux-text">{totalItems}</span>
                  </div>
                  <div className="flex flex-col border-l border-ux-border/40 pl-6 md:border-l-0 md:pl-0">
                    <span className="text-[10px] md:text-xs text-ux-text-secondary uppercase tracking-wider font-semibold">Categories</span>
                    <span className="text-base md:text-lg font-bold text-ux-text">{categories.length}</span>
                  </div>
                  <div className="flex flex-col border-l border-ux-border/40 pl-6 md:border-l-0 md:pl-0">
                    <span className="text-[10px] md:text-xs text-ux-text-secondary uppercase tracking-wider font-semibold">Photos</span>
                    <div className="flex items-baseline md:justify-end gap-1">
                      <span className="text-base md:text-lg font-bold text-ux-text">{itemsWithImages}</span>
                      <span className="text-[10px] md:text-xs text-ux-text-secondary">/ {totalItems}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
                        {isDemo && (
                          <UXButton
                            variant="warning"
                            size="md"
                            onClick={() => router.push(`/menus/${menuId}/upload`)}
                            disabled={loading}
                          >
                            <ImageUp className="hidden sm:inline-block h-4 w-4 mr-2" />
                            Upload a menu image
                          </UXButton>
                        )}
                        {!isDemo && (
                          <UXButton
                            variant="warning"
                            size="md"
                            onClick={() => setShowLogoUpload(true)}
                            disabled={loading}
                          >
                            <ImageUp className="hidden sm:inline-block h-4 w-4 mr-2" />
                            {logoUrl ? 'Manage logo' : 'Upload logo'}
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
                          onClick={() => setShowAddCategory(true)}
                          disabled={loading}
                        >
                          <svg className="hidden sm:inline-block h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Category
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
                      {selectedCount > 0 && (
                        <div className="flex justify-end">
                          <UXButton
                            variant="outline"
                            size="md"
                            onClick={() => setShowBulkDelete(true)}
                            disabled={loading}
                            className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                          >
                            <svg className="hidden sm:inline-block h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Selected ({selectedCount})
                          </UXButton>
                        </div>
                      )}
                      <div className="hidden">{/* Close the grid div properly */}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </UXCard>
        )}

        {/* Extracted Items by Category */}
        <div className="space-y-6">
          {(categories || []).map((category) => {
            if (!category) return null
            const items = (itemsByCategory[category] as (AnyItem | MenuItem)[]) || []
            const selectedInCategory = items.reduce((count, item, index) => {
              const key = makeItemKey(category, item, index)
              return count + (selectedItemKeys.has(key) ? 1 : 0)
            }, 0)
            const isCollapsed = collapsedCategories.has(category)
            return (
              <UXCard key={category}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4 border-b-2 border-ux-border pb-2 gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      {/* Category Reorder Controls */}
                      {!isDemo && (
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleReorderCategory(category, 'up')}
                            disabled={loading || categories.indexOf(category) === 0}
                            className="p-0.5 text-ux-text-secondary hover:text-ux-primary disabled:opacity-30 transition-colors"
                            aria-label={`Move ${category} up`}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReorderCategory(category, 'down')}
                            disabled={loading || categories.indexOf(category) === categories.length - 1}
                            className="p-0.5 text-ux-text-secondary hover:text-ux-primary disabled:opacity-30 transition-colors"
                            aria-label={`Move ${category} down`}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-1">
                      {editingCategory === category && !isDemo ? (
                        <input
                          type="text"
                          className="flex-1 px-2 py-1 text-lg font-semibold bg-ux-background border border-ux-border rounded text-ux-text focus:outline-none focus:ring-2 focus:ring-ux-primary"
                          value={categoryNameDraft}
                          onChange={(e) => setCategoryNameDraft(e.target.value)}
                          onBlur={() => handleEditCategoryName(category, categoryNameDraft)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditCategoryName(category, categoryNameDraft)
                            if (e.key === 'Escape') {
                              setEditingCategory(null)
                              setCategoryNameDraft('')
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <div className="group inline-flex items-center gap-2 flex-1">
                          <h4 className="text-lg font-semibold text-ux-text">
                            {category}
                          </h4>
                          {!isDemo && (
                            <>
                              <button
                                type="button"
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-ux-text-secondary hover:text-ux-primary p-1 rounded"
                                onClick={() => {
                                  setCategoryNameDraft(category)
                                  setEditingCategory(category)
                                }}
                                aria-label="Edit category name"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {category !== DEFAULT_CATEGORY && (
                                <button
                                  type="button"
                                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-ux-text-secondary hover:text-red-600 p-1 rounded"
                                  onClick={() => setDeletingCategory(category)}
                                  aria-label="Delete category"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                      {!isDemo && (
                        <button
                          type="button"
                          className="px-2 py-1 text-xs font-medium text-ux-primary hover:text-ux-primary/80 hover:bg-ux-primary/10 rounded transition-colors"
                          onClick={() => setShowAddItem(category)}
                        >
                          + Add Item
                        </button>
                      )}
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
                  <div className={isCollapsed ? 'hidden' : 'space-y-4'}>
                    {items.length === 0 ? (
                      <div className="text-center py-8 text-ux-text-secondary">
                        <p className="text-sm">No items in this category yet.</p>
                        {!isDemo && (
                          <button
                            type="button"
                            className="mt-2 px-3 py-1 text-sm font-medium text-ux-primary hover:text-ux-primary/80 hover:bg-ux-primary/10 rounded transition-colors"
                            onClick={() => setShowAddItem(category)}
                          >
                            + Add First Item
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
                          className={`relative flex flex-col justify-between gap-3 p-3 bg-ux-background rounded-lg border border-ux-border transition-all h-full ${
                            isDemo ? 'cursor-default' : 'cursor-pointer hover:shadow-md'
                          } ${selected ? 'ring-2 ring-ux-primary/60 shadow-md' : ''}`}
                          onClick={() => {
                            if (isDemo) {
                              // For demo, show image preview if available
                              if (hasImage && typeof imageSrc === 'string') {
                                setPreviewImage({
                                  url: imageSrc,
                                  alt: (raw.name as string) || 'Menu item photo',
                                })
                              }
                              return
                            }
                            if (!authMenu) return
                            const menuItem = authMenu.items.find(i => i.id === (raw as MenuItem).id)
                            if (menuItem) {
                              // If item is out of stock, show quick toggle option
                              if (!menuItem.available) {
                                // Quick toggle to make available
                                const toggleAvailability = async () => {
                                  try {
                                    const response = await fetch(`/api/menus/${menuId}/items/${menuItem.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ available: true }),
                                    })
                                    
                                    if (response.ok) {
                                      await refreshMenu()
                                      showToast({
                                        type: 'success',
                                        title: 'Item marked available',
                                        description: `"${menuItem.name}" is now available.`,
                                      })
                                    }
                                  } catch (error) {
                                    console.error('Error updating availability:', error)
                                  }
                                }
                                toggleAvailability()
                                return
                              }
                              setActiveMenuItem(menuItem)
                            }
                          }}
                        >
                          {/* Out of stock overlay */}
                          {!isDemo && authMenu && !(raw as MenuItem).available && (
                            <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center z-10">
                              <div className="text-center text-white">
                                <div className="text-sm font-semibold">Out of Stock</div>
                                <div className="text-xs opacity-90 mt-1">Tap to make available</div>
                              </div>
                            </div>
                          )}
                          <div className="flex flex-col gap-2">
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={selected}
                                aria-label={`Select ${raw.name || 'item'}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleItemSelected(key, !selected)
                                }}
                                className="relative z-20 h-4 w-4 min-h-[1rem] min-w-[1rem] p-0 rounded border border-ux-border flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ux-primary transition-colors shrink-0 mt-0.5"
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
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-ux-text leading-tight">
                                  {raw.name}
                                </h4>
                              </div>
                            </div>
                            {raw.description && (
                              <p className="text-xs text-ux-text-secondary leading-relaxed line-clamp-3 mt-1 pl-6">
                                {raw.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-end gap-3 mt-auto pt-2">
                            <div className="h-16 w-16 rounded-md border border-dashed border-ux-border bg-ux-background-secondary overflow-hidden flex items-center justify-center text-[11px] text-ux-text-secondary">
                              {hasImage ? (
                                <button
                                  type="button"
                                  className="h-full w-full focus:outline-none focus:ring-2 focus:ring-ux-primary rounded-md"
                                  aria-label={`Photos for ${raw.name || 'item'}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (typeof imageSrc === 'string' && imageSrc.length > 0) {
                                      setPreviewImage({
                                        url: imageSrc,
                                        alt: (raw.name as string) || 'Menu item photo',
                                      })
                                    }
                                  }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imageSrc}
                                    alt={raw.name || 'Menu item photo'}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                </button>
                              ) : (
                                demoGenerating ? (
                                  <div className="flex items-center justify-center w-full h-full bg-ux-background-secondary pointer-events-none">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-ux-primary"></div>
                                  </div>
                                ) : (
                                  <span className="pointer-events-none">No photo</span>
                                )
                              )}
                            </div>
                            <div className="flex-1 flex flex-col items-end text-right gap-1">
                              <div className="font-semibold text-ux-text">
                                {typeof price === 'number' ? formatCurrency(price) : '—'}
                              </div>
                            </div>
                          </div>


                        </div>
                      )
                    })}
                      </div>
                    )}
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
            onClick={isDemo ? handleBackToExtraction : () => router.push('/dashboard')}
            disabled={loading}
          >
            {isDemo ? '← Back to Extraction' : '← Back to Dashboard'}
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

      {/* Single-item management modal */}
      {!isDemo && activeImageItemId && activeImageMode === 'manage' && authMenu && (
        <ItemManagementModal
          itemId={activeImageItemId}
          menuId={menuId}
          itemName={authMenu.items.find(i => i.id === activeImageItemId)?.name}
          itemDescription={authMenu.items.find(i => i.id === activeImageItemId)?.description}
          itemCategory={authMenu.items.find(i => i.id === activeImageItemId)?.category}
          onImageSelected={async (itemId, imageUrl) => {
            console.log('🖼️ [Extracted Page] Image selected callback:', { itemId, imageUrl })
            // Immediately refresh the menu to show the new thumbnail
            await new Promise(resolve => setTimeout(resolve, 200))
            await refreshMenu()
            console.log('🖼️ [Extracted Page] Menu refreshed after image selection')
          }}
          onClose={async () => {
            console.log('ItemManagementModal closing, refreshing menu...')
            setActiveImageItemId(null)
            // Small delay to ensure database updates and sync are complete
            await new Promise(resolve => setTimeout(resolve, 500))
            await refreshMenu()
            console.log('Menu refreshed after modal close')
          }}
        />
      )}

      {/* Batch image generation modal */}
      {!isDemo && showBatchGeneration && authMenu && (
        <BatchAIImageGeneration
          menuId={menuId}
          items={authMenu.items
            .filter(item => selectedItemKeys.has(item.id))
            .map(item => ({ 
              id: item.id, 
              name: item.name, 
              description: item.description,
              category: item.category
            }))}
          onClose={async () => {
            setShowBatchGeneration(false)
            setSelectedItemKeys(new Set())
            await refreshMenu()
          }}
          onItemImageGenerated={handleAIImageGenerated}
        />
      )}

      {/* Thumbnail zoom modal */}
      {previewImage && (
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
                  {logoUrl ? 'Manage logo' : 'Upload logo'}
                </h3>
                <button
                  type="button"
                  className="h-7 w-7 flex items-center justify-center rounded-full text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-primary transition-colors"
                  onClick={() => !uploadingLogo && !removingLogo && setShowLogoUpload(false)}
                  aria-label="Close logo upload"
                  disabled={uploadingLogo || removingLogo}
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
                  {logoUrl 
                    ? 'Upload a new logo to swap it, or remove the current one altogether. Best as square JPEG/PNG up to 8MB.' 
                    : 'Upload a small JPEG or PNG logo (up to 8MB). For best results, use a square logo with a transparent or solid background.'}
                </p>
                <div className={(uploadingLogo || removingLogo) ? 'pointer-events-none opacity-60' : ''}>
                  <ImageUpload
                    onImageSelected={handleLogoImageSelected}
                    onCancel={() => !uploadingLogo && !removingLogo && setShowLogoUpload(false)}
                    noWrapper={true}
                    outputFormat="png"
                  />
                </div>
                {logoUrl && (
                  <div className="flex items-center justify-between pt-3 border-t border-dashed border-ux-border/60">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-ux-text-secondary">
                        Current logo:
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoUrl}
                        alt={baseMenu?.name || 'Restaurant logo'}
                        className="h-9 w-9 rounded-full border border-ux-border object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <UXButton
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveLogo}
                      loading={removingLogo}
                      disabled={uploadingLogo}
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 h-8 text-[11px]"
                    >
                      Remove Logo
                    </UXButton>
                  </div>
                )}
              </div>
            </UXCard>
          </div>
        </div>,
        document.body
      )}

      {/* Add Category Modal */}
      {!isDemo && showAddCategory && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md">
            <UXCard>
              <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-ux-border/60">
                <h3 className="text-sm font-semibold text-ux-text">
                  Add New Category
                </h3>
                <button
                  type="button"
                  className="h-7 w-7 flex items-center justify-center rounded-full text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-primary transition-colors"
                  onClick={() => {
                    setShowAddCategory(false)
                    setNewCategoryName('')
                  }}
                  aria-label="Close add category modal"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ux-text mb-2">
                    Category Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-ux-border rounded-lg text-ux-text bg-ux-background focus:outline-none focus:ring-2 focus:ring-ux-primary"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCategory()
                      if (e.key === 'Escape') {
                        setShowAddCategory(false)
                        setNewCategoryName('')
                      }
                    }}
                    placeholder="e.g., Appetizers, Main Courses, Desserts"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <UXButton
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddCategory(false)
                      setNewCategoryName('')
                    }}
                  >
                    Cancel
                  </UXButton>
                  <UXButton
                    variant="primary"
                    size="sm"
                    onClick={handleAddCategory}
                    disabled={!newCategoryName.trim()}
                  >
                    Add Category
                  </UXButton>
                </div>
              </div>
            </UXCard>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Category Confirmation Modal */}
      {!isDemo && deletingCategory && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md">
            <UXCard>
              <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-ux-border/60">
                <h3 className="text-sm font-semibold text-ux-text">
                  Delete Category
                </h3>
                <button
                  type="button"
                  className="h-7 w-7 flex items-center justify-center rounded-full text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-primary transition-colors"
                  onClick={() => setDeletingCategory(null)}
                  aria-label="Close delete category modal"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4">
                {(() => {
                  const itemsInCategory = authMenu?.items.filter(item => {
                    const normalizedItemCategory = normalizeCategory(item.category)
                    return normalizedItemCategory === deletingCategory
                  }) || []
                  
                  return (
                    <>
                      <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-red-800">
                            Warning: This action cannot be undone
                          </h4>
                          <p className="text-sm text-red-700 mt-1">
                            {itemsInCategory.length === 0 
                              ? `The "${deletingCategory}" category will be permanently deleted.`
                              : `Deleting "${deletingCategory}" will permanently delete ${itemsInCategory.length} menu item${itemsInCategory.length === 1 ? '' : 's'}:`
                            }
                          </p>
                        </div>
                      </div>
                      
                      {itemsInCategory.length > 0 && (
                        <div className="max-h-32 overflow-y-auto bg-ux-background-secondary rounded-lg p-3">
                          <ul className="space-y-1">
                            {itemsInCategory.map((item, index) => (
                              <li key={item.id || index} className="text-sm text-ux-text-secondary">
                                • {item.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="flex gap-2 justify-end">
                        <UXButton
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingCategory(null)}
                        >
                          Cancel
                        </UXButton>
                        <UXButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleDeleteCategory(deletingCategory)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Delete {itemsInCategory.length > 0 ? `${itemsInCategory.length} Item${itemsInCategory.length === 1 ? '' : 's'}` : 'Category'}
                        </UXButton>
                      </div>
                    </>
                  )
                })()}
              </div>
            </UXCard>
          </div>
        </div>,
        document.body
      )}

      {/* Menu Item Actions Modal */}
      {!isDemo && activeMenuItem && authMenu && (
        <MenuItemActionsModal
          item={activeMenuItem}
          menuId={menuId}
          availableCategories={categories}
          onClose={() => setActiveMenuItem(null)}
          onItemUpdated={async () => {
            await refreshMenu()
            setSelectedItemKeys(new Set()) // Clear selections after update
          }}
          onManageImages={() => {
            setActiveImageItemId(activeMenuItem.id)
            setActiveImageItemName(activeMenuItem.name)
            setActiveImageMode('manage')
            setActiveMenuItem(null)
          }}
          onEditDetails={() => {
            setEditItemData({
              name: activeMenuItem.name,
              description: activeMenuItem.description || '',
              price: activeMenuItem.price?.toString() || '',
              available: activeMenuItem.available
            })
            setShowEditItem(activeMenuItem)
            setActiveMenuItem(null)
          }}
        />
      )}

      {/* Bulk Delete Modal */}
      {!isDemo && showBulkDelete && authMenu && (
        <BulkDeleteModal
          itemCount={selectedCount}
          menuId={menuId}
          selectedItemIds={Array.from(selectedItemKeys).filter(key => {
            // For authenticated menus, keys should be item IDs directly
            return authMenu.items.some(item => item.id === key)
          })}
          onClose={() => setShowBulkDelete(false)}
          onItemsDeleted={async () => {
            await refreshMenu()
            setSelectedItemKeys(new Set()) // Clear selections after deletion
          }}
        />
      )}

      {/* Add Item Modal */}
      {!isDemo && showAddItem && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md">
            <UXCard>
              <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-ux-border/60">
                <h3 className="text-sm font-semibold text-ux-text">
                  Add Item to {showAddItem}
                </h3>
                <button
                  type="button"
                  className="h-7 w-7 flex items-center justify-center rounded-full text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-primary transition-colors"
                  onClick={() => {
                    setShowAddItem(null)
                    setNewItemData({ name: '', description: '', price: '', available: true })
                  }}
                  aria-label="Close add item modal"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ux-text mb-2">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-ux-border rounded-lg text-ux-text bg-ux-background focus:outline-none focus:ring-2 focus:ring-ux-primary"
                    value={newItemData.name}
                    onChange={(e) => setNewItemData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Caesar Salad"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ux-text mb-2">
                    Description
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-ux-border rounded-lg text-ux-text bg-ux-background focus:outline-none focus:ring-2 focus:ring-ux-primary resize-none"
                    rows={2}
                    value={newItemData.description}
                    onChange={(e) => setNewItemData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the item"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ux-text mb-2">
                    Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-ux-border rounded-lg text-ux-text bg-ux-background focus:outline-none focus:ring-2 focus:ring-ux-primary"
                    value={newItemData.price}
                    onChange={(e) => setNewItemData(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="available"
                    className="h-4 w-4 text-ux-primary focus:ring-ux-primary border-ux-border rounded"
                    checked={newItemData.available}
                    onChange={(e) => setNewItemData(prev => ({ ...prev, available: e.target.checked }))}
                  />
                  <label htmlFor="available" className="text-sm text-ux-text">
                    Available for ordering
                  </label>
                </div>
                <div className="flex gap-2 justify-end">
                  <UXButton
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddItem(null)
                      setNewItemData({ name: '', description: '', price: '', available: true })
                    }}
                  >
                    Cancel
                  </UXButton>
                  <UXButton
                    variant="primary"
                    size="sm"
                    onClick={() => handleAddItemToCategory(showAddItem)}
                    disabled={!newItemData.name.trim() || !newItemData.price}
                  >
                    Add Item
                  </UXButton>
                </div>
              </div>
            </UXCard>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Item Modal */}
      {!isDemo && showEditItem && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md">
            <UXCard>
              <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-ux-border/60">
                <h3 className="text-sm font-semibold text-ux-text">
                  Update Item Details
                </h3>
                <button
                  type="button"
                  className="h-7 w-7 flex items-center justify-center rounded-full text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-primary transition-colors"
                  onClick={() => setShowEditItem(null)}
                  aria-label="Close edit item modal"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ux-text mb-2">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-ux-border rounded-lg text-ux-text bg-ux-background focus:outline-none focus:ring-2 focus:ring-ux-primary"
                    value={editItemData.name}
                    onChange={(e) => setEditItemData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Caesar Salad"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ux-text mb-2">
                    Description
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-ux-border rounded-lg text-ux-text bg-ux-background focus:outline-none focus:ring-2 focus:ring-ux-primary resize-none"
                    rows={2}
                    value={editItemData.description}
                    onChange={(e) => setEditItemData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the item"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ux-text mb-2">
                    Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-ux-border rounded-lg text-ux-text bg-ux-background focus:outline-none focus:ring-2 focus:ring-ux-primary"
                    value={editItemData.price}
                    onChange={(e) => setEditItemData(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="available-edit"
                    className="h-4 w-4 text-ux-primary focus:ring-ux-primary border-ux-border rounded"
                    checked={editItemData.available}
                    onChange={(e) => setEditItemData(prev => ({ ...prev, available: e.target.checked }))}
                  />
                  <label htmlFor="available-edit" className="text-sm text-ux-text">
                    Available for ordering
                  </label>
                </div>
                <div className="flex gap-2 justify-end">
                  <UXButton
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditItem(null)}
                  >
                    Cancel
                  </UXButton>
                  <UXButton
                    variant="primary"
                    size="sm"
                    onClick={() => handleUpdateItem(showEditItem.id)}
                    disabled={!editItemData.name.trim() || !editItemData.price}
                  >
                    Update Item
                  </UXButton>
                </div>
              </div>
            </UXCard>
          </div>
        </div>,
        document.body
      )}
    </UXSection>
  )
}