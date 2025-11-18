'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UXWrapper, UXSection, UXCard, UXButton, UXProgressSteps } from '@/components/ux'
import { trackConversionEvent } from '@/lib/conversion-tracking'
import { useToast } from '@/components/ui'
import type { Menu } from '@/types'

interface SampleMenu {
  id: string
  name: string
  description: string
  imageUrl: string
  extractedText: string
  category: 'restaurant' | 'cafe' | 'bar'
}

// Sample menu data with pre-configured options
const SAMPLE_MENUS: SampleMenu[] = [
  {
    id: 'sample-breakfast',
    name: 'Breakfast menu',
    description: 'Classic breakfast board with omelettes, eggs benedict, and more',
    imageUrl: '/ux/sample-menus/breakfast.jpg',
    category: 'cafe',
    extractedText: `
BREAKFAST

Three Organic Eggs Your Way! - $10.60
With mixed greens & bread

Parisian Omelette - $11.60
Ham, swiss, mushroom & spinach with baby greens

Eggs Benedict - $10.50
On brioche (Scottish, Classic, or Florentine)

Breakfast Sandwich - $10.50
Scrambled eggs & BLT

French Toast - $9.50
With maple syrup, homemade jam & whipped cream
    `.trim()
  },
  {
    id: 'sample-fine-dining',
    name: 'Fine Dining',
    description: 'Elegant multi-course selections including appetizers, mains, and desserts',
    imageUrl: '/ux/sample-menus/fine-dining.jpg',
    category: 'restaurant',
    extractedText: `
Today's Menu

Appetizers
Marinated Local Oyster Mushroom Salad - $16
Pig ear terrine, pickled plum jelly, Jerusalem artichoke, Bose pear with mint, petit greens, red wine mousseline

Main Course
Grilled Faroe Island Salmon - $26
Quinoa, oyster mushrooms, brussels sprout leaves, beet mustard

Crispy Duck in Port Cherry Sauce - $36
Roasted turnips, parsnips, rutabaga and carrots with cornmeal, duck confit, bok choy

Desserts
Tres Leches Cake - $9
Strawberry compote, strawberry balsamic

House Made Ice Cream - $9
Black raspberry
    `.trim()
  }
]

export default function DemoSampleClient() {
  const [selectedMenu, setSelectedMenu] = useState<SampleMenu | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { showToast } = useToast()

  const handleMenuSelect = async (sampleMenu: SampleMenu) => {
    setSelectedMenu(sampleMenu)
    setLoading(true)

    // Track demo flow engagement
    trackConversionEvent({
      event: 'demo_start',
      metadata: {
        path: '/ux/demo/sample',
        sampleId: sampleMenu.id,
        category: sampleMenu.category,
      },
    })

    try {
      // Create a new demo menu using the sample data
      const response = await fetch('/api/demo/menus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sampleMenu.name,
          sampleData: {
            extractedText: sampleMenu.extractedText,
            category: sampleMenu.category
          }
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create demo menu')
      }

      const menu: Menu = result.data

      // Store demo menu data in sessionStorage for the demo flow, include imageUrl for preview consistency
      const demoWithImage = { ...result.data, imageUrl: sampleMenu.imageUrl }
      sessionStorage.setItem('demoMenu', JSON.stringify(demoWithImage))

      trackConversionEvent({
        event: 'demo_completed',
        metadata: {
          path: '/ux/demo/sample',
          sampleId: sampleMenu.id,
          menuId: menu.id,
        },
      })

      // Show success message
      showToast({
        type: 'success',
        title: 'Sample menu selected',
        description: 'Starting automatic text extraction...'
      })

      // Navigate directly to extraction since we have sample text
      router.push(`/ux/menus/${menu.id}/extract`)
      
    } catch (error) {
      console.error('Error creating demo menu:', error)
      showToast({
        type: 'error',
        title: 'Failed to create demo menu',
        description: 'Please try again or contact support.'
      })
      setSelectedMenu(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <UXWrapper variant="centered">
      <UXSection>
        <div className="mb-2">
          <UXProgressSteps currentStep="upload" menuId="demo" clickable={false} />
        </div>
        {/* Page heading styled like the upload page */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Choose a Sample Menu
          </h1>
          <p className="mt-2 text-white/90 text-hero-shadow-strong">
            Try our menu creation process with one of these sample menus
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {SAMPLE_MENUS.map((sampleMenu) => (
            <UXCard 
              key={sampleMenu.id}
            >
              {/* Menu Details */}
              <div className="p-6">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="text-xl font-semibold text-ux-text">
                    {sampleMenu.name}
                  </h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-ux-primary/10 text-ux-primary capitalize">
                    {sampleMenu.category}
                  </span>
                </div>
                <p className="text-ux-text mb-2">
                  {sampleMenu.description}
                </p>
              </div>

              {/* Menu Image */}
              {sampleMenu.imageUrl ? (
                <div className="w-full h-56 md:h-64 overflow-visible flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                  src={sampleMenu.imageUrl}
                    alt={`${sampleMenu.name} preview`}
                    className="h-full max-w-full object-contain drop-shadow-md md:drop-shadow-lg"
                    loading="lazy"
                    decoding="async"
                  onError={(e) => {
                    // Try simple extension fallback from .jpg -> .png once
                    const el = e.currentTarget as HTMLImageElement
                    if (el.dataset.fallbackTried !== '1' && sampleMenu.imageUrl.endsWith('.jpg')) {
                      el.dataset.fallbackTried = '1'
                      el.src = sampleMenu.imageUrl.replace(/\\.jpg$/i, '.png')
                    } else {
                      // Final fallback to placeholder style background
                      el.style.display = 'none'
                      const parent = el.parentElement
                      if (parent) {
                        parent.innerHTML = '<div class=\"placeholder-ux w-full h-48 flex items-center justify-center\"><span class=\"text-ux-text-secondary text-sm\">Preview unavailable</span></div>'
                      }
                    }
                  }}
                  />
                </div>
              ) : (
                <div className="placeholder-ux w-full h-56 md:h-64 flex items-center justify-center shadow-md md:shadow-lg">
                  <span className="text-ux-text-secondary text-sm">
                    {sampleMenu.name} Preview
                  </span>
                </div>
              )}

              {/* Action Button at bottom */}
              <div className="p-6 pt-4">
                <UXButton
                  variant="primary"
                  size="md"
                  className="w-full"
                  loading={loading && selectedMenu?.id === sampleMenu.id}
                  disabled={loading}
                  onClick={() => !loading && handleMenuSelect(sampleMenu)}
                >
                  {loading && selectedMenu?.id === sampleMenu.id 
                    ? 'Creating demo menu...' 
                    : 'Try this menu'
                  }
                </UXButton>
              </div>
            </UXCard>
          ))}
        </div>

        {/* Back to Home Link */}
        <div className="text-center mt-8">
          <UXButton
            variant="outline"
            size="sm"
            className="bg-white/20 border-white/40 text-white hover:bg-white/30"
            onClick={() => router.push('/ux')}
            disabled={loading}
          >
            ← Back to Home
          </UXButton>
        </div>
      </UXSection>
    </UXWrapper>
  )
}