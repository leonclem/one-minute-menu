'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UXWrapper, UXSection, UXCard, UXButton } from '@/components/ux'
import { trackConversionEvent } from '@/lib/conversion-tracking'
import { useToast } from '@/components/ui'
import ZoomableImageModal from '@/components/ZoomableImageModal'
import type { Menu } from '@/types'
import { normalizeDemoMenu } from '@/lib/demo-menu-normalizer'

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
    imageUrl: '/sample-menus/breakfast.jpg',
    category: 'cafe',
    extractedText: `
BREAKFAST

Three Organic Eggs Your Way! - $10.60
With mixed greens & bread

Parisian Omelette - $11.60
Ham, swiss, mushroom & spinach with baby greens

Two Soft-Boiled Eggs & 'Mouillettes' - $8.80
With bread fingers

Provençal Eggs - $10.50
2 sunny side-up eggs, fried tomatoes & provence herbs

Eggs Benedict - $13.50
On brioche (Scottish, Classic, or Florentine)

Le Parfait - $7.95
Homemade granola & yogurt with fresh fruit

Morning Tartine - $5.80
With non-salted butter & jam/acacia honey

Country Tartine - $9.95
Ham & brie with cornichons & non-salted butter

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
    imageUrl: '/sample-menus/chef---handwritten.png',
    category: 'restaurant',
    extractedText: `
TODAY'S MENU

APPETIZERS

Rutabaga and Toasted Hazelnut Soup - $12
Soy roasted hazelnuts, horseradish cream, Chällerhocker

Marinated Local Oyster Mushroom Salad - $16
Pig ear terrine, pickled plum jelly, Jerusalem artichoke, Bosc pear with mint, petit greens, red wine mousseline

MAIN ENTRÉES

Grilled Faroe Island Salmon - $26
Quinoa, oyster mushrooms, brussels sprout leaves, beet mustard

Pan Roasted Duck Breast - $29
Herbed farro, orange-frisée salad, honey gastrique

Crispy Duck in Port Cherry Sauce - $36
Roasted turnips, parsnips, rutabaga and carrots with cornmeal, johnnycake wrapped duck confit, bok choy

Tenderloin of Beef Wellington - $48
Foie gras, spinach, duxelles

DESSERTS

Tres Leches Cake - $9
Strawberry compote, strawberry balsamic

Key Lime Pudding - $8
Chantilly cream & wafer cookies

