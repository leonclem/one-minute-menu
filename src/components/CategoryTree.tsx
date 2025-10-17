/**
 * CategoryTree Component
 * 
 * Displays extracted menu items in a hierarchical tree structure with:
 * - Expand/collapse for categories and subcategories
 * - Inline editing for category names, item names, prices, and descriptions
 * - Confidence score color coding (green >0.8, yellow 0.6-0.8, red <0.6)
 * - Move up/down buttons for reordering items
 * 
 * Requirements: 1.1, 1.3, 4.1, 7.3
 */

'use client'

import React, { useState } from 'react'
import { Category, MenuItem } from '@/lib/extraction/schema-stage1'
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Edit2, Check, X } from 'lucide-react'

interface CategoryTreeProps {
  categories: Category[]
  onReorder?: (newCategories: Category[]) => void
  onEditItem?: (categoryPath: number[], itemIndex: number, updates: Partial<MenuItem>) => void
  onEditCategory?: (categoryPath: number[], updates: Partial<Category>) => void
  // Optional exclusion controls: grey out and skip on save
  excludedKeys?: Set<string>
  onToggleExclude?: (categoryPath: number[], itemIndex: number) => void
  readonly?: boolean
}

interface EditState {
  type: 'category' | 'item'
  path: number[]
  itemIndex?: number
  field: 'name' | 'price' | 'description'
  value: string
}

