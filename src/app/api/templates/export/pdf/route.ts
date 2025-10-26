import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError } from '@/lib/database'
import { transformExtractionToLayout } from '@/lib/templates/data-transformer'
import { selectLayoutPresetWithContext } from '@/lib/templates/layout-selector'
import { exportToPDF, validatePDFExportOptions } from '@/lib/templates/export/pdf-exporter'
import { logLayoutError, LayoutEngineError, ERROR_CODES } from '@/lib/templates/error-logger'
import { pdfExportLimiter, applyRateLimit } from '@/lib/templates/rate-limiter'
import { z } from 'zod'

// Extended timeout for PDF generation (30 seconds)
export const maxDuration = 30

// Request body schema
const ExportPDFRequestSchema = z.object({
  menuId: z.string().uuid('Invalid menu ID format'),
  presetId: z.string().optional(),
  options: z.object({
    orientation: z.enum(['portrait', 'landscape']).optional(),
    title: z.string().optional(),
    includePageNumbers: z.boolean().optional(),
    margins: z.object({
      top: z.number().optional(),
      right: z.number().optional(),
      bottom: z.number().optional(),
      left: z.number().optional()
    }).optional()
  }).optional()
})

/**
 * POST /api/templates/export/pdf
 * 
 * Export menu layout as PDF
 * 
 * Request body:
 * - menuId: UUID of the menu
 * - presetId: Optional preset ID to override automatic selection
 * - options: PDF export options (orientation, title, margins, etc.)
 * 
 * Response:
 * - PDF document with appropriate content-type header
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
    const rateLimit = applyRateLimit(pdfExportLimiter, user.id)
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
    const validation = ExportPDFRequestSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validation.error.format() 
        },
        { status: 400 }
      )
    }
    
    const { menuId, presetId, options = {} } = validation.data
    
    // Validate PDF export options
    if (options) {
      const optionsValidation = validatePDFExportOptions(options)
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
      preset = selectLayoutPresetWithContext(characteristics, 'print')
    }
    
    // Export to PDF
    const result = await exportToPDF(layoutData, preset, {
      ...options,
      title: options.title || menu.name
    })
    
    // Check if generation exceeded target time (5 seconds)
    if (result.duration > 5000) {
      console.warn(`[PDFExporter] Generation exceeded target time: ${result.duration}ms`)
    }
    
    // Log metrics
    console.log('[PDFExporter] Export completed:', {
      menuId,
      presetId: preset.id,
      size: result.size,
      pageCount: result.pageCount,
      duration: result.duration
    })
    
    // Return PDF with appropriate headers
    const orientation = options.orientation || 'portrait'
    return new Response(result.pdfBytes as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': result.size.toString(),
        'Content-Disposition': `attachment; filename="${menu.slug}-${orientation}.pdf"`,
        'Cache-Control': 'no-cache'
      }
    })
    
  } catch (error) {
    console.error('Error exporting PDF:', error)
    
    // Handle specific error types
    if (error instanceof DatabaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      )
    }
    
    if (error instanceof LayoutEngineError) {
      logLayoutError(error, {
        endpoint: '/api/templates/export/pdf',
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
