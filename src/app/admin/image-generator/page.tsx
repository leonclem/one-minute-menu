import { requireAdmin } from '@/lib/auth-utils'
import { AdminImageGeneratorClient } from '@/app/admin/_components/admin-image-generator-client'

export const dynamic = 'force-dynamic'

export default async function ImageGeneratorPage() {
  await requireAdmin()

  return (
    <AdminImageGeneratorClient
      title="Imagen 4.0 Generator"
      description="Generate high-quality images using Google's Imagen 4.0 AI with custom aspect ratios and 2K resolution. Admin-only tool."
      endpoint="/api/admin/generate-image"
      badgeText="Imagen 4.0! High-quality image generation with custom aspect ratios and 2K resolution support."
      supportsImageSize
      defaultAspectRatio="1:1"
      defaultImageSize="2K"
    />
  )
}