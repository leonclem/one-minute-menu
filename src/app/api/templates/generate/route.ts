import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError } from '@/lib/database'
import { transformExtractionToLayout, analyzeMenuCharacteristics } from '@/lib/templates/data-transformer'
import { selectLayoutPresetWithContext } from '@/lib/templates/layout-selector'
import { generateGridLayout } from '@/lib/templates/grid-generator'
import { insertFillerTiles } from '@/lib/templates/filler-tiles'
import { logLayoutError, LayoutEngineError, ERROR_CODES } from '@/lib/templates/error-logger'
import { layoutGenerationLimiter, applyRateLimit } from '@/lib/templates/rate-limiter'
import { MetricsBuilder, logLayoutMetrics, validatePerformance } from '@/lib/templates/metrics'
import type { OutputContext } from '@/lib/templates/types'
import { z } from 'zod'

// Request body schema
const GenerateLayoutRequestSchema = z.object({
  menuId: z.string().uuid('Invalid menu ID format'),
  context: z.enum(['mobile', 'tablet', 'desktop', 'print']).default('desktop'),
  presetId: z.string().optional()
})

// Maximum execution time (10 seconds as per requirements)
export const maxDuration = 10

/**
 * POST /api/templates/generate
 * 
 * Generate a grid layout for a menu
 * 
 * Request body:
 * - menuId: UUID of the menu
 * - context: Output context (mobile, tablet, desktop, print)
 * 
 * Response:
 * - layout: Complete grid layout configuration
 * - metrics: Layout generation metrics for telemetry
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
    const rateLimit = applyRateLimit(layoutGenerationLimiter, user.id)
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
    const validation = GenerateLayoutRequestSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validation.error.format() 
        },
        { status: 400 }
      )
    }
    
    const { menuId, context, presetId } = validation.data
    
    metricsBuilder.setMenuId(menuId)
    
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
    
    // Fetch the actual extraction result from the jobs table or reconstruct from menu items
    let extractionResult: any
    
    if ((menu.extractionMetadata as any).jobId) {
      // Fetch from extraction jobs table
      const { data: jobData, error: jobError } = await supabase
        .from('menu_extraction_jobs')
        .select('result')
        .eq('id', (menu.extractionMetadata as any).jobId)
        .single()
      
      if (jobError || !jobData || !jobData.result) {
        console.error('[LayoutEngine] Failed to fetch extraction result:', jobError)
        return NextResponse.json(
          { 
            error: 'Extraction result not found',
            code: ERROR_CODES.INVALID_INPUT
          },
          { status: 400 }
        )
      }
      
      extractionResult = jobData.result
    } else if (menu.items && menu.items.length > 0) {
      // Reconstruct extraction result from menu items
      console.log('[LayoutEngine] Reconstructing extraction result from menu items')
      console.log('[LayoutEngine] Menu items count:', menu.items.length)
      
      // Log first few items to see their structure
      console.log('[LayoutEngine] First 3 items:', menu.items.slice(0, 3).map(item => ({
        name: item.name,
        imageSource: item.imageSource,
        customImageUrl: item.customImageUrl,
        aiImageId: item.aiImageId
      })))
      
      // Group items by category
      const categoryMap = new Map<string, any[]>()
      
      for (const item of menu.items) {
        const categoryName = item.category || 'Uncategorized'
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, [])
        }
        
        // Get image URL if available  
        let imageRef: string | undefined
        if (item.customImageUrl) {
          // Both AI and custom images use customImageUrl
          imageRef = item.customImageUrl
        } else if (item.aiImageId) {
          // Fallback: construct URL from aiImageId if customImageUrl not available
          imageRef = `/api/images/${item.aiImageId}`
        }
        
        const menuItem = {
          name: item.name,
          price: item.price,
          description: item.description,
          imageRef,
          confidence: 1.0
        }
        
        // Log first item with image for debugging
        if (imageRef && !categoryMap.get(categoryName)!.some(i => i.imageRef)) {
          console.log('[LayoutEngine] First item with image:', {
            name: item.name,
            imageSource: item.imageSource,
            customImageUrl: item.customImageUrl,
            aiImageId: item.aiImageId,
            imageRef
          })
        }
        
        categoryMap.get(categoryName)!.push(menuItem)
      }
      
      // Convert to categories array
      const categories = Array.from(categoryMap.entries()).map(([name, items]) => ({
        name,
        items,
        confidence: 1.0
      }))
      
      console.log('[LayoutEngine] Reconstructed categories:', categories.length)
      console.log('[LayoutEngine] Items per category:', categories.map(c => `${c.name}: ${c.items.length}`).join(', '))
      
      extractionResult = {
        menu: {
          categories
        },
        currency: '$', // Default currency
        uncertainItems: [],
        superfluousText: []
      }
    } else {
      // No extraction data available
      return NextResponse.json(
        { 
          error: 'Menu has no extraction data or categories',
          code: ERROR_CODES.INVALID_INPUT
        },
        { status: 400 }
      )
    }
    
    // Transform extraction data to layout format
    const layoutData = transformExtractionToLayout(
      extractionResult,
      menu.name
    )
    
    // Analyze menu characteristics
    metricsBuilder.markCalculationStart()
    const characteristics = analyzeMenuCharacteristics(layoutData)
    
    // Set menu characteristics in metrics
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
    
    // Generate grid layout
    const gridLayout = generateGridLayout(layoutData, preset, context)
    
    // Insert filler tiles for dead space
    const layoutWithFillers = insertFillerTiles(gridLayout)
    
    metricsBuilder.markCalculationEnd()
    
    // Set render time to 0 (will be measured on client side)
    metricsBuilder.setRenderTime(0)
    
    // Build and log metrics
    const metrics = metricsBuilder.build()
    logLayoutMetrics(metrics)
    
    // Validate performance
    const performanceCheck = validatePerformance(metrics)
    if (!performanceCheck.isValid) {
      console.warn('[LayoutEngine] Performance warnings:', performanceCheck.warnings)
    }
    
    return NextResponse.json({
      success: true,
      data: {
        layout: layoutWithFillers,
        characteristics,
        metrics
      }
    })
    
  } catch (error) {
    console.error('Error generating layout:', error)
    
    // Handle specific error types
    if (error instanceof DatabaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      )
    }
    
    if (error instanceof LayoutEngineError) {
      logLayoutError(error, {
        endpoint: '/api/templates/generate',
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
      { error: 'Internal server error', code: ERROR_CODES.RENDER_TIMEOUT },
      { status: 500 }
    )
  }
}
