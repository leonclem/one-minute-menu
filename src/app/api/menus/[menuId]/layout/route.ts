import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations } from '@/lib/database'
import { toEngineMenu } from '@/lib/templates/menu-transformer'
import { TEMPLATE_REGISTRY } from '@/lib/templates/template-definitions'
import { generateLayout } from '@/lib/templates/layout-engine'
import { checkCompatibility } from '@/lib/templates/compatibility-checker'
import type { MenuTemplateSelection } from '@/lib/templates/engine-types'

/**
 * Simple in-memory cache for layout instances
 * Key format: `${menuId}-${templateId}-${menuVersion}-${configHash}`
 */
const layoutCache = new Map<string, { layout: any; timestamp: number }>()
const CACHE_TTL = 3600000 // 1 hour in milliseconds
const MAX_CACHE_SIZE = 100

/**
 * Generate a cache key for a layout
 */
function generateCacheKey(
  menuId: string,
  templateId: string,
  menuUpdatedAt: Date,
  configuration?: any
): string {
  const configHash = configuration ? JSON.stringify(configuration) : 'default'
  const menuVersion = menuUpdatedAt.getTime()
  return `${menuId}-${templateId}-${menuVersion}-${configHash}`
}

/**
 * Get layout from cache if available and not expired
 */
function getCachedLayout(cacheKey: string): any | null {
  const cached = layoutCache.get(cacheKey)
  
  if (!cached) {
    return null
  }
  
  // Check if cache entry is expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    layoutCache.delete(cacheKey)
    return null
  }
  
  return cached.layout
}

/**
 * Store layout in cache
 */
function setCachedLayout(cacheKey: string, layout: any): void {
  // Implement simple LRU by removing oldest entry if cache is full
  if (layoutCache.size >= MAX_CACHE_SIZE) {
    const firstKey = layoutCache.keys().next().value
    if (firstKey) {
      layoutCache.delete(firstKey)
    }
  }
  
  layoutCache.set(cacheKey, {
    layout,
    timestamp: Date.now()
  })
}

/**
 * Invalidate all cached layouts for a menu
 */
export function invalidateMenuLayouts(menuId: string): void {
  const keysToDelete: string[] = []
  
  layoutCache.forEach((_, key) => {
    if (key.startsWith(`${menuId}-`)) {
      keysToDelete.push(key)
    }
  })
  
  keysToDelete.forEach(key => layoutCache.delete(key))
}

/**
 * GET /api/menus/{menuId}/layout?templateId={templateId}
 * 
 * Generates and returns a layout instance for a menu using the specified template.
 * Uses cached layouts when available to improve performance.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')
    
    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId query parameter is required' },
        { status: 400 }
      )
    }
    
    // Validate template exists
    const template = TEMPLATE_REGISTRY[templateId]
    if (!template) {
      return NextResponse.json(
        { error: 'Invalid templateId' },
        { status: 400 }
      )
    }
    
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    // Allow demo menus (no auth required)
    const isDemoMenu = params.menuId.startsWith('demo-')
    
    if (!isDemoMenu && (authError || !user)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // For demo menus, expect menu data in request (but GET doesn't have body)
    // Client should use POST for demo menus
    if (isDemoMenu) {
      return NextResponse.json(
        { error: 'Demo menus should use POST /api/menus/{menuId}/layout with menu data in body' },
        { status: 400 }
      )
    }
    
    // Load menu from database
    const menu = await menuOperations.getMenu(params.menuId, user?.id)
    
    if (!menu) {
      return NextResponse.json(
        { error: 'Menu not found' },
        { status: 404 }
      )
    }
    
    // Load saved template selection (if exists)
    let selection: MenuTemplateSelection | undefined
    const { data: selectionData } = await supabase
      .from('menu_template_selections')
      .select('*')
      .eq('menu_id', params.menuId)
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
    
    // Generate cache key
    const cacheKey = generateCacheKey(
      params.menuId,
      templateId,
      menu.updatedAt,
      selection?.configuration
    )
    
    // Check cache
    const cachedLayout = getCachedLayout(cacheKey)
    if (cachedLayout) {
      return NextResponse.json({
        success: true,
        data: cachedLayout,
        cached: true
      })
    }
    
    // Transform to EngineMenu
    const engineMenu = toEngineMenu(menu)
    
    // Check compatibility
    const compatibility = checkCompatibility(engineMenu, template)
    if (compatibility.status === 'INCOMPATIBLE') {
      return NextResponse.json(
        { 
          error: 'Template is incompatible with this menu',
          compatibility
        },
        { status: 400 }
      )
    }
    
    // Generate layout
    const layout = generateLayout({
      menu: engineMenu,
      template,
      selection
    })
    
    // Cache the layout
    setCachedLayout(cacheKey, layout)
    
    return NextResponse.json({
      success: true,
      data: layout,
      cached: false,
      compatibility: compatibility.status === 'WARNING' ? compatibility : undefined
    })
    
  } catch (error) {
    console.error('Error generating layout:', error)
    
    // Check if it's a compatibility error
    if (error instanceof Error && error.name === 'CompatibilityError') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/menus/{menuId}/layout
 * 
 * Alternative endpoint for demo menus where menu data is passed in the request body.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const body = await request.json()
    const { menu, templateId, configuration } = body
    
    if (!menu) {
      return NextResponse.json(
        { error: 'menu data is required in request body' },
        { status: 400 }
      )
    }
    
    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      )
    }
    
    // Validate template exists
    const template = TEMPLATE_REGISTRY[templateId]
    if (!template) {
      return NextResponse.json(
        { error: 'Invalid templateId' },
        { status: 400 }
      )
    }
    
    // Transform to EngineMenu
    const engineMenu = toEngineMenu(menu)
    
    // Check compatibility
    const compatibility = checkCompatibility(engineMenu, template)
    if (compatibility.status === 'INCOMPATIBLE') {
      return NextResponse.json(
        { 
          error: 'Template is incompatible with this menu',
          compatibility
        },
        { status: 400 }
      )
    }
    
    // Create selection object if configuration provided
    const selection: MenuTemplateSelection | undefined = configuration ? {
      id: 'demo-selection',
      menuId: params.menuId,
      templateId,
      templateVersion: template.version,
      configuration,
      createdAt: new Date(),
      updatedAt: new Date()
    } : undefined
    
    // Generate layout
    const layout = generateLayout({
      menu: engineMenu,
      template,
      selection
    })
    
    return NextResponse.json({
      success: true,
      data: layout,
      cached: false,
      compatibility: compatibility.status === 'WARNING' ? compatibility : undefined
    })
    
  } catch (error) {
    console.error('Error generating layout:', error)
    
    // Check if it's a compatibility error
    if (error instanceof Error && error.name === 'CompatibilityError') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
