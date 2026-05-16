/**
 * Placeholder Menu Items
 *
 * Provides cuisine + establishment-type matched sample menu items for
 * first-time users, giving them a populated menu preview before they
 * add their own items.
 *
 * Source data: gridmenu-placeholder-menu-matrix-image-columns.xlsx
 * 792 items across 11 cuisines × 9 establishment types.
 */

import type { MenuItem, MenuCategory } from '@/types'
import type { PlaceholderMenuSet, PlaceholderItem, PlaceholderCategory, PlaceholderImageEntry } from './types'
import { getCurrencyMetadata } from '@/lib/currency-config'

import itemMatrix from './item-matrix.json'
import imageLibrary from './image-library.json'
import currencyMultipliers from './currency-multipliers.json'

type ItemMatrixMap = Record<string, PlaceholderMenuSet>
const MATRIX = itemMatrix as ItemMatrixMap
const IMAGE_LIBRARY = imageLibrary as PlaceholderImageEntry[]
const MULTIPLIERS = currencyMultipliers as unknown as Record<string, number>

/** Build the lookup key for a cuisine + establishment pair. */
function matrixKey(cuisineId: string, establishmentTypeId: string): string {
  return `${cuisineId}__${establishmentTypeId}`
}

/**
 * Resolve the best placeholder menu set for a given cuisine + establishment type.
 * Falls back to cuisine + 'other' establishment, then 'other' + 'other'.
 */
function resolveMenuSet(cuisineId: string, establishmentTypeId: string): PlaceholderMenuSet {
  const exact = MATRIX[matrixKey(cuisineId, establishmentTypeId)]
  if (exact) return exact

  const cuisineFallback = MATRIX[matrixKey(cuisineId, 'other')]
  if (cuisineFallback) return cuisineFallback

  const globalFallback = MATRIX[matrixKey('other', 'other')]
  if (globalFallback) return globalFallback

  // Absolute last resort: return first available set
  const firstKey = Object.keys(MATRIX)[0]
  return MATRIX[firstKey]
}

function slugToId(cuisineId: string, slug: string): string {
  return `placeholder-${cuisineId}-${slug}`
}

/**
 * Convert an SGD base price to the target currency using indicative multipliers.
 * Rounds based on currency decimal places for realistic-looking prices.
 */
function convertPrice(sgdPrice: number, currencyCode: string): number {
  const multiplier = MULTIPLIERS[currencyCode] ?? MULTIPLIERS['USD'] ?? 0.75
  const raw = sgdPrice * multiplier
  const meta = getCurrencyMetadata(currencyCode)

  if (meta.decimalPlaces === 0) {
    // Zero-decimal currencies (JPY, KRW, VND, CLP): round to nearest 10 for cleaner prices
    return Math.round(raw / 10) * 10
  }
  return Math.round(raw * 100) / 100
}

function buildMenuItem(
  item: PlaceholderItem,
  categoryName: string,
  order: number,
  cuisineId: string,
  currencyCode?: string,
  categoryHasFeatured?: boolean,
): MenuItem {
  const imageKey = item.suggestedImageKey
  const hasImage = !!imageKey
  const price = currencyCode ? convertPrice(item.price, currencyCode) : item.price

  // Only the first P1 item in each category gets isFeatured — one per category.
  // isFlagship is reserved for sampleRank === 1 (the single menu-wide hero item).
  const isFeatured = !categoryHasFeatured && item.imagePriority === 'P1'

  return {
    id: slugToId(cuisineId, item.slug),
    name: item.name,
    description: item.description,
    price,
    available: true,
    category: categoryName,
    order,
    imageSource: hasImage ? 'custom' : 'none',
    customImageUrl: hasImage ? getPlaceholderImagePath(imageKey) : undefined,
    cutoutUrl: hasImage ? getPlaceholderCutoutPath(imageKey) : undefined,
    isFeatured,
    isFlagship: item.sampleRank === 1,
    isPlaceholder: true,
  }
}

/**
 * Get placeholder menu items for a given cuisine and establishment type.
 *
 * @param cuisineId - Cuisine ID matching the CUISINES array (e.g. 'japanese')
 * @param establishmentTypeId - Establishment type ID (e.g. 'casual-dining')
 * @param menuCurrency - ISO 4217 currency code for price conversion (defaults to USD)
 * @returns Object with flat items array and hierarchical categories
 */
