'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UXWrapper, UXSection, UXCard, UXButton } from '@/components/ux'
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
    id: 'sample-restaurant',
    name: 'Bella Vista Restaurant',
    description: 'Italian fine dining with classic dishes and modern presentation',
    imageUrl: '/placeholder-menu-restaurant.jpg', // Will be yellow placeholder for now
    category: 'restaurant',
    extractedText: `
BELLA VISTA RESTAURANT

APPETIZERS
Bruschetta al Pomodoro - $12.00
Fresh tomatoes, basil, garlic on toasted bread

Antipasto Platter - $18.00
Selection of cured meats, cheeses, and olives

Calamari Fritti - $15.00
Crispy fried squid with marinara sauce

PASTA
Spaghetti Carbonara - $22.00
Eggs, pancetta, parmesan, black pepper

Fettuccine Alfredo - $20.00
Creamy parmesan sauce with fresh herbs

Penne Arrabbiata - $19.00
Spicy tomato sauce with garlic and chili

MAIN COURSES
Osso Buco - $32.00
Braised veal shank with risotto milanese

Grilled Salmon - $28.00
Atlantic salmon with lemon herb butter

Chicken Parmigiana - $25.00
Breaded chicken breast with marinara and mozzarella

DESSERTS
Tiramisu - $9.00
Classic coffee-flavored dessert

Panna Cotta - $8.00
Vanilla custard with berry compote
    `.trim()
  },
  {
    id: 'sample-cafe',
    name: 'Morning Brew Cafe',
    description: 'Cozy neighborhood cafe with artisan coffee and fresh pastries',
    imageUrl: '/placeholder-menu-cafe.jpg', // Will be yellow placeholder for now
    category: 'cafe',
    extractedText: `
MORNING BREW CAFE

COFFEE & ESPRESSO
Americano - $4.50
Double shot espresso with hot water

Cappuccino - $5.25
Espresso with steamed milk and foam

Latte - $5.75
Espresso with steamed milk

Mocha - $6.00
Espresso with chocolate and steamed milk

Cold Brew - $4.75
Smooth, cold-extracted coffee

BREAKFAST
Avocado Toast - $12.00
Multigrain bread, smashed avocado, cherry tomatoes

Breakfast Burrito - $11.00
Scrambled eggs, bacon, cheese, potatoes

Pancakes - $10.00
Fluffy buttermilk pancakes with maple syrup

Granola Bowl - $9.50
House-made granola with yogurt and berries

LUNCH
Grilled Chicken Sandwich - $13.50
Herb-marinated chicken with arugula

Caesar Salad - $11.00
Romaine lettuce, parmesan, croutons

Soup of the Day - $8.00
Ask your server for today's selection

PASTRIES & SWEETS
Croissant - $3.50
Buttery, flaky French pastry

Muffin - $4.00
Blueberry or chocolate chip

Scone - $4.50
Traditional British teatime treat
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

      // Store demo menu data in sessionStorage for the demo flow
      sessionStorage.setItem('demoMenu', JSON.stringify(result.data))

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
      <UXSection 
        title="Choose a Sample Menu"
        subtitle="Try our menu creation process with one of these sample menus"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {SAMPLE_MENUS.map((sampleMenu) => (
            <UXCard 
              key={sampleMenu.id}
              className="cursor-pointer transition-all duration-200 hover:shadow-lg"
              onClick={() => !loading && handleMenuSelect(sampleMenu)}
              clickable
            >
              {/* Menu Image Placeholder */}
              <div className="placeholder-ux w-full h-48 mb-4 flex items-center justify-center">
                <span className="text-ux-text-secondary text-sm">
                  {sampleMenu.name} Preview
                </span>
              </div>

              {/* Menu Details */}
              <div className="p-6">
                <h3 className="text-xl font-semibold text-ux-text mb-2">
                  {sampleMenu.name}
                </h3>
                <p className="text-ux-text-secondary mb-4">
                  {sampleMenu.description}
                </p>
                
                {/* Category Badge */}
                <div className="mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-ux-primary/10 text-ux-primary capitalize">
                    {sampleMenu.category}
                  </span>
                </div>

                {/* Action Button */}
                <UXButton
                  variant="primary"
                  size="md"
                  className="w-full"
                  loading={loading && selectedMenu?.id === sampleMenu.id}
                  disabled={loading}
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
            size="md"
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