import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError, assertUserCanEditMenu, userOperations } from '@/lib/database'
import { transformExtractionToLayout } from '@/lib/templates/data-transformer'
import { selectLayoutPresetWithContext } from '@/lib/templates/layout-selector'
import { exportToPDF, validatePDFExportOptions } from '@/lib/templates/export/pdf-exporter'
import { logLayoutError, LayoutEngineError, ERROR_CODES } from '@/lib/templates/error-logger'
import { pdfExportLimiter, applyRateLimit } from '@/lib/templates/rate-limiter'
import { MetricsBuilder, logLayoutMetrics, validatePerformance } from '@/lib/templates/metrics'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { StorageClient } from '@/lib/worker/storage-client'
import { computeDemoPdfCachePath } from '@/lib/templates/export/demo-pdf-cache'

// Extended timeout for PDF generation
export const maxDuration = 60

/**
 * Handle PDF export using the new template engine (V2)
 */
async function handleNewTemplateEngine(
  menu: any,
  templateId: string,
  configuration: any,
  options: any,
  userId: string,
  metricsBuilder: MetricsBuilder,
  headers?: Record<string, string>
) {
  // Import V2 template engine modules
  const { transformMenuToV2 } = await import('@/lib/templates/v2/menu-transformer-v2')
  const { generateLayoutV2 } = await import('@/lib/templates/v2/layout-engine-v2')
  const { renderToPdf } = await import('@/lib/templates/v2/renderer-pdf-v2')
  const { optimizeLayoutDocumentImages } = await import('@/lib/templates/v2/image-optimizer-v2')
  
  // Transform menu to EngineMenuV2
  metricsBuilder.markCalculationStart()
  const engineMenu = transformMenuToV2(menu)

  // Calculate menu characteristics for metrics
  // ... metrics calculation ...
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
  
  // Resolve configuration: priority is passed configuration > database > menu object
  let finalConfiguration = configuration || {}
  
  if (!finalConfiguration.colourPaletteId && !finalConfiguration.paletteId) {
    // Try to load saved template selection from database if no configuration passed
    const supabase = createServerSupabaseClient()
    const { data: selectionData } = await supabase
      .from('menu_template_selections')
      .select('*')
      .eq('menu_id', menu.id)
      .single()
    
    finalConfiguration = selectionData?.configuration || menu.configuration || {}
  }
  
  // Set paletteId if still not present in configuration
  if (!finalConfiguration.colourPaletteId && !finalConfiguration.paletteId && menu.theme?.colors) {
    // Attempt to derive palette ID or use default
    finalConfiguration.colourPaletteId = 'clean-modern'
  }
  
  // Generate V2 layout
  const layoutDocument = await generateLayoutV2({
    menu: engineMenu,
    templateId,
    selection: {
      textOnly: finalConfiguration.textOnly || false,
      fillersEnabled: finalConfiguration.fillersEnabled || false,
      texturesEnabled: finalConfiguration.texturesEnabled !== false, // default true
      showMenuTitle: finalConfiguration.showMenuTitle || false,
      colourPaletteId: finalConfiguration.colourPaletteId || finalConfiguration.paletteId
    },
    debug: false
  })
  
  metricsBuilder.setLayoutSelection(templateId, 'print')
  metricsBuilder.markCalculationEnd()
  
  // Optimize images for PDF
  metricsBuilder.markRenderStart()
  const optimizedLayout = await optimizeLayoutDocumentImages(layoutDocument, {
    maxWidth: 1000,
    quality: 75,
    // Protect serverless runtime (Vercel) from spending too long optimizing huge menus.
    // Worker exports do not use this route.
    maxImages: 50,
    timeout: 10000,
    concurrency: 3,
    headers
  })
  metricsBuilder.markRenderEnd()
  
  // Render to PDF using V2 renderer
  metricsBuilder.markExportStart()
  const pdfResult = await renderToPdf(optimizedLayout, {
    title: options.title || menu.name,
    paletteId: finalConfiguration.colourPaletteId || finalConfiguration.paletteId,
    includePageNumbers: options.includePageNumbers !== false,
    printBackground: true,
    texturesEnabled: finalConfiguration.texturesEnabled !== false,
    showRegionBounds: false
  })
  metricsBuilder.markExportEnd()
  
  // Set export details and build metrics
  metricsBuilder.setExportDetails('pdf', pdfResult.size)
  const metrics = metricsBuilder.build()
  logLayoutMetrics(metrics)
  
  // Return PDF
  const filename = `${menu.slug || 'menu'}-v2.pdf`
  return new Response(pdfResult.pdfBytes as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': pdfResult.size.toString(),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache'
    }
  })
}


