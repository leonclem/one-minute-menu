'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { UXSection, UXButton, UXCard } from '@/components/ux'
import { MenuThumbnailBadge } from '@/components/ux/MenuThumbnailBadge'
import { useToast } from '@/components/ui'
import type { Menu } from '@/types'
import { trackConversionEvent } from '@/lib/conversion-tracking'
import { TEMPLATE_REGISTRY } from '@/lib/templates/template-definitions'
import { normalizeDemoMenu } from '@/lib/demo-menu-normalizer'

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

interface UXMenuExportClientProps {
  menuId: string
}

interface ExportOption {
  id: string
  name: string
  description: string
  icon: string
  format: 'pdf' | 'image' | 'html' | 'images-zip'
  disabledForDemo?: boolean
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
    format: 'image',
    disabledForDemo: true
  },
  {
    id: 'html',
    name: 'Web Menu',
    description: 'Interactive HTML menu for your website',
    icon: '🌐',
    format: 'html',
    disabledForDemo: true
  },
  {
    id: 'images-zip',
    name: 'Menu Images Zip',
    description: 'Collection of menu images in different formats',
    icon: '📦',
    format: 'images-zip',
    disabledForDemo: true
  }
]

interface ConversionIncentive {
  icon: string
  title: string
  description: string
}

const CONVERSION_INCENTIVES: ConversionIncentive[] = [
  /*
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
  */
]

interface TemplateSelection {
  id?: string
  menuId: string
  templateId: string
  templateVersion: string
  configuration: {
    textOnly: boolean
    useLogo: boolean
    colourPaletteId?: string
  }
}

