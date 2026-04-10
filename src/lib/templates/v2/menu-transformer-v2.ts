/**
 * Menu Transformer V2
 *
 * Transforms existing menu data (from Supabase/API) to EngineMenuV2 format.
 *
 * KEY DESIGN DECISIONS:
 * 1. Indicator fields use explicit defaults (never undefined):
 *    - dietary: defaults to empty array []
 *    - allergens: defaults to empty array []
 *    - spiceLevel: defaults to null
 * 2. Deterministic output: consistent ordering, no random IDs
 * 3. Graceful handling of missing/null fields with sensible defaults
 */

import type { Menu, MenuItem, MenuCategory, CutoutStatus } from '@/types'
import { normalizeImageTransformRecord } from '@/types'
import type {
  EngineMenuV2,
  EngineSectionV2,
  EngineItemV2,
  ItemIndicatorsV2,
} from './engine-types-v2'
import { CutoutGenerationService } from '@/lib/background-removal/cutout-service'
import { trackRenderUsage } from '@/lib/background-removal/render-tracking'

/**
 * Per-item cutout metadata used during image resolution.
 */
export interface ItemCutoutContext {
  cutoutUrl: string | null
  cutoutStatus: CutoutStatus
}

/**
 * Options for menu transformation
 */
export interface TransformOptionsV2 {
  /** Override currency from menu theme */
  currency?: string
  /** Override venue name */
  venueName?: string
  /** Override venue address */
  venueAddress?: string
  /** Override logo URL */
  logoUrl?: string
  /** Cutout resolution context — omit entirely to preserve current behavior */
  cutout?: {
    /** Whether the cutout feature flag is enabled */
    featureEnabled: boolean
    /** Whether the active template supports cutouts */
    templateSupportsCutouts: boolean
    /** Per-item cutout metadata keyed by menu item ID */
    itemCutouts: Map<string, ItemCutoutContext>
    /** Template ID for render tracking */
    templateId?: string
    /** Menu ID for render tracking */
    menuId?: string
    /** True when called from an export/publish code path (triggers render tracking) */
    isExport?: boolean
  }
  /**
   * When true, all items are rendered in explicit cutout mode:
   * items with a succeeded cutout return cutout_url, others return null (blank placeholder).
   * Corresponds to imageMode === 'cutout' in the UI.
   */
  imageModeIsCutout?: boolean
}

/**
 * Transform existing menu data to EngineMenuV2 format.
 *
 * This function converts a database Menu object into the V2 engine format,
 * handling both categorized menus (with categories) and flat menus (items only).
 *
 * @param menu - Database menu object
 * @param options - Optional transformation overrides
 * @returns Normalized EngineMenuV2 for V2 layout engine
 *
 * @example
 * ```typescript
 * const engineMenu = transformMenuToV2(databaseMenu)
 * const layout = await generateLayoutV2({
 *   menu: engineMenu,
 *   templateId: '4-column-portrait'
 * })
 * ```
 */
