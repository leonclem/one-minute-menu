import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError } from '@/lib/database'
import { transformExtractionToLayout } from '@/lib/templates/data-transformer'
import { selectLayoutPresetWithContext } from '@/lib/templates/layout-selector'
import { exportToHTML, validateHTMLExportOptions } from '@/lib/templates/export/html-exporter'
import { ServerGridMenuLayout, ServerTextOnlyLayout } from '@/lib/templates/export/server-components'
import { logLayoutError, LayoutEngineError, ERROR_CODES } from '@/lib/templates/error-logger'
import { htmlExportLimiter, applyRateLimit } from '@/lib/templates/rate-limiter'
import { MetricsBuilder, logLayoutMetrics, validatePerformance } from '@/lib/templates/metrics'
import type { OutputContext } from '@/lib/templates/types'
import { z } from 'zod'

/**
 * Handle HTML export using the new template engine
 */
async function handleNewTemplateEngine(
  menu: any,
  templateId: string,
  context: OutputContext,
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
  const { createServerSupabaseClient } = await import('@/lib/supabase-server')
  
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
  
  // Analyze menu characteristics for metrics
  const totalItems = engineMenu.sections.reduce((sum, section) => sum + section.items.length, 0)
  const itemsWithImages = engineMenu.sections.reduce(
    (sum, section) => sum + section.items.filter(item => item.imageUrl).length,
    0
  )
  const imageRatio = totalItems > 0 ? (itemsWithImages / totalItems) * 100 : 0
  const allNames = engineMenu.sections.flatMap(section => section.items.map(item => item.name))
  const avgNameLength = allNames.length > 0 
    ? allNames.reduce((sum, name) => sum + name.length, 0) / allNames.length 
    : 0
  const hasDescriptions = engineMenu.sections.some(section => 
    section.items.some(item => item.description && item.description.length > 0)
  )
  
  metricsBuilder.setMenuCharacteristics({
    sectionCount: engineMenu.sections.length,
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
  const layout = generateLayout({
    menu: engineMenu,
    template,
    selection
  })
  
  metricsBuilder.setLayoutSelection(templateId, context)
  metricsBuilder.markCalculationEnd()
  
  // Render layout to HTML (without the inline style tags)
  metricsBuilder.markRenderStart()
  const componentHTML = renderToString(
    createElement(ServerLayoutRenderer, {
      layout,
      template,
      paletteId: selection?.configuration?.colourPaletteId,
      currency: engineMenu.metadata.currency,
      className: 'html-export',
      skipInlineStyles: true,
      themeColors: options.themeColors
    })
  )
  metricsBuilder.markRenderEnd()
  
  // Generate template CSS for the document head
  const { generateTemplateCSS } = await import('@/lib/templates/export/layout-renderer')
  const templateCSS = await generateTemplateCSS(template, selection?.configuration?.colourPaletteId)
  
  // Build complete HTML document with styles properly in <head>
  const includeDoctype = options.includeDoctype !== false
  const includeMetaTags = options.includeMetaTags !== false
  const includeStyles = options.includeStyles !== false
  const pageTitle = options.pageTitle || menu.name
  
  let htmlDocument = ''
  
  if (includeDoctype) {
    htmlDocument += '<!DOCTYPE html>\n'
  }
  
  htmlDocument += '<html lang="en">\n'
  
  if (includeMetaTags) {
    htmlDocument += '<head>\n'
    htmlDocument += '  <meta charset="UTF-8">\n'
    htmlDocument += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    htmlDocument += `  <title>${pageTitle}</title>\n`
  }
  
  if (includeStyles) {
    htmlDocument += '  <style>\n'
    htmlDocument += templateCSS
    htmlDocument += `
    
    .html-export {
      max-width: 1200px;
      margin: 0 auto;
    }
    `
    
    if (options.customCSS) {
      htmlDocument += options.customCSS
    }
    
    htmlDocument += '  </style>\n'
  }
  
  if (includeMetaTags) {
    htmlDocument += '</head>\n'
  }
  
  htmlDocument += '<body>\n'
  htmlDocument += componentHTML
  htmlDocument += '\n</body>\n'
  htmlDocument += '</html>'
  
  metricsBuilder.markExportStart()
  const size = Buffer.byteLength(htmlDocument, 'utf8')
  metricsBuilder.markExportEnd()
  
  // Set export details and build metrics
  metricsBuilder.setExportDetails('html', size)
  const metrics = metricsBuilder.build()
  logLayoutMetrics(metrics)
  
  // Validate performance
  const performanceCheck = validatePerformance(metrics)
  if (!performanceCheck.isValid) {
    console.warn('[HTMLExporter] Performance warnings:', performanceCheck.warnings)
  }
  
  // Return HTML with appropriate headers
  return new Response(htmlDocument, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': size.toString(),
      'Content-Disposition': `attachment; filename="${menu.slug}-${context}.html"`,
      'Cache-Control': 'no-cache'
    }
  })
}

