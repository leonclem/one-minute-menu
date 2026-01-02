'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UXHeader, UXFooter, UXButton, UXInput, UXCard } from '@/components/ux'
import { fetchJsonWithRetry } from '@/lib/retry'
import { ESTABLISHMENT_TYPES, CUISINES } from '@/types'

export default function OnboardingClient({ userEmail }: { userEmail?: string }) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    establishmentType: '',
    primaryCuisine: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleNext = () => {
    if (step === 1 && !formData.name) {
      setError('Please enter your restaurant name')
      return
    }
    setError('')
    setStep(step + 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.establishmentType || !formData.primaryCuisine) {
      setError('Please select both type and cuisine')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Create first menu automatically
      const slug = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
      const result = await fetchJsonWithRetry<{ success: boolean; data: any }>(
        '/api/menus',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            slug,
            establishmentType: formData.establishmentType,
            primaryCuisine: formData.primaryCuisine,
          }),
        }
      )

      if (result.success) {
        router.push(`/menus/${result.data.id}/upload`)
      } else {
        setError('Failed to create your first menu. Please try again.')
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

      <main className="container-ux py-10 md:py-12 flex-grow grid place-items-center">
        <div className="w-full max-w-xl">
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
              {step === 1 ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-ux-text mb-2">What&apos;s your restaurant called?</h2>
                    <p className="text-sm text-ux-text-secondary mb-6">
                      This will appear at the top of your digital menu.
                    </p>
                  </div>

                  <UXInput
                    label="Restaurant Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. The Golden Grill"
                    autoFocus
                  />

                  {error && <p className="text-sm text-ux-error">{error}</p>}

                  <UXButton variant="primary" size="lg" className="w-full" onClick={handleNext}>
                    Next Step
                  </UXButton>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-ux-text mb-2">Tell us more about your place</h2>
                    <p className="text-sm text-ux-text-secondary mb-6">
                      This helps our AI generate better images and style your menu perfectly.
                    </p>
                  </div>

                  <div className="space-y-4">
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

                  <div className="flex gap-4">
                    <UXButton
                      type="button"
                      variant="outline"
                      size="lg"
                      className="flex-1"
                      onClick={() => setStep(1)}
                      disabled={loading}
                    >
                      Back
                    </UXButton>
                    <UXButton
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="flex-1"
                      loading={loading}
                    >
                      Create Menu
                    </UXButton>
                  </div>
                </form>
              )}
            </div>
          </UXCard>
        </div>
      </main>

      <UXFooter />
    </div>
  )
}

