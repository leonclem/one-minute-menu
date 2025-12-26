/**
 * General Purpose Gemini Image Generator (Admin)
 *
 * A backup image generator using Gemini 2.5 Flash for general admin purposes,
 * creating assets, etc. without restaurant-specific controls.
 */

import { requireAdmin } from '@/lib/auth-utils'
import { AdminImageGeneratorClient } from '@/app/admin/_components/admin-image-generator-client'

export const dynamic = 'force-dynamic'

export default async function GeneralImageGeneratorPage() {
  await requireAdmin()

  return (
    <AdminImageGeneratorClient
      title="General Purpose Image Generator"
      description="Generate images using Gemini 2.5 Flash for general admin purposes, creating assets, and other non-restaurant specific needs. Supports reference images for style matching and composition. Backup option when Imagen 4.0 is temperamental."
      endpoint="/api/admin/generate-general-image"
      badgeText="Gemini 2.5 Flash — reliable backup generator for general admin use."
      noteText="This generator uses Gemini Flash as a reliable alternative to Imagen 4.0. Perfect for creating general assets and admin materials."
      supportsImageSize={false}
      defaultAspectRatio="1:1"
      allowedAspectRatios={['1:1', '4:3', '3:4', '16:9', '9:16']}
      supportsReferenceImage={true}
      context="general"
    />
  )
}