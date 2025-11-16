'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UpgradePrompt } from '@/components/ui'
import { UXButton, UXInput, UXCard } from '@/components/ux'
import { validateCreateMenu, generateSlugFromName } from '@/lib/validation'
import { fetchJsonWithRetry, HttpError } from '@/lib/retry'
import type { CreateMenuFormData } from '@/types'

export default function NewMenuPage() {
  const [formData, setFormData] = useState<CreateMenuFormData>({
    name: '',
    slug: '',
    description: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlugFromName(name)
    }))
    
    // Clear name error when user starts typing
    if (errors.name) {
      setErrors(prev => ({ ...prev, name: '' }))
    }
  }

  const handleSlugChange = (slug: string) => {
    // Only allow valid slug characters
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setFormData(prev => ({ ...prev, slug: cleanSlug }))
    
    // Clear slug error when user starts typing
    if (errors.slug) {
      setErrors(prev => ({ ...prev, slug: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    const validation = validateCreateMenu(formData)
    if (!validation.isValid) {
      const errorMap: Record<string, string> = {}
      validation.errors.forEach(error => {
        errorMap[error.field] = error.message
      })
      setErrors(errorMap)
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const result = await fetchJsonWithRetry<{ success: boolean; data: any; errors?: any[]; error?: string; code?: string }>(
        '/api/menus',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) },
        { retries: 2, baseDelayMs: 250, maxDelayMs: 1000 }
      )
      router.push(`/dashboard/menus/${result.data.id}`)
    } catch (error) {
      if (error instanceof HttpError) {
        const body: any = error.body || {}
        if (Array.isArray(body.errors)) {
          const errorMap: Record<string, string> = {}
          body.errors.forEach((err: any) => {
            if (err?.field && err?.message) errorMap[err.field] = err.message
          })
          setErrors(errorMap)
        } else if (body.code === 'PLAN_LIMIT_EXCEEDED') {
          setErrors({ general: body.error || 'Plan limit reached' })
        } else {
          setErrors({ general: body.error || error.message || 'Failed to create menu' })
        }
      } else {
        setErrors({ general: 'Network error. Please try again.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ux-implementation min-h-screen flex flex-col overflow-x-hidden relative">
      {/* Background image + soft overlay behind content */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/ux/backgrounds/kung-pao-chicken.png)`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 30%'
        }}
      />

      {/* Main Content */}
      <main className="container-ux w-full py-10 md:py-12">
        {/* Hero heading */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Create New Menu
          </h1>
          <p className="mt-2 text-white/90 text-hero-shadow-strong">
            Set up your menu details to get started
          </p>
        </div>

        <div className="w-full max-w-2xl mx-auto">
          <UXCard className="w-full">
            <div className="p-6 w-full">
              <h3 className="text-lg font-semibold text-ux-text mb-4">Menu Details</h3>

              <form onSubmit={handleSubmit} className="space-y-6 w-full">
                {/* General Error */}
                {errors.general && (
                  <UpgradePrompt
                    title="Plan limit reached"
                    message={errors.general}
                    cta="Upgrade to Premium"
                    href="/upgrade"
                    reason="Free plan allows 1 menu. Premium allows up to 10."
                  />
                )}

                {/* Menu Name */}
                <UXInput
                  label="Menu Name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Main Menu, Lunch Specials, Drinks"
                  error={errors.name}
                  helperText="This will be displayed at the top of your menu"
                  required
                  autoFocus
                />

                {/* Menu Slug */}
                <UXInput
                  label="Menu URL"
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="main-menu"
                  error={errors.slug}
                  helperText={`Your menu will be available at: yoursite.com/u/your-name/${formData.slug || 'menu-url'}`}
                />

                {/* Description (Optional) */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-ux-text">
                    Description (Optional)
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of your menu..."
                    rows={3}
                    className="input-ux resize-none"
                  />
                  <p className="text-sm text-ux-text-secondary">
                    This will help customers understand what this menu is for
                  </p>
                </div>

                {/* Actions */}
                <div className="flex justify-center">
                  <UXButton
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={loading}
                    className="w-full sm:w-auto"
                  >
                    {loading ? 'Creating Menu...' : 'Create Menu'}
                  </UXButton>
                </div>
              </form>
            </div>
          </UXCard>

          {/* Back to Dashboard glass button below card */}
          <div className="mt-6 text-center">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center text-sm rounded-full bg-white/20 border border-white/40 text-white hover:bg-white/30 px-4 py-2 transition-colors"
            >
              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}