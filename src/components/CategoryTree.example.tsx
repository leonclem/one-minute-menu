/**
 * CategoryTree Component Example
 * 
 * This file demonstrates how to use the CategoryTree component
 * with sample data and handlers.
 */

'use client'

import React, { useState } from 'react'
import { CategoryTree } from './CategoryTree'
import { Category, MenuItem } from '@/lib/extraction/schema-stage1'

export function CategoryTreeExample() {
  const [categories, setCategories] = useState<Category[]>([
    {
      name: 'Appetizers',
      confidence: 0.95,
      items: [
        {
          name: 'Spring Rolls',
          price: 8.5,
          description: 'Crispy vegetable rolls with sweet chili sauce',
          confidence: 0.9
        },
        {
          name: 'Garlic Bread',
          price: 6.0,
          description: 'Toasted bread with garlic butter',
          confidence: 0.85
        },
        {
          name: 'Bruschetta',
          price: 7.5,
          confidence: 0.65 // Medium confidence - yellow
        }
      ]
    },
    {
      name: 'Main Courses',
      confidence: 0.88,
      items: [
        {
          name: 'Pasta Carbonara',
          price: 15.5,
          description: 'Creamy pasta with bacon and parmesan',
          confidence: 0.92
        },
        {
          name: 'Grilled Salmon',
          price: 22.0,
          description: 'Fresh Atlantic salmon with vegetables',
          confidence: 0.87
        }
      ],
      subcategories: [
        {
          name: 'Premium Steaks',
          confidence: 0.75,
          items: [
            {
              name: 'Ribeye Steak',
              price: 35.0,
              description: '300g premium beef',
              confidence: 0.55 // Low confidence - red
            },
            {
              name: 'Wagyu Sirloin',
              price: 48.0,
              description: 'Japanese A5 Wagyu',
              confidence: 0.45 // Low confidence - red
            }
          ]
        }
      ]
    },
    {
      name: 'Desserts',
      confidence: 0.92,
      items: [
        {
          name: 'Tiramisu',
          price: 8.0,
          description: 'Classic Italian dessert',
          confidence: 0.95
        },
        {
          name: 'Chocolate Lava Cake',
          price: 9.5,
          confidence: 0.88
        }
      ]
    }
  ])

  const handleReorder = (newCategories: Category[]) => {
    console.log('Categories reordered:', newCategories)
    setCategories(newCategories)
  }

  const handleEditItem = (
    categoryPath: number[],
    itemIndex: number,
    updates: Partial<MenuItem>
  ) => {
    console.log('Item edited:', { categoryPath, itemIndex, updates })
    
    const newCategories = JSON.parse(JSON.stringify(categories)) as Category[]
    let targetCategory = newCategories[categoryPath[0]]
    
    // Navigate to nested category if needed
    for (let i = 1; i < categoryPath.length; i++) {
      if (targetCategory.subcategories) {
        targetCategory = targetCategory.subcategories[categoryPath[i]]
      }
    }
    
    // Update the item
    targetCategory.items[itemIndex] = {
      ...targetCategory.items[itemIndex],
      ...updates
    }
    
    setCategories(newCategories)
  }

  const handleEditCategory = (
    categoryPath: number[],
    updates: Partial<Category>
  ) => {
    console.log('Category edited:', { categoryPath, updates })
    
    const newCategories = JSON.parse(JSON.stringify(categories)) as Category[]
    let targetCategory = newCategories[categoryPath[0]]
    
    // Navigate to nested category if needed
    for (let i = 1; i < categoryPath.length; i++) {
      if (targetCategory.subcategories) {
        targetCategory = targetCategory.subcategories[categoryPath[i]]
      }
    }
    
    // Update the category
    Object.assign(targetCategory, updates)
    setCategories(newCategories)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Menu Extraction Review</h1>
        <p className="text-gray-600">
          Review and edit the extracted menu items. Click on categories to expand/collapse.
          Hover over items to see edit buttons.
        </p>
        
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="font-semibold mb-2">Confidence Score Legend:</h2>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-600 rounded"></span>
              <span>High (&gt;80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-yellow-600 rounded"></span>
              <span>Medium (60-80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-600 rounded"></span>
              <span>Low (&lt;60%)</span>
            </div>
          </div>
        </div>
      </div>

      <CategoryTree
        categories={categories}
        onReorder={handleReorder}
        onEditItem={handleEditItem}
        onEditCategory={handleEditCategory}
      />

      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h2 className="font-semibold mb-2">Tips:</h2>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Click on category names to expand/collapse</li>
          <li>• Hover over text to see edit buttons</li>
          <li>• Use Enter to save, Escape to cancel when editing</li>
          <li>• Use ↑↓ buttons to reorder items within categories</li>
          <li>• Items with low confidence (red) need careful review</li>
        </ul>
      </div>
    </div>
  )
}

// Example: Readonly mode
export function CategoryTreeReadonlyExample() {
  const categories: Category[] = [
    {
      name: 'Beverages',
      confidence: 0.93,
      items: [
        {
          name: 'Coffee',
          price: 4.5,
          confidence: 0.95
        },
        {
          name: 'Tea',
          price: 3.5,
          confidence: 0.92
        }
      ]
    }
  ]

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Published Menu (Readonly)</h1>
      <CategoryTree categories={categories} readonly={true} />
    </div>
  )
}
