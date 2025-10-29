import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError } from '@/lib/database'
import { transformExtractionToLayout } from '@/lib/templates/data-transformer'
import { selectLayoutPresetWithContext } from '@/lib/templates/layout-selector'
import { exportToImage, validateImageExportOptions, PRESET_DIMENSIONS } from '@/lib/templates/export/image-exporter'
import { logLayoutError, LayoutEngineError, ERROR_CODES } from '@/lib/templates/error-logger'
import { imageExportLimiter, applyRateLimit } from '@/lib/templates/rate-limiter'
import { MetricsBuilder, logLayoutMetrics, validatePerformance } from '@/lib/templates/metrics'
import type { OutputContext } from '@/lib/templates/types'
import { z } from 'zod'
import { logger } from '@/lib/logger'

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
  // Initialize metrics builder
  const metricsBuilder = new MetricsBuilder()
  
  try {
    // Authenticate user
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    metricsBuilder.setUserId(user.id)
    
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
    
    metricsBuilder.setMenuId(menuId)
    
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
    
    // Get extraction data - either from extractionMetadata or reconstruct from items
    let extractionResult: any
    
    // Check if extractionMetadata has the expected structure
    if (menu.extractionMetadata && (menu.extractionMetadata as any).menu) {
      extractionResult = menu.extractionMetadata
    } else if (menu.items && menu.items.length > 0) {
      // Reconstruct extraction result from menu items
      const categoryMap = new Map<string, any[]>()
      
      for (const item of menu.items) {
        const categoryName = item.category || 'Uncategorized'
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, [])
        }
        
        // Get image URL if available  
        let imageRef: string | undefined
        if (item.customImageUrl) {
          imageRef = item.customImageUrl
        } else if (item.aiImageId) {
          imageRef = `/api/images/${item.aiImageId}`
        }
        
        categoryMap.get(categoryName)!.push({
          name: item.name,
          price: item.price,
          description: item.description,
          imageRef,
          confidence: 1.0
        })
      }
      
      // Convert to categories array
      const categories = Array.from(categoryMap.entries()).map(([name, items]) => ({
        name,
        items,
        confidence: 1.0
      }))
      
      extractionResult = {
        menu: {
          categories
        },
        currency: '$',
        uncertainItems: [],
        superfluousText: []
      }
    } else {
      return NextResponse.json(
        { 
          error: 'Menu has no extraction data or items',
          code: ERROR_CODES.INVALID_INPUT
        },
        { status: 400 }
      )
    }
    
    // Transform extraction data to layout format
    metricsBuilder.markCalculationStart()
    const layoutData = transformExtractionToLayout(
      extractionResult,
      menu.name
    )
    
    // Analyze menu characteristics (needed for metrics regardless of preset selection)
    const { analyzeMenuCharacteristics } = await import('@/lib/templates/data-transformer')
    const characteristics = analyzeMenuCharacteristics(layoutData)
    metricsBuilder.setMenuCharacteristics({
      sectionCount: characteristics.sectionCount,
      totalItems: characteristics.totalItems,
      imageRatio: characteristics.imageRatio,
      avgNameLength: characteristics.avgNameLength,
      hasDescriptions: characteristics.hasDescriptions
    })
    
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
      preset = selectLayoutPresetWithContext(characteristics, context)
    }
    
    metricsBuilder.setLayoutSelection(preset.id, context)
    metricsBuilder.markCalculationEnd()
    
    // Dynamically import react-dom/server to avoid Next.js bundling issues
    const { renderToString } = await import('react-dom/server')
    const { createElement } = await import('react')
    const { ServerGridMenuLayout, ServerTextOnlyLayout } = await import('@/lib/templates/export/server-components')
    
    // Render React component to HTML string
    metricsBuilder.markRenderStart()
    const isTextOnly = preset.id === 'text-only'
    const componentHTML = isTextOnly
      ? renderToString(
          createElement(ServerTextOnlyLayout, {
            data: layoutData,
            preset,
            className: 'max-w-4xl mx-auto p-6'
          })
        )
      : renderToString(
          createElement(ServerGridMenuLayout, {
            data: layoutData,
            preset,
            context,
            className: 'max-w-7xl mx-auto p-6'
          })
        )
    metricsBuilder.markRenderEnd()
    
    // Export to image
    metricsBuilder.markExportStart()
    const result = await exportToImage(componentHTML, layoutData, context, imageOptions)
    metricsBuilder.markExportEnd()
    
    // Set export details and build metrics
    const exportFormat = imageOptions.format || 'png'
    metricsBuilder.setExportDetails(exportFormat, result.size)
    const metrics = metricsBuilder.build()
    logLayoutMetrics(metrics)
    
    // Validate performance
    const performanceCheck = validatePerformance(metrics)
    if (!performanceCheck.isValid) {
      logger.warn('[ImageExporter] Performance warnings:', performanceCheck.warnings)
    }
    
    // Return image with appropriate headers
    const mimeType = exportFormat === 'png' ? 'image/png' : 'image/jpeg'
    const extension = exportFormat === 'png' ? 'png' : 'jpg'
    
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
    logger.error('Error exporting image:', error)
    
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
        duration: metricsBuilder.build().totalTime
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