// Request body schema
const ExportPDFRequestSchema = z.object({
  menuId: z.string().optional(), // Optional for demo users
  menu: z.any().optional(), // Demo users send menu data directly
  templateId: z.string().optional(), // New: template ID for new engine
  presetId: z.string().optional(),   // Legacy: preset ID for old engine
  configuration: z.any().optional(), // Configuration for the new engine
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
    
    let { menuId, menu: demoMenu, templateId, presetId, configuration, options = {} } = validation.data
    
    // Safety check: If templateId is actually a legacy preset ID, treat it as such
    // This happens when older menus have legacy preset IDs stored in template_id
    if (templateId) {
      const { templateExists } = await import('@/lib/templates/v2/template-loader-v2')
      const exists = await templateExists(templateId)
      if (!exists) {
        const { LAYOUT_PRESETS } = await import('@/lib/templates/presets')
        if (LAYOUT_PRESETS[templateId]) {
          logger.info(`[PDFExport] Re-routing legacy templateId "${templateId}" to presetId`)
          presetId = templateId
          templateId = undefined
        }
      }
    }

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

      // If edits are locked, exporting is locked too (view-only mode)
      const supabase = createServerSupabaseClient()
      const profile = await userOperations.getProfile(user.id, supabase)
      try {
        await assertUserCanEditMenu({
          userId: user.id,
          menuCreatedAt: menu.createdAt,
          profile,
          supabaseClient: supabase,
        })
      } catch (e) {
        if (e instanceof DatabaseError && e.code === 'EDIT_WINDOW_EXPIRED') {
          return NextResponse.json(
            { error: e.message, code: e.code },
            { status: 403 }
          )
        }
        throw e
      }
    }
    
    // Determine which engine to use
    let effectiveTemplateId = templateId
    let effectivePresetId = presetId

    // If no template ID provided but we have a menu ID (authenticated),
    // check if the user has a saved template selection
    if (!effectiveTemplateId && !effectivePresetId && menuId && !isDemo) {
      try {
        const supabase = createServerSupabaseClient()
        const { data: selectionData } = await supabase
          .from('menu_template_selections')
          .select('template_id')
          .eq('menu_id', menuId)
          .single()
          
        if (selectionData && selectionData.template_id) {
          const selectedId = selectionData.template_id
          const { templateExists } = await import('@/lib/templates/v2/template-loader-v2')
          const exists = await templateExists(selectedId)
          
          if (exists) {
            effectiveTemplateId = selectedId
            logger.info(`[PDFExporter] Found saved template selection: ${effectiveTemplateId}`)
          } else {
            const { LAYOUT_PRESETS } = await import('@/lib/templates/presets')
            if (LAYOUT_PRESETS[selectedId]) {
              effectivePresetId = selectedId
              logger.info(`[PDFExporter] Found saved legacy preset selection: ${effectivePresetId}`)
            }
          }
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

      // Demo PDF caching (V2 templates)
      // Demo exports currently run in this API route (not the worker).
      // Cache the generated PDF in Supabase Storage so we don't regenerate identical PDFs repeatedly.
      if (isDemo) {
        // IMPORTANT: For the Next.js app runtime (non-Docker), prefer the public URL.
        // In local setups, SUPABASE_URL may be set to `host.docker.internal:54321` for workers,
        // which will fail from the host process.
        const supabaseUrl =
          process.env.NEXT_PUBLIC_SUPABASE_URL ||
          process.env.SUPABASE_URL
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        const bucket = process.env.EXPORT_STORAGE_BUCKET || process.env.STORAGE_BUCKET || 'export-files'

        if (supabaseUrl && serviceRoleKey) {
          try {
            const storageClient = new StorageClient({
              supabase_url: supabaseUrl,
              supabase_service_role_key: serviceRoleKey,
              storage_bucket: bucket,
            })

            const { cachePath, filenameBase } = await computeDemoPdfCachePath({
              menu,
              templateId: effectiveTemplateId,
              configuration,
              options,
            })

            // Try cache hit first
            const cachedBytes = await storageClient.download(cachePath)
            if (cachedBytes) {
              // Redirect to a signed URL to avoid streaming bytes through the app server.
              const signedUrl = await storageClient.generateSignedUrl(cachePath, 86400, `${filenameBase}.pdf`) // 24h
              return NextResponse.redirect(signedUrl, {
                headers: {
                  'x-demo-pdf-cache': 'HIT',
                },
              })
            }

            // Cache miss: generate, upload, then redirect to signed URL
            const generatedResponse = await handleNewTemplateEngine(
              menu,
              effectiveTemplateId,
              configuration,
              options,
              user?.id || 'demo-user',
              metricsBuilder,
              headers
            )

            if (generatedResponse.ok) {
              try {
                // Clone so we can still return the original response if caching fails.
                const cloned = generatedResponse.clone()
                const arrayBuffer = await cloned.arrayBuffer()
                const pdfBytes = new Uint8Array(arrayBuffer)
                const uploadBuffer = Buffer.from(pdfBytes)

                await storageClient.upload(uploadBuffer, cachePath, 'application/pdf')

                const signedUrl = await storageClient.generateSignedUrl(cachePath, 86400, `${filenameBase}.pdf`) // 24h
                return NextResponse.redirect(signedUrl, {
                  headers: {
                    'x-demo-pdf-cache': 'MISS',
                    // Helpful for debugging in logs; not relied upon by the client
                    'x-demo-pdf-cache-path': cachePath,
                    'x-demo-pdf-filename': `${filenameBase}.pdf`,
                  },
                })
              } catch (e) {
                logger.warn('[PDFExport] Demo cache write failed; falling back to direct response', {
                  error: e instanceof Error ? e.message : String(e),
                  cachePath,
                })
                return generatedResponse
              }
            }

            return generatedResponse
          } catch (e) {
            // Never fail the export because caching infrastructure is unavailable.
            logger.warn('[PDFExport] Demo cache unavailable; proceeding without cache', {
              error: e instanceof Error ? e.message : String(e),
            })
            return await handleNewTemplateEngine(
              menu,
              effectiveTemplateId,
              configuration,
              options,
              user?.id || 'demo-user',
              metricsBuilder,
              headers
            )
          }
        } else {
          logger.warn('[PDFExport] Demo cache disabled (missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)')
        }
      }

      return await handleNewTemplateEngine(menu, effectiveTemplateId, configuration, options, user?.id || 'demo-user', metricsBuilder, headers)
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
    if (effectivePresetId) {
      const { LAYOUT_PRESETS } = await import('@/lib/templates/presets')
      preset = LAYOUT_PRESETS[effectivePresetId]
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