export function getPlaceholderItems(
  cuisineId: string,
  establishmentTypeId?: string,
  menuCurrency?: string,
): { items: MenuItem[]; categories: MenuCategory[] } {
  const data = resolveMenuSet(cuisineId, establishmentTypeId ?? 'other')
  const currency = menuCurrency || 'USD'

  const items: MenuItem[] = []
  const categories: MenuCategory[] = []
  let globalOrder = 0

  data.categories.forEach((cat: PlaceholderCategory, catIndex: number) => {
    let categoryHasFeatured = false
    const categoryItems: MenuItem[] = cat.items.map((item: PlaceholderItem) => {
      globalOrder++
      const menuItem = buildMenuItem(item, cat.name, globalOrder, data.cuisineId, currency, categoryHasFeatured)
      if (menuItem.isFeatured) categoryHasFeatured = true
      return menuItem
    })

    items.push(...categoryItems)
    categories.push({
      id: `placeholder-cat-${catIndex}`,
      name: cat.name,
      items: categoryItems,
      order: catIndex,
    })
  })

  return { items, categories }
}

/** Check whether a menu contains any placeholder items. */
export function hasPlaceholderItems(items: MenuItem[]): boolean {
  return items.some(item => item.isPlaceholder)
}

/** Filter out placeholder items from a menu items array. */
export function filterPlaceholderItems(items: MenuItem[]): MenuItem[] {
  return items.filter(item => !item.isPlaceholder)
}

/** Filter placeholder items from categories. */
export function filterPlaceholderCategories(categories: MenuCategory[]): MenuCategory[] {
  return categories
    .map(cat => ({
      ...cat,
      items: cat.items.filter(item => !item.isPlaceholder),
    }))
    .filter(cat => cat.items.length > 0)
}

const STORAGE_BUCKET = 'menu-images'
const STORAGE_PREFIX = 'placeholder-items'

function getSupabaseStorageUrl(path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    // Env var not available at call time — warn and fall back so the URL can
    // be corrected at render time by fixPlaceholderImageUrls()
    console.warn('[placeholder-menus] NEXT_PUBLIC_SUPABASE_URL not set — placeholder image URL will be relative')
    return `/placeholder-items/${path}`
  }
  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${STORAGE_PREFIX}/${path}`
}

/** Get the image URL for a placeholder item's photo by image key. */
export function getPlaceholderImagePath(imageKey: string): string {
  return getSupabaseStorageUrl(`${imageKey}/photo.webp`)
}

/** Get the cutout image URL for a placeholder item by image key. */
export function getPlaceholderCutoutPath(imageKey: string): string {
  return getSupabaseStorageUrl(`${imageKey}/cutout.webp`)
}

/**
 * Fix placeholder item image URLs that were stored as relative paths
 * (e.g. `/placeholder-items/...`) instead of full Supabase Storage URLs.
 * This can happen when NEXT_PUBLIC_SUPABASE_URL is not available at the
 * time getPlaceholderItems() is called (e.g. during SSR without env).
 * Call this server-side after loading menu items from the database.
 */
export function fixPlaceholderImageUrls(items: MenuItem[]): MenuItem[] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return items

  return items.map(item => {
    if (!item.isPlaceholder) return item

    const fix = (url: string | null | undefined): string | undefined => {
      if (!url) return undefined
      if (url.startsWith('/placeholder-items/')) {
        const relativePath = url.replace('/placeholder-items/', '')
        return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${STORAGE_PREFIX}/${relativePath}`
      }
      return url
    }

    const fixedCustomImageUrl = fix(item.customImageUrl)

    // Derive cutoutUrl from customImageUrl if not stored (placeholder items written
    // before cutoutUrl was persisted won't have it in menu_data JSONB).
    // photo.webp → cutout.webp in the same storage folder.
    let fixedCutoutUrl = fix(item.cutoutUrl) ?? item.cutoutUrl
    if (!fixedCutoutUrl && fixedCustomImageUrl) {
      fixedCutoutUrl = fixedCustomImageUrl.replace('/photo.webp', '/cutout.webp')
    }

    return {
      ...item,
      customImageUrl: fixedCustomImageUrl,
      cutoutUrl: fixedCutoutUrl,
      // Mark cutout as succeeded so the renderer and UI enable cutout mode
      cutoutStatus: fixedCutoutUrl ? 'succeeded' : item.cutoutStatus,
    }
  })
}

/** Get all image library entries (for batch generation tooling). */
export function getImageLibrary(): PlaceholderImageEntry[] {
  return IMAGE_LIBRARY
}

/** Get P1 (generate-now) image entries. */
export function getP1Images(): PlaceholderImageEntry[] {
  return IMAGE_LIBRARY.filter(img => img.generate_now)
}