export default function UXMenuExportClient({ menuId }: UXMenuExportClientProps) {
  const [demoMenu, setDemoMenu] = useState<Menu | null>(null)
  const [authMenu, setAuthMenu] = useState<Menu | null>(null)
  const [templateSelection, setTemplateSelection] = useState<TemplateSelection | null>(null)
  const [exportingFormat, setExportingFormat] = useState<string | null>(null)
  const [completedExports, setCompletedExports] = useState<Set<string>>(new Set())
  const [canEdit, setCanEdit] = useState(true)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    // Attempt to treat dashed IDs as valid when possible:
    // If menuId is like "demo-<uuid>", try authenticated fetch with the uuid.
    const baseId = menuId.startsWith('demo-') ? menuId : menuId

    ;(async () => {
      try {
        // If it's a demo ID, skip the authenticated fetch and go straight to session storage
        if (menuId.startsWith('demo-')) {
          const storedDemoMenu = sessionStorage.getItem('demoMenu')
          if (storedDemoMenu) {
            try {
              const parsedMenu = JSON.parse(storedDemoMenu)
              const normalized = normalizeDemoMenu(parsedMenu) as Menu
              setDemoMenu(normalized)
              
              // Check for demo template selection in sessionStorage
              const storedSelection = sessionStorage.getItem(`templateSelection-${menuId}`)
              if (storedSelection) {
                try {
                  const parsedSelection = JSON.parse(storedSelection)
                  setTemplateSelection(parsedSelection)
                } catch (error) {
                  console.error('Error parsing template selection:', error)
                }
              }
            } catch (error) {
              console.error('Error parsing demo menu:', error)
              router.push('/demo/sample')
            }
          } else {
            router.push('/demo/sample')
          }
          return
        }

        const resp = await fetch(`/api/menus/${menuId}`)
        if (resp.ok) {
          const json = await resp.json()
          setAuthMenu(json?.data ?? null)
          
          // Fetch saved template selection for authenticated menus
          try {
            const selectionResp = await fetch(`/api/menus/${menuId}/template-selection`)
            if (selectionResp.ok) {
              const selectionJson = await selectionResp.json()
              if (selectionJson?.data) {
                setTemplateSelection(selectionJson.data)
              }
            }
          } catch (selectionErr) {
            console.error('Error fetching template selection:', selectionErr)
            // Non-fatal error, continue without template selection
          }
          
          return
        }
        if (resp.status === 401) {
          showToast({
            type: 'info',
            title: 'Sign in required',
            description: 'Please sign in to export your menu.'
          })
        }
      } catch (err) {
        // Network or parsing error; if demo path, try session storage
        if (menuId.startsWith('demo-')) {
          const storedDemoMenu = sessionStorage.getItem('demoMenu')
          if (storedDemoMenu) {
            try {
              const parsedMenu = JSON.parse(storedDemoMenu)
              const normalized = normalizeDemoMenu(parsedMenu) as Menu
              setDemoMenu(normalized)
              
              // Check for demo template selection in sessionStorage
              const storedSelection = sessionStorage.getItem(`templateSelection-${menuId}`)
              if (storedSelection) {
                try {
                  const parsedSelection = JSON.parse(storedSelection)
                  setTemplateSelection(parsedSelection)
                } catch (error) {
                  console.error('Error parsing template selection:', error)
                }
              }
            } catch {
              router.push('/demo/sample')
            }
          } else {
            router.push('/demo/sample')
          }
        } else {
          console.error('Failed to load menu info:', err)
        }
      }
    })()
  }, [menuId, router, showToast])

  const isDemo = menuId.startsWith('demo-')
  const isReadOnly = !isDemo && canEdit === false

  useEffect(() => {
    if (isDemo) return
    let mounted = true
    ;(async () => {
      try {
        const resp = await fetch('/api/user/edit-access')
        const json = await resp.json().catch(() => ({}))
        if (!mounted) return
        if (resp.ok && typeof json?.canEdit === 'boolean') {
          setCanEdit(json.canEdit)
        }
      } catch {
        // best-effort
      }
    })()
    return () => { mounted = false }
  }, [isDemo])

  const handleExport = async (option: ExportOption) => {
    const baseId = menuId.startsWith('demo-') ? menuId : menuId
    const isDemo = !authMenu && menuId.startsWith('demo-')
    setExportingFormat(option.id)

    // Track export start for funnel analytics
    trackConversionEvent({
      event: 'export_start',
      metadata: {
        path: `/menus/${menuId}/export`,
        format: option.format,
        isDemo,
      },
    })

    try {
      if (isDemo) {
        if (!demoMenu || !templateSelection) return
        
        // Skip registry check for V2 templates used in demo flow.
        // Template page stores IDs like '4-column-portrait' with templateVersion '2.0.0'
        // (no '-v2' suffix), so we treat either as V2.
        const isV2Template =
          templateSelection.templateId.endsWith('-v2') ||
          templateSelection.templateVersion === '2.0.0'

        if (!isV2Template) {
          // Generate styled export for demo users (Legacy engine check)
          const template = TEMPLATE_REGISTRY[templateSelection.templateId]
          if (!template) {
            showToast({
              type: 'error',
              title: 'Template not found',
              description: 'Please go back and select a template first.'
            })
            return
          }
        }

        // For PDF export, demo users use the job queue (Railway worker)
        if (option.format === 'pdf') {
          try {
            const resp = await fetch('/api/export/jobs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                menu: demoMenu,
                templateId: templateSelection.templateId,
                configuration: templateSelection.configuration,
                options: {
                  orientation: 'portrait',
                  includePageNumbers: true,
                  title: demoMenu.name
                }
              })
            })

            const data = await resp.json().catch(() => ({}))
            const filename = `${demoMenu.name.replace(/\s+/g, '-').toLowerCase()}-menu.pdf`

            if (!resp.ok) {
              throw new Error(data?.error || 'Export failed')
            }

            // Cache hit: immediate download via signed URL
            if (data.cache_hit && data.download_url) {
              const a = document.createElement('a')
              a.href = data.download_url
              a.download = filename
              a.rel = 'noopener noreferrer'
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              setCompletedExports(prev => new Set(Array.from(prev).concat(option.id)))
              showToast({
                type: 'success',
                title: 'PDF Menu exported',
                description: 'Your PDF has been downloaded successfully'
              })
              trackConversionEvent({
                event: 'export_completed',
                metadata: { path: `/menus/${menuId}/export`, format: option.format, isDemo: true }
              })
              return
            }

            // Cache miss: poll for job completion
            const jobId = data.job_id
            if (!jobId) throw new Error('No job ID returned')

            showToast({
              type: 'info',
              title: 'Generating your PDF...',
              description: 'Your menu is being prepared. This usually takes a few seconds.'
            })

            const pollInterval = 2000
            const maxAttempts = 90 // 3 minutes
            let attempts = 0

            while (attempts < maxAttempts) {
              await new Promise(r => setTimeout(r, pollInterval))
              const statusResp = await fetch(`/api/export/jobs/${jobId}`)
              const statusData = await statusResp.json().catch(() => ({}))
              attempts++

              if (statusData.status === 'completed' && statusData.file_url) {
                const a = document.createElement('a')
                a.href = statusData.file_url
                a.download = filename
                a.rel = 'noopener noreferrer'
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                setCompletedExports(prev => new Set(Array.from(prev).concat(option.id)))
                showToast({
                  type: 'success',
                  title: 'PDF Menu exported',
                  description: 'Your PDF has been downloaded successfully'
                })
                trackConversionEvent({
                  event: 'export_completed',
                  metadata: { path: `/menus/${menuId}/export`, format: option.format, isDemo: true }
                })
                return
              }
              if (statusData.status === 'failed') {
                throw new Error(statusData.error_message || 'PDF generation failed')
              }
            }

            throw new Error('Export is taking longer than expected. Please try again.')
          } catch (error) {
            console.error('Error exporting PDF:', error)
            showToast({
              type: 'error',
              title: 'Export failed',
              description: error instanceof Error ? error.message : 'Failed to generate PDF export. Please try again.'
            })
          }
          return
        }

        // For HTML and image exports, show upgrade prompt for demo users
        if (option.format === 'html' || option.format === 'image') {
          showToast({
            type: 'info',
            title: 'Sign up for HTML & image exports',
            description: 'Create a free account to download HTML and image exports of your menu.'
          })
          
          trackConversionEvent({
            event: 'cta_click_primary',
            metadata: {
              path: `/menus/${menuId}/export`,
              format: option.format,
              isDemo: true,
              action: 'export_upgrade_prompt',
            },
          })
          return
        }

        // For other formats, show coming soon
        showToast({
          type: 'info',
          title: 'Coming soon',
          description: `${option.name} export will be available soon.`
        })
        return
      }

      // Authenticated export via API
      const menuName =
        authMenu?.name ||
        demoMenu?.name ||
        'menu'

      let endpoint = ''
      let body: any = { menuId: baseId }
      let filename = ''
      
      // Include templateId and configuration if a template selection exists
      if (templateSelection?.templateId) {
        body.templateId = templateSelection.templateId
        // Pass configuration to export API
        body.configuration = templateSelection.configuration
      }

      switch (option.id) {
        case 'pdf':
          endpoint = '/api/templates/export/pdf'
          body.options = { orientation: 'portrait', includePageNumbers: true, title: menuName }
          filename = `${menuName.replace(/\s+/g, '-').toLowerCase()}-menu.pdf`
          break
        case 'image':
          endpoint = '/api/templates/export/image'
          body.context = 'desktop'
          body.options = { format: 'png', width: 1200, height: 1600 }
          filename = `${menuName.replace(/\s+/g, '-').toLowerCase()}-menu.png`
          break
        case 'html':
          endpoint = '/api/templates/export/html'
          body.context = 'desktop'
          body.options = { includeDoctype: true, includeMetaTags: true, includeStyles: true, pageTitle: menuName }
          filename = `${menuName.replace(/\s+/g, '-').toLowerCase()}-menu.html`
          break
        case 'images-zip':
          // Not yet implemented server-side; show helpful toast
          showToast({
            type: 'info',
            title: 'Images ZIP coming soon',
            description: 'Multiple image sizes ZIP will be available shortly.'
          })
          return
        default:
          return
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        if (resp.status === 401) {
          showToast({
            type: 'info',
            title: 'Sign in required',
            description: 'Create an account to export your real menu.'
          })
          router.push('/register')
          return
        }
        const errText = await resp.text().catch(() => 'Export failed')
        throw new Error(errText)
      }

      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setCompletedExports(prev => new Set(Array.from(prev).concat(option.id)))
      showToast({
        type: 'success',
        title: `${option.name} exported`,
        description: `Your ${option.name.toLowerCase()} has been generated successfully`
      })
      trackConversionEvent({
        event: 'export_completed',
        metadata: {
          path: `/menus/${menuId}/export`,
          format: option.format,
          isDemo: false,
        },
      })
    } catch (error) {
      console.error('Error exporting menu:', error)
      const isDemoError = isDemo && !authMenu
      showToast({
        type: 'error',
        title: isDemoError ? 'Demo export failed' : 'Export failed',
        description: isDemoError
          ? 'Something went wrong while generating the demo export. Please try again or restart the demo.'
          : 'Something went wrong while generating your export. Please try again or contact support if this keeps happening.'
      })
      trackConversionEvent({
        event: 'ux_error',
        metadata: {
          path: `/menus/${menuId}/export`,
          format: option.format,
          isDemo,
        },
      })
    } finally {
      setExportingFormat(null)
    }
  }

  const handleTryOwnMenu = () => {
    trackConversionEvent({
      event: 'cta_click_try_own_menu',
      metadata: {
        path: `/menus/${menuId}/export`,
        isDemo: menuId.startsWith('demo-'),
      },
    })
    trackConversionEvent({
      event: 'registration_start',
      metadata: {
        path: `/menus/${menuId}/export`,
        source: 'export_conversion_panel',
      },
    })
    router.push('/register')
  }

  const handleBackToTemplate = () => {
    router.push(`/menus/${menuId}/template`)
  }

  const ready = isDemo ? !!demoMenu : !!authMenu
  const menuForSummary = isDemo ? demoMenu : authMenu

  if (!ready) {
    return (
      <UXSection>
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Loading...
          </h1>
          <p className="mt-2 text-white/90 text-hero-shadow-strong">
            Preparing for export
          </p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ux-primary"></div>
        </div>
      </UXSection>
    )
  }
  
  // Check if template selection is missing and guide user back
  const hasTemplateSelection = !!templateSelection?.templateId
  
  if (!hasTemplateSelection) {
    return (
      <UXSection>
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            No Template Selected
          </h1>
          <p className="mt-2 text-white/90 text-hero-shadow-strong">
            Please select a template before exporting your menu
          </p>
        </div>
        <div className="max-w-2xl mx-auto">
          <UXCard>
            <div className="p-8 text-center">
              <div className="text-5xl mb-4">🎨</div>
              <h3 className="text-xl font-semibold text-ux-text mb-4">
                Choose a Template First
              </h3>
              <p className="text-ux-text-secondary mb-6">
                You need to select a template design before you can export your menu. 
                Go back to the template selection page to choose a design that fits your style.
              </p>
              <UXButton
                variant="primary"
                size="lg"
                onClick={handleBackToTemplate}
              >
                ← Back to Template Selection
              </UXButton>
            </div>
          </UXCard>
        </div>
      </UXSection>
    )
  }

  return (
    <UXSection>
      {/* Hero heading (consistent with earlier steps) */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
          Export Your Menu
        </h1>
        <p className="mt-2 text-white/90 text-hero-shadow-strong">
          Download {menuForSummary?.name ?? 'your menu'} in multiple formats
        </p>
      </div>
      <div className="max-w-6xl mx-auto space-y-8">
        {isReadOnly && (
          <UXCard>
            <div className="p-6">
              <div className="text-sm font-medium text-ux-text">Viewing mode</div>
              <div className="mt-1 text-sm text-ux-text-secondary">
                Your editing window has expired. Export is locked until you purchase a Creator Pack or subscribe.
              </div>
            </div>
          </UXCard>
        )}
        {/* Menu Summary */}
        <UXCard>
          <MenuThumbnailBadge imageUrl={menuForSummary?.imageUrl} position="right" />
          <div className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ux-text mb-2">
                  {menuForSummary?.name}
                </h3>
                <p className="text-ux-text-secondary mb-2">
                  {(menuForSummary?.items?.length ?? 0)} items • Ready for export
                </p>
                {templateSelection && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-ux-primary/10 text-ux-primary text-xs font-medium">
                      <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                      Template: {templateSelection.templateId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </span>
                    {templateSelection.configuration?.textOnly && (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs">
                        Text Only
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-ux-success/10 text-ux-success text-sm">
                  <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Ready to Export
                </div>
              </div>
            </div>
          </div>
        </UXCard>

        {/* Export Options */}
        <div>
          <h4 className="text-xl font-semibold text-white text-hero-shadow mb-6 text-center">
            Choose Your Export Format
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {EXPORT_OPTIONS.map((option) => {
              const isDisabled = isDemo && option.disabledForDemo
              const isLocked = !isDemo && isReadOnly
              return (
                <UXCard 
                  key={option.id}
                  className={`text-center transition-all duration-200 ${(isDisabled || isLocked) ? 'opacity-60 grayscale-[0.5]' : 'hover:shadow-lg'}`}
                >
                  <div className="p-6">
                    <div className="text-4xl mb-4">{option.icon}</div>
                    <h5 className="text-lg font-semibold text-ux-text mb-2">
                      {option.name}
                    </h5>
                    <p className="text-sm text-ux-text-secondary mb-4">
                      {isLocked
                        ? 'Locked until you purchase a Creator Pack or subscribe'
                        : (isDisabled ? 'Not available for the demo flow' : option.description)}
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
                        onClick={() => {
                          if (isLocked) {
                            showToast({
                              type: 'info',
                              title: 'Export locked',
                              description: 'Purchase a Creator Pack or subscribe to export your menu.',
                            })
                            return
                          }
                          if (!isDisabled) handleExport(option)
                        }}
                        loading={exportingFormat === option.id}
                        disabled={exportingFormat !== null || isDisabled || isLocked}
                        className="w-full"
                      >
                        {(isDisabled || isLocked) ? 'Locked' : exportingFormat === option.id ? 'Exporting...' : 'Export'}
                      </UXButton>
                    )}
                  </div>
                </UXCard>
              )
            })}
          </div>
        </div>

        {/* Conversion Incentives (improved contrast) - Only show for demo users */}
        {isDemo && (
          <div className="bg-gradient-to-br from-ux-primary/30 to-ux-primary/40 rounded-md p-8 border border-ux-primary/40 text-white">
            <div className="text-center mb-8">
              <h4 className="text-2xl font-bold text-white text-hero-shadow mb-4">
                Want to unlock more features?
              </h4>
              <p className="text-white/90 text-lg text-hero-shadow-strong">
                Sign up to get access to advanced features and create your own custom menus
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {CONVERSION_INCENTIVES.map((incentive, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl mb-3">{incentive.icon}</div>
                  <h5 className="font-semibold text-white mb-2">
                    {incentive.title}
                  </h5>
                  <p className="text-sm text-white/90">
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
        )}

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <UXButton
            variant="outline"
            size="lg"
            className="bg-white/20 border-white/40 text-white hover:bg-white/30"
            onClick={handleBackToTemplate}
            disabled={exportingFormat !== null}
          >
            ← Back to Template
          </UXButton>
          
          {/* Start Over button - Only show for demo users */}
          {isDemo && (
            <UXButton
              variant="outline"
              size="lg"
              className="bg-white/20 border-white/40 text-white hover:bg-white/30"
              onClick={() => router.push('/')}
              disabled={exportingFormat !== null}
            >
              Start Over
            </UXButton>
          )}
        </div>

        {/* Demo Notice - Only show for demo users */}
        {isDemo && (
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-lg bg-ux-primary/10 text-ux-primary text-sm">
              <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              This is a demo export. Sign up to get real menu files and advanced features!
            </div>
          </div>
        )}
      </div>
    </UXSection>
  )
}