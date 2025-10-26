import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError } from '@/lib/database'
import { transformExtractionToLayout } from '@/lib/templates/data-transformer'
import { selectLayoutPresetWithContext } from '@/lib/templates/layout-selector'
import { exportToHTML, validateHTMLExportOptions } from '@/lib/templates/export/html-exporter'
import { logLayoutError, LayoutEngineError, ERROR_CODES } from '@/lib/templates/error-logger'
import { htmlExportLimiter, applyRateLimit } from '@/lib/templates/rate-limiter'
import type { OutputContext } from '@/lib/templates/types'
import { z } from 'zod'

// Request body schema
const ExportHTMLRequestSchema = z.object({
  menuId: z.string().uuid('Invalid menu ID format'),
  context: z.enum(['mobile', 'tablet', 'desktop', 'print']).default('desktop'),
  presetId: z.string().optional(),
  options: z.object({
    includeDoctype: z.boolean().optional(),
    includeMetaTags: z.boolean().optional(),
    includeStyles: z.boolean().optional(),
    customCSS: z.string().optional(),
    pageTitle: z.string().optional()
  }).optional()
})

/**
 * POST /api/templates/export/html
 * 
 * Export menu layout as HTML
 * 
 * Request body:
 * - menuId: UUID of the menu
 * - context: Output context (mobile, tablet, desktop, print)
 * - presetId: Optional preset ID to override automatic selection
 * - options: HTML export options
 * 
 * Response:
 * - HTML string with appropriate content-type header
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
    const rateLimit = applyRateLimit(htmlExportLimiter, user.id)
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
    const validation = ExportHTMLRequestSchema.safeParse(body)
    
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
    
    // Validate HTML export options
    if (options) {
      const optionsValidation = validateHTMLExportOptions(options)
      if (!optionsValidation.valid) {
        return NextResponse.json(
          { 
            error: 'Invalid export options', 
            details: optionsValidation.errors 
          },
          { status: 400 }
        )
      }
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
    
    // Export to HTML
    const result = exportToHTML(layoutData, preset, context, {
      ...options,
      pageTitle: options.pageTitle || menu.name
    })
    
    // Log metrics
    const duration = Date.now() - startTime
    console.log('[HTMLExporter] Export completed:', {
      menuId,
      context,
      presetId: preset.id,
      size: result.size,
      duration
    })
    
    // Return HTML with appropriate headers
    return new Response(result.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': result.size.toString(),
        'Content-Disposition': `attachment; filename="${menu.slug}-${context}.html"`,
        'Cache-Control': 'no-cache'
      }
    })
    
  } catch (error) {
    console.error('Error exporting HTML:', error)
    
    // Handle specific error types
    if (error instanceof DatabaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      )
    }
    
    if (error instanceof LayoutEngineError) {
      logLayoutError(error, {
        endpoint: '/api/templates/export/html',
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
