'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { UXButton } from './UXButton'
import { UXInput } from './UXInput'
import { useToast } from '@/components/ui'
import { fetchJsonWithRetry } from '@/lib/retry'

interface QuickItemCreatorProps {
  open: boolean
  menuId: string
  onClose: () => void
  onItemCreated: (itemId: string) => void
  /** Called after the image generation job has been queued — use to start polling */
  onImageGenerationQueued?: () => void
  /** Pre-selected category name (if known) */
  defaultCategory?: string
  /** Available categories from the current menu */
  categories?: string[]
}

export function QuickItemCreator({
  open,
  menuId,
  onClose,
  onItemCreated,
  onImageGenerationQueued,
  defaultCategory,
  categories = [],
}: QuickItemCreatorProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState(defaultCategory || '')
  const [newCategory, setNewCategory] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { showToast } = useToast()

  if (!open) return null

  const resolvedCategory = newCategory.trim() || category || 'Specials'

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast({ type: 'error', title: 'Please enter a dish name' })
      return
    }
    const parsedPrice = parseFloat(price)
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      showToast({ type: 'error', title: 'Please enter a valid price' })
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Create the menu item
      const itemResult = await fetchJsonWithRetry<{ success: boolean; data: any }>(
        `/api/menus/${menuId}/items`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            price: parsedPrice,
            category: resolvedCategory,
            available: true,
            isFlagship: true,
          }),
        }
      )

      if (!itemResult.success) {
        showToast({ type: 'error', title: 'Failed to create item' })
        return
      }

      // Find the newly created item ID from the response
      const updatedMenu = itemResult.data
      const allItems = updatedMenu?.items ?? []
      const newItem = allItems[allItems.length - 1]

      if (!newItem?.id) {
        showToast({ type: 'error', title: 'Item created but could not start photo generation' })
        onItemCreated('')
        onClose()
        return
      }

      // Close the modal immediately — the user doesn't need to wait for
      // image generation to be queued. Show a toast so they know it's underway.
      showToast({ type: 'success', title: 'Dish added! Photo generating...' })
      onItemCreated(newItem.id)
      onClose()

      // Trigger image generation in the background (non-blocking).
      // Once the job is queued, notify the parent so it can start polling
      // for status — this drives the "Generating..." overlay on the preview.
      fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuId,
          menuItemId: newItem.id,
          itemName: name.trim(),
          itemDescription: description.trim() || undefined,
          category: resolvedCategory,
          numberOfVariations: 1,
          styleParams: {
            angle: '45',
            lighting: 'natural',
          },
        }),
      })
        .then(() => onImageGenerationQueued?.())
        .catch(() => {
          // Non-fatal: item was created even if image generation fails
        })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Something went wrong',
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  What&apos;s your top seller?
                </h3>
                <p className="text-xs text-gray-500">
                  We&apos;ll generate a photo and add it to your menu
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 pb-4 space-y-4">
            <UXInput
              label="Dish name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grilled Salmon"
              autoFocus
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-ux-text">Description</label>
              <textarea
                className="input-ux w-full resize-none"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Atlantic salmon with miso glaze and seasonal vegetables"
              />
            </div>

            <UXInput
              label="Price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-ux-text">Category</label>
              {categories.length > 0 ? (
                <select
                  className="input-ux w-full"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value)
                    if (e.target.value) setNewCategory('')
                  }}
                >
                  <option value="">Select a category...</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__new">+ New category</option>
                </select>
              ) : null}
              {(category === '__new' || categories.length === 0) && (
                <UXInput
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Mains, Specials"
                />
              )}
            </div>
          </div>

          <div className="px-6 pb-5 flex gap-3">
            <UXButton
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Skip for now
            </UXButton>
            <UXButton
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={handleSubmit}
              loading={isSubmitting}
            >
              Generate photo
            </UXButton>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
