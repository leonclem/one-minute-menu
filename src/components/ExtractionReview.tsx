/**
 * Extraction Review Component
 * 
 * Displays extraction results with hierarchical categories and uncertain items
 * Integrates CategoryTree and UncertainItemsPanel for comprehensive review
 */

'use client'

import { useState } from 'react'
import { Button, useToast } from '@/components/ui'
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
  jobId?: string
}

export default function ExtractionReview({
  result,
  onSave,
  onCancel,
  loading = false,
  jobId
}: ExtractionReviewProps) {
  // Compute safe initial values first; hooks must be unconditional
  const hasValidResult = !!(result && result.menu && result.menu.categories)
  const initialCategories: Category[] = hasValidResult ? result.menu.categories : []
  const initialUncertain: UncertainItem[] = hasValidResult ? (result.uncertainItems || []) : []

  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [uncertainItems, setUncertainItems] = useState<UncertainItem[]>(initialUncertain)
  const [resolvedItems, setResolvedItems] = useState<ExtractedMenuItem[]>([])
  const [saving, setSaving] = useState(false)
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set())
  const [overallFeedbackType, setOverallFeedbackType] = useState<'excellent' | 'system_error' | 'menu_unclear' | 'needs_improvement' | ''>('')
  const [overallFeedback, setOverallFeedback] = useState<string>('')
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false)
  const { showToast } = useToast()

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

  const handleSubmitItemFeedback = async (
    itemIndex: number,
    feedback: string,
    feedbackType: 'system_error' | 'menu_unclear'
  ) => {
    if (!jobId) return
    try {
      const res = await fetch('/api/extraction/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          feedbackType,
          itemId: String(itemIndex),
          comment: feedback
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast({ type: 'error', title: 'Feedback failed', description: data.error || 'Please try again.' })
        return
      }
      showToast({ type: 'success', title: 'Feedback submitted', description: 'Thanks for your help!' })
    } catch {}
  }

  const handleToggleExclude = (categoryPath: number[], itemIndex: number) => {
    const key = `${categoryPath.join('-')}:${itemIndex}`
    setExcludedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Build a copy where excluded items are removed before saving
      const filtered = JSON.parse(JSON.stringify(categories)) as Category[]

      const prune = (cats: Category[], path: number[] = []) => {
        for (let i = 0; i < cats.length; i++) {
          const cat = cats[i]
          cat.items = cat.items.filter((_, idx) => !excludedKeys.has(`${[...path, i].join('-')}:${idx}`))
          if (cat.subcategories && cat.subcategories.length > 0) prune(cat.subcategories, [...path, i])
        }
      }
      prune(filtered)

      await onSave(filtered, resolvedItems)
    } finally {
      setSaving(false)
    }
  }

  const totalItems = categories.reduce((sum, cat) => {
    const catItems = cat.items.length
    const subItems = cat.subcategories?.reduce((subSum, sub) => subSum + sub.items.length, 0) || 0
    return sum + catItems + subItems
  }, 0)

  // Heuristic detection for set/combo menus to guide users per MVP stance
  const looksLikeSetMenu = (() => {
    try {
      const re = /(prix\s*fixe|set|combo|course|for\s*2|for\s*two)/i
      const scanCats = (cats: any[]): boolean => {
        for (const c of cats || []) {
          if (re.test(String(c?.name || ''))) return true
          for (const it of c?.items || []) {
            const nm = String(it?.name || '')
            const ds = String(it?.description || '')
            if (re.test(nm) || re.test(ds)) return true
            if ((it as any)?.type === 'set_menu' || (it as any)?.setMenu) return true
          }
          if (c?.subcategories && scanCats(c.subcategories)) return true
        }
        return false
      }
      return scanCats(categories)
    } catch {
      return false
    }
  })()

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
        {looksLikeSetMenu && (
          <div className="mb-3 p-3 rounded border border-yellow-200 bg-yellow-50 text-sm text-yellow-900">
            Set menus handled separately: For set/combos like “PRIX FIXE SET FOR 2”, please create them as their own menu. This extraction focuses on individual items; set menus are treated as separate menus.
          </div>
        )}
        <CategoryTree
          categories={categories}
          onReorder={handleReorder}
          onEditItem={handleEditItem}
          onEditCategory={handleEditCategory}
          excludedKeys={excludedKeys}
          onToggleExclude={handleToggleExclude}
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

      {/* Overall Feedback */}
      {jobId && (
        <div className="bg-white rounded-lg border border-secondary-200 p-4">
          <h4 className="text-sm font-medium text-secondary-700 mb-3">Feedback on this extraction</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="overallFeedbackType"
                value="excellent"
                checked={overallFeedbackType === 'excellent'}
                onChange={() => setOverallFeedbackType('excellent')}
              />
              Excellent
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="overallFeedbackType"
                value="system_error"
                checked={overallFeedbackType === 'system_error'}
                onChange={() => setOverallFeedbackType('system_error')}
              />
              System error
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="overallFeedbackType"
                value="menu_unclear"
                checked={overallFeedbackType === 'menu_unclear'}
                onChange={() => setOverallFeedbackType('menu_unclear')}
              />
              Menu unclear
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="overallFeedbackType"
                value="needs_improvement"
                checked={overallFeedbackType === 'needs_improvement'}
                onChange={() => setOverallFeedbackType('needs_improvement')}
              />
              Needs improvement
            </label>
          </div>
          <div className="mt-3">
            <textarea
              className="w-full border rounded-md p-2 text-sm"
              rows={3}
              placeholder="Optional comments (what went well or what needs fixing)"
              value={overallFeedback}
              onChange={(e) => setOverallFeedback(e.target.value)}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              disabled={!overallFeedbackType || submittingFeedback}
              loading={submittingFeedback}
              onClick={async () => {
                if (!jobId || !overallFeedbackType) return
                setSubmittingFeedback(true)
                try {
                  const res = await fetch('/api/extraction/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      jobId,
                      feedbackType: overallFeedbackType,
                      comment: overallFeedback || undefined
                    })
                  })
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    showToast({ type: 'error', title: 'Feedback failed', description: data.error || 'Please try again.' })
                  } else {
                    setOverallFeedback('')
                    setOverallFeedbackType('')
                    showToast({ type: 'success', title: 'Feedback submitted', description: 'Thanks for your help!' })
                  }
                } finally {
                  setSubmittingFeedback(false)
                }
              }}
            >
              Submit Feedback
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
