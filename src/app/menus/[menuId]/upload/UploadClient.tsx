'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ImageUpload from '@/components/ImageUpload'
import { UXButton } from '@/components/ux'

interface UploadClientProps {
  menuId: string
}

export default function UploadClient({ menuId }: UploadClientProps) {
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
      router.push(`/menus/${menuId}/extract`)
    } catch (e) {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <section className="container-ux py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">Upload your menu</h1>
          <p className="mt-2 text-white/80 text-hero-shadow">Select a clear photo or PNG/JPG of your menu to extract items automatically.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="card-ux bg-white/80 backdrop-blur-[1.5px]">
          <ImageUpload
            onImageSelected={(file) => handleUpload(file)}
            className="w-full bg-transparent shadow-none"
          />
        </div>

        <div className="mt-6 flex justify-center items-center">
          <Link href={`/dashboard/menus/${menuId}`} aria-label="Enter items manually in the dashboard">
            <UXButton variant="warning" size="md" noShadow className="min-w-[220px] py-2">Enter items manually</UXButton>
          </Link>
        </div>
      </div>
    </section>
  )
}


