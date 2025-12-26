import { NextRequest, NextResponse } from 'next/server'
import { getNanoBananaClient, NanoBananaError } from '@/lib/nano-banana'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const VALID_ASPECT_RATIOS = new Set(['1:1', '4:3', '3:4', '16:9', '9:16'])
const VALID_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_REFERENCE_IMAGE_BYTES = 7 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminApi()
    if (!admin.ok) return admin.response

    const {
      prompt,
      aspectRatio = '1:1',
      numberOfImages = 1,
      negativePrompt = '',
      referenceMode = 'style_match',
      referenceImages = [],
    } =
      (await request.json()) as {
        prompt?: string
        aspectRatio?: string
        numberOfImages?: number
        negativePrompt?: string
        referenceMode?: 'style_match' | 'composite'
        referenceImages?: Array<{ dataUrl: string; role?: 'subject' | 'background' | 'style' | 'other'; name?: string }>
      }

    if (!process.env.NANO_BANANA_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!VALID_ASPECT_RATIOS.has(aspectRatio)) {
      return NextResponse.json(
        { error: `Invalid aspectRatio. Must be one of: ${Array.from(VALID_ASPECT_RATIOS).join(', ')}` },
        { status: 400 },
      )
    }

    const count = Math.min(Math.max(Number(numberOfImages) || 1, 1), 4)

    const normalizedRefs = Array.isArray(referenceImages) ? referenceImages.slice(0, 3) : []
    if (Array.isArray(referenceImages) && referenceImages.length > 3) {
      return NextResponse.json({ error: 'Too many reference images (max 3)' }, { status: 400 })
    }

    let reference_images:
      | Array<{ mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string; role?: 'subject' | 'background' | 'style' | 'other' }>
      | undefined
    const referenceImageMeta: Array<{ mimeType: string; bytes: number; role?: string; name?: string }> = []

    if (normalizedRefs.length > 0) {
      reference_images = []
      for (const ref of normalizedRefs) {
        const match = /^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/=]+)$/.exec(ref.dataUrl || '')
        if (!match) {
          return NextResponse.json(
            { error: 'Invalid reference image dataUrl. Must be a base64 data URL for PNG/JPEG/WebP.' },
            { status: 400 },
          )
        }

        const mimeType = match[1]
        const b64 = match[2]
        if (!VALID_MIME_TYPES.has(mimeType)) {
          return NextResponse.json({ error: 'Invalid reference image type' }, { status: 400 })
        }

        const bytes = Buffer.from(b64, 'base64')
        if (bytes.length > MAX_REFERENCE_IMAGE_BYTES) {
          return NextResponse.json({ error: 'Reference image too large (max 7MB)' }, { status: 400 })
        }

        reference_images.push({ mimeType: mimeType as any, data: b64, role: ref.role || 'other' })
        referenceImageMeta.push({ mimeType, bytes: bytes.length, role: ref.role, name: ref.name })
      }
    }

    logger.info('🎨 [Admin General Image] Request', {
      userId: admin.user.id,
      aspectRatio,
      numberOfImages: count,
      referenceMode: normalizedRefs.length > 0 ? referenceMode : null,
      referenceImageCount: normalizedRefs.length,
      referenceImages: referenceImageMeta,
      promptLength: (prompt || '').length,
      negativePromptLength: (negativePrompt || '').length,
    })

    console.log('🔍 [Debug] About to call generateImage with params:', {
      prompt: prompt.trim(),
      aspect_ratio: aspectRatio,
      number_of_images: count,
      safety_filter_level: 'block_some',
      person_generation: 'allow',
      referenceMode: normalizedRefs.length > 0 ? referenceMode : null,
      referenceImageCount: normalizedRefs.length,
      hasNegativePrompt: !!(negativePrompt?.trim())
    })

    const result = await getNanoBananaClient().generateImage({
      prompt: prompt.trim(),
      negative_prompt: negativePrompt?.trim() || '',
      aspect_ratio: aspectRatio,
      number_of_images: count,
      safety_filter_level: 'block_some',
      person_generation: 'dont_allow',
      reference_images,
      reference_mode: normalizedRefs.length > 0 ? referenceMode : undefined,
      context: 'general',
    })

    // Gemini returns inline image data (base64). Wrap as a data URL for browser usage.
    const images = result.images.map((b64) => `data:image/png;base64,${b64}`)

    return NextResponse.json({
      imageUrl: images[0],
      images,
      prompt: prompt.trim(),
      aspectRatio,
      model: 'gemini-2.5-flash-image',
      referenceMode: normalizedRefs.length > 0 ? referenceMode : undefined,
    })
  } catch (error: any) {
    console.log('🔍 [API Route] Caught error:', {
      type: error?.constructor?.name,
      isNanoBananaError: error instanceof NanoBananaError,
      message: error?.message,
      code: error?.code,
      status: error?.status
    })

    if (error instanceof NanoBananaError) {
      console.log('🔍 [API Route] Processing NanoBananaError:', {
        code: error.code,
        message: error.message,
        suggestions: error.suggestions,
        filterReason: error.filterReason
      })

      const status =
        error.code === 'AUTHENTICATION_ERROR' ? 401 :
        error.code === 'CONTENT_POLICY_VIOLATION' ? 403 :
        error.code === 'RATE_LIMIT_EXCEEDED' ? 429 :
        error.code === 'SERVICE_UNAVAILABLE' ? 503 :
        400
      
      console.log('🔍 [API Route] Returning error response with status:', status)
      
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          retryAfter: error.retryAfter,
          suggestions: error.suggestions,
          filterReason: error.filterReason,
        },
        { status },
      )
    }

    console.error('Error generating general image:', error)
    
    // Log the full error details for debugging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        ...(error as any)
      })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}