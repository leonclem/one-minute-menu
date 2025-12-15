/**
 * Gemini 2.5 Flash Image Generator (Admin)
 *
 * Prompt refinement playground for Gemini native image generation.
 */

import { requireAdmin } from '@/lib/auth-utils'
import { AdminImageGeneratorClient } from '@/app/admin/_components/admin-image-generator-client'

export const dynamic = 'force-dynamic'

export default async function GeminiImageGeneratorPage() {
  await requireAdmin()

  return (
    <AdminImageGeneratorClient
      title="Gemini 2.5 Flash Image Generator"
      description="Generate images using Gemini native image generation (gemini-2.5-flash-image). Designed for fast iteration and prompt refinement. Admin-only tool."
      endpoint="/api/admin/generate-gemini-image"
      badgeText="Gemini 2.5 Flash Image (Nano Banana) — native image generation via generateContent."
      noteText="Aspect ratio control is currently best-effort for Gemini native image generation. Until it’s reliably honored, this tool only offers 1:1 to avoid misleading options."
      supportsImageSize={false}
      defaultAspectRatio="1:1"
      allowedAspectRatios={['1:1']}
      supportsReferenceImage
    />
  )
}


