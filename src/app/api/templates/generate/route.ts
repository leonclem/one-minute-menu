import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError } from '@/lib/database'
import { transformExtractionToLayout, analyzeMenuCharacteristics } from '@/lib/templates/data-transformer'
import { selectLayoutPresetWithContext } from '@/lib/templates/layout-selector'
import { generateGridLayout } from '@/lib/templates/grid-generator'
import { insertFillerTiles } from '@/lib/templates/filler-tiles'
import { logLayoutError, LayoutEngineError, ERROR_CODES } from '@/lib/templates/error-logger'
import { layoutGenerationLimiter, applyRateLimit } from '@/lib/templates/rate-limiter'
import type { OutputContext } from '@/lib/templates/types'
import { z } from 'zod'

// Request body schema
const GenerateLayoutRequestSchema = z.object({
  menuId: z.string().uuid('Invalid menu ID format'),
  context: z.enum(['mobile', 'tablet', 'desktop', 'print']).default('desktop')
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
  const startTime = Date.now()
  
  try {
    // Authenticate user
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
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
    
    const { menuId, context } = validation.data
    
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
    
    // Analyze menu characteristics
    const characteristics = analyzeMenuCharacteristics(layoutData)
    
    // Select optimal preset
    const preset = selectLayoutPresetWithContext(characteristics, context)
    
    // Generate grid layout
    const gridLayout = generateGridLayout(layoutData, preset, context)
    
    // Insert filler tiles for dead space
    const layoutWithFillers = insertFillerTiles(gridLayout)
    
    // Calculate metrics
    const calculationTime = Date.now() - startTime
    
    const metrics = {
      menuId,
      sectionCount: characteristics.sectionCount,
      totalItems: characteristics.totalItems,
      imageRatio: characteristics.imageRatio,
      selectedPreset: preset.id,
      outputContext: context,
      calculationTime,
      renderTime: 0, // Will be set by client
      totalTime: calculationTime,
      timestamp: new Date().toISOString()
    }
    
    // Log metrics for telemetry
    console.log('[LayoutEngine] Layout generated:', metrics)
    
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
