'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UXSection, UXButton, UXCard } from '@/components/ux'
import { useToast } from '@/components/ui'
import type { Menu } from '@/types'

interface UXMenuExtractClientProps {
  menuId: string
}

export default function UXMenuExtractClient({ menuId }: UXMenuExtractClientProps) {
  const [demoMenu, setDemoMenu] = useState<Menu & { sampleData?: any } | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractionComplete, setExtractionComplete] = useState(false)
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
      // Handle authenticated user menu extraction
      // This would integrate with existing menu extraction functionality
      showToast({
        type: 'info',
        title: 'Feature coming soon',
        description: 'Authenticated user menu extraction will be implemented in the next task.'
      })
    }
  }, [menuId, router, showToast])

  const handleExtractItems = async () => {
    if (!demoMenu?.sampleData?.extractedText) {
      showToast({
        type: 'error',
        title: 'No sample data',
        description: 'Please select a sample menu first.'
      })
      return
    }

    setExtracting(true)

    try {
      // Simulate extraction process for demo
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Parse the sample text into menu items (simplified parsing for demo)
      const extractedItems = parseSampleTextToItems(demoMenu.sampleData.extractedText)
      
      // Update demo menu with extracted items
      const updatedDemoMenu = {
        ...demoMenu,
        items: extractedItems,
        extractionMetadata: {
          schemaVersion: 'stage1' as const,
          promptVersion: 'demo-v1',
          confidence: 0.95,
          extractedAt: new Date(),
          jobId: `demo-job-${Date.now()}`
        }
      }

      // Store updated demo menu
      sessionStorage.setItem('demoMenu', JSON.stringify(updatedDemoMenu))
      setDemoMenu(updatedDemoMenu)
      setExtractionComplete(true)

      showToast({
        type: 'success',
        title: 'Extraction complete',
        description: `Successfully extracted ${extractedItems.length} menu items`
      })

    } catch (error) {
      console.error('Error during extraction:', error)
      showToast({
        type: 'error',
        title: 'Extraction failed',
        description: 'Please try again or contact support.'
      })
    } finally {
      setExtracting(false)
    }
  }

  const handleProceedToResults = () => {
    router.push(`/ux/menus/${menuId}/extracted`)
  }

  if (!demoMenu) {
    return (
      <UXSection 
        title="Loading..."
        subtitle="Preparing your demo menu"
      >
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ux-primary"></div>
        </div>
      </UXSection>
    )
  }

  return (
    <UXSection 
      title="Extract Menu Items"
      subtitle={`Our AI will extract all items from ${demoMenu.name}`}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Menu Preview */}
        <UXCard>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-ux-text mb-2">
              {demoMenu.name}
            </h3>
            <p className="text-ux-text-secondary mb-4">
              Sample menu ready for extraction
            </p>
            
            {/* Sample Text Preview */}
            <div className="bg-ux-background border border-ux-border rounded-lg p-4 max-h-48 overflow-y-auto">
              <pre className="text-sm text-ux-text-secondary whitespace-pre-wrap font-mono">
                {demoMenu.sampleData?.extractedText?.substring(0, 300)}
                {demoMenu.sampleData?.extractedText?.length > 300 && '...'}
              </pre>
            </div>
          </div>
        </UXCard>

        {/* Extraction Controls */}
        <div className="text-center space-y-4">
          {!extractionComplete ? (
            <UXButton
              variant="primary"
              size="lg"
              onClick={handleExtractItems}
              loading={extracting}
              disabled={extracting}
            >
              {extracting ? 'Extracting items...' : 'Extract Items'}
            </UXButton>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-ux-success/10 text-ux-success">
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Extraction Complete
                </div>
              </div>
              
              <UXButton
                variant="primary"
                size="lg"
                onClick={handleProceedToResults}
              >
                View Extracted Items
              </UXButton>
            </div>
          )}

          {/* Back Button */}
          <div>
            <UXButton
              variant="outline"
              size="md"
              onClick={() => router.push('/ux/demo/sample')}
              disabled={extracting}
            >
              ← Back to Sample Selection
            </UXButton>
          </div>
        </div>
      </div>
    </UXSection>
  )
}

// Helper function to parse sample text into menu items
function parseSampleTextToItems(text: string) {
  const lines = text.split('\n').filter(line => line.trim())
  const items = []
  let currentCategory = ''
  let itemOrder = 0

  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // Skip empty lines and restaurant name
    if (!trimmedLine || trimmedLine.includes('RESTAURANT') || trimmedLine.includes('CAFE')) {
      continue
    }
    
    // Check if this is a category header (all caps, no price)
    if (trimmedLine === trimmedLine.toUpperCase() && !trimmedLine.includes('$')) {
      currentCategory = trimmedLine
      continue
    }
    
    // Check if this line contains a menu item (has a price)
    const priceMatch = trimmedLine.match(/\$(\d+\.?\d*)/)
    if (priceMatch) {
      const price = parseFloat(priceMatch[1])
      const nameAndDescription = trimmedLine.replace(/\s*-\s*\$\d+\.?\d*.*$/, '').trim()
      const descriptionMatch = trimmedLine.match(/-\s*\$\d+\.?\d*\s*(.*)$/)
      const description = descriptionMatch ? descriptionMatch[1].trim() : ''
      
      items.push({
        id: `demo-item-${Date.now()}-${itemOrder}`,
        name: nameAndDescription,
        description: description || '',
        price: price,
        available: true,
        category: currentCategory,
        order: itemOrder,
        confidence: 0.95,
        imageSource: 'none' as const
      })
      
      itemOrder++
    }
  }
  
  return items
}