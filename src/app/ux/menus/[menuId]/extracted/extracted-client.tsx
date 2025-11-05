'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UXSection, UXButton, UXCard } from '@/components/ux'
import { useToast } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import type { Menu, MenuItem } from '@/types'

interface UXMenuExtractedClientProps {
  menuId: string
}

export default function UXMenuExtractedClient({ menuId }: UXMenuExtractedClientProps) {
  const [demoMenu, setDemoMenu] = useState<Menu | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    // Check if this is a demo menu
    if (menuId.startsWith('demo-')) {
      const storedDemoMenu = sessionStorage.getItem('demoMenu')
      if (storedDemoMenu) {
        try {
          const parsedMenu = JSON.parse(storedDemoMenu)
          setDemoMenu(parsedMenu)
        } catch (error) {
          console.error('Error parsing demo menu:', error)
          router.push('/ux/demo/sample')
        }
      } else {
        // No demo menu data found, redirect back to sample selection
        router.push('/ux/demo/sample')
      }
    } else {
      // Handle authenticated user menu
      showToast({
        type: 'info',
        title: 'Feature coming soon',
        description: 'Authenticated user menu processing will be implemented in the next task.'
      })
    }
  }, [menuId, router, showToast])

  const handleProceedToTemplate = () => {
    setLoading(true)
    
    // Navigate to template selection
    router.push(`/ux/menus/${menuId}/template`)
  }

  const handleBackToExtraction = () => {
    router.push(`/ux/menus/${menuId}/extract`)
  }

  if (!demoMenu) {
    return (
      <UXSection 
        title="Loading..."
        subtitle="Loading your extracted menu items"
      >
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ux-primary"></div>
        </div>
      </UXSection>
    )
  }

  // Group items by category
  const itemsByCategory = demoMenu.items.reduce((acc, item) => {
    const category = item.category || 'Uncategorized'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {} as Record<string, MenuItem[]>)

  const totalItems = demoMenu.items.length
  const categories = Object.keys(itemsByCategory)

  return (
    <UXSection 
      title="Review Extracted Items"
      subtitle={`We found ${totalItems} items across ${categories.length} categories`}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Summary Card */}
        <UXCard>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-ux-text">
                {demoMenu.name}
              </h3>
              <div className="flex items-center space-x-4 text-sm text-ux-text-secondary">
                <span>{totalItems} items</span>
                <span>{categories.length} categories</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-ux-success/10 text-ux-success">
                  <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  95% confidence
                </span>
              </div>
            </div>
            <p className="text-ux-text-secondary">
              Review the extracted items below. All items look good and are ready for template selection.
            </p>
          </div>
        </UXCard>

        {/* Extracted Items by Category */}
        <div className="space-y-6">
          {categories.map((category) => (
            <UXCard key={category}>
              <div className="p-6">
                <h4 className="text-lg font-semibold text-ux-text mb-4 border-b border-ux-border pb-2">
                  {category}
                </h4>
                <div className="space-y-3">
                  {itemsByCategory[category].map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-start justify-between p-3 bg-ux-background rounded-lg border border-ux-border"
                    >
                      <div className="flex-1">
                        <h5 className="font-medium text-ux-text">
                          {item.name}
                        </h5>
                        {item.description && (
                          <p className="text-sm text-ux-text-secondary mt-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="ml-4 text-right">
                        <div className="font-semibold text-ux-text">
                          {formatCurrency(item.price)}
                        </div>
                        <div className="text-xs text-ux-text-secondary">
                          {Math.round((item.confidence || 0.95) * 100)}% confidence
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </UXCard>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <UXButton
            variant="outline"
            size="lg"
            onClick={handleBackToExtraction}
            disabled={loading}
          >
            ← Back to Extraction
          </UXButton>
          
          <UXButton
            variant="primary"
            size="lg"
            onClick={handleProceedToTemplate}
            loading={loading}
            disabled={loading}
          >
            Proceed to Template Selection →
          </UXButton>
        </div>

        {/* Demo Notice */}
        <div className="text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-lg bg-ux-primary/10 text-ux-primary text-sm">
            <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            This is a demo with sample data. Sign up to process your own menus!
          </div>
        </div>
      </div>
    </UXSection>
  )
}