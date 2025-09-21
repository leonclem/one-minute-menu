'use client'

import { useState, useId } from 'react'
import Link from 'next/link'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import type { MenuItem, MenuItemFormData } from '@/types'

// Mock menu data for testing
const mockMenu = {
  id: 'test-menu-1',
  name: 'Main Menu',
  status: 'draft' as const,
  items: [
    {
      id: '1',
      name: 'Chicken Rice',
      description: 'Hainanese-style chicken rice with fragrant rice',
      price: 8.50,
      category: 'Main Course',
      available: true,
      order: 0,
    },
    {
      id: '2', 
      name: 'Beef Noodles',
      description: 'Tender beef with hand-pulled noodles in rich broth',
      price: 12.00,
      category: 'Main Course',
      available: true,
      order: 1,
    },
    {
      id: '3',
      name: 'Iced Coffee',
      description: 'Traditional kopi with condensed milk',
      price: 3.50,
      category: 'Beverages',
      available: false,
      order: 2,
    },
  ] as MenuItem[]
}

export default function TestMenuEditor() {
  const availableCheckboxId = useId()
  const [menu, setMenu] = useState(mockMenu)
  const [newItem, setNewItem] = useState<MenuItemFormData>({
    name: '',
    description: '',
    price: 0,
    category: '',
    available: true,
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  // Mock functions for testing UI
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading('add')
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const newMenuItem: MenuItem = {
      ...newItem,
      id: Date.now().toString(),
      order: menu.items.length,
    }
    
    setMenu(prev => ({
      ...prev,
      items: [...prev.items, newMenuItem]
    }))
    
    setNewItem({
      name: '',
      description: '',
      price: 0,
      category: '',
      available: true,
    })
    setShowAddForm(false)
    setLoading(null)
  }

  const handleToggleAvailability = async (item: MenuItem) => {
    setLoading(item.id)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    setMenu(prev => ({
      ...prev,
      items: prev.items.map(i => 
        i.id === item.id ? { ...i, available: !i.available } : i
      )
    }))
    setLoading(null)
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return
    
    setLoading(itemId)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    setMenu(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== itemId)
    }))
    setLoading(null)
  }

  const handleMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    const currentIndex = menu.items.findIndex(item => item.id === itemId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= menu.items.length) return

    setLoading('reorder')
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))

    const reorderedItems = [...menu.items]
    const [movedItem] = reorderedItems.splice(currentIndex, 1)
    reorderedItems.splice(newIndex, 0, movedItem)

    setMenu(prev => ({
      ...prev,
      items: reorderedItems.map((item, index) => ({ ...item, order: index }))
    }))
    setLoading(null)
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/test-dashboard"
                className="text-secondary-500 hover:text-secondary-700"
              >
                ← Back
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-secondary-900">
                  {menu.name} (Test Mode)
                </h1>
                <p className="text-sm text-secondary-600">
                  {menu.items.length} items • {menu.status}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(true)}
                disabled={loading !== null}
              >
                Add Item
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-mobile py-6">
        <div className="space-y-6">
          {/* Test Notice */}
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              🧪 <strong>Test Mode:</strong> This menu editor demonstrates the UI and interactions. 
              Changes are stored locally and will reset on page refresh.
            </p>
          </div>

          {/* Add Item Form */}
          {showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle>Add New Item</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddItem} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Item Name"
                      value={newItem.name}
                      onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Chicken Rice"
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
          )}

          {/* Menu Items */}
          <div className="space-y-3">
            {menu.items.length === 0 ? (
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
                    onClick={() => setShowAddForm(true)}
                  >
                    Add First Item
                  </Button>
                </CardContent>
              </Card>
            ) : (
              menu.items.map((item, index) => (
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
                            disabled={index === menu.items.length - 1 || loading !== null}
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
                          {loading === item.id ? (
                            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                          ) : item.available ? (
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
                          {loading === item.id ? (
                            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Quick Actions */}
          {menu.items.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-secondary-900 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddForm(true)}
                    disabled={loading !== null}
                  >
                    Add Item
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={true}
                  >
                    Preview Menu
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}