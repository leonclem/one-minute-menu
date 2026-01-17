'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UpgradePrompt } from '@/components/ui'
import { UXButton, UXInput, UXCard } from '@/components/ux'
import { validateCreateMenu, generateSlugFromName } from '@/lib/validation'
import { fetchJsonWithRetry, HttpError } from '@/lib/retry'
import { markDashboardForRefresh } from '@/lib/dashboard-refresh'
import type { CreateMenuFormData, User } from '@/types'
import { ESTABLISHMENT_TYPES, CUISINES } from '@/types'

export default function NewMenuPage() {
  const [formData, setFormData] = useState<CreateMenuFormData>({
    name: '',
    slug: '',
    description: '',
    establishmentType: '',
    primaryCuisine: '',
    venueInfo: {
      address: '',
      phone: '',
      email: '',
      socialMedia: {
        instagram: '',
        facebook: '',
        x: '',
        website: '',
      },
    },
  })

  // Pre-fill from profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetchJsonWithRetry<{ success: boolean; data: User }>('/api/profile')
        if (response.success && response.data) {
          const profile = response.data
          setFormData(prev => ({
            ...prev,
            name: profile.restaurantName || prev.name,
            slug: profile.restaurantName ? generateSlugFromName(profile.restaurantName) : prev.slug,
            establishmentType: profile.establishmentType || prev.establishmentType,
            primaryCuisine: profile.primaryCuisine || prev.primaryCuisine,
          }))
        }
      } catch (err) {
        console.error('Failed to load profile for pre-filling:', err)
      }
    }
    loadProfile()
  }, [])

  // Helper component for info tooltips
  const InfoTip = ({ children }: { children: React.ReactNode }) => (
    <div className="group relative inline-block ml-1 align-middle">
      <button type="button" className="text-ux-primary hover:text-ux-primary-dark transition-colors">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-white border-2 border-ux-primary rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-xs text-ux-text z-50 pointer-events-none font-medium leading-relaxed">
        <div className="relative">
          {children}
          {/* Tooltip Arrow */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 border-8 border-transparent border-t-ux-primary" />
          <div className="absolute -bottom-[14px] left-1/2 -translate-x-1/2 border-[7px] border-transparent border-t-white" />
        </div>
      </div>
    </div>
  )

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
      // Ensure dashboard list is fresh when user later returns
      markDashboardForRefresh()
      router.push(`/menus/${result.data.id}/upload`)
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
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/backgrounds/kung-pao-chicken.png)`,
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

                {/* Description (Optional) */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-ux-text">
                    Description (Optional)
                    <InfoTip>
                      This helps our AI understand the theme of your menu to generate more relevant and appetizing images for your dishes later.
                    </InfoTip>
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of your menu..."
                    rows={3}
                    className="input-ux resize-none"
                  />
                </div>

                {/* Establishment Details */}
                <div className="pt-4 border-t border-ux-border">
                  <h4 className="text-md font-semibold text-ux-text mb-4">
                    Establishment & Cuisine (Optional)
                    <InfoTip>
                      This helps our AI tailor the presentation and style of generated images to match your brand (e.g., fine dining vs. casual cafe).
                    </InfoTip>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-ux-text">Establishment Type</label>
                      <select
                        className="input-ux w-full"
                        value={formData.establishmentType}
                        onChange={(e) => setFormData({ ...formData, establishmentType: e.target.value })}
                      >
                        <option value="">Select a type...</option>
                        {ESTABLISHMENT_TYPES.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-ux-text">Primary Cuisine</label>
                      <select
                        className="input-ux w-full"
                        value={formData.primaryCuisine}
                        onChange={(e) => setFormData({ ...formData, primaryCuisine: e.target.value })}
                      >
                        <option value="">Select a cuisine...</option>
                        {CUISINES.map((cuisine) => (
                          <option key={cuisine.id} value={cuisine.id}>
                            {cuisine.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Venue & Contact Info */}
                <div className="pt-4 border-t border-ux-border">
                  <h4 className="text-md font-semibold text-ux-text mb-4">
                    Venue & Contact (Optional)
                    <InfoTip>
                      These details will be automatically formatted and displayed in the footer of your digital menu, making it easy for guests to find or contact you.
                    </InfoTip>
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-ux-text">Address</label>
                      <textarea
                        value={formData.venueInfo?.address || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          venueInfo: { ...formData.venueInfo, address: e.target.value }
                        })}
                        placeholder="123 Restaurant St, Food City"
                        rows={2}
                        className="input-ux resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <UXInput
                        label="Email Address"
                        type="email"
                        value={formData.venueInfo?.email || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          venueInfo: { ...formData.venueInfo, email: e.target.value }
                        })}
                        placeholder="hello@restaurant.com"
                      />
                      <UXInput
                        label="Telephone"
                        value={formData.venueInfo?.phone || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          venueInfo: { ...formData.venueInfo, phone: e.target.value }
                        })}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <UXInput
                        label="Instagram (@handle)"
                        value={formData.venueInfo?.socialMedia?.instagram || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          venueInfo: {
                            ...formData.venueInfo,
                            socialMedia: { ...formData.venueInfo?.socialMedia, instagram: e.target.value }
                          }
                        })}
                        placeholder="@restaurant"
                      />
                      <UXInput
                        label="Facebook (URL or @handle)"
                        value={formData.venueInfo?.socialMedia?.facebook || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          venueInfo: {
                            ...formData.venueInfo,
                            socialMedia: { ...formData.venueInfo?.socialMedia, facebook: e.target.value }
                          }
                        })}
                        placeholder="facebook.com/restaurant"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <UXInput
                        label="X (Twitter) (@handle)"
                        value={formData.venueInfo?.socialMedia?.x || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          venueInfo: {
                            ...formData.venueInfo,
                            socialMedia: { ...formData.venueInfo?.socialMedia, x: e.target.value }
                          }
                        })}
                        placeholder="@restaurant"
                      />
                      <UXInput
                        label="Website URL"
                        value={formData.venueInfo?.socialMedia?.website || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          venueInfo: {
                            ...formData.venueInfo,
                            socialMedia: { ...formData.venueInfo?.socialMedia, website: e.target.value }
                          }
                        })}
                        placeholder="www.restaurant.com"
                      />
                    </div>
                  </div>
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