export function transformMenuToV2(
  menu: Menu,
  options?: TransformOptionsV2
): EngineMenuV2 {
  // Extract currency from options, theme, or use default
  const currency =
    options?.currency ?? menu.theme?.layout?.currency ?? '$'

  // Determine which data source to use
  const hasValidCategories =
    menu.categories &&
    menu.categories.length > 0 &&
    menu.categories.some((cat) => cat.items && cat.items.length > 0)

  const hasValidItems = menu.items && menu.items.length > 0

  // Check for data inconsistency between categories and flat items
  const categoryItemCount = menu.categories
    ? menu.categories.reduce((sum, cat) => sum + (cat.items?.length || 0), 0)
    : 0
  const flatItemCount = menu.items?.length || 0
  const hasDataInconsistency =
    hasValidCategories &&
    hasValidItems &&
    categoryItemCount !== flatItemCount

  // Create image lookup map from flat items array
  // Include items that have a usable image (imageSource is 'ai', 'custom', or 'cutout' with a URL)
  const itemsImageLookup = new Map<string, MenuItem>()
  if (menu.items) {
    menu.items.forEach((item) => {
      if (
        (item.imageSource === 'ai' && (item.aiImageId || item.customImageUrl)) ||
        (item.imageSource === 'custom' && item.customImageUrl) ||
        (item.imageSource === 'cutout' && (item.cutoutUrl || item.customImageUrl))
      ) {
        itemsImageLookup.set(item.id, item)
      }
    })
  }

  let sections: EngineSectionV2[]

  // Use categories if valid and consistent
  if (hasValidCategories && !hasDataInconsistency) {
    sections = menu
      .categories!.filter((cat) => cat.items && cat.items.length > 0)
      .map((cat, idx) =>
        transformCategoryToV2(cat, idx, itemsImageLookup, options)
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }
  // Otherwise, create sections from flat items grouped by category
  else if (hasValidItems) {
    sections = createSectionsFromFlatItems(menu.items!, options)
  }
  // Fallback: empty menu with single empty section
  else {
    sections = [
      {
        id: 'empty-section',
        name: 'Menu',
        sortOrder: 0,
        items: [],
      },
    ]
  }

  return {
    id: menu.id,
    name: menu.name,
    sections,
    metadata: {
      currency,
      venueName: options?.venueName ?? menu.name,
      venueAddress: options?.venueAddress ?? menu.venueInfo?.address,
      logoUrl: options?.logoUrl ?? menu.logoUrl,
      establishmentType: menu.establishmentType,
      primaryCuisine: menu.primaryCuisine,
      venueInfo: menu.venueInfo,
    },
  }
}

/**
 * Transform MenuCategory to EngineSectionV2 with image lookup
 */
function transformCategoryToV2(
  category: MenuCategory,
  fallbackOrder: number,
  itemsImageLookup: Map<string, MenuItem>,
  options?: TransformOptionsV2
): EngineSectionV2 {
  const items = category.items
    .filter((item) => item.available !== false)
    .map((item, idx) =>
      transformItemToV2(item, idx, itemsImageLookup, options)
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return {
    id: category.id,
    name: category.name,
    sortOrder: category.order ?? fallbackOrder,
    items,
    hasImages: items.some(i => !!i.imageUrl),
  }
}

/**
 * Create sections from flat items array grouped by category
 */
function createSectionsFromFlatItems(
  items: MenuItem[],
  options?: TransformOptionsV2
): EngineSectionV2[] {
  // Group items by category
  const categoryGroups = new Map<string, MenuItem[]>()

  items.forEach((item) => {
    if (item.available === false) return
    const categoryName =
      item.category && item.category.trim()
        ? item.category.trim()
        : 'Menu'
    if (!categoryGroups.has(categoryName)) {
      categoryGroups.set(categoryName, [])
    }
    categoryGroups.get(categoryName)!.push(item)
  })

  // Convert groups to sections
  return Array.from(categoryGroups.entries()).map(
    ([categoryName, categoryItems], idx) => {
      // Use special ID for implicit single section when all items are uncategorized
      const isImplicitSection =
        categoryGroups.size === 1 && categoryName === 'Menu'

      const items = categoryItems
        .map((item, itemIdx) =>
          transformItemToV2(item, itemIdx, new Map(), options)
        )
        .sort((a, b) => a.sortOrder - b.sortOrder)

      return {
        id: isImplicitSection ? 'implicit-section' : `section-${idx}`,
        name: categoryName,
        sortOrder: idx,
        items,
        hasImages: items.some(i => !!i.imageUrl),
      }
    }
  )
}

/**
 * Transform MenuItem to EngineItemV2 with image lookup
 */
function transformItemToV2(
  item: MenuItem,
  fallbackOrder: number,
  itemsImageLookup: Map<string, MenuItem>,
  options?: TransformOptionsV2
): EngineItemV2 {
  // Prefer flat items as source of truth for image selection (e.g. after "Use this" on extracted page)
  const lookupItem = itemsImageLookup.get(item.id)
  let imageUrl =
    (lookupItem ? getItemImageUrl(lookupItem) : undefined) ?? getItemImageUrl(item)

  // Resolve cutout URL when cutout context is provided
  const cutoutCtx = options?.cutout
  const originalImageUrl = imageUrl // preserve before cutout resolution
  if (imageUrl && cutoutCtx) {
    const itemCutout = cutoutCtx.itemCutouts.get(item.id)
    const resolvedUrl = CutoutGenerationService.resolveImageUrl({
      originalUrl: imageUrl,
      cutoutUrl: itemCutout?.cutoutUrl ?? null,
      cutoutStatus: itemCutout?.cutoutStatus ?? 'not_requested',
      templateSupportsCutouts: cutoutCtx.templateSupportsCutouts,
      featureEnabled: cutoutCtx.featureEnabled,
      itemUsesCutout: options?.imageModeIsCutout === true,
    })

    // Best-effort render tracking — only on export/publish code paths
    if (cutoutCtx.isExport && cutoutCtx.templateId && cutoutCtx.menuId) {
      const usedCutout = resolvedUrl !== null && resolvedUrl !== imageUrl
      const fallbackReason = !usedCutout
        ? determineFallbackReason(cutoutCtx, itemCutout)
        : undefined

      // Fire-and-forget — never blocks rendering
      trackRenderUsage({
        menuId: cutoutCtx.menuId,
        menuItemId: item.id,
        templateId: cutoutCtx.templateId,
        imageSourceUsed: usedCutout ? 'cutout' : 'original',
        fallbackReason,
      }).catch(() => {})
    }

    // resolvedUrl may be null in explicit cutout mode when cutout is unavailable
    // (null signals a blank placeholder — intentional, not a fallback to original)
    imageUrl = resolvedUrl ?? undefined
  }

  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    imageUrl,
    originalImageUrl: originalImageUrl !== imageUrl ? originalImageUrl : undefined,
    cutoutUrl: item.cutoutUrl ?? undefined,
    sortOrder: item.order ?? fallbackOrder,
    indicators: transformIndicators(item),
    isFeatured: item.isFeatured ?? false,
    isFlagship: item.isFlagship ?? undefined,
    imageTransform: normalizeImageTransformRecord(item.imageTransform),
  }
}

/**
 * Transform item indicators to V2 format.
 *
 * CRITICAL: All indicator fields use explicit defaults (never undefined):
 * - dietary: empty array [] (never undefined)
 * - allergens: empty array [] (never undefined)
 * - spiceLevel: null (never undefined)
 *
 * This ensures deterministic rendering and simplifies null checks downstream.
 */
function transformIndicators(item: MenuItem): ItemIndicatorsV2 {
  return {
    dietary: (item as any).dietary || [],
    allergens: (item as any).allergens || [],
    spiceLevel: (item as any).spiceLevel !== undefined ? (item as any).spiceLevel : null,
  }
}

/**
 * Get the image URL for a menu item based on its imageSource
 */
function getItemImageUrl(item: MenuItem): string | undefined {
  if (item.imageSource === 'cutout') {
    // Cutout images: prefer cutoutUrl if available, fall back to customImageUrl
    return item.cutoutUrl ?? item.customImageUrl
  }

  if (item.imageSource === 'ai') {
    // AI-generated images - URL is populated in customImageUrl
    return item.customImageUrl
  }

  if (item.imageSource === 'custom' && item.customImageUrl) {
    return item.customImageUrl
  }

  return undefined
}

/**
 * Determine why the original image was used instead of the cutout.
 */
function determineFallbackReason(
  cutoutCtx: NonNullable<TransformOptionsV2['cutout']>,
  itemCutout: ItemCutoutContext | undefined
): 'no_cutout' | 'cutout_pending' | 'cutout_failed' | 'template_unsupported' | 'feature_disabled' | undefined {
  if (!cutoutCtx.featureEnabled) return 'feature_disabled'
  if (!cutoutCtx.templateSupportsCutouts) return 'template_unsupported'
  if (!itemCutout) return 'no_cutout'
  if (itemCutout.cutoutStatus === 'pending') return 'cutout_pending'
  if (itemCutout.cutoutStatus === 'failed' || itemCutout.cutoutStatus === 'timed_out') return 'cutout_failed'
  if (itemCutout.cutoutStatus === 'not_requested') return 'no_cutout'
  if (!itemCutout.cutoutUrl) return 'no_cutout'
  return undefined
}

/**
 * Type guard to check if a value is an EngineMenuV2
 */
export function isEngineMenuV2(value: unknown): value is EngineMenuV2 {
  if (!value || typeof value !== 'object') return false
  const menu = value as any

  return (
    typeof menu.id === 'string' &&
    typeof menu.name === 'string' &&
    Array.isArray(menu.sections) &&
    menu.sections.every(isEngineSectionV2) &&
    typeof menu.metadata === 'object' &&
    typeof menu.metadata.currency === 'string'
  )
}

/**
 * Type guard to check if a value is an EngineSectionV2
 */
export function isEngineSectionV2(
  value: unknown
): value is EngineSectionV2 {
  if (!value || typeof value !== 'object') return false
  const section = value as any

  return (
    typeof section.id === 'string' &&
    typeof section.name === 'string' &&
    typeof section.sortOrder === 'number' &&
    Array.isArray(section.items) &&
    section.items.every(isEngineItemV2)
  )
}

/**
 * Type guard to check if a value is an EngineItemV2
 */
export function isEngineItemV2(value: unknown): value is EngineItemV2 {
  if (!value || typeof value !== 'object') return false
  const item = value as any

  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.price === 'number' &&
    typeof item.sortOrder === 'number' &&
    (item.description === undefined ||
      typeof item.description === 'string') &&
    (item.imageUrl === undefined || typeof item.imageUrl === 'string') &&
    typeof item.indicators === 'object' &&
    Array.isArray(item.indicators.dietary) &&
    Array.isArray(item.indicators.allergens) &&
    (item.indicators.spiceLevel === null ||
      typeof item.indicators.spiceLevel === 'number')
  )
}
