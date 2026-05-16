'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UXHeader, UXFooter, UXButton, UXInput, UXCard } from '@/components/ux'
import { fetchJsonWithRetry } from '@/lib/retry'
import { ESTABLISHMENT_TYPES, CUISINES } from '@/types'
import { captureEvent, ANALYTICS_EVENTS } from '@/lib/posthog'
import { getPlaceholderItems } from '@/data/placeholder-menus'

export default function OnboardingClient({ 
  userEmail, 
  next,
  reason,
  isNewSignup,
  initialData,
}: { 
  userEmail?: string;
  next?: string;
  reason?: string;
  isNewSignup?: boolean;
  initialData?: {
    restaurantName: string;
    establishmentType: string;
    primaryCuisine: string;
    username: string;
  };
}) {
  const [formData, setFormData] = useState({
    name: initialData?.restaurantName || '',
    establishmentType: initialData?.establishmentType || '',
    primaryCuisine: initialData?.primaryCuisine || '',
    username: initialData?.username || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detectedMenuCurrency, setDetectedMenuCurrency] = useState<string>('USD')
  const router = useRouter()

  // Detect user's likely menu currency for placeholder item pricing
  useEffect(() => {
    fetch('/api/geo')
      .then(r => r.json())
      .then(json => {
        if (json?.data?.menuCurrency) {
          setDetectedMenuCurrency(json.data.menuCurrency)
        }
      })
      .catch(() => { /* fall back to USD (default) */ })
  }, [])

  // Fire Google Ads conversion when a genuinely new user lands here,
  // regardless of whether they came via /register or /auth/signin
  useEffect(() => {
    if (isNewSignup && typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
      ;(window as any).gtag('event', 'conversion', {
        send_to: `${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}/${process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL}`,
      })
    }
  }, [isNewSignup])

  // Fire signup_completed for new users after the Supabase session is confirmed.
  // The auth callback sets ?new_signup=true and redirects here, so this is the
  // earliest client-visible point after session establishment for new signups.
  useEffect(() => {
    if (isNewSignup) {
      captureEvent(ANALYTICS_EVENTS.SIGNUP_COMPLETED)
    }
  }, [isNewSignup])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      setError('Please enter your restaurant name')
      return
    }
    if (!formData.establishmentType || !formData.primaryCuisine) {
      setError('Please select both type and cuisine')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 1. Update user profile
      const result = await fetchJsonWithRetry<{ success: boolean; data: any }>(
        '/api/profile',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantName: formData.name,
            establishmentType: formData.establishmentType,
            primaryCuisine: formData.primaryCuisine,
            username: formData.username || undefined,
            onboardingCompleted: true,
          }),
        }
      )

      if (!result.success) {
        setError('Failed to complete onboarding. Please try again.')
        return
      }

      // 2. Auto-create first menu with cuisine-matched placeholder items
      const { items, categories } = getPlaceholderItems(
        formData.primaryCuisine,
        formData.establishmentType,
        detectedMenuCurrency,
      )
      const menuName = formData.name
      const menuResult = await fetchJsonWithRetry<{ success: boolean; data: any }>(
        '/api/menus',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: menuName,
            establishmentType: formData.establishmentType,
            primaryCuisine: formData.primaryCuisine,
            currency: detectedMenuCurrency,
            items,
            categories,
          }),
        }
      )

      if (menuResult.success && menuResult.data?.id) {
        // 3. Redirect to template page for instant "wow" moment
        router.refresh()
        setTimeout(() => {
          router.push(`/menus/${menuResult.data.id}/template`)
        }, 100)
      } else {
        // Menu creation failed -- still go to dashboard
        router.refresh()
        setTimeout(() => {
          router.push(next || '/dashboard')
        }, 100)
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ux-implementation min-h-screen flex flex-col overflow-x-hidden relative">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.45)), url(/backgrounds/kung-pao-chicken.png)',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 30%',
        }}
      />

      <UXHeader userEmail={userEmail} />

      <main className="container-ux py-10 md:py-12 flex-1 grid place-items-center">
        <div className="w-full max-w-xl">
          {reason === 'required' && (
            <div className="mb-6 p-4 bg-ux-primary/20 border border-ux-primary/30 rounded-xl text-white text-center text-sm backdrop-blur-md">
              <p className="font-semibold mb-1">Finish setting up your profile</p>
              <p className="opacity-90">We use these details to generate higher-quality AI images for your menu items.</p>
            </div>
          )}

          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
              Welcome to GridMenu
            </h1>
            <p className="mt-2 text-white/90 text-hero-shadow-strong">
              Let&apos;s set up your first menu in seconds
            </p>
          </div>

          <UXCard>
            <div className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-ux-text mb-2">Tell us about your place</h2>
                  <p className="text-sm text-ux-text-secondary mb-6">
                    We use these details to style your menu and generate better AI images.
                  </p>
                </div>

                <div className="space-y-4">
                  <UXInput
                    label="Restaurant Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. The Golden Grill"
                    autoFocus
                  />

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-ux-text">Establishment Type</label>
                    <select
                      className="input-ux w-full"
                      value={formData.establishmentType}
                      onChange={(e) => setFormData({ ...formData, establishmentType: e.target.value })}
                      required
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
                      required
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

                {error && <p className="text-sm text-ux-error">{error}</p>}

                <UXButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  loading={loading}
                >
                  Get Started!
                </UXButton>
              </form>
            </div>
          </UXCard>
        </div>
      </main>

      <UXFooter />
    </div>
  )
}

