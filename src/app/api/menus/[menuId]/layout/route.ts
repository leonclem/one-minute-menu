import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations } from '@/lib/database'
import { toEngineMenu } from '@/lib/templates/menu-transformer'
import { transformMenuToV2, isEngineMenuV2 } from '@/lib/templates/v2/menu-transformer-v2'
import { generateLayoutWithVersion } from '@/lib/templates/engine-selector'
import { TEMPLATE_REGISTRY } from '@/lib/templates/template-definitions'
import type { MenuTemplateSelection } from '@/lib/templates/engine-types'
import type { ImageModeV2 } from '@/lib/templates/v2/engine-types-v2'
import { getMenuCurrency } from '@/lib/menu-currency-service'
import { isCutoutFeatureEnabled } from '@/lib/background-removal/feature-flag'
import type { ItemCutoutContext } from '@/lib/templates/v2/menu-transformer-v2'
import type { MenuItem } from '@/types'

const VALID_IMAGE_MODES: readonly ImageModeV2[] = ['none', 'compact-rect', 'compact-circle', 'stretch', 'background', 'cutout']

/**
 * Simple in-memory cache for layout instances
 * Key format: `${menuId}-${templateId}-${menuVersion}-${configHash}`
 */
const layoutCache = new Map<string, { layout: any; timestamp: number }>()
const CACHE_TTL = 3600000 // 1 hour in milliseconds
const MAX_CACHE_SIZE = 100
const LAYOUT_CACHE_VERSION = 'v31'

/**
 * Generate a cache key for a layout
 * Includes menu currency so layout regenerates when user changes currency in settings
 */