// Request body schema
const ExportHTMLRequestSchema = z.object({
  menuId: z.string().uuid('Invalid menu ID format'),
  context: z.enum(['mobile', 'tablet', 'desktop', 'print']).default('desktop'),
  templateId: z.string().optional(), // New: template ID for new engine
  presetId: z.string().optional(),   // Legacy: preset ID for old engine
  options: z.object({
    includeDoctype: z.boolean().optional(),
    includeMetaTags: z.boolean().optional(),
    includeStyles: z.boolean().optional(),
    customCSS: z.string().optional(),
    pageTitle: z.string().optional(),
    themeColors: z.object({
      primary: z.string().optional(),
      secondary: z.string().optional(),
      accent: z.string().optional(),
      background: z.string().optional(),
      text: z.string().optional()
    }).optional()
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
  // Initialize metrics builder
  const metricsBuilder = new MetricsBuilder()
  const startTime = Date.now()
  
  try {
    // Authenticate user
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    metricsBuilder.setUserId(user.id)
    
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
    
    const { menuId, context, templateId, presetId, options = {} } = validation.data
    
    metricsBuilder.setMenuId(menuId)
    
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
    
    // NEW TEMPLATE ENGINE PATH
    if (templateId) {
      return await handleNewTemplateEngine(menu, templateId, context, options, user.id, metricsBuilder)
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
      preset = selectLayoutPresetWithContext(characteristics, context)
    }
    
    metricsBuilder.setLayoutSelection(preset.id, context)
    metricsBuilder.markCalculationEnd()
    
    // Dynamically import react-dom/server to avoid Next.js bundling issues
    const { renderToString } = await import('react-dom/server')
    
    // Render React component to HTML string
    metricsBuilder.markRenderStart()
    const isTextOnly = preset.id === 'text-only'
    const componentHTML = isTextOnly
      ? renderToString(
          createElement(ServerTextOnlyLayout, {
            data: layoutData,
            preset,
            className: 'max-w-4xl mx-auto p-6',
            themeColors: options.themeColors
          })
        )
      : renderToString(
          createElement(ServerGridMenuLayout, {
            data: layoutData,
            preset,
            context,
            className: 'max-w-7xl mx-auto p-6',
            themeColors: options.themeColors
          })
        )
    metricsBuilder.markRenderEnd()
    
    // Export to HTML
    metricsBuilder.markExportStart()
    const result = exportToHTML(componentHTML, layoutData, context, {
      ...options,
      pageTitle: options.pageTitle || menu.name
    })
    metricsBuilder.markExportEnd()
    
    // Set export details and build metrics
    metricsBuilder.setExportDetails('html', result.size)
    const metrics = metricsBuilder.build()
    logLayoutMetrics(metrics)
    
    // Validate performance
    const performanceCheck = validatePerformance(metrics)
    if (!performanceCheck.isValid) {
      console.warn('[HTMLExporter] Performance warnings:', performanceCheck.warnings)
    }
    
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
