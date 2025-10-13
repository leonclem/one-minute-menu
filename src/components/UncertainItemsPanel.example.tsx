/**
 * Example Usage of UncertainItemsPanel Component
 * 
 * This file demonstrates how to use the UncertainItemsPanel component
 * in a menu extraction review interface.
 */

'use client'

import React, { useState } from 'react'
import { UncertainItemsPanel, ItemResolution } from './UncertainItemsPanel'
import { UncertainItem, Category } from '@/lib/extraction/schema-stage1'

// ============================================================================
// Example Data
// ============================================================================

const exampleCategories: Category[] = [
  {
    name: 'Appetizers',
    items: [
      {
        name: 'Spring Rolls',
        price: 8.50,
        description: 'Crispy vegetable rolls',
        confidence: 0.95
      }
    ],
    confidence: 0.95
  },
  {
    name: 'Main Courses',
    items: [],
    subcategories: [
      {
        name: 'Seafood',
        items: [],
        confidence: 0.9
      },
      {
        name: 'Steaks',
        items: [],
        confidence: 0.92
      }
    ],
    confidence: 0.91
  },
  {
    name: 'Desserts',
    items: [],
    confidence: 0.88
  }
]

const exampleUncertainItems: UncertainItem[] = [
  {
    text: 'Grilled Salmon Fillet',
    reason: 'Price partially obscured by shadow in image',
    confidence: 0.45,
    suggestedCategory: 'Main Courses',
    suggestedPrice: 24.99
  },
  {
    text: 'Chef\'s Special',
    reason: 'Text is blurry and difficult to read clearly',
    confidence: 0.28
  },
  {
    text: 'Seasonal Soup of the Day',
    reason: 'Price not visible in the menu image',
    confidence: 0.62,
    suggestedCategory: 'Appetizers'
  },
  {
    text: 'Wagyu Beef Burger',
    reason: 'Multiple prices listed, unclear which applies',
    confidence: 0.55,
    suggestedCategory: 'Main Courses',
    suggestedPrice: 18.50
  }
]

// ============================================================================
// Example Component
// ============================================================================

export function UncertainItemsPanelExample() {
  const [uncertainItems, setUncertainItems] = useState<UncertainItem[]>(exampleUncertainItems)
  const [resolvedItems, setResolvedItems] = useState<Array<{
    item: UncertainItem
    resolution: ItemResolution
  }>>([])

  // Handle item resolution
  const handleResolve = (itemIndex: number, resolution: ItemResolution) => {
    const item = uncertainItems[itemIndex]
    
    // Add to resolved items
    setResolvedItems(prev => [...prev, { item, resolution }])
    
    // Remove from uncertain items
    setUncertainItems(prev => prev.filter((_, idx) => idx !== itemIndex))
    
    console.log('Item resolved:', { item, resolution })
  }

  // Handle item dismissal
  const handleDismiss = (itemIndex: number) => {
    setUncertainItems(prev => prev.filter((_, idx) => idx !== itemIndex))
    console.log('Item dismissed:', itemIndex)
  }

  // Handle feedback submission
  const handleSubmitFeedback = (
    itemIndex: number,
    feedback: string,
    feedbackType: 'system_error' | 'menu_unclear'
  ) => {
    const item = uncertainItems[itemIndex]
    console.log('Feedback submitted:', {
      item,
      feedback,
      feedbackType
    })
    
    // In a real app, you would send this to your backend
    alert(`Feedback submitted:\nType: ${feedbackType}\nFeedback: ${feedback}`)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Menu Extraction Review
        </h1>
        <p className="text-gray-600">
          Review and resolve uncertain items from the menu extraction
        </p>
      </div>

      {/* Uncertain Items Panel */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Uncertain Items
        </h2>
        <UncertainItemsPanel
          items={uncertainItems}
          categories={exampleCategories}
          onResolve={handleResolve}
          onDismiss={handleDismiss}
          onSubmitFeedback={handleSubmitFeedback}
        />
      </div>

      {/* Resolved Items Summary */}
      {resolvedItems.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Resolved Items ({resolvedItems.length})
          </h2>
          <div className="space-y-2">
            {resolvedItems.map((resolved, idx) => (
              <div
                key={idx}
                className="p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {resolved.item.text}
                  </span>
                  <span className="text-sm text-green-700 font-medium">
                    {resolved.resolution.action === 'add_to_menu' && 'Added to Menu'}
                    {resolved.resolution.action === 'mark_superfluous' && 'Marked Superfluous'}
                    {resolved.resolution.action === 'needs_retake' && 'Needs Retake'}
                  </span>
                </div>
                {resolved.resolution.action === 'add_to_menu' && resolved.resolution.correctedData && (
                  <div className="mt-2 text-sm text-gray-600">
                    <div>Category: {resolved.resolution.category}</div>
                    <div>Price: ${resolved.resolution.correctedData.price?.toFixed(2)}</div>
                    {resolved.resolution.correctedData.description && (
                      <div>Description: {resolved.resolution.correctedData.description}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Example Code */}
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          Example Usage
        </h3>
        <pre className="text-xs text-gray-700 overflow-x-auto">
{`import { UncertainItemsPanel } from '@/components/UncertainItemsPanel'

<UncertainItemsPanel
  items={uncertainItems}
  categories={categories}
  onResolve={(itemIndex, resolution) => {
    // Handle item resolution
    console.log('Resolved:', resolution)
  }}
  onDismiss={(itemIndex) => {
    // Handle item dismissal
    console.log('Dismissed:', itemIndex)
  }}
  onSubmitFeedback={(itemIndex, feedback, feedbackType) => {
    // Handle feedback submission
    console.log('Feedback:', feedback, feedbackType)
  }}
/>`}
        </pre>
      </div>
    </div>
  )
}

// ============================================================================
// Readonly Example
// ============================================================================

export function UncertainItemsPanelReadonlyExample() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Readonly View
      </h1>
      <UncertainItemsPanel
        items={exampleUncertainItems}
        categories={exampleCategories}
        onResolve={() => {}}
        onDismiss={() => {}}
        readonly={true}
      />
    </div>
  )
}

// ============================================================================
// Empty State Example
// ============================================================================

export function UncertainItemsPanelEmptyExample() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        No Uncertain Items
      </h1>
      <UncertainItemsPanel
        items={[]}
        categories={exampleCategories}
        onResolve={() => {}}
        onDismiss={() => {}}
      />
    </div>
  )
}
