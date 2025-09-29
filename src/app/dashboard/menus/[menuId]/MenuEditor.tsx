'use client'

import { useState, useOptimistic, useId, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Input, Card, CardHeader, CardTitle, CardContent, useToast, ConfirmDialog, UpgradePrompt } from '@/components/ui'
import { getAvailableThemes, applyTheme as applyThemeLib, generateThemePreview } from '@/lib/themes'
import { fetchJsonWithRetry, HttpError } from '@/lib/retry'
import { pickDominantColorsFromImageData, hexToRgb } from '@/lib/color'
import { formatCurrency } from '@/lib/utils'
import { validateMenuItem } from '@/lib/validation'
import VersionHistory from '@/components/VersionHistory'
import ImageUpload from '@/components/ImageUpload'
import type { Menu, MenuItem, MenuItemFormData } from '@/types'

interface MenuEditorProps {
  menu: Menu
}

export default function MenuEditor({ menu: initialMenu }: MenuEditorProps) {
  // Merge very similar hex colors (e.g., #FC6B02 vs #FD6E05) into a single entry
  const dedupeSimilarColors = (colors: string[], threshold: number = 24): string[] => {
    const unique: string[] = []
    const isSimilar = (a: string, b: string): boolean => {
      const ra = hexToRgb(a)
      const rb = hexToRgb(b)
      const dr = ra.r - rb.r
      const dg = ra.g - rb.g
      const db = ra.b - rb.b
      const distance = Math.sqrt(dr * dr + dg * dg + db * db)
      return distance <= threshold
    }
    for (const c of colors) {
      const exists = unique.some(u => isSimilar(u, c))
      if (!exists) unique.push(c)
    }
    return unique
  }
  const availableCheckboxId = useId()
  const { showToast } = useToast()
  const [menu, setMenu] = useState(initialMenu)
  const [optimisticMenu, addOptimisticUpdate] = useOptimistic(
    menu,
    (state, newMenu: Menu) => newMenu
  )
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [newItem, setNewItem] = useState<MenuItemFormData>({
    name: '',
    description: '',
    price: 0,
    category: '',
    available: true,
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [ocrJobId, setOcrJobId] = useState<string | null>(null)
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle')
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState<string | null>(null)
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)
  const [parsedItems, setParsedItems] = useState<MenuItemFormData[] | null>(null)
  const [parsing, setParsing] = useState<boolean>(false)
  const [brandingPreview, setBrandingPreview] = useState<string | null>(null)
  const [themeTemplates, setThemeTemplates] = useState<Array<{ id: string; name: string }>>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('modern')
  const [applyingTheme, setApplyingTheme] = useState<boolean>(false)
  const [extracting, setExtracting] = useState<boolean>(false)
  const [extractedColors, setExtractedColors] = useState<string[] | null>(null)
  const [brandColors, setBrandColors] = useState<string[]>([])
  const brandFileInputRef = useRef<HTMLInputElement | null>(null)
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null)
  const paynowFileInputRef = useRef<HTMLInputElement | null>(null)
  const [updatingPayment, setUpdatingPayment] = useState<boolean>(false)
  const [paymentOpen, setPaymentOpen] = useState<boolean>(true)
  const [brandingOpen, setBrandingOpen] = useState<boolean>(true)
  const [photoOpen, setPhotoOpen] = useState<boolean>(true)
  const [itemsOpen, setItemsOpen] = useState<boolean>(true)
  const addItemFormRef = useRef<HTMLDivElement | null>(null)
  const [editingField, setEditingField] = useState<{
    id: string
    field: 'name' | 'description' | 'price'
  } | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [editingMenuName, setEditingMenuName] = useState<boolean>(false)
  const [menuNameDraft, setMenuNameDraft] = useState<string>(initialMenu.name)
  const migratedCategoriesRef = useRef<boolean>(false)
  const router = useRouter()
  // Load available templates once
  useEffect(() => {
    setThemeTemplates(getAvailableThemes())
  }, [])

  // Update branding preview when template or theme changes
  useEffect(() => {
    try {
      const tempTheme = applyThemeLib(selectedTemplate, menu.theme.colors)
      const preview = generateThemePreview(tempTheme)
      setBrandingPreview(preview)
    } catch {
      setBrandingPreview(null)
    }
  }, [selectedTemplate, menu.theme])

  const handleApplyBranding = async (colors?: string[], templateIdOverride?: string) => {
    setApplyingTheme(true)
    try {
      const res = await fetch(`/api/menus/${menu.id}?action=applyTheme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: templateIdOverride || selectedTemplate, palette: { colors } })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to apply theme')
      setMenu(data.data.menu)
      addOptimisticUpdate(data.data.menu)
      showToast({ type: 'success', title: 'Branding applied', description: `${data.data.menu.theme.name} theme updated.` })
    } catch (e) {
      showToast({ type: 'error', title: 'Apply failed', description: 'Please try again.' })
    } finally {
      setApplyingTheme(false)
    }
  }

  const handleExtractFromBrandImage = async (file: File) => {
    setExtracting(true)
    try {
      const img = new Image()
      const url = URL.createObjectURL(file)
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Image load failed'))
        img.src = url
      })
      const canvas = document.createElement('canvas')
      const maxDim = 512
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const colors = pickDominantColorsFromImageData(imageData, 5)
      const deduped = dedupeSimilarColors(colors)
      setExtractedColors(deduped)
      setBrandColors(deduped)
      // Auto-apply on extraction
      await handleApplyBranding(deduped)
      URL.revokeObjectURL(url)
    } catch (e) {
      showToast({ type: 'error', title: 'Extraction failed', description: 'Please try a different image.' })
    } finally {
      setExtracting(false)
    }
  }
  
  // Smoothly open and scroll to the Add Item form
  const openAddItemForm = () => {
    setShowAddForm(true)
    setTimeout(() => {
      const container = addItemFormRef.current
      if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' })
        const firstField = container.querySelector('input, textarea, select') as HTMLElement | null
        firstField?.focus()
      }
    }, 0)
  }
  const [confirmState, setConfirmState] = useState<{
    open: boolean
    action: null | (() => void)
    title: string
    description: string
    confirmText?: string
  }>({ open: false, action: null, title: '', description: '' })

  // Add new menu item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validation = validateMenuItem(newItem)
    if (!validation.isValid) {
      const errorMap: Record<string, string> = {}
      validation.errors.forEach(error => {
        errorMap[error.field] = error.message
      })
      setErrors(errorMap)
      return
    }

    setLoading('add')
    setErrors({})

    try {
      const response = await fetch(`/api/menus/${menu.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newItem),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.code === 'PLAN_LIMIT_EXCEEDED') {
          setErrors({ general: result.error || 'Plan limit reached' })
        } else {
          setErrors({ general: result.error || 'Failed to add item' })
        }
        return
      }

      // Update menu state
      setMenu(result.data)
      addOptimisticUpdate(result.data)
      
      // Reset form
      setNewItem({
        name: '',
        description: '',
        price: 0,
        category: '',
        available: true,
      })
      setShowAddForm(false)
    } catch (error) {
      setErrors({ general: 'Network error. Please try again.' })
    } finally {
      setLoading(null)
    }
  }

  // Trigger OCR extraction
  const handleExtractItems = async () => {
    try {
      setOcrError(null)
      const result = await fetchJsonWithRetry<{ success: boolean; data: any; error?: string; code?: string }>(
        `/api/menus/${menu.id}/ocr?force=1`,
        { method: 'POST' },
        { retries: 2, baseDelayMs: 250, maxDelayMs: 1000 }
      )
      setOcrJobId(result.data.id)
      setOcrStatus(result.data.status)
      pollJob(result.data.id)
    } catch (e) {
      if (e instanceof HttpError && (e.body as any)?.code === 'PLAN_LIMIT_EXCEEDED') {
        const b: any = e.body || {}
        showToast({ type: 'info', title: 'Plan limit reached', description: b.error || 'Monthly OCR limit reached.' })
      } else {
        showToast({ type: 'error', title: 'OCR failed to start', description: e instanceof Error ? e.message : 'Please try again.' })
      }
    }
  }

  const pollJob = async (jobId: string) => {
    const poll = async () => {
      try {
        const data = await fetchJsonWithRetry<{ success: boolean; data: any; error?: string }>(
          `/api/ocr/jobs/${jobId}`,
          { method: 'GET' },
          { retries: 2, baseDelayMs: 300, maxDelayMs: 1200 }
        )
        setOcrStatus(data.data.status)
        if (data.data.status === 'queued' || data.data.status === 'processing') {
          setTimeout(poll, 1500)
          return
        }
        if (data.data.status === 'completed') {
          const text: string | undefined = data.data.result?.ocrText
          if (text) setOcrText(text)
          const conf: number | undefined = data.data.result?.confidence
          if (typeof conf === 'number') setOcrConfidence(conf)
        }
      } catch (err: any) {
        setOcrError((err?.body as any)?.error || err?.message || 'Failed to fetch job')
        setOcrStatus('failed')
      }
    }
    await poll()
  }

  // Update menu item
  const handleUpdateItem = async (itemId: string, updates: Partial<MenuItem>): Promise<boolean> => {
    setLoading(itemId)
    try {
      const response = await fetch(`/api/menus/${menu.id}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Failed to update item:', result.error)
        return false
      }

      setMenu(result.data)
      addOptimisticUpdate(result.data)
      setEditingItem(null)
      return true
    } catch (error) {
      console.error('Network error:', error)
      return false
    } finally {
      setLoading(null)
    }
  }

  // Delete menu item
  const handleDeleteItem = async (itemId: string) => {
    setConfirmState({
      open: true,
      action: async () => {
        setLoading(itemId)
        try {
          const response = await fetch(`/api/menus/${menu.id}/items/${itemId}`, {
            method: 'DELETE',
          })
          const result = await response.json()
          if (!response.ok) {
            console.error('Failed to delete item:', result.error)
            return
          }
          setMenu(result.data)
          addOptimisticUpdate(result.data)
        } catch (error) {
          console.error('Network error:', error)
        } finally {
          setLoading(null)
        }
      },
      title: 'Delete item?',
      description: 'This action cannot be undone.',
      confirmText: 'Delete',
    })
    return

  }

  // Toggle item availability
  const handleToggleAvailability = (item: MenuItem) => {
    handleUpdateItem(item.id, { available: !item.available })
  }

  // Move item up/down
  const handleMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    const currentIndex = optimisticMenu.items.findIndex(item => item.id === itemId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= optimisticMenu.items.length) return

    const reorderedItems = [...optimisticMenu.items]
    const [movedItem] = reorderedItems.splice(currentIndex, 1)
    reorderedItems.splice(newIndex, 0, movedItem)

    const itemIds = reorderedItems.map(item => item.id)

    setLoading('reorder')

    try {
      const response = await fetch(`/api/menus/${menu.id}/items`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemIds }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Failed to reorder items:', result.error)
        return
      }

      setMenu(result.data)
      addOptimisticUpdate(result.data)
    } catch (error) {
      console.error('Network error:', error)
    } finally {
      setLoading(null)
    }
  }

  // Inline editing helpers for item fields
  const beginEdit = (item: MenuItem, field: 'name' | 'description' | 'price') => {
    setEditingField({ id: item.id, field })
    if (field === 'price') {
      setEditingValue(String(item.price))
    } else if (field === 'description') {
      setEditingValue(item.description || item.category || '')
    } else {
      setEditingValue((item as any)[field] || '')
    }
  }

  const commitEdit = async () => {
    if (!editingField) return
    const { id, field } = editingField
    let updates: Partial<MenuItem> = {}

    if (field === 'price') {
      const parsed = parseFloat(editingValue.replace(/,/g, '.'))
      if (!isNaN(parsed) && parsed >= 0) {
        const rounded = Math.round(parsed * 100) / 100
        updates.price = rounded
      }
    } else if (field === 'description') {
      const v = editingValue.trim()
      updates.description = v
      updates.category = ''
    } else {
      const v = editingValue.trim()
      ;(updates as any)[field] = v
    }

    if (Object.keys(updates).length > 0) {
      const ok = await handleUpdateItem(id, updates)
      if (ok) {
        showToast({ type: 'success', title: 'Saved', description: undefined })
      } else {
        showToast({ type: 'error', title: 'Update failed', description: 'Please try again.' })
      }
    }
    setEditingField(null)
    setEditingValue('')
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditingValue('')
  }

  // One-time migration: move existing category text into description when description is empty
  useEffect(() => {
    if (migratedCategoriesRef.current) return
    const toMigrate = optimisticMenu.items.filter(it => (!it.description || it.description.trim().length === 0) && !!(it.category && it.category.trim().length > 0))
    if (toMigrate.length === 0) {
      migratedCategoriesRef.current = true
      return
    }
    ;(async () => {
      for (const it of toMigrate) {
        await handleUpdateItem(it.id, { description: it.category || '', category: '' })
      }
      migratedCategoriesRef.current = true
    })()
  }, [optimisticMenu.items])

  // Publish menu
  const handlePublishMenu = async () => {
    if (optimisticMenu.items.length === 0) {
      showToast({ type: 'info', title: 'Add at least one item', description: 'Please add an item before publishing.' })
      return
    }

    setConfirmState({
      open: true,
      action: async () => {
        setPublishing(true)
        try {
          const response = await fetch(`/api/menus/${menu.id}/publish`, { method: 'POST' })
          const result = await response.json()
          if (!response.ok) {
            console.error('Failed to publish menu:', result.error)
            showToast({ type: 'error', title: 'Publish failed', description: 'Please try again.' })
            return
          }
          setMenu(result.data)
          addOptimisticUpdate(result.data)
          showToast({ type: 'success', title: 'Menu published', description: 'Your menu is now live.' })
          try {
            const origin = window.location.origin
            const publicUrl = `${origin}/u/${result.data.userId}/${result.data.slug}`
            window.open(publicUrl, '_blank', 'noopener,noreferrer')
          } catch (_) {
            // ignore failures to open new tab
          }
        } catch (error) {
          console.error('Network error:', error)
          showToast({ type: 'error', title: 'Network error', description: 'Please try again.' })
        } finally {
          setPublishing(false)
        }
      },
      title: 'Publish menu?',
      description: 'This will create a new version and make it publicly available.',
      confirmText: 'Publish',
    })
    return

    setPublishing(true)

    try {
      const response = await fetch(`/api/menus/${menu.id}/publish`, {
        method: 'POST',
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Failed to publish menu:', result.error)
        showToast({ type: 'error', title: 'Publish failed', description: 'Please try again.' })
        return
      }

      setMenu(result.data)
      addOptimisticUpdate(result.data)
      showToast({ type: 'success', title: 'Menu published', description: 'Your menu is now live.' })
    } catch (error) {
      console.error('Network error:', error)
      showToast({ type: 'error', title: 'Network error', description: 'Please try again.' })
    } finally {
      setPublishing(false)
    }
  }

  // Commit menu name change
  const commitMenuName = async () => {
    const newName = menuNameDraft.trim()
    if (!newName || newName === optimisticMenu.name) {
      setEditingMenuName(false)
      return
    }
    setLoading('rename-menu')
    try {
      const response = await fetch(`/api/menus/${menu.id}` ,{
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      })
      const result = await response.json()
      if (!response.ok) {
        showToast({ type: 'error', title: 'Rename failed', description: result?.error || 'Please try again.' })
        return
      }
      setMenu(result.data)
      addOptimisticUpdate(result.data)
      setEditingMenuName(false)
      showToast({ type: 'success', title: 'Menu renamed', description: undefined })
    } catch (error) {
      showToast({ type: 'error', title: 'Network error', description: 'Please try again.' })
    } finally {
      setLoading(null)
    }
  }

  // Delete entire menu (destructive)
  const handleDeleteMenu = () => {
    setConfirmState({
      open: true,
      action: async () => {
        setLoading('delete-menu')
        try {
          const response = await fetch(`/api/menus/${menu.id}`, { method: 'DELETE' })
          const result = await response.json().catch(() => ({}))
          if (!response.ok) {
            showToast({ type: 'error', title: 'Delete failed', description: result?.error || 'Please try again.' })
            return
          }
          showToast({ type: 'success', title: 'Menu deleted', description: 'Returning to dashboard…' })
          router.push('/dashboard')
        } catch (error) {
          showToast({ type: 'error', title: 'Network error', description: 'Please try again.' })
        } finally {
          setLoading(null)
        }
      },
      title: 'Delete menu? ',
      description: 'This will permanently delete this menu and its items. This action cannot be undone.',
      confirmText: 'Delete',
    })
  }

  useEffect(() => {
    // Build QR preview data URL via the API when menu is published
    if (menu.status === 'published') {
      const url = `/api/menus/${menu.id}/qr?format=png&size=256`
      setQrPreviewUrl(url)
    } else {
      setQrPreviewUrl(null)
    }
  }, [menu.id, menu.status])

  // Handle version revert
  const handleRevertToVersion = async (versionId: string) => {
    try {
      const response = await fetch(`/api/menus/${menu.id}/versions/${versionId}/revert`, {
        method: 'POST',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to revert')
      }

      setMenu(result.data)
      addOptimisticUpdate(result.data)
      showToast({ type: 'success', title: 'Reverted to version', description: 'The selected version is now active.' })
    } catch (error) {
      console.error('Error reverting:', error)
      throw error // Re-throw to let VersionHistory component handle it
    }
  }

  // Handle image upload
  const handleImageUpload = async (file: File, preview: string) => {
    setUploadingImage(true)
    setShowImageUpload(false)

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch(`/api/menus/${menu.id}/image`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.code === 'PLAN_LIMIT_EXCEEDED') {
          showToast({ type: 'info', title: 'Plan limit reached', description: result.error || 'Monthly upload limit reached.' })
        } else {
          showToast({ type: 'error', title: 'Upload failed', description: result.error || 'Please try again.' })
        }
        return
      }

      setMenu(result.data.menu)
      addOptimisticUpdate(result.data.menu)
      showToast({ type: 'success', title: 'Image uploaded', description: 'Ready for OCR extraction.' })
    } catch (error) {
      console.error('Error uploading image:', error)
      showToast({ type: 'error', title: 'Network error', description: 'Please try again.' })
    } finally {
      setUploadingImage(false)
    }
  }

  // Handle image removal
  const handleRemoveImage = async () => {
    setConfirmState({
      open: true,
      action: async () => {
        setUploadingImage(true)
        try {
          const response = await fetch(`/api/menus/${menu.id}/image`, { method: 'DELETE' })
          const result = await response.json()
          if (!response.ok) {
            showToast({ type: 'error', title: 'Remove failed', description: result.error || 'Please try again.' })
            return
          }
          setMenu(result.data)
          addOptimisticUpdate(result.data)
          showToast({ type: 'success', title: 'Image removed', description: 'You can upload a new photo anytime.' })
        } catch (error) {
          console.error('Error removing image:', error)
          showToast({ type: 'error', title: 'Network error', description: 'Please try again.' })
        } finally {
          setUploadingImage(false)
        }
      },
      title: 'Remove image?',
      description: 'This will remove the current menu photo.',
      confirmText: 'Remove',
    })
    return

    try {
      const response = await fetch(`/api/menus/${menu.id}/image`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        showToast({ type: 'error', title: 'Remove failed', description: result.error || 'Please try again.' })
        return
      }

      setMenu(result.data)
      addOptimisticUpdate(result.data)
      showToast({ type: 'success', title: 'Image removed', description: 'You can upload a new photo anytime.' })
    } catch (error) {
      console.error('Error removing image:', error)
      showToast({ type: 'error', title: 'Network error', description: 'Please try again.' })
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard"
                className="text-secondary-500 hover:text-secondary-700"
              >
                ← Back
              </Link>
              <div>
                {editingMenuName ? (
                  <div className="flex items-center gap-2">
                    <input
                      className="text-2xl font-bold text-secondary-900 border border-secondary-300 rounded px-2 py-1"
                      value={menuNameDraft}
                      autoFocus
                      onChange={(e) => setMenuNameDraft(e.target.value)}
                      onBlur={commitMenuName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitMenuName()
                        if (e.key === 'Escape') { setEditingMenuName(false); setMenuNameDraft(optimisticMenu.name) }
                      }}
                    />
                  </div>
                ) : (
                  <div className="group inline-flex items-center gap-2">
                    <h1
                      className="text-2xl font-bold text-secondary-900"
                      onClick={() => { setEditingMenuName(true); setMenuNameDraft(optimisticMenu.name) }}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setEditingMenuName(true); setMenuNameDraft(optimisticMenu.name) } }}
                      title="Edit menu name"
                    >
                      {optimisticMenu.name}
                    </h1>
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-secondary-400 hover:text-secondary-600 p-0 h-5 min-h-0"
                      onClick={() => { setEditingMenuName(true); setMenuNameDraft(optimisticMenu.name) }}
                      aria-label="Edit menu name"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM12.172 4.414L4 12.586V16h3.414l8.172-8.172-3.414-3.414z" />
                      </svg>
                    </button>
                  </div>
                )}
                <p className="text-sm text-secondary-600">
                  {optimisticMenu.items.length} items • {optimisticMenu.status}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {/* Action pair: Preview (secondary) + Publish (primary) */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const origin = window.location.origin
                  const previewUrl = `${origin}/u/${menu.userId}/${menu.slug}?preview=1`
                  window.open(previewUrl, '_blank', 'noopener,noreferrer')
                }}
                disabled={loading !== null || publishing}
                aria-label="Preview draft (opens in new tab)"
              >
                Preview
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handlePublishMenu}
                loading={publishing}
                disabled={loading !== null}
                aria-label="Publish update"
              >
                {optimisticMenu.status === 'published' ? 'Update' : 'Publish'}
              </Button>
              <div className="mx-1 h-6 w-px bg-secondary-200" aria-hidden="true" />
              {/* Secondary utilities */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVersionHistory(true)}
                disabled={loading !== null || publishing}
              >
                History
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openAddItemForm}
                disabled={loading !== null || publishing}
              >
                Add Item
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={handleDeleteMenu}
                disabled={loading !== null || publishing}
                aria-label="Delete menu"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-mobile py-6">
        <div className="space-y-6">
          {/* Branding Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Brand Styling</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setBrandingOpen(o => !o)} aria-expanded={brandingOpen} aria-controls="branding-panel">
                  {brandingOpen ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            <CardContent id="branding-panel" className={brandingOpen ? '' : 'hidden'}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-secondary-700">Theme</label>
                  <select
                    value={selectedTemplate}
                    onChange={async (e) => {
                      const next = e.target.value
                      setSelectedTemplate(next)
                      await handleApplyBranding(brandColors.length ? brandColors.slice(0, 5) : undefined, next)
                    }}
                    className="mt-1 block w-full border border-secondary-300 rounded-md px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {themeTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <input
                    ref={brandFileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleExtractFromBrandImage(f)
                      // reset value so selecting the same file again re-triggers change
                      if (e.target) (e.target as HTMLInputElement).value = ''
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    loading={extracting}
                    disabled={extracting}
                    onClick={() => brandFileInputRef.current?.click()}
                  >
                    {extracting ? 'Extracting…' : 'Use Brand Image'}
                  </Button>
                </div>
              </div>
              {(brandingPreview || (brandColors && brandColors.length > 0)) && (
                <div className="mt-4 grid md:grid-cols-2 gap-4 md:gap-6 items-start">
                  <div>
                    {brandingPreview && (
                      <div className="border border-secondary-200 rounded bg-white p-2 flex items-center justify-center">
                        <img src={brandingPreview} alt="Theme preview" className="max-w-full max-h-64" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    {brandColors && brandColors.length > 0 && (
                      <div>
                        <div className="text-xs text-secondary-600 mb-1">
                          Drag or move to set roles (top to bottom): Primary, Secondary, Accent, Background, Text seed. Only first 5 are used.
                        </div>
                        <div className="flex flex-col gap-2 max-w-sm">
                          {brandColors.map((c, i) => (
                            <div key={`${c}-${i}`} className="flex items-center gap-2 p-1 border rounded w-full">
                              <div
                                className="h-6 w-6 rounded border border-secondary-200"
                                style={{ backgroundColor: c }}
                                aria-label={`Color swatch`}
                              />
                              <div className="text-xs text-secondary-700 flex-1">
                                {i === 0 ? 'Primary' : i === 1 ? 'Secondary' : i === 2 ? 'Accent' : i === 3 ? 'Background' : i === 4 ? 'Text seed' : 'Extra'}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  className="h-6 w-6 min-h-0 rounded hover:bg-secondary-100 text-secondary-500 disabled:opacity-40"
                                  onClick={() => {
                                    if (i === 0) return
                                    const next = [...brandColors]
                                    const t = next[i - 1]; next[i - 1] = next[i]; next[i] = t
                                    setBrandColors(next)
                                    handleApplyBranding(next.slice(0, 5))
                                  }}
                                  disabled={i === 0}
                                  aria-label="Move up"
                                  title="Move up"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="h-6 w-6 min-h-0 rounded hover:bg-secondary-100 text-secondary-500 disabled:opacity-40"
                                  onClick={() => {
                                    if (i === brandColors.length - 1) return
                                    const next = [...brandColors]
                                    const t = next[i + 1]; next[i + 1] = next[i]; next[i] = t
                                    setBrandColors(next)
                                    handleApplyBranding(next.slice(0, 5))
                                  }}
                                  disabled={i === brandColors.length - 1}
                                  aria-label="Move down"
                                  title="Move down"
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  className="h-6 w-6 min-h-0 rounded hover:bg-secondary-100 text-red-600"
                                  onClick={() => {
                                    const next = brandColors.filter((_, idx) => idx !== i)
                                    setBrandColors(next)
                                    handleApplyBranding(next.slice(0, 5))
                                  }}
                                  aria-label="Remove color"
                                  title="Remove color"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-col md:flex-row md:flex-wrap items-stretch gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full md:w-auto"
                            onClick={() => {
                              const next = brandColors.includes('#FFFFFF') ? brandColors : [...brandColors, '#FFFFFF']
                              setBrandColors(next)
                              handleApplyBranding(next.slice(0, 5))
                            }}
                          >
                            Add White
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full md:w-auto"
                            onClick={() => {
                              const next = brandColors.includes('#111827') ? brandColors : [...brandColors, '#111827']
                              setBrandColors(next)
                              handleApplyBranding(next.slice(0, 5))
                            }}
                          >
                            Add Black
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full md:w-auto"
                            onClick={() => {
                              const next = extractedColors || []
                              setBrandColors(next)
                              handleApplyBranding(next.slice(0, 5))
                            }}
                          >
                            Reset
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <p className="text-xs text-secondary-600 mt-2">Choose a theme or upload a brand image to auto-extract colors. We validate contrast to meet WCAG AA where possible.</p>
            </CardContent>
          </Card>
          {/* Menu Image Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Menu Photo</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setPhotoOpen(o => !o)} aria-expanded={photoOpen} aria-controls="photo-panel">
                  {photoOpen ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            <CardContent id="photo-panel" className={photoOpen ? '' : 'hidden'}>
              {optimisticMenu.imageUrl ? (
                <div className="space-y-4">
                  <div className="relative">
                    <img
                      src={optimisticMenu.imageUrl}
                      alt="Menu"
                      className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                    />
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                        <div className="text-white text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                          <p className="text-sm">Processing...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center space-x-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowImageUpload(true)}
                      disabled={uploadingImage}
                    >
                      Replace Photo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveImage}
                      disabled={uploadingImage}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove Photo
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleExtractItems}
                      disabled={ocrStatus === 'queued' || ocrStatus === 'processing'}
                    >
                      {ocrStatus === 'queued' || ocrStatus === 'processing' ? 'Processing…' : 'Extract Items'}
                    </Button>
                  </div>
                  {ocrError && (
                    <p className="text-red-600 text-sm text-center">{ocrError}</p>
                  )}
                  {ocrText && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-secondary-700 mb-2">OCR Text (preview)</h4>
                      <pre className="whitespace-pre-wrap text-sm bg-secondary-50 p-3 rounded-md max-h-56 overflow-auto">{ocrText}</pre>
                      {ocrConfidence !== null && (
                        <p className="text-xs text-secondary-600 mt-2">Confidence: {(ocrConfidence * 100).toFixed(0)}%</p>
                      )}
                      <div className="mt-3 flex items-center gap-3">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={async () => {
                            if (!ocrJobId) return
                            setParsing(true)
                            try {
                              const data = await fetchJsonWithRetry<{ success: boolean; data: any; error?: string }>(
                                `/api/ocr/jobs/${ocrJobId}`,
                                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ useAI: true }) },
                                { retries: 2, baseDelayMs: 250, maxDelayMs: 1000 }
                              )
                              const items = data?.data?.result?.extractedItems || []
                              setParsedItems(items)
                              showToast({ type: 'success', title: 'Items extracted', description: `${items.length} items found.` })
                            } catch (e) {
                              showToast({ type: 'error', title: 'Parse failed', description: 'Please try again.' })
                            } finally {
                              setParsing(false)
                            }
                          }}
                          loading={parsing}
                        >
                          {parsing ? 'Parsing…' : 'Parse with AI'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (!ocrJobId) return
                            setParsing(true)
                            try {
                              const data = await fetchJsonWithRetry<{ success: boolean; data: any; error?: string }>(
                                `/api/ocr/jobs/${ocrJobId}`,
                                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ useAI: false }) },
                                { retries: 2, baseDelayMs: 250, maxDelayMs: 1000 }
                              )
                              const items = data?.data?.result?.extractedItems || []
                              setParsedItems(items)
                              showToast({ type: 'success', title: 'Heuristic items extracted', description: `${items.length} items found.` })
                            } catch (e) {
                              showToast({ type: 'error', title: 'Parse failed', description: 'Please try again.' })
                            } finally {
                              setParsing(false)
                            }
                          }}
                          disabled={parsing}
                        >
                          Fallback Parse
                        </Button>
                      </div>
                      {parsedItems && parsedItems.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-secondary-700 mb-2">Extracted Items ({parsedItems.length})</h4>
                          <div className="space-y-2 max-h-64 overflow-auto">
                            {parsedItems.map((it, idx) => (
                              <div key={idx} className="flex items-start justify-between p-2 border rounded-md">
                                <div className="min-w-0 pr-3">
                                  <div className="font-medium truncate">{it.name}</div>
                                  <div className="text-xs text-secondary-600 truncate">{it.description || ''}</div>
                                  <div className="text-xs text-secondary-500">{it.category || 'Uncategorized'}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    className="w-24 border rounded px-2 py-1 text-sm"
                                    min="0"
                                    step="0.01"
                                    value={it.price}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value) || 0
                                      setParsedItems(prev => prev ? prev.map((p, i) => i === idx ? { ...p, price: value } : p) : prev)
                                    }}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      const validation = validateMenuItem(it)
                                      if (!validation.isValid) {
                                        showToast({ type: 'error', title: 'Invalid item', description: 'Please edit before adding.' })
                                        return
                                      }
                                      setLoading('add')
                                      try {
                                        const response = await fetch(`/api/menus/${menu.id}/items`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify(it),
                                        })
                                        const result = await response.json()
                                        if (!response.ok) {
                                          if (result.code === 'PLAN_LIMIT_EXCEEDED') {
                                            showToast({ type: 'info', title: 'Plan limit reached', description: result.error || 'Item limit reached.' })
                                          } else {
                                            showToast({ type: 'error', title: 'Failed to add', description: result.error || 'Try again.' })
                                          }
                                          return
                                        }
                                        setMenu(result.data)
                                        addOptimisticUpdate(result.data)
                                      } catch (e) {
                                        showToast({ type: 'error', title: 'Network error', description: 'Please try again.' })
                                      } finally {
                                        setLoading(null)
                                      }
                                    }}
                                  >
                                    Add
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={async () => {
                                if (!parsedItems) return
                                setLoading('bulk-add')
                                try {
                                  for (const it of parsedItems) {
                                    const validation = validateMenuItem(it)
                                    if (!validation.isValid) continue
                                    const resp = await fetch(`/api/menus/${menu.id}/items`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(it),
                                    })
                                    if (!resp.ok) {
                                      const r = await resp.json().catch(() => ({}))
                                      if (r?.code === 'PLAN_LIMIT_EXCEEDED') {
                                        showToast({ type: 'info', title: 'Plan limit reached', description: r.error || 'Item limit reached.' })
                                        break
                                      }
                                    }
                                  }
                                  const refreshed = await fetch(`/api/menus/${menu.id}`)
                                  const refreshedData = await refreshed.json().catch(() => null)
                                  if (refreshed.ok && refreshedData?.data) {
                                    setMenu(refreshedData.data)
                                    addOptimisticUpdate(refreshedData.data)
                                  }
                                  showToast({ type: 'success', title: 'Items added', description: 'Parsed items have been added.' })
                                } catch (e) {
                                  // ignore errors per-item
                                } finally {
                                  setLoading(null)
                                }
                              }}
                              disabled={!parsedItems || parsedItems.length === 0 || loading === 'bulk-add'}
                              loading={loading === 'bulk-add'}
                            >
                              Add All
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setParsedItems(null)}>Clear</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {ocrStatus === 'failed' && (
                    <div className="mt-3 text-center">
                      <p className="text-sm text-secondary-600 mb-2">OCR failed. You can add items manually.</p>
                      <Button variant="outline" size="sm" onClick={openAddItemForm}>
                        Enter Items Manually
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="mx-auto h-12 w-12 text-secondary-400 mb-4">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-secondary-900 mb-2">
                    No menu photo yet
                  </h3>
                  <p className="text-secondary-600 mb-4">
                    Upload a photo of your menu to extract items automatically
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setShowImageUpload(true)}
                    disabled={uploadingImage}
                  >
                    Upload Menu Photo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Section removed here and re-inserted below, before Quick Actions */}

          {/* Image Upload Modal */}
          {showImageUpload && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="w-full max-w-2xl">
                <ImageUpload
                  onImageSelected={handleImageUpload}
                  onCancel={() => setShowImageUpload(false)}
                />
              </div>
            </div>
          )}

          {/* Add Item Form */}
          {showAddForm && (
            <div ref={addItemFormRef}>
            <Card>
              <CardHeader>
                <CardTitle>Add New Item</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddItem} className="space-y-4">
                  {errors.general && (
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                      {errors.general}
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Item Name"
                      value={newItem.name}
                      onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Chicken Rice"
                      error={errors.name}
                      required
                    />
                    <Input
                      label="Price (SGD)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newItem.price}
                      onChange={(e) => setNewItem(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      placeholder="8.50"
                      error={errors.price}
                      required
                    />
                  </div>

                  <Input
                    label="Description (Optional)"
                    value={newItem.description}
                    onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the item"
                  />

                  <Input
                    label="Category (Optional)"
                    value={newItem.category}
                    onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="e.g., Main Course, Drinks, Desserts"
                  />

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={availableCheckboxId}
                      checked={newItem.available}
                      onChange={(e) => setNewItem(prev => ({ ...prev, available: e.target.checked }))}
                      className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor={availableCheckboxId} className="text-sm font-medium text-secondary-700">
                      Available for order
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                      disabled={loading === 'add'}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={loading === 'add'}
                    >
                      Add Item
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            </div>
          )}

          {/* Menu Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Menu Items</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setItemsOpen(o => !o)} aria-expanded={itemsOpen} aria-controls="items-panel">
                  {itemsOpen ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            <CardContent id="items-panel" className={itemsOpen ? '' : 'hidden'}>
              <div className="space-y-3">
                {optimisticMenu.items.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <div className="mx-auto h-12 w-12 text-secondary-400 mb-4">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-secondary-900 mb-2">
                        No items yet
                      </h3>
                      <p className="text-secondary-600 mb-6">
                        Add your first menu item to get started
                      </p>
                      <Button
                        variant="primary"
                        onClick={openAddItemForm}
                      >
                        Add First Item
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  optimisticMenu.items.map((item, index) => (
                    <Card key={item.id} className={`p-0 ${!item.available ? 'opacity-60' : ''}`}>
                      <CardContent className="py-2 px-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {editingField?.id === item.id && editingField.field === 'name' ? (
                                <input
                                  className="font-medium text-secondary-900 text-sm border border-secondary-300 rounded px-2 py-1 w-full max-w-[240px]"
                                  value={editingValue}
                                  autoFocus
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitEdit()
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                />
                              ) : (
                                <div className="group inline-flex items-center gap-1 max-w-full leading-none">
                                  <h3
                                    className="font-medium text-secondary-900 truncate text-sm"
                                    onClick={() => beginEdit(item, 'name')}
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') beginEdit(item, 'name') }}
                                    title="Edit name"
                                  >
                                    {item.name}
                                  </h3>
                                  <button
                                    type="button"
                                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-secondary-400 hover:text-secondary-600 p-0 h-4 min-h-0"
                                    onClick={() => beginEdit(item, 'name')}
                                    aria-label="Edit name"
                                  >
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M13.586 3a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM12.172 4.414L4 12.586V16h3.414l8.172-8.172-3.414-3.414z" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                              {!item.available && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800">
                                  Out of stock
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5">
                              {editingField?.id === item.id && editingField.field === 'description' ? (
                                <textarea
                                  className="text-xs text-secondary-600 border border-secondary-300 rounded px-2 py-1 w-full"
                                  rows={2}
                                  value={editingValue}
                                  autoFocus
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit() }}
                                />
                              ) : (
                                <div className="group inline-flex items-center gap-1 max-w-full leading-none">
                                  <p
                                    className="text-xs text-secondary-600 truncate"
                                    onClick={() => beginEdit(item, 'description')}
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') beginEdit(item, 'description') }}
                                    title="Edit description"
                                  >
                                    {item.description || item.category || 'Add a description'}
                                  </p>
                                  <button
                                    type="button"
                                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-secondary-300 hover:text-secondary-500 p-0 h-4 min-h-0"
                                    onClick={() => beginEdit(item, 'description')}
                                    aria-label="Edit description"
                                  >
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M13.586 3a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM12.172 4.414L4 12.586V16h3.414l8.172-8.172-3.414-3.414z" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                            
                          </div>
                          <div className="shrink-0 text-sm font-semibold text-primary-600 min-w-[64px] text-right">
                            {editingField?.id === item.id && editingField.field === 'price' ? (
                              <input
                                inputMode="decimal"
                                pattern="[0-9]*"
                                className="border border-secondary-300 rounded px-2 py-1 w-20 text-right"
                                value={editingValue}
                                autoFocus
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEdit()
                                  if (e.key === 'Escape') cancelEdit()
                                }}
                              />
                            ) : (
                              <div className="group inline-flex items-center gap-1 leading-none">
                                <button
                                  type="button"
                                  className="px-1 py-0.5 -mr-1 rounded hover:bg-secondary-100 leading-none min-h-0"
                                  onClick={() => beginEdit(item, 'price')}
                                  aria-label="Edit price"
                                  title="Edit price"
                                >
                                  {formatCurrency(item.price)}
                                </button>
                                <button
                                  type="button"
                                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-secondary-400 hover:text-secondary-600 p-0 h-4 min-h-0"
                                  onClick={() => beginEdit(item, 'price')}
                                  aria-label="Edit price"
                                >
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM12.172 4.414L4 12.586V16h3.414l8.172-8.172-3.414-3.414z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Condensed action bar */}
                          <div className="ml-1 flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveItem(item.id, 'up')}
                              disabled={index === 0 || loading !== null}
                              className="h-8 w-8 min-h-0 rounded hover:bg-secondary-100 text-secondary-500 hover:text-secondary-700 disabled:opacity-50"
                              title="Move up"
                              aria-label="Move up"
                            >
                              <svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveItem(item.id, 'down')}
                              disabled={index === optimisticMenu.items.length - 1 || loading !== null}
                              className="h-8 w-8 min-h-0 rounded hover:bg-secondary-100 text-secondary-500 hover:text-secondary-700 disabled:opacity-50"
                              title="Move down"
                              aria-label="Move down"
                            >
                              <svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleAvailability(item)}
                              disabled={loading === item.id}
                              className={`h-8 w-8 min-h-0 rounded hover:bg-secondary-100 ${
                                item.available
                                  ? 'text-red-600 hover:text-red-700'
                                  : 'text-green-600 hover:text-green-700'
                              }`}
                              title={item.available ? 'Mark as out of stock' : 'Mark as available'}
                              aria-label={item.available ? 'Mark as out of stock' : 'Mark as available'}
                            >
                              {item.available ? (
                                // No entry sign
                                <svg className="mx-auto h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <circle cx="12" cy="12" r="9" strokeWidth="2" />
                                  <line x1="7" y1="12" x2="17" y2="12" strokeWidth="2" />
                                </svg>
                              ) : (
                                // Checkmark to mark available again
                                <svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              disabled={loading === item.id}
                              className="h-8 w-8 min-h-0 rounded hover:bg-secondary-100 text-red-500 hover:text-red-700 disabled:opacity-50"
                              title="Delete item"
                              aria-label="Delete item"
                            >
                              <svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Section (moved after items; collapsible) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Payment</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setPaymentOpen(o => !o)} aria-expanded={paymentOpen} aria-controls="payment-panel">
                  {paymentOpen ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            <CardContent id="payment-panel" className={paymentOpen ? '' : 'hidden'}>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-secondary-700">PayNow QR</label>
                    <div className="mt-2 flex items-center gap-3">
                      {optimisticMenu.paymentInfo?.payNowQR ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={optimisticMenu.paymentInfo.payNowQR} alt="PayNow QR" className="w-24 h-24 rounded bg-white border" />
                      ) : (
                        <div className="w-24 h-24 rounded border flex items-center justify-center text-xs text-secondary-500">No QR</div>
                      )}
                      <div className="flex flex-col gap-2">
                        <input
                          ref={paynowFileInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            setUpdatingPayment(true)
                            try {
                              const fd = new FormData()
                              fd.append('qr', f)
                              const res = await fetch(`/api/menus/${menu.id}/payment`, { method: 'POST', body: fd })
                              const data = await res.json()
                              if (!res.ok) throw new Error(data.error || 'Upload failed')
                              setMenu(data.data)
                              addOptimisticUpdate(data.data)
                              showToast({ type: 'success', title: 'QR uploaded', description: 'PayNow QR added to your menu.' })
                            } catch (e) {
                              showToast({ type: 'error', title: 'Upload failed', description: 'Please try again.' })
                            } finally {
                              setUpdatingPayment(false)
                              if (e.target) (e.target as HTMLInputElement).value = ''
                            }
                          }}
                        />
                        <div className="flex gap-2 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => paynowFileInputRef.current?.click()} loading={updatingPayment} disabled={updatingPayment}>Upload QR</Button>
                          {optimisticMenu.paymentInfo?.payNowQR && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                setUpdatingPayment(true)
                                try {
                                  const res = await fetch(`/api/menus/${menu.id}/payment`, { method: 'DELETE' })
                                  const data = await res.json()
                                  if (!res.ok) throw new Error(data.error || 'Failed')
                                  setMenu(data.data)
                                  addOptimisticUpdate(data.data)
                                  showToast({ type: 'success', title: 'Removed', description: 'Payment QR removed.' })
                                } catch (e) {
                                  showToast({ type: 'error', title: 'Remove failed', description: 'Please try again.' })
                                } finally {
                                  setUpdatingPayment(false)
                                }
                              }}
                              disabled={updatingPayment}
                            >
                              Remove QR
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-secondary-700">Instructions</label>
                    <textarea
                      className="mt-1 block w-full border border-secondary-300 rounded-md px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="e.g., Please alert a member of our team to conduct the payment at the counter"
                      rows={4}
                      defaultValue={optimisticMenu.paymentInfo?.instructions || ''}
                      onBlur={async (e) => {
                        const value = e.currentTarget.value
                        setUpdatingPayment(true)
                        try {
                          const res = await fetch(`/api/menus/${menu.id}/payment`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ instructions: value })
                          })
                          const data = await res.json()
                          if (!res.ok) throw new Error(data.error || 'Failed')
                          setMenu(data.data)
                          addOptimisticUpdate(data.data)
                        } catch (e) {
                          showToast({ type: 'error', title: 'Save failed', description: 'Please try again.' })
                        } finally {
                          setUpdatingPayment(false)
                        }
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-secondary-700">Disclaimer</label>
                  <Input
                    value={optimisticMenu.paymentInfo?.disclaimer || 'Payment handled by your bank app; platform does not process funds'}
                    onChange={(e) => {
                      const v = e.target.value
                      setMenu(prev => ({ ...prev, paymentInfo: { ...(prev.paymentInfo || { disclaimer: '' }), disclaimer: v } }))
                    }}
                    onBlur={async (e) => {
                      const v = e.target.value
                      setUpdatingPayment(true)
                      try {
                        const res = await fetch(`/api/menus/${menu.id}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disclaimer: v }) })
                        const data = await res.json()
                        if (!res.ok) throw new Error(data.error || 'Failed')
                        setMenu(data.data)
                        addOptimisticUpdate(data.data)
                      } catch (e) {
                        showToast({ type: 'error', title: 'Save failed', description: 'Please try again.' })
                      } finally {
                        setUpdatingPayment(false)
                      }
                    }}
                  />
                  <p className="text-xs text-secondary-600 mt-1">Required: "Payment handled by your bank app; platform does not process funds"</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Section moved above Quick Actions */}

          {/* Quick Actions */}
          {optimisticMenu.items.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-secondary-900 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openAddItemForm}
                    disabled={loading !== null || publishing}
                  >
                    Add Item
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVersionHistory(true)}
                    disabled={loading !== null || publishing}
                  >
                    Version History
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setConfirmState({
                        open: true,
                        action: async () => {
                          setLoading('clear-all')
                          try {
                            const res = await fetch(`/api/menus/${menu.id}/items`, { method: 'DELETE' })
                            const data = await res.json()
                            if (!res.ok) throw new Error(data.error || 'Failed to clear items')
                            setMenu(data.data)
                            addOptimisticUpdate(data.data)
                            showToast({ type: 'success', title: 'Cleared', description: 'All items removed from this menu.' })
                          } catch (e) {
                            showToast({ type: 'error', title: 'Clear failed', description: 'Please try again.' })
                          } finally {
                            setLoading(null)
                          }
                        },
                        title: 'Clear all items?',
                        description: 'This will remove all items from this menu. You can add new items afterwards.',
                        confirmText: 'Clear All',
                      })
                    }}
                    disabled={loading !== null || publishing}
                  >
                    Clear All Items
                  </Button>
                  {/* Action pair: Preview (secondary) + Publish (primary) */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const origin = window.location.origin
                      const previewUrl = `${origin}/u/${menu.userId}/${menu.slug}?preview=1`
                      window.open(previewUrl, '_blank', 'noopener,noreferrer')
                    }}
                    disabled={loading !== null || publishing}
                    aria-label="Preview draft (opens in new tab)"
                  >
                    Preview (not live)
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full col-span-2"
                    onClick={handlePublishMenu}
                    loading={publishing}
                    disabled={loading !== null}
                    aria-label="Publish update"
                  >
                    {publishing ? 'Publishing...' : optimisticMenu.status === 'published' ? 'Publish Update' : 'Publish Menu'}
                  </Button>
                  {menu.status === 'published' && (
                    <div className="col-span-2">
                      <div className="flex flex-col gap-2 items-center">
                        <div className="text-sm text-secondary-700 flex items-center gap-1 justify-center">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <rect x="3" y="3" width="7" height="7" rx="1" />
                            <rect x="14" y="3" width="7" height="7" rx="1" />
                            <rect x="3" y="14" width="7" height="7" rx="1" />
                            <path d="M14 14h2v2h-2zM18 14h3v3h-1v1h-2v-4zM14 18h2v4h-2zM18 20h2v2h-2z" />
                          </svg>
                          <span>Share your menu</span>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-center">
                          <a
                            href={`/api/menus/${menu.id}/qr?format=png&size=1024`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button variant="outline" size="sm">Download PNG</Button>
                          </a>
                          <a
                            href={`/api/menus/${menu.id}/qr?format=pdf&size=1024`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button variant="outline" size="sm">Download PDF</Button>
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const origin = window.location.origin
                                const shareUrl = `${origin}/u/${menu.userId}/${menu.slug}`
                                if (navigator.share) {
                                  await navigator.share({ title: menu.name, url: shareUrl })
                                } else {
                                  await navigator.clipboard.writeText(shareUrl)
                                  showToast({ type: 'success', title: 'Link copied', description: 'Menu URL copied to clipboard.' })
                                }
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            Share Link
                          </Button>
                        </div>
                        <div className="text-xs text-secondary-500 text-center">QR codes link to a user-namespaced URL and remain valid after updates.</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Version History Modal */}
      {showVersionHistory && (
        <VersionHistory
          menuId={menu.id}
          currentVersion={optimisticMenu.version}
          onRevert={handleRevertToVersion}
          onClose={() => setShowVersionHistory(false)}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.confirmText}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false, action: null }))}
        onConfirm={() => {
          const action = confirmState.action
          setConfirmState(prev => ({ ...prev, open: false, action: null }))
          action?.()
        }}
      />
    </div>
  )
}