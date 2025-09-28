'use client'

import { useState, useOptimistic, useId, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Input, Card, CardHeader, CardTitle, CardContent, useToast, ConfirmDialog } from '@/components/ui'
import { getAvailableThemes, applyTheme as applyThemeLib, generateThemePreview } from '@/lib/themes'
import { pickDominantColorsFromImageData } from '@/lib/color'
import { formatCurrency } from '@/lib/utils'
import { validateMenuItem } from '@/lib/validation'
import VersionHistory from '@/components/VersionHistory'
import ImageUpload from '@/components/ImageUpload'
import type { Menu, MenuItem, MenuItemFormData } from '@/types'

interface MenuEditorProps {
  menu: Menu
}

export default function MenuEditor({ menu: initialMenu }: MenuEditorProps) {
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
  const brandFileInputRef = useRef<HTMLInputElement | null>(null)
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null)
  const addItemFormRef = useRef<HTMLDivElement | null>(null)
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

  const handleApplyBranding = async (colors?: string[]) => {
    setApplyingTheme(true)
    try {
      const res = await fetch(`/api/menus/${menu.id}?action=applyTheme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate, palette: { colors } })
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
      setExtractedColors(colors)
      await handleApplyBranding(colors)
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
        setErrors({ general: result.error || 'Failed to add item' })
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
      const response = await fetch(`/api/menus/${menu.id}/ocr?force=1`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok) {
        showToast({ type: 'error', title: 'OCR failed to start', description: result.error || 'Please try again.' })
        return
      }
      setOcrJobId(result.data.id)
      setOcrStatus(result.data.status)
      pollJob(result.data.id)
    } catch (e) {
      showToast({ type: 'error', title: 'Network error', description: 'Please try again.' })
    }
  }

  const pollJob = async (jobId: string) => {
    const poll = async () => {
      const res = await fetch(`/api/ocr/jobs/${jobId}`)
      const data = await res.json()
      if (!res.ok) {
        setOcrError(data.error || 'Failed to fetch job')
        setOcrStatus('failed')
        return
      }
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
    }
    await poll()
  }

  // Update menu item
  const handleUpdateItem = async (itemId: string, updates: Partial<MenuItem>) => {
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
        return
      }

      setMenu(result.data)
      addOptimisticUpdate(result.data)
      setEditingItem(null)
    } catch (error) {
      console.error('Network error:', error)
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
        showToast({ type: 'error', title: 'Upload failed', description: result.error || 'Please try again.' })
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
                <h1 className="text-2xl font-bold text-secondary-900">
                  {optimisticMenu.name}
                </h1>
                <p className="text-sm text-secondary-600">
                  {optimisticMenu.items.length} items • {optimisticMenu.status}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
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
                variant="primary"
                size="sm"
                onClick={handlePublishMenu}
                loading={publishing}
                disabled={loading !== null}
              >
                {optimisticMenu.status === 'published' ? 'Update' : 'Publish'}
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
              <CardTitle>Brand Styling</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-secondary-700">Theme</label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="mt-1 block w-full border border-secondary-300 rounded-md px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {themeTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApplyBranding()}
                    loading={applyingTheme}
                  >
                    Apply Theme
                  </Button>
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
              {brandingPreview && (
                <div className="mt-4">
                  <img src={brandingPreview} alt="Theme preview" className="border border-secondary-200 w-full max-w-sm" />
                </div>
              )}
              {extractedColors && (
                <div className="mt-2 flex items-center gap-2">
                  {extractedColors.map((c, i) => (
                    <div key={i} className="w-6 h-6 rounded" style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
              )}
              <p className="text-xs text-secondary-600 mt-2">Choose a theme or upload a brand image to auto-extract colors. We validate contrast to meet WCAG AA where possible.</p>
            </CardContent>
          </Card>
          {/* Menu Image Section */}
          <Card>
            <CardHeader>
              <CardTitle>Menu Photo</CardTitle>
            </CardHeader>
            <CardContent>
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
                              const res = await fetch(`/api/ocr/jobs/${ocrJobId}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ useAI: true }),
                              })
                              const data = await res.json()
                              if (!res.ok) throw new Error(data.error || 'Failed to parse')
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
                              const res = await fetch(`/api/ocr/jobs/${ocrJobId}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ useAI: false }),
                              })
                              const data = await res.json()
                              if (!res.ok) throw new Error(data.error || 'Failed to parse')
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
                                          showToast({ type: 'error', title: 'Failed to add', description: result.error || 'Try again.' })
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
                                    await fetch(`/api/menus/${menu.id}/items`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(it),
                                    })
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
                <Card key={item.id} className={`${!item.available ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-secondary-900 truncate">
                            {item.name}
                          </h3>
                          {!item.available && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Out of stock
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-secondary-600 mt-1">
                            {item.description}
                          </p>
                        )}
                        {item.category && (
                          <p className="text-xs text-secondary-500 mt-1">
                            {item.category}
                          </p>
                        )}
                        <p className="text-lg font-semibold text-primary-600 mt-2">
                          {formatCurrency(item.price)}
                        </p>
                      </div>

                      {/* Mobile-friendly action buttons */}
                      <div className="flex flex-col space-y-1 ml-4">
                        {/* Move buttons */}
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleMoveItem(item.id, 'up')}
                            disabled={index === 0 || loading !== null}
                            className="p-2 text-secondary-400 hover:text-secondary-600 disabled:opacity-50 min-h-touch min-w-touch"
                            title="Move up"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleMoveItem(item.id, 'down')}
                            disabled={index === optimisticMenu.items.length - 1 || loading !== null}
                            className="p-2 text-secondary-400 hover:text-secondary-600 disabled:opacity-50 min-h-touch min-w-touch"
                            title="Move down"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        {/* Toggle availability */}
                        <button
                          onClick={() => handleToggleAvailability(item)}
                          disabled={loading === item.id}
                          className={`p-2 min-h-touch min-w-touch ${
                            item.available 
                              ? 'text-green-600 hover:text-green-700' 
                              : 'text-red-600 hover:text-red-700'
                          }`}
                          title={item.available ? 'Mark as out of stock' : 'Mark as available'}
                        >
                          {item.available ? (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={loading === item.id}
                          className="p-2 text-red-400 hover:text-red-600 disabled:opacity-50 min-h-touch min-w-touch"
                          title="Delete item"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    variant="primary"
                    size="sm"
                    onClick={handlePublishMenu}
                    loading={publishing}
                    disabled={loading !== null}
                    className="col-span-2"
                  >
                    {publishing ? 'Publishing...' : optimisticMenu.status === 'published' ? 'Publish Update' : 'Publish Menu'}
                  </Button>
                  {menu.status === 'published' && (
                    <div className="col-span-2 grid grid-cols-3 gap-3 items-start">
                      <div className="col-span-1 flex items-center justify-center border rounded-md p-3 bg-white">
                        {qrPreviewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={qrPreviewUrl} alt="QR code" className="w-32 h-32" />
                        ) : (
                          <div className="text-sm text-secondary-500">QR preview</div>
                        )}
                      </div>
                      <div className="col-span-2 flex flex-col gap-2">
                        <div className="text-sm text-secondary-700">Share your menu</div>
                        <div className="flex gap-2 flex-wrap">
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
                        <div className="text-xs text-secondary-500">QR codes link to a user-namespaced URL and remain valid after updates.</div>
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