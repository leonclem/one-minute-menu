/**
 * Gemini 3.0 Pro Image Generator (Admin Test Area)
 *
 * Professional asset production playground for Gemini 3.0 Pro image generation.
 * Supports up to 14 reference images and 4K resolution.
 */

import { requireAdmin } from '@/lib/auth-utils'
import { AdminImageGeneratorClient } from '@/app/admin/_components/admin-image-generator-client'

export const dynamic = 'force-dynamic'

export default async function Gemini3ProImageGeneratorPage() {
  await requireAdmin()

  return (
    <AdminImageGeneratorClient
      title="Gemini 3.0 Pro Image Generator"
      description="Professional asset production playground using Gemini 3.0 Pro (gemini-3-pro-image-preview). Supports advanced reasoning, 4K resolution, and up to 14 reference images. Admin-only testing tool."
      endpoint="/api/admin/generate-gemini-3-pro-image"
      badgeText="Gemini 3.0 Pro (Nano Banana Pro) — high-fidelity professional generation."
      noteText="Gemini 3.0 Pro supports up to 14 reference images (6 objects, 5 humans recommended) and resolution up to 4K. Use 'Thinking' process for complex compositions."
      supportsImageSize={true}
      defaultImageSize="2K"
      defaultAspectRatio="1:1"
      allowedAspectRatios={['1:1', '4:3', '3:4', '16:9', '9:16']}
      supportsReferenceImage
      context="food"
    />
  )
}
