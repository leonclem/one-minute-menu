'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Input, Card, CardHeader, CardTitle, CardContent, UpgradePrompt } from '@/components/ui'
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
    <div className="min-h-screen bg-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard"
                className="text-secondary-500 hover:text-secondary-700"
              >
                ← Back
              </Link>
              <h1 className="text-2xl font-bold text-secondary-900">
                Create New Menu
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-mobile py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Menu Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
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
                <Input
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
                <Input
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
                  <label className="block text-sm font-medium text-secondary-700">
                    Description (Optional)
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of your menu..."
                    rows={3}
                    className="input resize-none"
                  />
                  <p className="text-sm text-secondary-500">
                    This will help customers understand what this menu is for
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Link
                    href="/dashboard"
                    className="btn btn-outline w-full sm:w-auto"
                  >
                    Cancel
                  </Link>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={loading}
                    className="w-full sm:w-auto"
                  >
                    {loading ? 'Creating Menu...' : 'Create Menu'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Help Section */}
          <div className="mt-8 rounded-lg bg-blue-50 p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              What happens next?
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• Your menu will be created with a unique URL</li>
              <li>• You can add menu items manually or upload a photo for OCR</li>
              <li>• Customize colors and styling to match your brand</li>
              <li>• Generate a QR code for customers to scan</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}