export function CategoryTree({
  categories,
  onReorder,
  onEditItem,
  onEditCategory,
  excludedKeys,
  onToggleExclude,
  readonly = false
}: CategoryTreeProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [editState, setEditState] = useState<EditState | null>(null)

  const toggleCategory = (path: number[]) => {
    const key = path.join('-')
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const isCategoryExpanded = (path: number[]) => {
    return expandedCategories.has(path.join('-'))
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConfidenceBgColor = (confidence: number): string => {
    if (confidence > 0.8) return 'bg-green-50 border-green-200'
    if (confidence >= 0.6) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  const startEdit = (
    type: 'category' | 'item',
    path: number[],
    field: 'name' | 'price' | 'description',
    currentValue: string | number | undefined,
    itemIndex?: number
  ) => {
    if (readonly) return
    setEditState({
      type,
      path,
      itemIndex,
      field,
      value: String(currentValue ?? '')
    })
  }

  const cancelEdit = () => {
    setEditState(null)
  }

  const saveEdit = () => {
    if (!editState) return

    if (editState.type === 'category' && onEditCategory) {
      onEditCategory(editState.path, {
        [editState.field]: editState.value
      })
    } else if (editState.type === 'item' && editState.itemIndex !== undefined && onEditItem) {
      const value = editState.field === 'price' 
        ? parseFloat(editState.value) || 0 
        : editState.value
      
      onEditItem(editState.path, editState.itemIndex, {
        [editState.field]: value
      })
    }

    setEditState(null)
  }

  const moveItem = (categoryPath: number[], itemIndex: number, direction: 'up' | 'down') => {
    if (!onReorder || readonly) return

    const newCategories = JSON.parse(JSON.stringify(categories)) as Category[]
    let targetCategory = newCategories[categoryPath[0]]
    
    // Navigate to the correct nested category
    for (let i = 1; i < categoryPath.length; i++) {
      if (targetCategory.subcategories) {
        targetCategory = targetCategory.subcategories[categoryPath[i]]
      }
    }

    const items = targetCategory.items
    const newIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1

    if (newIndex >= 0 && newIndex < items.length) {
      // Swap items
      const temp = items[itemIndex]
      items[itemIndex] = items[newIndex]
      items[newIndex] = temp
      
      onReorder(newCategories)
    }
  }

  const renderEditableField = (
    type: 'category' | 'item',
    path: number[],
    field: 'name' | 'price' | 'description',
    value: string | number | undefined,
    itemIndex?: number,
    className?: string
  ) => {
    const isEditing = editState?.type === type &&
      editState?.path.join('-') === path.join('-') &&
      editState?.field === field &&
      editState?.itemIndex === itemIndex

    if (isEditing) {
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <input
            type={field === 'price' ? 'number' : 'text'}
            value={editState.value}
            onChange={(e) => setEditState({ ...editState, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit()
              if (e.key === 'Escape') cancelEdit()
            }}
            className="px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            autoFocus
            step={field === 'price' ? '0.01' : undefined}
          />
          <button
            onClick={saveEdit}
            className="p-1 text-green-600 hover:bg-green-50 rounded"
            title="Save"
          >
            <Check size={16} />
          </button>
          <button
            onClick={cancelEdit}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="Cancel"
          >
            <X size={16} />
          </button>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2 group">
        <span className={className}>{value ?? ''}</span>
        {!readonly && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              startEdit(type, path, field, value, itemIndex)
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-opacity"
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
        )}
      </div>
    )
  }

  const renderMenuItem = (item: MenuItem, categoryPath: number[], itemIndex: number, totalItems: number) => {
    const itemKey = `${categoryPath.join('-')}:${itemIndex}`
    const isExcluded = excludedKeys?.has(itemKey) ?? false
    const confidenceColor = getConfidenceColor(item.confidence)
    const confidenceBg = getConfidenceBgColor(item.confidence)

    return (
      <div
        key={itemIndex}
        className={`ml-8 p-3 mb-2 border rounded-lg ${isExcluded ? 'bg-gray-50 border-gray-200 opacity-60' : confidenceBg} transition-colors`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className={`flex-1 min-w-0 ${isExcluded ? 'line-through' : ''}`}>
            {/* Item Name */}
            <div className="flex items-center gap-2 mb-1">
              {renderEditableField(
                'item',
                categoryPath,
                'name',
                item.name,
                itemIndex,
                'font-medium text-gray-900'
              )}
              <span className={`text-xs font-semibold ${confidenceColor}`}>
                {Math.round(item.confidence * 100)}%
              </span>
            </div>

            {/* Item Description */}
            {(item.description || !readonly) && (
              <div className="mb-1">
                {renderEditableField(
                  'item',
                  categoryPath,
                  'description',
                  item.description,
                  itemIndex,
                  'text-sm text-gray-600'
                )}
              </div>
            )}

            {/* Item Price */}
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-500">Price:</span>
              {renderEditableField(
                'item',
                categoryPath,
                'price',
                item.price,
                itemIndex,
                'text-sm font-semibold text-gray-900'
              )}
            </div>
          </div>

          {/* Reorder Buttons */}
          {!readonly && onReorder && (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => moveItem(categoryPath, itemIndex, 'up')}
                disabled={itemIndex === 0 || isExcluded}
                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move up"
              >
                <ArrowUp size={16} />
              </button>
              <button
                onClick={() => moveItem(categoryPath, itemIndex, 'down')}
                disabled={itemIndex === totalItems - 1 || isExcluded}
                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move down"
              >
                <ArrowDown size={16} />
              </button>
              {onToggleExclude && (
                <button
                  onClick={() => onToggleExclude(categoryPath, itemIndex)}
                  className={`px-2 py-1 mt-1 rounded text-xs border ${isExcluded ? 'text-green-700 border-green-300 hover:bg-green-50' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  title={isExcluded ? 'Include this item' : "Don't add this item"}
                >
                  {isExcluded ? 'Include' : "Don\'t add"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderCategory = (category: Category, path: number[], level: number = 0) => {
    const isExpanded = isCategoryExpanded(path)
    const confidenceColor = getConfidenceColor(category.confidence)
    const hasSubcategories = category.subcategories && category.subcategories.length > 0
    const hasItems = category.items && category.items.length > 0

    return (
      <div key={path.join('-')} className="mb-3">
        {/* Category Header */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
          {/* Expand/Collapse Icon */}
          <button 
            className="text-gray-600 cursor-pointer"
            onClick={() => toggleCategory(path)}
          >
            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>

          {/* Category Name */}
          <div 
            className="flex-1 flex items-center gap-2 cursor-pointer"
            onClick={() => toggleCategory(path)}
          >
            {renderEditableField(
              'category',
              path,
              'name',
              category.name,
              undefined,
              'font-semibold text-gray-900'
            )}
            <span className={`text-xs font-semibold ${confidenceColor}`}>
              {Math.round(category.confidence * 100)}%
            </span>
          </div>

          {/* Item Count */}
          <span className="text-sm text-gray-500">
            {category.items.length} {category.items.length === 1 ? 'item' : 'items'}
            {hasSubcategories && ` • ${category.subcategories!.length} subcategories`}
          </span>
        </div>

        {/* Category Content (when expanded) */}
        {isExpanded && (
          <div className="mt-2 ml-4">
            {/* Items */}
            {hasItems && (
              <div className="mb-3">
                {category.items.map((item, itemIndex) =>
                  renderMenuItem(item, path, itemIndex, category.items.length)
                )}
              </div>
            )}

            {/* Subcategories */}
            {hasSubcategories && (
              <div className="space-y-2">
                {category.subcategories!.map((subcategory, subIndex) =>
                  renderCategory(subcategory, [...path, subIndex], level + 1)
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!categories || categories.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
        No categories to display
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {categories.map((category, index) => renderCategory(category, [index]))}
    </div>
  )
}