House Made Ice Cream - $9
Black raspberry
`.trim()
  }
]

export default function DemoSampleClient() {
  const [selectedMenu, setSelectedMenu] = useState<SampleMenu | null>(null)
  const [loading, setLoading] = useState(false)
  const [zoomMenu, setZoomMenu] = useState<SampleMenu | null>(null)
  const router = useRouter()
  const { showToast } = useToast()

  const handleMenuSelect = async (sampleMenu: SampleMenu) => {
    setSelectedMenu(sampleMenu)
    setLoading(true)

    // Track demo flow engagement
    trackConversionEvent({
      event: 'demo_start',
      metadata: {
        path: '/demo/sample',
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

      const menu: Menu = normalizeDemoMenu(result.data) as Menu
      const flowMenuId = menu.id?.startsWith('demo-') ? menu.id : `demo-${menu.id}`

      // Parse the sample text into menu items now, so /extracted has them immediately
      const extractedItems = parseSampleTextToItems(sampleMenu.extractedText)

      // Store demo menu data in sessionStorage for the demo flow, include imageUrl and pre-parsed items
      const demoWithImage = { ...menu, imageUrl: sampleMenu.imageUrl, items: extractedItems }
      sessionStorage.setItem('demoMenu', JSON.stringify(demoWithImage))

      trackConversionEvent({
        event: 'demo_completed',
        metadata: {
          path: '/demo/sample',
          sampleId: sampleMenu.id,
          menuId: menu.id,
        },
      })

      // Show success message
      showToast({
        type: 'success',
        title: 'Sample menu selected',
        description: 'Extracting menu items...'
      })

      // Navigate directly to extracted results, skipping the extract preview step
      router.push(`/menus/${flowMenuId}/extracted`)
      
    } catch (error) {
      console.error('Error creating demo menu:', error)
      showToast({
        type: 'error',
        title: 'Demo menu could not be created',
        description: 'The sample menu failed to start. Please try again in a moment or choose the other sample.'
      })
      setSelectedMenu(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <UXWrapper variant="centered">
      <UXSection>
        {/* Page heading */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Choose a sample menu to get started
          </h1>
          <p className="mt-2 text-white/90 text-hero-shadow-strong">
            Tap a photo to zoom in, then hit <strong>Use this photo</strong> — our AI will extract the items automatically
          </p>
        </div>

        {/* Zoom modal */}
        {zoomMenu && (
          <ZoomableImageModal
            isOpen={!!zoomMenu}
            onClose={() => setZoomMenu(null)}
            url={zoomMenu.imageUrl}
            alt={`${zoomMenu.name} preview`}
          />
        )}

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

              {/* Menu Image — zoomable */}
              {sampleMenu.imageUrl ? (
                <div className="w-full h-56 md:h-64 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setZoomMenu(sampleMenu)}
                    className="relative inline-flex items-center justify-center focus:outline-none group cursor-zoom-in"
                    aria-label={`Zoom in on ${sampleMenu.name} photo`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sampleMenu.imageUrl}
                      alt={`${sampleMenu.name} preview`}
                      className="max-h-56 md:max-h-64 max-w-full object-contain drop-shadow-md md:drop-shadow-lg"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const el = e.currentTarget as HTMLImageElement
                        if (el.dataset.fallbackTried !== '1' && sampleMenu.imageUrl.endsWith('.jpg')) {
                          el.dataset.fallbackTried = '1'
                          el.src = sampleMenu.imageUrl.replace(/\.jpg$/i, '.png')
                        } else {
                          el.style.display = 'none'
                          const parent = el.parentElement
                          if (parent) {
                            parent.innerHTML = '<div class="placeholder-ux w-full h-48 flex items-center justify-center"><span class="text-ux-text-secondary text-sm">Preview unavailable</span></div>'
                          }
                        }
                      }}
                    />
                    {/* Zoom hint — centred over the image, fades in on hover */}
                    <span
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                      aria-hidden="true"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-10 h-10 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
                      >
                        <circle cx="11" cy="11" r="7" />
                        <line x1="16.5" y1="16.5" x2="22" y2="22" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                        <line x1="11" y1="8" x2="11" y2="14" />
                      </svg>
                    </span>
                  </button>
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
                    : 'Use this photo'
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
            onClick={() => router.push('/')}
            disabled={loading}
          >
            ← Back to Home
          </UXButton>
        </div>
      </UXSection>
    </UXWrapper>
  )
}

// Parse sample menu text into menu items (mirrors the logic in extract-client.tsx)
function parseSampleTextToItems(text: string) {
  const lines = text.split('\n').filter(line => line.trim())
  const items = []
  let currentCategory = ''
  let itemOrder = 0
  let currentItem: any = null

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Skip empty lines and restaurant name
    if (!trimmedLine || trimmedLine.includes('RESTAURANT') || trimmedLine.includes('CAFE')) {
      continue
    }

    // Category header: all caps, no price, has letters, length > 2
    if (trimmedLine === trimmedLine.toUpperCase() && !trimmedLine.includes('$') && /[A-Z]/.test(trimmedLine) && trimmedLine.length > 2) {
      currentCategory = trimmedLine
      currentItem = null
      continue
    }

    // Menu item: has a price
    const priceMatch = trimmedLine.match(/\$(\d+\.?\d*)/)
    if (priceMatch) {
      const price = parseFloat(priceMatch[1])
      let namePart = trimmedLine.substring(0, trimmedLine.indexOf('$')).trim()
      if (namePart.endsWith('-')) namePart = namePart.slice(0, -1).trim()

      const priceEndIndex = trimmedLine.indexOf(priceMatch[0]) + priceMatch[0].length
      let description = trimmedLine.substring(priceEndIndex).trim()
      if (description.startsWith('-')) description = description.substring(1).trim()

      const newItem = {
        id: `demo-item-${Date.now()}-${itemOrder}`,
        name: namePart,
        description: description || '',
        price,
        available: true,
        category: currentCategory || 'Main',
        order: itemOrder,
        confidence: 0.95,
        imageSource: 'none' as const,
      }

      items.push(newItem)
      currentItem = newItem
      itemOrder++
    } else if (currentItem) {
      // Continuation line — append to previous item's description
      currentItem.description = currentItem.description
        ? `${currentItem.description} ${trimmedLine}`
        : trimmedLine
    }
  }

  return items
}
