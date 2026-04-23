import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, getMenuAsAdmin } from '@/lib/database'
import { getMenuCurrency } from '@/lib/menu-currency-service'
import { transformMenuToV2, isEngineMenuV2 } from '@/lib/templates/v2/menu-transformer-v2'
import { generateLayoutWithVersion } from '@/lib/templates/engine-selector'
import { isCutoutFeatureEnabled } from '@/lib/background-removal/feature-flag'
import type { ImageModeV2 } from '@/lib/templates/v2/engine-types-v2'
import type { MenuItem } from '@/types'
import type { ItemCutoutContext } from '@/lib/templates/v2/menu-transformer-v2'

const VALID_IMAGE_MODES = ['none', 'compact-rect', 'compact-circle', 'stretch', 'background', 'cutout'] as const

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users/[userId]/menus/[slug]/layout
 *
 * Admin-only layout generation for any user's menu, regardless of status.
 * Mirrors /api/menus/[menuId]/layout but uses the admin Supabase client
 * to bypass RLS, and uses the menu owner's currency preference.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string; slug: string } }
) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')

    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
    }

    // Resolve menu ID via admin client (bypasses RLS)
    const adminSupabase = createAdminSupabaseClient()
    const { data: row, error: rowError } = await adminSupabase
      .from('menus')
      .select('id')
      .eq('user_id', params.userId)
      .eq('slug', params.slug)
      .single()

    if (rowError || !row) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    // Load full menu object using admin client (bypasses RLS on all sub-queries)
    const menu = await getMenuAsAdmin(row.id)
    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    // Parse all the same options as the main layout route
    const paletteId = searchParams.get('paletteId') || undefined
    const fillersEnabled = searchParams.get('fillersEnabled') === 'true'
    const spacerTilePatternId = searchParams.get('spacerTilePatternId') || undefined
    const rawImageMode = searchParams.get('imageMode') || 'stretch'
    const parsedImageMode: ImageModeV2 = (VALID_IMAGE_MODES as readonly string[]).includes(rawImageMode)
      ? (rawImageMode as ImageModeV2)
      : 'stretch'
    const imageMode: ImageModeV2 = parsedImageMode === 'none' ? 'stretch' : parsedImageMode
    const textOnly = searchParams.get('textOnly') === 'true' || rawImageMode === 'none'
    const texturesEnabled = searchParams.get('texturesEnabled') !== 'false'
    const textureId = searchParams.get('textureId') || undefined
    const showMenuTitle = searchParams.get('showMenuTitle') === 'true'
    const showVignette = searchParams.get('showVignette') === 'true'
    const showCategoryTitles = searchParams.get('showCategoryTitles') !== 'false'
    const showLogoTile = searchParams.get('showLogoTile') === 'true'
    const showCategoryHeaderTiles = searchParams.get('showCategoryHeaderTiles') === 'true'
    const showFlagshipTile = searchParams.get('showFlagshipTile') === 'true'
    const centreAlignment = searchParams.get('centreAlignment') === 'true'
    const showBanner = searchParams.get('showBanner') !== 'false'
    const bannerTitle = searchParams.get('bannerTitle') || undefined
    const showBannerTitle = searchParams.get('showBannerTitle') !== 'false'
    const showVenueName = searchParams.get('showVenueName') !== 'false'
    const bannerSwapLayout = searchParams.get('bannerSwapLayout') === 'true'
    const bannerImageStyle = searchParams.get('bannerImageStyle') || undefined
    const fontStylePreset = searchParams.get('fontStylePreset') || undefined
    const flagshipItemId = searchParams.get('flagshipItemId') || undefined

    // Use the menu owner's currency preference
    const menuCurrency = await getMenuCurrency(params.userId)

    // Build cutout context when cutout mode is active
    let cutoutOptions: Parameters<typeof transformMenuToV2>[1] = {
      currency: menuCurrency,
      imageModeIsCutout: imageMode === 'cutout',
    }

    if (imageMode === 'cutout') {
      const featureEnabled = isCutoutFeatureEnabled()
      const allItems: MenuItem[] = [
        ...(menu.items ?? []),
        ...(menu.categories?.flatMap((c) => c.items) ?? []),
      ]
      const itemCutouts = new Map<string, ItemCutoutContext>()
      allItems.forEach((item) => {
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
          templateSupportsCutouts: true,
          itemCutouts,
          menuId: row.id,
          templateId,
          isExport: false,
        },
      }
    }

    const menuV2 = transformMenuToV2(menu, cutoutOptions)

    if (flagshipItemId) {
      for (const section of menuV2.sections) {
        for (const item of section.items) {
          if (item.id === flagshipItemId) {
            item.isFlagship = true
          }
        }
      }
    }

    const layout = await generateLayoutWithVersion(
      {
        menu: menuV2,
        templateId,
        selection: {
          textOnly,
          fillersEnabled,
          spacerTilePatternId,
          texturesEnabled,
          textureId,
          showMenuTitle,
          showVignette,
          showCategoryTitles,
          showLogoTile,
          showCategoryHeaderTiles,
          showFlagshipTile,
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
        debug: false,
      },
      'v2'
    )

    return NextResponse.json({ success: true, data: layout })
  } catch (error) {
    console.error('[admin-menu-layout] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