function generateCacheKey(
  menuId: string,
  templateId: string,
  menuUpdatedAt: Date,
  configuration?: any,
  menuCurrency?: string
): string {
  const configHash = configuration ? JSON.stringify(configuration) : 'default'
  const menuVersion = menuUpdatedAt.getTime()
  const currencyPart = menuCurrency || 'default'
  return `${LAYOUT_CACHE_VERSION}-${menuId}-${templateId}-${menuVersion}-${configHash}-${currencyPart}`
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
    const paletteId = searchParams.get('paletteId')
    
    // V2 Options
    const fillersEnabled = searchParams.get('fillersEnabled') === 'true'
    const spacerTilePatternId = searchParams.get('spacerTilePatternId') || undefined
    const rawImageMode = searchParams.get('imageMode') || 'stretch'
    const parsedImageMode: ImageModeV2 = (VALID_IMAGE_MODES as readonly string[]).includes(rawImageMode) ? (rawImageMode as ImageModeV2) : 'stretch'
    const imageMode: ImageModeV2 = parsedImageMode === 'none' ? 'stretch' : parsedImageMode
    const textOnly = searchParams.get('textOnly') === 'true' || rawImageMode === 'none'
    const texturesEnabled = searchParams.get('texturesEnabled') !== 'false' // default true
    const textureId = searchParams.get('textureId') || undefined
    const targetCellWidthPt = searchParams.get('targetCellWidthPt')
      ? parseFloat(searchParams.get('targetCellWidthPt')!)
      : undefined
    const showMenuTitle = searchParams.get('showMenuTitle') === 'true'
    const showVignette = searchParams.get('showVignette') === 'true'
    const showCategoryTitles = searchParams.get('showCategoryTitles') !== 'false' // default true
    const showLogoTile = searchParams.get('showLogoTile') === 'true'
    const showCategoryHeaderTiles = searchParams.get('showCategoryHeaderTiles') === 'true'
    const showFlagshipTile = searchParams.get('showFlagshipTile') === 'true'
    const centreAlignment = searchParams.get('centreAlignment') === 'true' // default false
    const engineVersion = (searchParams.get('engineVersion') as 'v1' | 'v2') || 'v2'
    const showBanner = searchParams.get('showBanner') !== 'false' // default true
    const bannerTitle = searchParams.get('bannerTitle') || undefined
    const showBannerTitle = searchParams.get('showBannerTitle') !== 'false' // default true
    const showVenueName = searchParams.get('showVenueName') !== 'false' // default true
    const bannerSwapLayout = searchParams.get('bannerSwapLayout') === 'true' // default false
    const bannerImageStyle = searchParams.get('bannerImageStyle') || undefined
    const fontStylePreset = searchParams.get('fontStylePreset') || undefined
    const flagshipItemId = searchParams.get('flagshipItemId') || undefined
    const assetVersion = searchParams.get('assetVersion') || undefined
    
    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId query parameter is required' },
        { status: 400 }
      )
    }
    
    // For V1, we still need to validate against TEMPLATE_REGISTRY
    if (engineVersion === 'v1') {
      const template = TEMPLATE_REGISTRY[templateId]
      if (!template) {
        return NextResponse.json(
          { error: 'Invalid V1 templateId' },
          { status: 400 }
        )
      }
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
    
    // Configuration object for cache and engine.
    // Most visual-only options are intentionally excluded from the cache key, but Galactic
    // currently applies a compact portrait density override, so it must vary structurally.
    const structuralPaletteId = paletteId === 'galactic-menu' ? paletteId : undefined
    const cacheKeyConfig = {
      imageMode,
      fillersEnabled,
      spacerTilePatternId,
      textOnly,
      targetCellWidthPt,
      showMenuTitle,
      showCategoryTitles,
      showLogoTile,
      showCategoryHeaderTiles,
      showFlagshipTile,
      centreAlignment,
      engineVersion,
      showBanner,
      bannerTitle,
      showBannerTitle,
      showVenueName,
      bannerSwapLayout,
      bannerImageStyle,
      fontStylePreset,
      flagshipItemId,
      assetVersion,
      structuralPaletteId,
    }
    // Full configuration still passed to the layout engine so banner/footer tiles have
    // correctly baked-in colours (used by the PDF renderer as a fallback).
    const configuration = {
      ...cacheKeyConfig,
      paletteId,
    }
    
    // Fetch user's menu currency preference (needed for cache key and transformation)
    const menuCurrency = await getMenuCurrency(user!.id)
    
    // Generate cache key (includes currency so layout regenerates when user changes settings)
    const cacheKey = generateCacheKey(
      params.menuId,
      templateId,
      menu.updatedAt,
      cacheKeyConfig,
      menuCurrency
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
    
    let layout
    if (engineVersion === 'v2') {
      // Build cutout context when cutout mode is active
      let cutoutOptions: Parameters<typeof transformMenuToV2>[1] = { currency: menuCurrency, imageModeIsCutout: imageMode === 'cutout' }
      if (imageMode === 'cutout') {
        const featureEnabled = isCutoutFeatureEnabled()
        const allItems: MenuItem[] = [
          ...(menu.items ?? []),
          ...(menu.categories?.flatMap(c => c.items) ?? []),
        ]
        const itemCutouts = new Map<string, ItemCutoutContext>()
        allItems.forEach(item => {
          if (item.cutoutUrl !== undefined || item.cutoutStatus !== undefined) {
            itemCutouts.set(item.id, {
              cutoutUrl: item.cutoutUrl ?? null,
              cutoutStatus: item.cutoutStatus ?? 'not_requested',
            })
          }
        })
        cutoutOptions = {
          ...cutoutOptions,
          cutout: {
            featureEnabled,
            templateSupportsCutouts: true, // user explicitly chose cutout mode
            itemCutouts,
            menuId: params.menuId,
            templateId,
            isExport: false,
          },
        }
      }

      // Transform to EngineMenuV2 with user's currency preference
      const menuV2 = transformMenuToV2(menu, cutoutOptions)

      // Mark the flagship item so findFlagshipItem() can locate it for the banner hero
      if (flagshipItemId) {
        for (const section of menuV2.sections) {
          for (const item of section.items) {
            if (item.id === flagshipItemId) {
              item.isFlagship = true
            }
          }
        }
      }
      
      layout = await generateLayoutWithVersion({
        menu: menuV2,
        templateId,
        selection: {
          textOnly,
          fillersEnabled,
          spacerTilePatternId,
          targetCellWidthPt,
          showMenuTitle,
          showCategoryTitles,
          showLogoTile,
          showCategoryHeaderTiles,
          showFlagshipTile,
          centreAlignment,
          colourPaletteId: paletteId || undefined,
          imageMode,
          showBanner,
          bannerTitle,
          showBannerTitle,
          showVenueName,
          bannerSwapLayout,
          bannerImageStyle: bannerImageStyle as any,
          fontStylePreset: fontStylePreset as any,
        },
        debug: true
      }, 'v2')
    } else {
      // V1 Path
      const template = TEMPLATE_REGISTRY[templateId]
      const engineMenu = toEngineMenu(menu)
      
      layout = await generateLayoutWithVersion({
        menu: engineMenu,
        template,
        selection: {
          id: 'preview-selection',
          menuId: params.menuId,
          templateId,
          templateVersion: template.version,
          configuration: {
            textOnly,
            useLogo: true,
            colourPaletteId: paletteId || undefined
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }, 'v1')
    }
    
    // Cache the layout
    setCachedLayout(cacheKey, layout)
    
    return NextResponse.json({
      success: true,
      data: layout,
      cached: false
    })
    
  } catch (error) {
    console.error('Error generating layout:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
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
    const { menu, templateId, configuration = {} } = body
    
    const {
      paletteId,
      imageMode: rawImageMode = 'stretch',
      fillersEnabled = true,
      spacerTilePatternId,
      textOnly: configTextOnly = false,
      texturesEnabled = true,
      textureId,
      targetCellWidthPt,
      showMenuTitle = false,
      showVignette = true,
      showCategoryTitles = true,
      engineVersion = 'v2',
      showBanner = true,
      bannerTitle,
      showBannerTitle = true,
      showVenueName = true,
      bannerSwapLayout = false,
      bannerImageStyle,
      fontStylePreset,
      centreAlignment = false,
    } = configuration
    const imageMode = rawImageMode === 'none' ? 'stretch' : rawImageMode
    const textOnly = configTextOnly || rawImageMode === 'none'
    
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
    
    let layout
    if (engineVersion === 'v2') {
      // Build cutout context when cutout mode is active (mirrors GET handler)
      let demoTransformOptions: Parameters<typeof transformMenuToV2>[1] = { imageModeIsCutout: imageMode === 'cutout' }
      if (imageMode === 'cutout') {
        const featureEnabled = isCutoutFeatureEnabled()
        const allItems: any[] = Array.isArray(menu.items) ? menu.items : []
        const itemCutouts = new Map<string, ItemCutoutContext>()
        allItems.forEach((item: any) => {
          if (item.cutoutUrl !== undefined || item.cutoutStatus !== undefined) {
            itemCutouts.set(item.id, {
              cutoutUrl: item.cutoutUrl ?? null,
              cutoutStatus: item.cutoutStatus ?? 'not_requested',
            })
          }
        })
        demoTransformOptions = {
          ...demoTransformOptions,
          cutout: {
            featureEnabled,
            templateSupportsCutouts: true,
            itemCutouts,
          },
        }
      }

      // Transform to EngineMenuV2 if needed
      const menuV2 = isEngineMenuV2(menu) ? menu : transformMenuToV2(menu, demoTransformOptions)

      // Mark the flagship item so findFlagshipItem() can locate it for the banner hero
      const postFlagshipItemId = typeof configuration.flagshipItemId === 'string' ? configuration.flagshipItemId : undefined
      if (postFlagshipItemId) {
        for (const section of menuV2.sections) {
          for (const item of section.items) {
            if (item.id === postFlagshipItemId) {
              item.isFlagship = true
            }
          }
        }
      }
      
      layout = await generateLayoutWithVersion({
        menu: menuV2,
        templateId,
        selection: {
          textOnly,
          fillersEnabled,
          spacerTilePatternId,
          texturesEnabled,
          textureId,
          targetCellWidthPt,
          showMenuTitle,
          showVignette,
          showCategoryTitles,
          showLogoTile: configuration.showLogoTile === true,
          showCategoryHeaderTiles: configuration.showCategoryHeaderTiles === true,
          showFlagshipTile: configuration.showFlagshipTile === true,
          centreAlignment,
          colourPaletteId: paletteId,
          imageMode,
          showBanner,
          bannerTitle,
          showBannerTitle,
          showVenueName,
          bannerSwapLayout,
          bannerImageStyle: bannerImageStyle as any,
          fontStylePreset: fontStylePreset as any,
        },
        debug: true
      }, 'v2')
    } else {
      // V1 Path
      const template = TEMPLATE_REGISTRY[templateId]
      if (!template) {
        return NextResponse.json({ error: 'Invalid V1 templateId' }, { status: 400 })
      }
      const engineMenu = toEngineMenu(menu)
      
      layout = await generateLayoutWithVersion({
        menu: engineMenu,
        template,
        selection: {
          id: 'demo-selection',
          menuId: params.menuId,
          templateId,
          templateVersion: template.version,
          configuration: {
            textOnly,
            useLogo: true,
            colourPaletteId: paletteId
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }, 'v1')
    }
    
    return NextResponse.json({
      success: true,
      data: layout,
      cached: false
    })
    
  } catch (error) {
    console.error('Error generating layout:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

