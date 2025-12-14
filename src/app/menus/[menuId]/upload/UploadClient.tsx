'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ImageUpload from '@/components/ImageUpload'
import { UXButton } from '@/components/ux'

interface UploadClientProps {
  menuId: string
  menuName?: string
}

export default function UploadClient({ menuId, menuName }: UploadClientProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async (file: File) => {
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch(`/api/menus/${menuId}/image`, {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) {
        setError(result?.error || 'Upload failed. Please try again.')
        setSubmitting(false)
        return
      }
      router.push(`/ux/menus/${menuId}/extract`)
    } catch (e) {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <section className="container-ux py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Add items for {menuName || 'your menu'}
          </h1>
          <p className="mt-2 text-white/80 text-hero-shadow">
            You can upload a photo of your existing menu to extract items automatically, or skip the photo and enter items manually.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="card-ux bg-white/80 backdrop-blur-[1.5px]">
          <div className="p-4 pb-2 text-center">
            <p
              className="text-ux-text-secondary mb-1"
              style={{ fontSize: '1rem', lineHeight: '1rem' }}
            >
              Use a clear, readable photo of your menu.
            </p>
            <p
              className="text-ux-text-secondary mb-3"
              style={{ fontSize: '1rem', lineHeight: '1rem' }}
            >
              We&apos;ll extract items automatically so you can review and tweak them.
            </p>
          </div>
          <ImageUpload
            onImageSelected={(file) => handleUpload(file)}
            className="w-full bg-transparent shadow-none"
          />
        </div>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-white/90 text-hero-shadow">
            Prefer to build everything by hand instead?
          </p>
          <div className="flex justify-center items-center">
            <Link href={`/ux/menus/${menuId}/extracted`} aria-label="Enter items manually in the extracted page">
              <UXButton variant="warning" size="md" noShadow className="min-w-[220px] py-2">
                Enter items manually
              </UXButton>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}


