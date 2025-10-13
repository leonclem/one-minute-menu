/**
 * UncertainItemsPanel Component
 * 
 * Displays uncertain items extracted from menu images with:
 * - Reasons and confidence scores for each uncertain item
 * - Actions: add to menu, mark as superfluous, needs retake
 * - Category suggestion dropdown for adding items to menu
 * - Feedback submission for system errors
 * - Prioritized display at top of review interface
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5, 14.1, 14.2
 */

'use client'

import React, { useState } from 'react'
import { UncertainItem, Category } from '@/lib/extraction/schema-stage1'
import { AlertCircle, Plus, Trash2, Camera, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ItemResolution {
  action: 'add_to_menu' | 'mark_superfluous' | 'needs_retake'
  category?: string
  correctedData?: {
    name?: string
    price?: number
    description?: string
  }
  feedback?: string
}

export interface UncertainItemsPanelProps {
  items: UncertainItem[]
  categories: Category[]
  onResolve: (itemIndex: number, resolution: ItemResolution) => void
  onDismiss: (itemIndex: number) => void
  onSubmitFeedback?: (itemIndex: number, feedback: string, feedbackType: 'system_error' | 'menu_unclear') => void
  readonly?: boolean
}

interface EditingState {
  itemIndex: number
  name: string
  price: string
  description: string
  selectedCategory: string
}

// ============================================================================
// UncertainItemsPanel Component
// ============================================================================

export function UncertainItemsPanel({
  items,
  categories,
  onResolve,
  onDismiss,
  onSubmitFeedback,
  readonly = false
}: UncertainItemsPanelProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0])) // First item expanded by default
  const [editingState, setEditingState] = useState<EditingState | null>(null)
  const [feedbackState, setFeedbackState] = useState<{
    itemIndex: number
    feedback: string
    feedbackType: 'system_error' | 'menu_unclear'
  } | null>(null)

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const toggleItem = (itemIndex: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemIndex)) {
        next.delete(itemIndex)
      } else {
        next.add(itemIndex)
      }
      return next
    })
  }

  const isItemExpanded = (itemIndex: number) => {
    return expandedItems.has(itemIndex)
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.5) return 'text-yellow-600'
    if (confidence > 0.3) return 'text-orange-600'
    return 'text-red-600'
  }

  const getConfidenceBgColor = (confidence: number): string => {
    if (confidence > 0.5) return 'bg-yellow-50 border-yellow-300'
    if (confidence > 0.3) return 'bg-orange-50 border-orange-300'
    return 'bg-red-50 border-red-300'
  }

  const getCategoryOptions = (): string[] => {
    const options: string[] = []
    
    const extractCategories = (cats: Category[], prefix: string = '') => {
      cats.forEach(cat => {
        const fullName = prefix ? `${prefix} > ${cat.name}` : cat.name
        options.push(fullName)
        
        if (cat.subcategories && cat.subcategories.length > 0) {
          extractCategories(cat.subcategories, fullName)
        }
      })
    }
    
    extractCategories(categories)
    return options
  }

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const startAddToMenu = (itemIndex: number, item: UncertainItem) => {
    const categoryOptions = getCategoryOptions()
    setEditingState({
      itemIndex,
      name: item.text,
      price: item.suggestedPrice?.toString() || '',
      description: '',
      selectedCategory: item.suggestedCategory || categoryOptions[0] || ''
    })
  }

  const cancelEdit = () => {
    setEditingState(null)
  }

  const saveAddToMenu = () => {
    if (!editingState) return

    const price = parseFloat(editingState.price)
    if (isNaN(price) || price < 0) {
      alert('Please enter a valid price')
      return
    }

    if (!editingState.selectedCategory) {
      alert('Please select a category')
      return
    }

    onResolve(editingState.itemIndex, {
      action: 'add_to_menu',
      category: editingState.selectedCategory,
      correctedData: {
        name: editingState.name,
        price: price,
        description: editingState.description || undefined
      }
    })

    setEditingState(null)
  }

  const handleMarkSuperfluous = (itemIndex: number) => {
    if (confirm('Mark this item as superfluous (decorative text)?')) {
      onResolve(itemIndex, {
        action: 'mark_superfluous'
      })
    }
  }

  const handleNeedsRetake = (itemIndex: number) => {
    if (confirm('Mark this extraction as needing a photo retake?')) {
      onResolve(itemIndex, {
        action: 'needs_retake'
      })
    }
  }

  const startFeedback = (itemIndex: number) => {
    setFeedbackState({
      itemIndex,
      feedback: '',
      feedbackType: 'system_error'
    })
  }

  const cancelFeedback = () => {
    setFeedbackState(null)
  }

  const submitFeedback = () => {
    if (!feedbackState || !onSubmitFeedback) return

    if (!feedbackState.feedback.trim()) {
      alert('Please enter feedback')
      return
    }

    onSubmitFeedback(
      feedbackState.itemIndex,
      feedbackState.feedback,
      feedbackState.feedbackType
    )

    setFeedbackState(null)
  }

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderEditForm = (item: UncertainItem) => {
    if (!editingState) return null

    const categoryOptions = getCategoryOptions()

    return (
      <div className="mt-3 p-4 bg-white border border-blue-300 rounded-lg space-y-3">
        <h4 className="font-semibold text-gray-900 text-sm">Add to Menu</h4>
        
        {/* Item Name */}
        <div>
          <label htmlFor="edit-item-name" className="block text-xs font-medium text-gray-700 mb-1">
            Item Name *
          </label>
          <input
            id="edit-item-name"
            type="text"
            value={editingState.name}
            onChange={(e) => setEditingState({ ...editingState, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Enter item name"
          />
        </div>

        {/* Price */}
        <div>
          <label htmlFor="edit-item-price" className="block text-xs font-medium text-gray-700 mb-1">
            Price *
          </label>
          <input
            id="edit-item-price"
            type="number"
            step="0.01"
            min="0"
            value={editingState.price}
            onChange={(e) => setEditingState({ ...editingState, price: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="0.00"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="edit-item-description" className="block text-xs font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            id="edit-item-description"
            value={editingState.description}
            onChange={(e) => setEditingState({ ...editingState, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Enter description"
            rows={2}
          />
        </div>

        {/* Category Selection */}
        <div>
          <label htmlFor="edit-item-category" className="block text-xs font-medium text-gray-700 mb-1">
            Category *
          </label>
          <select
            id="edit-item-category"
            value={editingState.selectedCategory}
            onChange={(e) => setEditingState({ ...editingState, selectedCategory: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {categoryOptions.length === 0 ? (
              <option value="">No categories available</option>
            ) : (
              categoryOptions.map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={saveAddToMenu}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Add to Menu
          </button>
          <button
            onClick={cancelEdit}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const renderFeedbackForm = () => {
    if (!feedbackState) return null

    return (
      <div className="mt-3 p-4 bg-white border border-purple-300 rounded-lg space-y-3">
        <h4 className="font-semibold text-gray-900 text-sm">Submit Feedback</h4>
        
        {/* Feedback Type */}
        <div>
          <label htmlFor="feedback-type" className="block text-xs font-medium text-gray-700 mb-1">
            Issue Type
          </label>
          <select
            id="feedback-type"
            value={feedbackState.feedbackType}
            onChange={(e) => setFeedbackState({
              ...feedbackState,
              feedbackType: e.target.value as 'system_error' | 'menu_unclear'
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          >
            <option value="system_error">System Error (extraction issue)</option>
            <option value="menu_unclear">Menu Unclear (photo quality)</option>
          </select>
        </div>

        {/* Feedback Text */}
        <div>
          <label htmlFor="feedback-text" className="block text-xs font-medium text-gray-700 mb-1">
            Feedback *
          </label>
          <textarea
            id="feedback-text"
            value={feedbackState.feedback}
            onChange={(e) => setFeedbackState({ ...feedbackState, feedback: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            placeholder="Describe the issue..."
            rows={3}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={submitFeedback}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            Submit Feedback
          </button>
          <button
            onClick={cancelFeedback}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const renderUncertainItem = (item: UncertainItem, itemIndex: number) => {
    const isExpanded = isItemExpanded(itemIndex)
    const isEditing = editingState?.itemIndex === itemIndex
    const isFeedbackOpen = feedbackState?.itemIndex === itemIndex
    const confidenceColor = getConfidenceColor(item.confidence)
    const confidenceBg = getConfidenceBgColor(item.confidence)

    return (
      <div
        key={itemIndex}
        className={`border rounded-lg ${confidenceBg} transition-all`}
      >
        {/* Item Header */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Left: Icon and Content */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <AlertCircle className={`${confidenceColor} flex-shrink-0 mt-0.5`} size={20} />
              
              <div className="flex-1 min-w-0">
                {/* Text and Confidence */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 truncate">
                    {item.text}
                  </span>
                  <span className={`text-xs font-semibold ${confidenceColor} flex-shrink-0`}>
                    {Math.round(item.confidence * 100)}%
                  </span>
                </div>

                {/* Reason */}
                <p className="text-sm text-gray-600 mb-2">
                  {item.reason}
                </p>

                {/* Suggestions */}
                {(item.suggestedCategory || item.suggestedPrice !== undefined) && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {item.suggestedCategory && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        Suggested: {item.suggestedCategory}
                      </span>
                    )}
                    {item.suggestedPrice !== undefined && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                        Price: ${item.suggestedPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Expand/Collapse Button */}
            <button
              onClick={() => toggleItem(itemIndex)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>

          {/* Action Buttons (when expanded) */}
          {isExpanded && !readonly && !isEditing && !isFeedbackOpen && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => startAddToMenu(itemIndex, item)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus size={16} />
                Add to Menu
              </button>
              
              <button
                onClick={() => handleMarkSuperfluous(itemIndex)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                <Trash2 size={16} />
                Mark Superfluous
              </button>
              
              <button
                onClick={() => handleNeedsRetake(itemIndex)}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-sm font-medium"
              >
                <Camera size={16} />
                Needs Retake
              </button>
              
              {onSubmitFeedback && (
                <button
                  onClick={() => startFeedback(itemIndex)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  <MessageSquare size={16} />
                  Submit Feedback
                </button>
              )}
            </div>
          )}

          {/* Edit Form */}
          {isExpanded && isEditing && renderEditForm(item)}

          {/* Feedback Form */}
          {isExpanded && isFeedbackOpen && renderFeedbackForm()}
        </div>
      </div>
    )
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  if (!items || items.length === 0) {
    return (
      <div className="p-6 text-center bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center justify-center gap-2 text-green-700">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">No uncertain items - all items extracted successfully!</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center gap-2">
          <AlertCircle className="text-yellow-600" size={20} />
          <span className="font-semibold text-gray-900">
            {items.length} {items.length === 1 ? 'Item' : 'Items'} Need Review
          </span>
        </div>
        <span className="text-sm text-gray-600">
          Please review and resolve uncertain items
        </span>
      </div>

      {/* Uncertain Items List */}
      {items.map((item, index) => renderUncertainItem(item, index))}
    </div>
  )
}
