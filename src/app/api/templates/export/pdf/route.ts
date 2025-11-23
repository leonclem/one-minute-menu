import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError } from '@/lib/database'
import { transformExtractionToLayout } from '@/lib/templates/data-transformer'
import { selectLayoutPresetWithContext } from '@/lib/templates/layout-selector'
import { exportToPDF, validatePDFExportOptions } from '@/lib/templates/export/pdf-exporter'
import { logLayoutError, LayoutEngineError, ERROR_CODES } from '@/lib/templates/error-logger'
import { pdfExportLimiter, applyRateLimit } from '@/lib/templates/rate-limiter'
import { MetricsBuilder, logLayoutMetrics, validatePerformance } from '@/lib/templates/metrics'
import { z } from 'zod'
import { logger } from '@/lib/logger'

// Extended timeout for PDF generation
export const maxDuration = 60

/**
 * Handle PDF export using the new template engine
 */
async function handleNewTemplateEngine(
  menu: any,
  templateId: string,
  options: any,
  userId: string,
  metricsBuilder: MetricsBuilder
) {
  // Import new template engine modules
  const { toEngineMenu } = await import('@/lib/templates/menu-transformer')
  const { TEMPLATE_REGISTRY } = await import('@/lib/templates/template-definitions')
  const { generateLayout } = await import('@/lib/templates/layout-engine')
  const { checkCompatibility } = await import('@/lib/templates/compatibility-checker')
  const { ServerLayoutRenderer } = await import('@/lib/templates/export/layout-renderer')
  const { renderToString } = await import('react-dom/server')
  const { createElement } = await import('react')
  
  // Validate template exists
  const template = TEMPLATE_REGISTRY[templateId]
  if (!template) {
    return NextResponse.json(
      { error: 'Invalid template ID', code: ERROR_CODES.PRESET_NOT_FOUND },
      { status: 400 }
    )
  }
  
  // Transform menu to EngineMenu
  metricsBuilder.markCalculationStart()
  const engineMenu = toEngineMenu(menu)
  
  // Check compatibility
  const compatibility = checkCompatibility(engineMenu, template)
  if (compatibility.status === 'INCOMPATIBLE') {
    return NextResponse.json(
      { 
        error: 'Template is incompatible with this menu',
        code: ERROR_CODES.INVALID_INPUT,
        details: compatibility
      },
      { status: 400 }
    )
  }
  
  // Load saved template selection (if exists)
  const supabase = createServerSupabaseClient()
  let selection: any
  const { data: selectionData } = await supabase
    .from('menu_template_selections')
    .select('*')
    .eq('menu_id', menu.id)
    .single()
  
  if (selectionData) {
    selection = {
      id: selectionData.id,
      menuId: selectionData.menu_id,
      templateId: selectionData.template_id,
      templateVersion: selectionData.template_version,
      configuration: selectionData.configuration,
      createdAt: new Date(selectionData.created_at),
      updatedAt: new Date(selectionData.updated_at)
    }
  }
  
  // Generate layout
  const layout = generateLayout({
    menu: engineMenu,
    template,
    selection
  })
  
  metricsBuilder.setLayoutSelection(templateId, 'print')
  metricsBuilder.markCalculationEnd()
  
  // Render layout to HTML
  metricsBuilder.markRenderStart()
  const componentHTML = renderToString(
    createElement(ServerLayoutRenderer, {
      layout,
      currency: engineMenu.metadata.currency,
      className: 'pdf-export'
    })
  )
  metricsBuilder.markRenderEnd()
  
  // Build complete HTML document
  const htmlDocument = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title || menu.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      color: #1f2937;
    }
    
    @page {
      size: ${template.orientation === 'A4_LANDSCAPE' ? 'A4 landscape' : 'A4 portrait'};
      margin: 0;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  ${componentHTML}
</body>
</html>
  `.trim()
  
  // Export to PDF
  metricsBuilder.markExportStart()
  // Create minimal LayoutMenuData for PDF export metadata
  const layoutData = {
    metadata: {
      title: menu.name,
      currency: engineMenu.metadata.currency
    },
    sections: []
  }
  const result = await exportToPDF(htmlDocument, layoutData, {
    ...options,
    title: options.title || menu.name
  })
  metricsBuilder.markExportEnd()
  
  // Set export details and build metrics
  metricsBuilder.setExportDetails('pdf', result.size)
  const metrics = metricsBuilder.build()
  logLayoutMetrics(metrics)
  
  // Validate performance
  const performanceCheck = validatePerformance(metrics)
  if (!performanceCheck.isValid) {
    logger.warn('[PDFExporter] Performance warnings:', performanceCheck.warnings)
  }
  
  // Return PDF with appropriate headers
  const orientation = template.orientation === 'A4_LANDSCAPE' ? 'landscape' : 'portrait'
  return new Response(result.pdfBytes as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': result.size.toString(),
      'Content-Disposition': `attachment; filename="${menu.slug}-${orientation}.pdf"`,
      'Cache-Control': 'no-cache'
    }
  })
}

// Request body schema
const ExportPDFRequestSchema = z.object({
  menuId: z.string().uuid('Invalid menu ID format'),
  templateId: z.string().optional(), // New: template ID for new engine
  presetId: z.string().optional(),   // Legacy: preset ID for old engine
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
    
    const { menuId, templateId, presetId, options = {} } = validation.data
    
    metricsBuilder.setMenuId(menuId)
    
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
    
    // NEW TEMPLATE ENGINE PATH
    if (templateId) {
      return await handleNewTemplateEngine(menu, templateId, options, user.id, metricsBuilder)
    }
    
    // LEGACY PATH: Continue with existing preset-based system
    
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
      preset = selectLayoutPresetWithContext(characteristics, 'print')
    }
    
    metricsBuilder.setLayoutSelection(preset.id, 'print')
    metricsBuilder.markCalculationEnd()
    
    // Dynamically import react-dom/server to avoid Next.js bundling issues
    const { renderToString } = await import('react-dom/server')
    const { createElement } = await import('react')
    const { ServerGridMenuLayout, ServerTextOnlyLayout } = await import('@/lib/templates/export/server-components')
    const { exportToHTML } = await import('@/lib/templates/export/html-exporter')
    
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
            context: 'print',
            className: 'max-w-7xl mx-auto p-6'
          })
        )
    metricsBuilder.markRenderEnd()
    
    // Build complete HTML document
    const htmlResult = exportToHTML(componentHTML, layoutData, 'print', {
      includeDoctype: true,
      includeMetaTags: true,
      includeStyles: true,
      pageTitle: options.title || menu.name
    })
    
    // Export to PDF
    metricsBuilder.markExportStart()
    const result = await exportToPDF(htmlResult.html, layoutData, {
      ...options,
      title: options.title || menu.name
    })
    metricsBuilder.markExportEnd()
    
    // Set export details and build metrics
    metricsBuilder.setExportDetails('pdf', result.size)
    const metrics = metricsBuilder.build()
    logLayoutMetrics(metrics)
    
    // Validate performance
    const performanceCheck = validatePerformance(metrics)
    if (!performanceCheck.isValid) {
      logger.warn('[PDFExporter] Performance warnings:', performanceCheck.warnings)
    }
    
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
    logger.error('Error exporting PDF:', error)
    
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
