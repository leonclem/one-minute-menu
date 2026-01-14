import { NextRequest, NextResponse } from 'next/server'
import { getNanoBananaClient, NanoBananaError } from '@/lib/nano-banana'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const VALID_ASPECT_RATIOS = new Set(['1:1', '4:3', '3:4', '16:9', '9:16', '21:9', '2:3', '3:2', '4:5', '5:4'])
const VALID_IMAGE_SIZES = new Set(['1K', '2K', '4K'])
const VALID_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_REFERENCE_IMAGE_BYTES = 7 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminApi()
    if (!admin.ok) return admin.response

    const {
      prompt,
      aspectRatio = '1:1',
      imageSize = '2K',
      numberOfImages = 1,
      negativePrompt = '',
      referenceMode = 'style_match',
      referenceImages = [],
      scenarioId = null,
    } =
      (await request.json()) as {
        prompt?: string
        aspectRatio?: string
        imageSize?: string
        numberOfImages?: number
        negativePrompt?: string
        referenceMode?: 'style_match' | 'composite'
        referenceImages?: Array<{ dataUrl: string; role?: string; name?: string }>
        scenarioId?: string | null
      }

    if (!process.env.NANO_BANANA_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!VALID_ASPECT_RATIOS.has(aspectRatio)) {
      // Relaxed validation for Pro which supports more ratios
      logger.warn(`🧪 [Admin Gemini 3 Pro] Unexpected aspectRatio: ${aspectRatio}`)
    }

    if (!VALID_IMAGE_SIZES.has(imageSize)) {
      return NextResponse.json({ error: 'Invalid imageSize. Use 1K, 2K, or 4K.' }, { status: 400 })
    }

    const count = Math.min(Math.max(Number(numberOfImages) || 1, 1), 4)

    // Gemini 3 Pro supports up to 14 reference images
    const normalizedRefs = Array.isArray(referenceImages) ? referenceImages.slice(0, 14) : []
    
    let reference_images:
      | Array<{ mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string; role?: string; comment?: string }>
      | undefined
    const referenceImageMeta: Array<{ mimeType: string; bytes: number; role?: string; name?: string }> = []

    if (normalizedRefs.length > 0) {
      reference_images = []
      for (const ref of normalizedRefs) {
        const dataUrl = (ref.dataUrl || '').trim()
        const match = dataUrl.match(/^data:(image\/png|image\/jpeg|image\/webp);base64,/)
        
        if (!match) continue

        const mimeType = match[1]
        const b64 = dataUrl.substring(match[0].length).replace(/[\r\n\s]/g, '')
        
        if (!b64) continue

        const bytes = Buffer.from(b64, 'base64')
        if (bytes.length > MAX_REFERENCE_IMAGE_BYTES) continue

        reference_images.push({ 
          mimeType: mimeType as any, 
          data: b64, 
          role: ref.role || 'other'
        })
        referenceImageMeta.push({ mimeType, bytes: bytes.length, role: ref.role, name: ref.name })
      }
    }

    logger.info('🧪 [Admin Gemini 3 Pro] Request', {
      userId: admin.user.id,
      scenarioId,
      aspectRatio,
      imageSize,
      numberOfImages: count,
      referenceMode: normalizedRefs.length > 0 ? referenceMode : null,
      referenceImageCount: reference_images?.length || 0,
      promptLength: (prompt || '').length,
    })

    const result = await getNanoBananaClient().generateImage({
      model: 'gemini-3-pro-image-preview',
      prompt: prompt.trim(),
      negative_prompt: negativePrompt?.trim() || '',
      aspect_ratio: aspectRatio,
      image_size: imageSize,
      number_of_images: count,
      safety_filter_level: 'block_some',
      person_generation: 'dont_allow',
      reference_images,
      reference_mode: reference_images && reference_images.length > 0 ? referenceMode : undefined,
      context: 'food',
    })

    const images = result.images.map((b64) => `data:image/png;base64,${b64}`)

    return NextResponse.json({
      imageUrl: images[0],
      images,
      prompt: prompt.trim(),
      aspectRatio,
      imageSize,
      model: 'gemini-3-pro-image-preview',
      referenceMode: reference_images && reference_images.length > 0 ? referenceMode : undefined,
      scenarioId,
    })
  } catch (error) {
    if (error instanceof NanoBananaError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          suggestions: error.suggestions,
          filterReason: error.filterReason,
        },
        { status: error.status || 400 },
      )
    }

    console.error('Error generating Gemini 3 Pro image:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
