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

// Extended timeout for image generation
export const maxDuration = 60

/**
 * Handle image export using the V2 template engine
 */
async function handleV2TemplateEngine(
  menu: any,
  templateId: string,
  context: OutputContext,
  imageOptions: any,
  userId: string,
  metricsBuilder: MetricsBuilder,
  headers?: Record<string, string>
) {
  // Import V2 template engine modules
  const { transformMenuToV2 } = await import('@/lib/templates/v2/menu-transformer-v2')
  const { generateLayoutV2 } = await import('@/lib/templates/v2/layout-engine-v2')
  const { renderToWeb } = await import('@/lib/templates/v2/renderer-web-v2')
  const { PALETTES_V2 } = await import('@/lib/templates/v2/renderer-v2')
  const { renderToString } = await import('react-dom/server')
  
  // Transform menu to EngineMenuV2
  metricsBuilder.markCalculationStart()
  const engineMenu = transformMenuToV2(menu)

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
  
  // Load saved template selection (if exists)
  const supabase = createServerSupabaseClient()
  const { data: selectionData } = await supabase
    .from('menu_template_selections')
    .select('*')
    .eq('menu_id', menu.id)
    .single()
  
  const configuration = selectionData?.configuration || {}
  
  // Generate V2 layout
  const layoutDocument = await generateLayoutV2({
    menu: engineMenu,
    templateId,
    selection: {
      textOnly: configuration.textOnly || false,
      fillersEnabled: configuration.fillersEnabled || false,
      texturesEnabled: configuration.texturesEnabled !== false,
      showMenuTitle: configuration.showMenuTitle || false,
      colourPaletteId: configuration.colourPaletteId || configuration.paletteId
    },
    debug: false
  })
  
  metricsBuilder.setLayoutSelection(templateId, context)
  metricsBuilder.markCalculationEnd()
  
  // Resolve palette
  const paletteId = configuration.colourPaletteId || configuration.paletteId
  const palette = PALETTES_V2.find(p => p.id === paletteId) || PALETTES_V2[0]
  
  // Calculate dimensions for image export based on page spec
  const pageSpec = layoutDocument.pageSpec
  
  // Logical dimensions in points
  const padding = 20 // points
  const pageCount = layoutDocument.pages.length
  const logicalWidth = Math.ceil(pageSpec.width + (padding * 2))
  // For PNG, we can show all pages stacked if requested, or just the first page
  // The user previously mentioned only first page is fine for now, but if we're
  // fixing dimensions, let's at least make the viewport match the first page correctly.
  // If they want multiple pages later, we can multiply height by pageCount.
  const logicalHeight = Math.ceil(pageSpec.height + (padding * 2))

  // Override dimensions for V2 to ensure flush output with buffer
  // unless a specific preset dimension (like Instagram) was requested
  if (!imageOptions.presetDimension) {
    imageOptions.width = logicalWidth
    imageOptions.height = logicalHeight
  }

  // Pre-fetch texture data URL if enabled
  const { getTextureDataURL } = await import('@/lib/templates/export/texture-utils')
  let textureDataURL: string | undefined = undefined
  if (configuration.texturesEnabled !== false) {
    if (palette.id === 'midnight-gold') {
      textureDataURL = await getTextureDataURL('dark-paper-2.png', headers) || undefined
    } else if (palette.id === 'elegant-dark') {
      textureDataURL = await getTextureDataURL('dark-paper.png', headers) || undefined
    }
  }

  // Extract font sets for Google Fonts support
  const fontSets = new Set(['modern-sans'])
  layoutDocument.pages.forEach(page => {
    page.tiles.forEach(tile => {
      if ((tile as any).style?.typography?.fontSet) {
        fontSets.add((tile as any).style.typography.fontSet)
      }
    })
  })
  
  const { FONT_SETS_V2 } = await import('@/lib/templates/v2/renderer-v2')
  const googleFontsURL = `https://fonts.googleapis.com/css2?family=${Array.from(fontSets)
    .map(id => FONT_SETS_V2.find(set => set.id === id)?.googleFonts)
    .filter(Boolean)
    .join('&family=')}&display=swap`
  
  // Prepare custom CSS for V2
  const v2CustomCSS = `
    @import url('${googleFontsURL}');
    
    body {
      background-color: ${palette.colors.background};
      margin: 0;
      padding: ${padding}px;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    
    .layout-document-v2 {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: auto;
    }
    
    .page-container-v2 {
      margin-bottom: 0 !important;
      box-shadow: none !important;
    }
  `

  // Render layout to HTML fragment
  metricsBuilder.markRenderStart()
  const componentHTML = renderToString(
    renderToWeb(layoutDocument, {
      scale: 1,
      palette,
      isExport: true,
      texturesEnabled: configuration.texturesEnabled !== false,
      textureDataURL,
      showGridOverlay: false,
      showRegionBounds: false,
      showTileIds: false
    })
  )
  metricsBuilder.markRenderEnd()
  
  // Create LayoutMenuData for image export metadata
  const layoutData = {
    metadata: {
      title: menu.name,
      currency: engineMenu.metadata.currency
    },
    sections: []
  }
  
  // Merge V2 styles into image options
  const finalImageOptions = {
    ...imageOptions,
    customCSS: `${v2CustomCSS}${imageOptions.customCSS || ''}`,
    themeColors: {
      background: palette.colors.background,
      text: palette.colors.itemTitle
    }
  }
  
  // Export to image
  metricsBuilder.markExportStart()
  const result = await exportToImage(componentHTML, layoutData, context, finalImageOptions)
  metricsBuilder.markExportEnd()
  
  // Set export details and build metrics
  const exportFormat = imageOptions.format || 'png'
  metricsBuilder.setExportDetails(exportFormat, result.size)
  const metrics = metricsBuilder.build()
  logLayoutMetrics(metrics)
  
  return new Response(result.imageBuffer as any, {
    status: 200,
    headers: {
      'Content-Type': exportFormat === 'png' ? 'image/png' : 'image/jpeg',
      'Content-Length': result.size.toString(),
      'Content-Disposition': `attachment; filename="${menu.slug || 'menu'}-${context}.${exportFormat === 'png' ? 'png' : 'jpg'}"`,
      'Cache-Control': 'no-cache'
    }
  })
}

