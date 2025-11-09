'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UXSection, UXButton, UXCard } from '@/components/ux'
import { MenuThumbnailBadge } from '@/components/ux/MenuThumbnailBadge'
import { useToast } from '@/components/ui'
import type { Menu } from '@/types'

interface UXMenuExportClientProps {
  menuId: string
}

interface ExportOption {
  id: string
  name: string
  description: string
  icon: string
  format: 'pdf' | 'image' | 'html' | 'images-zip'
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'pdf',
    name: 'PDF Menu',
    description: 'Professional PDF perfect for printing or sharing',
    icon: '📄',
    format: 'pdf'
  },
  {
    id: 'image',
    name: 'Menu Image',
    description: 'High-quality image for social media or websites',
    icon: '🖼️',
    format: 'image'
  },
  {
    id: 'html',
    name: 'Web Menu',
    description: 'Interactive HTML menu for your website',
    icon: '🌐',
    format: 'html'
  },
  {
    id: 'images-zip',
    name: 'Menu Images Zip',
    description: 'Collection of menu images in different formats',
    icon: '📦',
    format: 'images-zip'
  }
]

const CONVERSION_INCENTIVES = [
  {
    icon: '🎨',
    title: 'Apply your own branding',
    description: 'Customize colors, fonts, and add your logo'
  },
  {
    icon: '📱',
    title: 'Generate QR codes',
    description: 'Create QR codes for contactless menu access'
  },
  {
    icon: '⚡',
    title: 'Instant price changes',
    description: 'Update prices and items in real-time'
  },
  {
    icon: '📊',
    title: 'Menu analytics',
    description: 'Track views and popular items'
  }
]

export default function UXMenuExportClient({ menuId }: UXMenuExportClientProps) {
  const [demoMenu, setDemoMenu] = useState<Menu | null>(null)
  const [exportingFormat, setExportingFormat] = useState<string | null>(null)
  const [completedExports, setCompletedExports] = useState<Set<string>>(new Set())
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
        description: 'Authenticated user export will be implemented in the next task.'
      })
    }
  }, [menuId, router, showToast])

  const handleExport = async (option: ExportOption) => {
    if (!demoMenu) return

    setExportingFormat(option.id)

    try {
      // Simulate export process for demo
      await new Promise(resolve => setTimeout(resolve, 2000))

      // For demo purposes, we'll simulate successful export
      // In a real implementation, this would call the actual export API
      
      setCompletedExports(prev => new Set(Array.from(prev).concat(option.id)))
      
      showToast({
        type: 'success',
        title: `${option.name} exported`,
        description: `Your ${option.name.toLowerCase()} has been generated successfully`
      })

      // Simulate download (in real implementation, this would be an actual file)
      const blob = new Blob([`Demo ${option.name} for ${demoMenu.name}`], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${demoMenu.name.replace(/\s+/g, '-').toLowerCase()}-${option.format}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Error exporting menu:', error)
      showToast({
        type: 'error',
        title: 'Export failed',
        description: 'Please try again or contact support.'
      })
    } finally {
      setExportingFormat(null)
    }
  }

  const handleTryOwnMenu = () => {
    router.push('/ux/register')
  }

  const handleBackToTemplate = () => {
    router.push(`/ux/menus/${menuId}/template`)
  }

  if (!demoMenu) {
    return (
      <UXSection 
        title="Loading..."
        subtitle="Preparing export options"
      >
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ux-primary"></div>
        </div>
      </UXSection>
    )
  }

  return (
    <UXSection 
      title="Export Your Menu"
      subtitle={`Download ${demoMenu.name} in multiple formats`}
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Menu Summary */}
        <UXCard>
          <MenuThumbnailBadge imageUrl={demoMenu?.imageUrl} position="right" />
          <div className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ux-text mb-2">
                  {demoMenu.name}
                </h3>
                <p className="text-ux-text-secondary">
                  {demoMenu.items.length} items • {demoMenu.theme.name} template • Ready for export
                </p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-ux-success/10 text-ux-success text-sm">
                  <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Demo Complete
                </div>
              </div>
            </div>
          </div>
        </UXCard>

        {/* Export Options */}
        <div>
          <h4 className="text-xl font-semibold text-ux-text mb-6 text-center">
            Choose Your Export Format
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {EXPORT_OPTIONS.map((option) => (
              <UXCard 
                key={option.id}
                className="text-center hover:shadow-lg transition-all duration-200"
              >
                <div className="p-6">
                  <div className="text-4xl mb-4">{option.icon}</div>
                  <h5 className="text-lg font-semibold text-ux-text mb-2">
                    {option.name}
                  </h5>
                  <p className="text-sm text-ux-text-secondary mb-4">
                    {option.description}
                  </p>
                  
                  {completedExports.has(option.id) ? (
                    <div className="flex items-center justify-center text-ux-success">
                      <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Downloaded
                    </div>
                  ) : (
                    <UXButton
                      variant="primary"
                      size="sm"
                      onClick={() => handleExport(option)}
                      loading={exportingFormat === option.id}
                      disabled={exportingFormat !== null}
                      className="w-full"
                    >
                      {exportingFormat === option.id ? 'Exporting...' : 'Export'}
                    </UXButton>
                  )}
                </div>
              </UXCard>
            ))}
          </div>
        </div>

        {/* Conversion Incentives */}
        <div className="bg-gradient-to-br from-ux-primary/15 to-ux-primary/25 rounded-md p-8 border border-ux-border">
          <div className="text-center mb-8">
            <h4 className="text-2xl font-bold text-ux-text mb-4">
              Want to unlock more features?
            </h4>
            <p className="text-ux-text-secondary text-lg">
              Sign up to get access to advanced features and create your own custom menus
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {CONVERSION_INCENTIVES.map((incentive, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl mb-3">{incentive.icon}</div>
                <h5 className="font-semibold text-ux-text mb-2">
                  {incentive.title}
                </h5>
                <p className="text-sm text-ux-text-secondary">
                  {incentive.description}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <UXButton
              variant="primary"
              size="lg"
              onClick={handleTryOwnMenu}
              className="px-8"
            >
              Try it with your own menu →
            </UXButton>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <UXButton
            variant="outline"
            size="lg"
            onClick={handleBackToTemplate}
            disabled={exportingFormat !== null}
          >
            ← Back to Template
          </UXButton>
          
          <UXButton
            variant="outline"
            size="lg"
            onClick={() => router.push('/ux')}
            disabled={exportingFormat !== null}
          >
            Start Over
          </UXButton>
        </div>

        {/* Demo Notice */}
        <div className="text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-lg bg-ux-primary/10 text-ux-primary text-sm">
            <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            This is a demo export. Sign up to get real menu files and advanced features!
          </div>
        </div>
      </div>
    </UXSection>
  )
}