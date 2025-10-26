import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError } from '@/lib/database'
import { transformExtractionToLayout } from '@/lib/templates/data-transformer'
import { selectLayoutPresetWithContext } from '@/lib/templates/layout-selector'
import { exportToImage, validateImageExportOptions, PRESET_DIMENSIONS } from '@/lib/templates/export/image-exporter'
import { logLayoutError, LayoutEngineError, ERROR_CODES } from '@/lib/templates/error-logger'
import { imageExportLimiter, applyRateLimit } from '@/lib/templates/rate-limiter'
import type { OutputContext } from '@/lib/templates/types'
import { z } from 'zod'

// Extended timeout for image generation (30 seconds)
export const maxDuration = 30

// Request body schema
const ExportImageRequestSchema = z.object({
  menuId: z.string().uuid('Invalid menu ID format'),
  context: z.enum(['mobile', 'tablet', 'desktop', 'print']).default('desktop'),
  presetId: z.string().optional(),
  options: z.object({
    format: z.enum(['png', 'jpg']).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    quality: z.number().int().min(1).max(100).optional(),
    backgroundColor: z.string().optional(),
    pixelRatio: z.number().min(1).max(4).optional(),
    customCSS: z.string().optional(),
    presetDimension: z.enum([
      'instagramSquare',
      'instagramPortrait',
      'instagramLandscape',
      'instagramStory',
      'facebookPost',
      'twitterPost',
      'linkedinPost',
      'a4Portrait',
      'a4Landscape',
      'hd',
      'uhd'
    ]).optional()
  }).optional()
})

/**
 * POST /api/templates/export/image
 * 
 * Export menu layout as PNG or JPG image
 * 
 * Request body:
 * - menuId: UUID of the menu
 * - context: Output context (mobile, tablet, desktop, print)
 * - presetId: Optional preset ID to override automatic selection
 * - options: Image export options (format, dimensions, quality, etc.)
 * 
 * Response:
 * - Image file with appropriate content-type header
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Authenticate user
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Apply rate limiting
    const rateLimit = applyRateLimit(imageExportLimiter, user.id)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          code: ERROR_CODES.CONCURRENCY_LIMIT,
          retryAfter: rateLimit.retryAfter
        },
        { 
          status: 429,
          headers: rateLimit.headers
        }
      )
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validation = ExportImageRequestSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validation.error.format() 
        },
        { status: 400 }
      )
    }
    
    const { menuId, context, presetId, options = {} } = validation.data
    
    // Handle preset dimensions
    let imageOptions = { ...options }
    if (options.presetDimension) {
      const dimensions = PRESET_DIMENSIONS[options.presetDimension]
      imageOptions.width = dimensions.width
      imageOptions.height = dimensions.height
    }
    
    // Validate image export options
    const optionsValidation = validateImageExportOptions(imageOptions)
    if (!optionsValidation.valid) {
      return NextResponse.json(
        { 
          error: 'Invalid export options', 
          details: optionsValidation.errors 
        },
        { status: 400 }
      )
    }
    
    // Fetch menu data
    const menu = await menuOperations.getMenu(menuId, user.id)
    
    if (!menu) {
      return NextResponse.json(
        { error: 'Menu not found' },
        { status: 404 }
      )
    }
    
    // Check if menu has extraction metadata
    if (!menu.extractionMetadata) {
      return NextResponse.json(
        { 
          error: 'Menu has no extraction data',
          code: ERROR_CODES.INVALID_INPUT
        },
        { status: 400 }
      )
    }
    
    // Transform extraction data to layout format
    const layoutData = transformExtractionToLayout(
      menu.extractionMetadata as any,
      menu.name
    )
    
    // Select preset (use provided presetId or auto-select)
    let preset
    if (presetId) {
      const { LAYOUT_PRESETS } = await import('@/lib/templates/presets')
      preset = LAYOUT_PRESETS[presetId]
      if (!preset) {
        return NextResponse.json(
          { error: 'Invalid preset ID', code: ERROR_CODES.PRESET_NOT_FOUND },
          { status: 400 }
        )
      }
    } else {
      const { analyzeMenuCharacteristics } = await import('@/lib/templates/data-transformer')
      const characteristics = analyzeMenuCharacteristics(layoutData)
      preset = selectLayoutPresetWithContext(characteristics, context)
    }
    
    // Export to image
    const result = await exportToImage(layoutData, preset, context, imageOptions)
    
    // Check if generation exceeded target time (4 seconds)
    if (result.duration > 4000) {
      console.warn(`[ImageExporter] Generation exceeded target time: ${result.duration}ms`)
    }
    
    // Log metrics
    console.log('[ImageExporter] Export completed:', {
      menuId,
      context,
      presetId: preset.id,
      format: result.format,
      size: result.size,
      dimensions: `${result.width}x${result.height}`,
      duration: result.duration
    })
    
    // Return image with appropriate headers
    const format = imageOptions.format || 'png'
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
    const extension = format === 'png' ? 'png' : 'jpg'
    
    return new Response(result.imageBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': result.size.toString(),
        'Content-Disposition': `attachment; filename="${menu.slug}-${context}.${extension}"`,
        'Cache-Control': 'no-cache'
      }
    })
    
  } catch (error) {
    console.error('Error exporting image:', error)
    
    // Handle specific error types
    if (error instanceof DatabaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      )
    }
    
    if (error instanceof LayoutEngineError) {
      logLayoutError(error, {
        endpoint: '/api/templates/export/image',
        duration: Date.now() - startTime
      })
      
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: 400 }
      )
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid menu data', 
          code: ERROR_CODES.INVALID_INPUT,
          details: error.format() 
        },
        { status: 400 }
      )
    }
    
    // Generic error
    return NextResponse.json(
      { error: 'Internal server error', code: ERROR_CODES.EXPORT_FAILED },
      { status: 500 }
    )
  }
}