/**
 * Handle image export using the new template engine
 */
async function handleNewTemplateEngine(
  menu: any,
  templateId: string,
  context: OutputContext,
  imageOptions: any,
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
  const layout = generateLayout({
    menu: engineMenu,
    template,
    selection
  })
  
  metricsBuilder.setLayoutSelection(templateId, context)
  metricsBuilder.markCalculationEnd()
  
  // Render layout to HTML using the styled renderer
  metricsBuilder.markRenderStart()
  const componentHTML = renderToString(
    createElement(ServerLayoutRenderer, {
      layout,
      template,
      paletteId: selection?.configuration?.colourPaletteId,
      currency: engineMenu.metadata.currency,
      className: 'image-export',
      skipInlineStyles: true
    })
  )
  metricsBuilder.markRenderEnd()
  
  // Generate template CSS for the document
  const { generateTemplateCSS } = await import('@/lib/templates/server-style-generator')
  const templateCSS = await generateTemplateCSS(template, selection?.configuration?.colourPaletteId, 'inline', headers)
  
  // Create complete HTML document with proper styling
  const styledHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${menu.name}</title>
  <style>
    ${templateCSS}
    
    .image-export {
      width: 100%;
    }
  </style>
</head>
<body>
  ${componentHTML}
</body>
</html>
  `.trim()
  
  // Create minimal LayoutMenuData for image export metadata
  const layoutData = {
    metadata: {
      title: menu.name,
      currency: engineMenu.metadata.currency
    },
    sections: []
  }
  
  // Export to image using the styled HTML
  metricsBuilder.markExportStart()
  const result = await exportToImage(styledHTML, layoutData, context, imageOptions)
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
}

// Request body schema
const ExportImageRequestSchema = z.object({
  menuId: z.string().uuid('Invalid menu ID format'),
  context: z.enum(['mobile', 'tablet', 'desktop', 'print']).default('desktop'),
  templateId: z.string().optional(), // New: template ID for new engine
  presetId: z.string().optional(),   // Legacy: preset ID for old engine
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
    
    let { menuId, context, templateId, presetId, options = {} } = validation.data
    
    logger.info(`[ImageExport] Starting export for menu ${menuId}, templateId: ${templateId}, presetId: ${presetId}`)

    // Engine Selection and Routing
    let useV2 = false
    let useV1 = false
    let useLegacy = false

    if (templateId) {
      const { templateExists } = await import('@/lib/templates/v2/template-loader-v2')
      if (await templateExists(templateId)) {
        useV2 = true
        logger.info(`[ImageExport] Using V2 engine for templateId: ${templateId}`)
      } else {
        const { TEMPLATE_REGISTRY } = await import('@/lib/templates/template-definitions')
        if (TEMPLATE_REGISTRY[templateId]) {
          useV1 = true
          logger.info(`[ImageExport] Using V1 engine for templateId: ${templateId}`)
        } else {
          const { LAYOUT_PRESETS } = await import('@/lib/templates/presets')
          if (LAYOUT_PRESETS[templateId]) {
            useLegacy = true
            presetId = templateId
            templateId = undefined
            logger.info(`[ImageExport] Re-routing legacy templateId "${presetId}" to preset path`)
          } else {
            logger.warn(`[ImageExport] templateId "${templateId}" not found in any registry`)
          }
        }
      }
    } else if (presetId) {
      useLegacy = true
      logger.info(`[ImageExport] Using legacy path for presetId: ${presetId}`)
    }

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
    
    // EXECUTE SELECTED ENGINE PATH
    
    if (useV2 && templateId) {
      const headers = {
        cookie: request.headers.get('cookie') || '',
        authorization: request.headers.get('authorization') || '',
        host: request.headers.get('host') || '',
        'x-forwarded-host': request.headers.get('x-forwarded-host') || '',
        'x-forwarded-proto': request.headers.get('x-forwarded-proto') || ''
      }
      return await handleV2TemplateEngine(menu, templateId, context, imageOptions, user.id, metricsBuilder, headers)
    }
    
    if (useV1 && templateId) {
      const headers = {
        cookie: request.headers.get('cookie') || '',
        authorization: request.headers.get('authorization') || '',
        host: request.headers.get('host') || '',
        'x-forwarded-host': request.headers.get('x-forwarded-host') || '',
        'x-forwarded-proto': request.headers.get('x-forwarded-proto') || ''
      }
      return await handleNewTemplateEngine(menu, templateId, context, imageOptions, user.id, metricsBuilder, headers)
    }
    
    // LEGACY PATH: Continue with existing preset-based system (or auto-select)
    
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
