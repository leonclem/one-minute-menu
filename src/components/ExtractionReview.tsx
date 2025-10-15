/**
 * Extraction Review Component
 * 
 * Displays extraction results with hierarchical categories and uncertain items
 * Integrates CategoryTree and UncertainItemsPanel for comprehensive review
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import { CategoryTree } from './CategoryTree'
import { UncertainItemsPanel } from './UncertainItemsPanel'
import type { 
  Category, 
  MenuItem as ExtractedMenuItem, 
  UncertainItem,
  ExtractionResult 
} from '@/lib/extraction/schema-stage1'

interface ExtractionReviewProps {
  result: ExtractionResult
  onSave: (categories: Category[], resolvedItems: ExtractedMenuItem[]) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function ExtractionReview({
  result,
  onSave,
  onCancel,
  loading = false
}: ExtractionReviewProps) {
  // Compute safe initial values first; hooks must be unconditional
  const hasValidResult = !!(result && result.menu && result.menu.categories)
  const initialCategories: Category[] = hasValidResult ? result.menu.categories : []
  const initialUncertain: UncertainItem[] = hasValidResult ? (result.uncertainItems || []) : []

  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [uncertainItems, setUncertainItems] = useState<UncertainItem[]>(initialUncertain)
  const [resolvedItems, setResolvedItems] = useState<ExtractedMenuItem[]>([])
  const [saving, setSaving] = useState(false)

  const handleReorder = (newCategories: Category[]) => {
    setCategories(newCategories)
  }

  const handleEditItem = (categoryPath: number[], itemIndex: number, updates: Partial<ExtractedMenuItem>) => {
    setCategories(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as Category[]
      
      // Navigate to the category
      let targetCategory = updated[categoryPath[0]]
      for (let i = 1; i < categoryPath.length; i++) {
        if (targetCategory.subcategories) {
          targetCategory = targetCategory.subcategories[categoryPath[i]]
        }
      }
      
      // Update the item
      if (targetCategory.items[itemIndex]) {
        targetCategory.items[itemIndex] = {
          ...targetCategory.items[itemIndex],
          ...updates
        }
      }
      
      return updated
    })
  }

  const handleEditCategory = (categoryPath: number[], updates: Partial<Category>) => {
    setCategories(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as Category[]
      
      // Navigate to the category
      let targetCategory = updated[categoryPath[0]]
      for (let i = 1; i < categoryPath.length; i++) {
        if (targetCategory.subcategories) {
          targetCategory = targetCategory.subcategories[categoryPath[i]]
        }
      }
      
      // Update the category
      Object.assign(targetCategory, updates)
      
      return updated
    })
  }

  const handleResolveUncertain = (itemIndex: number, resolution: {
    action: 'add_to_menu' | 'mark_superfluous' | 'needs_retake'
    category?: string
    correctedData?: {
      name?: string
      price?: number
      description?: string
    }
    feedback?: string
  }) => {
    const item = uncertainItems[itemIndex]
    if (!item) return

    if (resolution.action === 'add_to_menu' && resolution.correctedData) {
      // Add to resolved items
      const newItem: ExtractedMenuItem = {
        name: resolution.correctedData.name || item.text,
        price: resolution.correctedData.price || item.suggestedPrice || 0,
        description: resolution.correctedData.description,
        confidence: item.confidence
      }
      
      setResolvedItems(prev => [...prev, newItem])
      
      // Add to appropriate category
      if (resolution.category) {
        setCategories(prev => {
          const updated = [...prev]
          const categoryIndex = updated.findIndex(c => c.name === resolution.category)
          
          if (categoryIndex >= 0) {
            updated[categoryIndex] = {
              ...updated[categoryIndex],
              items: [...updated[categoryIndex].items, newItem]
            }
          } else {
            // Create new category
            updated.push({
              name: resolution.category || 'Uncategorized',
              items: [newItem],
              confidence: 0.8
            })
          }
          
          return updated
        })
      }
    }

    // Remove from uncertain items
    setUncertainItems(prev => prev.filter((_, idx) => idx !== itemIndex))
  }

  const handleDismissUncertain = (itemIndex: number) => {
    setUncertainItems(prev => prev.filter((_, idx) => idx !== itemIndex))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(categories, resolvedItems)
    } finally {
      setSaving(false)
    }
  }

  const totalItems = categories.reduce((sum, cat) => {
    const catItems = cat.items.length
    const subItems = cat.subcategories?.reduce((subSum, sub) => subSum + sub.items.length, 0) || 0
    return sum + catItems + subItems
  }, 0)

  // Safety check for undefined or invalid result (after hooks are declared)
  if (!hasValidResult) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold mb-2">Extraction Result Missing</h3>
        <p className="text-red-600 mb-4">
          The extraction result is not available. This may be due to an incomplete extraction or a cached result from an older version.
        </p>
        <Button onClick={onCancel} variant="outline">
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-secondary-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-secondary-900">
              Review Extracted Menu
            </h3>
            <p className="text-sm text-secondary-600 mt-1">
              {totalItems} items extracted • {categories.length} categories • {uncertainItems.length} items need review
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={saving || loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving || loading}
            >
              Save to Menu
            </Button>
          </div>
        </div>
      </div>

      {/* Uncertain Items Panel (if any) */}
      {uncertainItems.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-yellow-900 mb-3">
            Items Needing Attention ({uncertainItems.length})
          </h4>
          <UncertainItemsPanel
            items={uncertainItems}
            categories={categories}
            onResolve={handleResolveUncertain}
            onDismiss={handleDismissUncertain}
          />
        </div>
      )}

      {/* Category Tree */}
      <div className="bg-white rounded-lg border border-secondary-200 p-4">
        <h4 className="text-sm font-medium text-secondary-700 mb-3">
          Menu Structure
        </h4>
        <CategoryTree
          categories={categories}
          onReorder={handleReorder}
          onEditItem={handleEditItem}
          onEditCategory={handleEditCategory}
        />
      </div>

      {/* Superfluous Text (if any) */}
      {result.superfluousText.length > 0 && (
        <details className="bg-secondary-50 border border-secondary-200 rounded-lg p-4">
          <summary className="text-sm font-medium text-secondary-700 cursor-pointer">
            Decorative Text Detected ({result.superfluousText.length})
          </summary>
          <div className="mt-3 space-y-2">
            {result.superfluousText.map((text, idx) => (
              <div key={idx} className="text-sm text-secondary-600 bg-white p-2 rounded border">
                <div className="font-medium">{text.text}</div>
                <div className="text-xs text-secondary-500 mt-1">
                  Context: {text.context}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Extraction Metadata */}
      <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-secondary-700 mb-2">
          Extraction Details
        </h4>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-secondary-600">Currency</dt>
            <dd className="font-medium text-secondary-900">{result.currency}</dd>
          </div>
          <div>
            <dt className="text-secondary-600">Categories</dt>
            <dd className="font-medium text-secondary-900">{categories.length}</dd>
          </div>
          <div>
            <dt className="text-secondary-600">Total Items</dt>
            <dd className="font-medium text-secondary-900">{totalItems}</dd>
          </div>
          <div>
            <dt className="text-secondary-600">Uncertain Items</dt>
            <dd className="font-medium text-secondary-900">{uncertainItems.length}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
