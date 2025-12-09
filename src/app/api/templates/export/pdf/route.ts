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
  metricsBuilder: MetricsBuilder,
  headers?: Record<string, string>
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

  // Calculate menu characteristics for metrics
  const sectionCount = engineMenu.sections.length
  const totalItems = engineMenu.sections.reduce((sum, section) => sum + section.items.length, 0)
  const itemsWithImages = engineMenu.sections.reduce((sum, section) => 
    sum + section.items.filter(item => !!item.imageUrl).length, 0)
  const imageRatio = totalItems > 0 ? (itemsWithImages / totalItems) * 100 : 0
  
  const totalNameLength = engineMenu.sections.reduce((sum, section) => 
    sum + section.items.reduce((s, i) => s + i.name.length, 0), 0)
  const avgNameLength = totalItems > 0 ? totalNameLength / totalItems : 0
  
  const hasDescriptions = engineMenu.sections.some(section => 
    section.items.some(item => !!item.description && item.description.length > 0))

  metricsBuilder.setMenuCharacteristics({
    sectionCount,
    totalItems,
    imageRatio,
    avgNameLength,
    hasDescriptions
  })
  
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
  let layout = generateLayout({
    menu: engineMenu,
    template,
    selection
  })
  
  metricsBuilder.setLayoutSelection(templateId, 'print')
  metricsBuilder.markCalculationEnd()
  
  // Convert all image URLs to base64 data URLs for PDF compatibility
  // This can be disabled via environment variable if it causes timeouts
  const enableImageConversion = process.env.PDF_ENABLE_IMAGES !== 'false'
  
  if (enableImageConversion) {
    try {
      const { convertLayoutImagesToDataURLs } = await import('@/lib/templates/export/texture-utils')
      logger.info('[PDFExporter] Converting images to base64...')
      layout = await convertLayoutImagesToDataURLs(layout, {
        concurrency: 3,
        timeout: 15000, // Increased timeout for Supabase storage images
        maxImages: 20,
        headers
      })
      logger.info('[PDFExporter] Image conversion complete')
    } catch (error) {
      logger.error('[PDFExporter] Image conversion failed, using fallbacks:', error)
      // Continue with original layout (will show fallback icons)
    }
  } else {
    logger.info('[PDFExporter] Image conversion disabled, using fallback icons')
  }
  
  // Render layout to HTML (without the inline style tags)
  metricsBuilder.markRenderStart()
  const componentHTML = renderToString(
    createElement(ServerLayoutRenderer, {
      layout,
      template,
      paletteId: selection?.configuration?.colourPaletteId,
      currency: engineMenu.metadata.currency,
      className: 'pdf-export',
      skipInlineStyles: true
    })
  )
  metricsBuilder.markRenderEnd()
  
  // Generate template CSS for the document head
  const { generateTemplateCSS } = await import('@/lib/templates/server-style-generator')
  const templateCSS = await generateTemplateCSS(template, selection?.configuration?.colourPaletteId, 'inline', headers)
  
  // Build complete HTML document with styles properly in <head>
  const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title || menu.name}</title>
  <style>
${templateCSS}

@page {
  size: ${template.orientation === 'A4_LANDSCAPE' ? 'A4 landscape' : 'A4 portrait'};
  margin: 0;
}
  </style>
</head>
<body>
${componentHTML}
</body>
</html>`.trim()
  
  // Debug: Log first 500 chars of HTML to verify structure
  logger.info('[PDFExporter] HTML preview:', htmlDocument.substring(0, 500))
  
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
  menuId: z.string().uuid('Invalid menu ID format').optional(), // Optional for demo users
  menu: z.any().optional(), // Demo users send menu data directly
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
    // Parse and validate request body first
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
    
    const { menuId, menu: demoMenu, templateId, presetId, options = {} } = validation.data
    
    // Check if this is a demo export (menu data provided instead of menuId)
    const isDemo = !!demoMenu && !menuId
    
    // Authenticate user (not required for demo exports)
    let user: any = null
    if (!isDemo) {
      const supabase = createServerSupabaseClient()
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      user = authUser
      metricsBuilder.setUserId(user.id)
      
      // Apply rate limiting for authenticated users
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
    } else {
      // Demo export - use a demo user ID for metrics
      metricsBuilder.setUserId('demo-user')
    }
    
    metricsBuilder.setMenuId(menuId || 'demo-menu')
    
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
    
    // Fetch menu data (or use provided demo menu)
    let menu: any
    if (isDemo) {
      // Demo export - use provided menu data
      menu = demoMenu
      if (!menu) {
        return NextResponse.json(
          { error: 'Menu data required for demo export' },
          { status: 400 }
        )
      }
    } else {
      // Authenticated export - fetch from database
      menu = await menuOperations.getMenu(menuId!, user.id)
      
      if (!menu) {
        return NextResponse.json(
          { error: 'Menu not found' },
          { status: 404 }
        )
      }
    }
    
    // Determine which engine to use
    let effectiveTemplateId = templateId

    // If no template ID provided but we have a menu ID (authenticated),
    // check if the user has a saved template selection
    if (!effectiveTemplateId && menuId && !isDemo) {
      try {
        const supabase = createServerSupabaseClient()
        const { data: selectionData } = await supabase
          .from('menu_template_selections')
          .select('template_id')
          .eq('menu_id', menuId)
          .single()
          
        if (selectionData && selectionData.template_id) {
          effectiveTemplateId = selectionData.template_id
          logger.info(`[PDFExporter] Found saved template selection: ${effectiveTemplateId}`)
        }
      } catch (err) {
        // Ignore error, fallback to legacy
        console.warn('[PDFExporter] Error checking template selection:', err)
      }
    }

    // NEW TEMPLATE ENGINE PATH
    if (effectiveTemplateId) {
      const headers = {
        cookie: request.headers.get('cookie') || '',
        authorization: request.headers.get('authorization') || '',
        host: request.headers.get('host') || '',
        'x-forwarded-host': request.headers.get('x-forwarded-host') || '',
        'x-forwarded-proto': request.headers.get('x-forwarded-proto') || ''
      }
      return await handleNewTemplateEngine(menu, effectiveTemplateId, options, user?.id || 'demo-user', metricsBuilder, headers)
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
