'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { UXCard, UXButton } from './index'
import { useToast } from '@/components/ui'
import type { Menu, MenuItem } from '@/types'

interface AddItemModalProps {
  menuId: string
  /** Category to add the item into. If undefined, a category selector is shown. */
  categoryName?: string
  /** All available category names for the selector when categoryName is not pre-set */
  categories?: string[]
  onSuccess: (updatedMenu: Menu) => void
  /** Called with the newly created item immediately after creation, before the modal closes */
  onItemCreated?: (item: MenuItem) => void
  onClose: () => void
}

interface ItemDraft {
  name: string
  description: string
  price: string
  available: boolean
}

const EMPTY_DRAFT: ItemDraft = { name: '', description: '', price: '', available: true }

export function AddItemModal({ menuId, categoryName, categories = [], onSuccess, onItemCreated, onClose }: AddItemModalProps) {
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT)
  const [selectedCategory, setSelectedCategory] = useState(categoryName ?? (categories[0] ?? ''))
  const [newCategory, setNewCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  const resolvedCategory = categoryName ?? (newCategory.trim() || selectedCategory || 'Mains')

  const handleSubmit = async () => {
    if (!draft.name.trim()) {
      showToast({ type: 'error', title: 'Item name required' })
      return
    }
    const priceNum = parseFloat(draft.price)
    if (isNaN(priceNum) || priceNum < 0) {
      showToast({ type: 'error', title: 'Invalid price', description: 'Please enter a valid price.' })
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/menus/${menuId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name.trim(),
          description: draft.description.trim() || undefined,
          price: priceNum,
          category: resolvedCategory,
          available: draft.available,
          imageSource: 'none',
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to add item')
      }

      const result = await response.json()
      const updatedMenu = result.data as Menu
      const newItem = (updatedMenu.items ?? [])[updatedMenu.items.length - 1] as MenuItem | undefined
      showToast({ type: 'success', title: 'Item added', description: `"${draft.name.trim()}" added to ${resolvedCategory}.` })
      onSuccess(updatedMenu)
      if (newItem) onItemCreated?.(newItem)
      onClose()
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to add item',
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const set = (field: keyof ItemDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft(prev => ({ ...prev, [field]: e.target.value }))

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-md">
          <UXCard>
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-ux-border/60">
              <h3 className="text-sm font-semibold text-ux-text">
                {categoryName ? `Add item to ${categoryName}` : 'Add menu item'}
              </h3>
              <button
                type="button"
                className="h-7 w-7 flex items-center justify-center rounded-full text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-primary transition-colors"
                onClick={onClose}
                aria-label="Close"
                disabled={saving}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Category selector — only shown when no category is pre-set */}
              {!categoryName && (
                <div>
                  <label className="block text-sm font-medium text-ux-text mb-2">Category</label>
                  {categories.length > 0 ? (
                    <select
                      className="w-full px-3 py-2 border border-ux-border rounded-lg text-ux-text bg-ux-background focus:outline-none focus:ring-2 focus:ring-ux-primary"
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value)
                        if (e.target.value !== '__new') setNewCategory('')
                      }}
                    >
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      <option value="__new">+ New category…</option>
                    </select>
                  ) : null}
                  {(selectedCategory === '__new' || categories.length === 0) && (
                    <input
                      type="text"
                      className="mt-2 w-full px-3 py-2 border border-ux-border rounded-lg text-ux-text bg-ux-background focus:outline-none focus:ring-2 focus:ring-ux-primary"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="e.g. Mains, Starters…"
                    />
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-ux-text mb-2">Item name *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-ux-border rounded-lg text-ux-text bg-ux-background focus:outline-none focus:ring-2 focus:ring-ux-primary"
                  value={draft.name}
                  onChange={set('name')}
                  placeholder="e.g. Caesar Salad"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ux-text mb-2">Description</label>
                <textarea
                  className="w-full px-3 py-2 border border-ux-border rounded-lg text-ux-text bg-ux-background focus:outline-none focus:ring-2 focus:ring-ux-primary resize-none"
                  rows={2}
                  value={draft.description}
                  onChange={set('description')}
                  placeholder="Brief description of the item"
                />
                <p className="text-xs text-ux-text-secondary mt-1">
                  Aim for ~90–110 characters for best results in grid layouts.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ux-text mb-2">Price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-ux-border rounded-lg text-ux-text bg-ux-background focus:outline-none focus:ring-2 focus:ring-ux-primary"
                  value={draft.price}
                  onChange={set('price')}
                  placeholder="0.00"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="add-item-available"
                  className="h-4 w-4 text-ux-primary focus:ring-ux-primary border-ux-border rounded"
                  checked={draft.available}
                  onChange={(e) => setDraft(prev => ({ ...prev, available: e.target.checked }))}
                />
                <label htmlFor="add-item-available" className="text-sm text-ux-text">
                  Available for ordering
                </label>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <UXButton variant="outline" size="sm" onClick={onClose} disabled={saving}>
                  Cancel
                </UXButton>
                <UXButton
                  variant="primary"
                  size="sm"
                  onClick={handleSubmit}
                  loading={saving}
                  disabled={!draft.name.trim() || !draft.price}
                >
                  Add Item
                </UXButton>
              </div>
            </div>
          </UXCard>
        </div>
      </div>
    </div>,
    document.body
  )
}
