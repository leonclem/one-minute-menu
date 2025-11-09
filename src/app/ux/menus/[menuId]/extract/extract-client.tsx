'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UXSection, UXButton, UXCard } from '@/components/ux'
import { useToast } from '@/components/ui'
import type { Menu } from '@/types'
import { fetchJsonWithRetry, HttpError } from '@/lib/retry'

interface UXMenuExtractClientProps {
  menuId: string
}

export default function UXMenuExtractClient({ menuId }: UXMenuExtractClientProps) {
  const [demoMenu, setDemoMenu] = useState<Menu & { sampleData?: any } | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractionComplete, setExtractionComplete] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
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
      // Authenticated user menu extraction flow: load menu (to get imageUrl)
      ;(async () => {
        try {
          const response = await fetch(`/api/menus/${menuId}`, { method: 'GET' })
          const result = await response.json()
          if (!response.ok) {
            if (response.status === 401) {
              showToast({
                type: 'error',
                title: 'Sign in required',
                description: 'Please sign in to extract items from your menu.'
              })
              router.push('/auth/signin')
              return
            }
            throw new Error(result?.error || 'Failed to load menu')
          }
          const loadedMenu: Menu = result.data
          setMenu(loadedMenu)
          if (!loadedMenu.imageUrl) {
            showToast({
              type: 'info',
              title: 'Upload required',
              description: 'Please upload a menu image before extracting items.'
            })
            // Redirect to the existing working upload route
            router.push(`/menus/${menuId}/upload`)
          }
        } catch (e) {
          console.error('Error loading menu:', e)
          showToast({
            type: 'error',
            title: 'Failed to load menu',
            description: 'Please try again or contact support.'
          })
        }
      })()
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
      await new Promise(resolve => setTimeout(resolve, 3000))

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

      // Navigate directly to results for a seamless experience
      router.push(`/ux/menus/${menuId}/extracted`)

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

  const handleAuthenticatedExtract = async () => {
    if (!menu?.imageUrl) {
      showToast({
        type: 'error',
        title: 'No image found',
        description: 'Upload a menu image first.'
      })
      router.push(`/menus/${menuId}/upload`)
      return
    }
    setExtracting(true)
    try {
      // Submit extraction job
      const submitData = await fetchJsonWithRetry<{ success: boolean; data: any; error?: string; code?: string }>(
        '/api/extraction/submit',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: menu.imageUrl,
            menuId,
            schemaVersion: 'stage2'
          })
        },
        { retries: 2, baseDelayMs: 250, maxDelayMs: 1000, timeoutMs: 90000 }
      )
      const newJobId: string = submitData.data.jobId
      setJobId(newJobId)
      // Persist job id for next step (results page)
      sessionStorage.setItem(`extractionJob:${menuId}`, newJobId)
      showToast({
        type: 'success',
        title: 'Extraction started',
        description: 'We are processing your menu. This usually takes ~15 seconds.'
      })
      // Poll job status
      const maxAttempts = 20
      const delayMs = 2000
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Small delay between polls
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, delayMs))
        // eslint-disable-next-line no-await-in-loop
        const statusResp = await fetch(`/api/extraction/status/${newJobId}`)
        // eslint-disable-next-line no-await-in-loop
        const statusData = await statusResp.json()
        if (!statusResp.ok) {
          continue
        }
        const status = statusData?.data?.status as 'queued' | 'processing' | 'completed' | 'failed' | undefined
        if (status === 'completed') {
          // Store the result for the next step
          try {
            const payloadToStore = {
              jobId: statusData.data.id,
              schemaVersion: statusData.data.schemaVersion,
              promptVersion: statusData.data.promptVersion,
              result: statusData.data.result,
              confidence: statusData.data.confidence,
              tokenUsage: statusData.data.tokenUsage
            }
            sessionStorage.setItem(`extractionResult:${menuId}`, JSON.stringify(payloadToStore))
          } catch {
            // ignore storage errors
          }
          setExtractionComplete(true)
          showToast({
            type: 'success',
            title: 'Extraction complete',
            description: 'Your items are ready to review.'
          })
          router.push(`/dashboard/menus/${menuId}`)
          return
        }
        if (status === 'failed') {
          showToast({
            type: 'error',
            title: 'Extraction failed',
            description: statusData?.error || 'Please try again or contact support.'
          })
          break
        }
      }
      // If we exit the loop without completion
      showToast({
        type: 'info',
        title: 'Still processing',
        description: 'Extraction is taking longer than expected. You can check back shortly.'
      })
    } catch (e) {
      const body: any = e instanceof HttpError ? e.body : {}
      const code = body?.code

      if (code === 'PLAN_LIMIT_EXCEEDED') {
        const msg = body?.userMessage || body?.error || 'You’ve reached your monthly extraction limit.'
        showToast({ type: 'info', title: 'Please try again soon', description: msg })
        setExtracting(false)
        return
      }

      if (code === 'RATE_LIMIT_EXCEEDED') {
        const retrySecs = typeof body?.retryAfterSeconds === 'number' ? body.retryAfterSeconds : undefined
        const mins = retrySecs != null ? Math.floor(retrySecs / 60) : undefined
        const secs = retrySecs != null ? retrySecs % 60 : undefined
        const friendly = body?.userMessage
          || (retrySecs != null
            ? `You’ve reached the hourly limit (${body?.current ?? '?'} / ${body?.limit ?? '?'}). Thanks for your patience — please try again in ${mins}m ${secs}s.`
            : (body?.error || 'You’re sending requests a little quickly. Please try again in a moment.'))
        showToast({ type: 'info', title: 'Please try again soon', description: friendly })
        setExtracting(false)
        return
      }

      if (code === 'OPENAI_QUOTA_EXCEEDED') {
        const msg = body?.userMessage || 'The AI service is temporarily at capacity. Please try again shortly.'
        showToast({ type: 'info', title: 'Please try again soon', description: msg })
        setExtracting(false)
        return
      }

      if (code === 'OPENAI_RATE_LIMIT') {
        const retrySecs = typeof body?.retryAfterSeconds === 'number' ? body.retryAfterSeconds : undefined
        const mins = retrySecs != null ? Math.floor(retrySecs / 60) : undefined
        const secs = retrySecs != null ? retrySecs % 60 : undefined
        const msg = body?.userMessage
          || (retrySecs != null
            ? `We’re getting a lot of requests right now. Thanks for your patience — please try again in ${mins}m ${secs}s.`
            : 'We’re getting a lot of requests right now. Please try again shortly.')
        showToast({ type: 'info', title: 'Please try again soon', description: msg })
        setExtracting(false)
        return
      }

      const fallbackMsg = body?.userMessage || (e instanceof Error ? e.message : 'Please try again or add items manually.')
      showToast({ type: 'error', title: 'Extraction failed to start', description: fallbackMsg })
    } finally {
      setExtracting(false)
    }
  }

  const handleProceedToResults = () => {
    router.push(`/ux/menus/${menuId}/extracted`)
  }

  const isDemo = menuId.startsWith('demo-')

  if (isDemo) {
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
      <UXSection>
        {/* Page heading styled like the sample page */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Extract Menu Items
          </h1>
          <p className="mt-2 text-white/90 text-hero-shadow-strong">
            Our AI will extract all items from sample menu “{demoMenu.name}”
          </p>
        </div>
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Menu Image Preview */}
          <UXCard>
            <div className="p-6">
              {demoMenu.imageUrl ? (
                <div className="w-full overflow-visible flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={demoMenu.imageUrl}
                    alt={`${demoMenu.name} menu`}
                    className="w-full max-h-96 object-contain drop-shadow-md md:drop-shadow-lg"
                  />
                </div>
              ) : (
                <div className="placeholder-ux w-full h-96 flex items-center justify-center text-ux-text-secondary shadow-md md:shadow-lg">
                  Preview image unavailable.
                </div>
              )}
              {!extractionComplete && (
                <div className="mt-4 text-center">
                  <UXButton
                    variant="primary"
                    size="lg"
                    onClick={handleExtractItems}
                    loading={extracting}
                    disabled={extracting}
                  >
                    {extracting ? 'Extracting items...' : 'Extract Items'}
                  </UXButton>
                </div>
              )}
            </div>
          </UXCard>

          {/* Navigation Controls */}
          <div className="text-center">
            <UXButton
              variant="outline"
              size="md"
              className="bg-white/20 border-white/40 text-white hover:bg-white/30"
              onClick={() => router.push('/ux/demo/sample')}
              disabled={extracting}
            >
              ← Back to Sample Selection
            </UXButton>
          </div>
        </div>
      </UXSection>
    )
  }

  // Authenticated flow UI
  if (!menu) {
    return (
      <UXSection 
        title="Loading..."
        subtitle="Loading your menu"
      >
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ux-primary"></div>
        </div>
      </UXSection>
    )
  }

  return (
    <UXSection>
      {/* Page heading styled like the sample page */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
          Extract Menu Items
        </h1>
        <p className="mt-2 text-white/90 text-hero-shadow-strong">
          Our AI will extract items from {menu.name}
        </p>
      </div>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Menu Image Preview (if available) */}
        <UXCard>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-ux-text mb-2">
              {menu.name}
            </h3>
            <p className="text-ux-text-secondary mb-4">
              {menu.imageUrl ? 'Image uploaded and ready for extraction' : 'No image uploaded yet'}
            </p>
            {menu.imageUrl ? (
              <div className="w-full overflow-visible flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={menu.imageUrl}
                  alt={`${menu.name} menu`}
                  className="w-full max-h-96 object-contain drop-shadow-md md:drop-shadow-lg"
                />
              </div>
            ) : (
              <div className="placeholder-ux w-full h-96 flex items-center justify-center text-ux-text-secondary shadow-md md:shadow-lg">
                Please upload a menu image to continue.
              </div>
            )}
          </div>
        </UXCard>

        {/* Extraction Controls */}
        <div className="text-center space-y-4">
          <UXButton
            variant="primary"
            size="lg"
            onClick={handleAuthenticatedExtract}
            loading={extracting}
            disabled={extracting || !menu.imageUrl}
          >
            {extracting ? 'Extracting items...' : 'Extract Items'}
          </UXButton>
          <div>
            <UXButton
              variant="outline"
              size="md"
              className="bg-white/20 border-white/40 text-white hover:bg-white/30"
              onClick={() => router.push(`/menus/${menuId}/upload`)}
              disabled={extracting}
            >
              ← Back to Upload
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