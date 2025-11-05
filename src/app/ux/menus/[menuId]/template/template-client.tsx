'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UXSection, UXButton, UXCard } from '@/components/ux'
import { useToast } from '@/components/ui'
import type { Menu } from '@/types'

interface UXMenuTemplateClientProps {
  menuId: string
}

interface Template {
  id: string
  name: string
  description: string
  preview: string
  features: string[]
}

// Available templates (MVP: single template)
const AVAILABLE_TEMPLATES: Template[] = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean, contemporary design with excellent readability',
    preview: '/placeholder-template-modern.jpg',
    features: [
      'Mobile-optimized layout',
      'Clear typography',
      'Category organization',
      'Price highlighting',
      'Professional appearance'
    ]
  }
]

export default function UXMenuTemplateClient({ menuId }: UXMenuTemplateClientProps) {
  const [demoMenu, setDemoMenu] = useState<Menu | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(AVAILABLE_TEMPLATES[0])
  const [loading, setLoading] = useState(false)
  const [isDemoUser, setIsDemoUser] = useState(false)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    // Check if this is a demo menu
    if (menuId.startsWith('demo-')) {
      setIsDemoUser(true)
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
      setIsDemoUser(false)
      showToast({
        type: 'info',
        title: 'Feature coming soon',
        description: 'Authenticated user template selection will be implemented in the next task.'
      })
    }
  }, [menuId, router, showToast])

  const handleSelectTemplate = async () => {
    if (!demoMenu) return

    setLoading(true)

    try {
      // Apply the selected template to the demo menu
      const updatedDemoMenu = {
        ...demoMenu,
        theme: {
          ...demoMenu.theme,
          id: selectedTemplate.id,
          name: selectedTemplate.name
        }
      }

      // Store updated demo menu
      sessionStorage.setItem('demoMenu', JSON.stringify(updatedDemoMenu))
      setDemoMenu(updatedDemoMenu)

      showToast({
        type: 'success',
        title: 'Template applied',
        description: `${selectedTemplate.name} template has been applied to your menu`
      })

      // Navigate based on user type
      if (isDemoUser) {
        // Demo users go to export
        router.push(`/ux/menus/${menuId}/export`)
      } else {
        // Authenticated users would go to preview (not implemented yet)
        showToast({
          type: 'info',
          title: 'Preview coming soon',
          description: 'Preview functionality will be implemented in the next task.'
        })
      }

    } catch (error) {
      console.error('Error applying template:', error)
      showToast({
        type: 'error',
        title: 'Template application failed',
        description: 'Please try again or contact support.'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBackToExtracted = () => {
    router.push(`/ux/menus/${menuId}/extracted`)
  }

  if (!demoMenu && isDemoUser) {
    return (
      <UXSection 
        title="Loading..."
        subtitle="Loading template options"
      >
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ux-primary"></div>
        </div>
      </UXSection>
    )
  }

  return (
    <UXSection 
      title="Choose Your Template"
      subtitle="Select a template for your digital menu"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Menu Summary */}
        {demoMenu && (
          <UXCard>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-ux-text mb-2">
                {demoMenu.name}
              </h3>
              <p className="text-ux-text-secondary">
                {demoMenu.items.length} items ready for template application
              </p>
            </div>
          </UXCard>
        )}

        {/* Template Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Template Options */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-ux-text">Available Templates</h4>
            
            {AVAILABLE_TEMPLATES.map((template) => (
              <UXCard 
                key={template.id}
                className={`cursor-pointer transition-all duration-200 ${
                  selectedTemplate.id === template.id 
                    ? 'ring-2 ring-ux-primary border-ux-primary' 
                    : 'hover:shadow-lg'
                }`}
                onClick={() => setSelectedTemplate(template)}
                clickable
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h5 className="text-lg font-semibold text-ux-text">
                      {template.name}
                    </h5>
                    {selectedTemplate.id === template.id && (
                      <div className="flex items-center text-ux-primary">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-ux-text-secondary mb-4">
                    {template.description}
                  </p>
                  
                  <div className="space-y-2">
                    <h6 className="text-sm font-medium text-ux-text">Features:</h6>
                    <ul className="text-sm text-ux-text-secondary space-y-1">
                      {template.features.map((feature, index) => (
                        <li key={index} className="flex items-center">
                          <svg className="h-4 w-4 text-ux-success mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </UXCard>
            ))}
          </div>

          {/* Template Preview */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-ux-text">Preview</h4>
            
            <UXCard>
              <div className="p-6">
                {/* Template Preview Placeholder */}
                <div className="placeholder-ux w-full h-96 mb-4 flex items-center justify-center">
                  <span className="text-ux-text-secondary">
                    {selectedTemplate.name} Template Preview
                  </span>
                </div>
                
                <div className="text-center">
                  <h5 className="font-semibold text-ux-text mb-2">
                    {selectedTemplate.name} Template
                  </h5>
                  <p className="text-sm text-ux-text-secondary">
                    This is how your menu will look with the {selectedTemplate.name.toLowerCase()} template
                  </p>
                </div>
              </div>
            </UXCard>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <UXButton
            variant="outline"
            size="lg"
            onClick={handleBackToExtracted}
            disabled={loading}
          >
            ← Back to Items
          </UXButton>
          
          <UXButton
            variant="primary"
            size="lg"
            onClick={handleSelectTemplate}
            loading={loading}
            disabled={loading}
          >
            {isDemoUser ? 'Select and Export' : 'Select and Preview'}
          </UXButton>
        </div>

        {/* MVP Notice */}
        <div className="text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-lg bg-ux-primary/10 text-ux-primary text-sm">
            <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            More templates coming soon! Currently showing our Modern template.
          </div>
        </div>
      </div>
    </UXSection>
  )
}