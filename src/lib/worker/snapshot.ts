/**
 * Render Snapshot Creation
 * 
 * Creates frozen snapshots of menu state at export job creation time.
 * Ensures that menu edits after job creation don't affect the export output.
 */

import { createWorkerSupabaseClient } from '@/lib/supabase-worker'
import type { RenderSnapshot } from '@/types'

/**
 * Export options for snapshot creation
 */
export interface ExportOptions {
  template_id: string
  configuration?: any
  format?: 'A4' | 'Letter'
  orientation?: 'portrait' | 'landscape'
  include_images?: boolean
  include_prices?: boolean
}

/**
 * Error thrown when snapshot creation fails
 */
export class SnapshotCreationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message)
    this.name = 'SnapshotCreationError'
  }
}

/**
 * Validates that all image URLs are from trusted Supabase Storage domains
 */
function validateImageUrls(menu: any): void {
  const trustedDomains = [
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace('http://', '').split(':')[0],
    'supabase.co',
    'supabase.in',
    'localhost'
  ].filter(Boolean)

  const imageUrls: string[] = []
  
  // Collect logo URL
  if (menu.logo_url) {
    imageUrls.push(menu.logo_url)
  }
  
  // Collect item image URLs (customImageUrl after enrichment, or legacy image_url)
  if (menu.menu_data?.items) {
    for (const item of menu.menu_data.items) {
      const url = item.customImageUrl || item.image_url
      if (url) imageUrls.push(url)
    }
  }
  
  // Validate each URL
  for (const url of imageUrls) {
    // Skip internal placeholder values (e.g. 'custom-{uuid}' before a real upload URL is stored)
    if (!url.startsWith('http://') && !url.startsWith('https://')) continue

    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname
      
      const isTrusted = trustedDomains.some(domain => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      )
      
      if (!isTrusted) {
        throw new SnapshotCreationError(
          `Untrusted image URL domain: ${hostname}`,
          'UNTRUSTED_IMAGE_URL',
          { url, hostname }
        )
      }
    } catch (error) {
      if (error instanceof SnapshotCreationError) {
        throw error
      }
      throw new SnapshotCreationError(
        `Invalid image URL: ${url}`,
        'INVALID_IMAGE_URL',
        { url, error: error instanceof Error ? error.message : String(error) }
      )
    }
  }
}

/**
 * Fetches template information from the database or template registry
 * 
 * @param templateId - UUID or identifier of the template
 * @returns Template information including version and name
 */
async function fetchTemplate(templateId: string): Promise<{
  id: string
  version: string
  name: string
}> {
  // Resolve directly from YAML — the template loader is the single source of truth.
  // No hardcoded map needed; adding a new template only requires a new YAML file.
  try {
    const { loadTemplateV2 } = await import('@/lib/templates/v2/template-loader-v2')
    const t = await loadTemplateV2(templateId)
    return { id: templateId, version: t.version, name: t.name }
  } catch {
    throw new SnapshotCreationError(
      `Template not found: ${templateId}`,
      'TEMPLATE_NOT_FOUND',
      { templateId }
    )
  }
}

/**
 * Fetches menu data with all items and relations
 * 
 * @param menuId - UUID of the menu
 * @returns Complete menu data including items, categories, and metadata
 */
async function fetchMenuWithItems(menuId: string): Promise<any> {
  const supabase = createWorkerSupabaseClient()
  
  const { data: menu, error } = await supabase
    .from('menus')
    .select('*')
    .eq('id', menuId)
    .single()
  
  if (error) {
    throw new SnapshotCreationError(
      `Failed to fetch menu: ${error.message}`,
      'MENU_FETCH_ERROR',
      { menuId, error: error.message }
    )
  }
  
  if (!menu) {
    throw new SnapshotCreationError(
      `Menu not found: ${menuId}`,
      'MENU_NOT_FOUND',
      { menuId }
    )
  }
  
  return menu
}

/**
 * Fetches image_transform from menu_items table (source of truth for zoom/pan).
 */
async function fetchImageTransformsForMenu(menuId: string): Promise<Map<string, any>> {
  const supabase = createWorkerSupabaseClient()
  const { data: rows, error } = await supabase
    .from('menu_items')
    .select('id, image_transform')
    .eq('menu_id', menuId)

  if (error || !rows?.length) return new Map()
  const map = new Map<string, any>()
  for (const row of rows) {
    if (row.image_transform) map.set(row.id, row.image_transform)
  }
  return map
}

/**
 * Resolves AI image IDs to actual URLs so the snapshot has fetchable image_urls.
 * Raw menu_data only has aiImageId; desktop_url comes from ai_generated_images.
 */
async function enrichMenuDataWithImageUrls(menu: any): Promise<void> {
  const supabase = createWorkerSupabaseClient()
  const menuData = menu.menu_data || {}
  const aiImageIds: string[] = []

  if (menuData.items) {
    for (const item of menuData.items) {
      if (item.aiImageId && item.imageSource === 'ai') aiImageIds.push(item.aiImageId)
    }
  }
  if (menuData.categories) {
    for (const cat of menuData.categories) {
      if (cat.items) {
        for (const item of cat.items) {
          if (item.aiImageId && item.imageSource === 'ai') aiImageIds.push(item.aiImageId)
        }
      }
    }
  }
  if (aiImageIds.length === 0) return

  const { data: rows, error } = await supabase
    .from('ai_generated_images')
    .select('id, desktop_url, cutout_url, cutout_status')
    .in('id', aiImageIds)

  if (error || !rows?.length) return
  const imageById = new Map<string, { desktopUrl: string; cutoutUrl: string | null; cutoutStatus: string | null }>()
  for (const row of rows) {
    if (row.desktop_url) {
      imageById.set(row.id, {
        desktopUrl: row.desktop_url,
        cutoutUrl: row.cutout_url ?? null,
        cutoutStatus: row.cutout_status ?? null,
      })
    }
  }

  const applyImageData = (item: any) => {
    if (item.aiImageId && item.imageSource === 'ai') {
      const data = imageById.get(item.aiImageId)
      if (data) {
        item.customImageUrl = data.desktopUrl
        item.cutoutUrl = data.cutoutUrl
        item.cutoutStatus = data.cutoutStatus
      }
    }
  }

  if (menuData.items) {
    for (const item of menuData.items) applyImageData(item)
  }
  if (menuData.categories) {
    for (const cat of menuData.categories) {
      if (cat.items) {
        for (const item of cat.items) applyImageData(item)
      }
    }
  }
}

/**
 * Creates a frozen snapshot of menu state at job creation time
 * 
 * This function captures all data required to render a menu at the exact moment
 * an export job is created. The snapshot ensures that workers render the menu
 * as it existed when the user requested the export, even if the menu is
 * subsequently edited.
 * 
 * @param menuId - UUID of the menu to snapshot
 * @param templateId - UUID or identifier of the template to use
 * @param exportOptions - Export configuration options
 * @returns Complete render snapshot with frozen menu state
 * @throws SnapshotCreationError if snapshot creation fails
 * 
 * @example
 * ```typescript
 * const snapshot = await createRenderSnapshot(
 *   'menu-uuid',
 *   'elegant-dark',
 *   {
 *     template_id: 'elegant-dark',
 *     format: 'A4',
 *     orientation: 'portrait',
 *     include_images: true,
 *     include_prices: true
 *   }
 * )
 * ```
 */
export async function createRenderSnapshot(
  menuId: string,
  templateId: string,
  exportOptions: ExportOptions
): Promise<RenderSnapshot> {
  try {
    // Fetch menu data with all relations
    const menu = await fetchMenuWithItems(menuId)

    // Resolve AI image IDs to full URLs (raw menu_data has aiImageId only; worker needs fetchable URLs)
    await enrichMenuDataWithImageUrls(menu)
    
    // Fetch user's menu currency preference
    const { getMenuCurrency } = await import('@/lib/menu-currency-service')
    const userMenuCurrency = await getMenuCurrency(menu.user_id)
    
    // Fetch template information
    const template = await fetchTemplate(templateId)
    
    // Validate all image URLs are from trusted domains
    validateImageUrls(menu)
    
    // Extract menu_data from the menu record
    const menuData = menu.menu_data || {}
    
    // Flatten items: use menuData.items if present, else flatten from categories
    const flatItems: any[] = (menuData.items && menuData.items.length > 0)
      ? menuData.items
      : (menuData.categories || []).flatMap((cat: any) => (cat.items || []).map((item: any) => ({ ...item, category: item.category || cat.name })))
    
    // Fetch image_transform from menu_items (source of truth for positioning)
    const transformById = await fetchImageTransformsForMenu(menuId)
    
    console.log(`[Snapshot] Creating snapshot for menu ${menuId}. Items count: ${flatItems.length}`)
    if (flatItems.length > 0) {
      console.log(`[Snapshot] First item sample:`, JSON.stringify({
        name: flatItems[0].name,
        price: flatItems[0].price,
        description: flatItems[0].description?.substring(0, 20),
        indicators: flatItems[0].indicators
      }))
    }

    // Create frozen snapshot
    const snapshot: RenderSnapshot = {
      template_id: template.id,
      template_version: template.version,
      template_name: template.name,
      configuration: exportOptions.configuration,
      
      menu_data: {
        id: menu.id,
        name: menu.name,
        description: menuData.description,
        logo_url: menu.logo_url,
        // Prefer explicit establishment details from menu_data, then venue_info, then menu name
        establishment_name: menuData.establishment_name || menu.venue_info?.name || menu.name,
        establishment_address: menuData.establishment_address || menu.venue_info?.address,
        establishment_phone: menuData.establishment_phone || menu.venue_info?.phone,
        // Include full venue info for V2 footer rendering (address/phone/email/social links)
        venue_info: menu.venue_info,
        
        // Map items with full details (flattened, with image_transform from menu_items)
        // Only include items that are available (available !== false)
        items: flatItems.filter((item: any) => item.available !== false).map((item: any, index: number) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          currency: userMenuCurrency, // Use user's menu currency preference
          category: item.category,
          // Only set image_url when the item has a usable image.
          // imageSource 'none' means the user deselected the image;
          // 'ai' items get customImageUrl populated by enrichMenuDataWithImageUrls;
          // falling back to raw aiImageId (a UUID) would make hasImages true incorrectly.
          image_url: item.imageSource === 'none'
            ? undefined
            : item.imageSource === 'custom'
              ? item.customImageUrl
              : item.imageSource === 'ai'
                ? item.customImageUrl  // enriched URL; undefined if enrichment failed
                : undefined,
          display_order: item.order ?? index,
          
          // Include modifiers if present
          modifiers: item.modifierGroups?.map((group: any) => ({
            id: group.id || `modifier-${group.name}`,
            name: group.name,
            options: group.options?.map((opt: any) => ({
              name: opt.name,
              price_adjustment: opt.priceDelta
            })) || []
          })),
          
          // Include variants if present
          variants: item.variants?.map((variant: any) => ({
            id: variant.id || `variant-${variant.size}`,
            name: variant.size || variant.name,
            price: variant.price
          })),

          // Include indicators (dietary, spice, allergens)
          indicators: item.indicators || {
            dietary: [],
            spiceLevel: null,
            allergens: []
          },

          // Cutout (transparent background) image URL, when available.
          // Populated by enrichMenuDataWithImageUrls from ai_generated_images.cutout_url.
          cutout_url: item.cutoutUrl ?? undefined,

          // Flagship item designation for banner hero image
          isFlagship: item.isFlagship === true || item.is_flagship === true,

          isFeatured: item.isFeatured === true || item.is_featured === true,

          // Placeholder item designation — items from the sample/demo set
          isPlaceholder: item.isPlaceholder === true || item.is_placeholder === true,

          // Per-mode image positioning (zoom/pan) for PDF export — prefer menu_items
          imageTransform: transformById.get(item.id) ?? item.imageTransform
        })),
        
        // Map categories if present
        categories: menuData.categories?.map((cat: any, index: number) => ({
          name: cat.name,
          display_order: cat.order ?? index
        }))
      },
      
      export_options: {
        format: exportOptions.format || 'A4',
        orientation: exportOptions.orientation || 'portrait',
        include_images: exportOptions.include_images ?? true,
        include_prices: exportOptions.include_prices ?? true
      },
      
      snapshot_created_at: new Date().toISOString(),
      snapshot_version: '2.0'
    }
    
    return snapshot
  } catch (error) {
    if (error instanceof SnapshotCreationError) {
      throw error
    }
    
    throw new SnapshotCreationError(
      `Snapshot creation failed: ${error instanceof Error ? error.message : String(error)}`,
      'SNAPSHOT_CREATION_FAILED',
      {
        menuId,
        templateId,
        error: error instanceof Error ? error.message : String(error)
      }
    )
  }
}

/**
 * Resolves relative image URLs to absolute for worker fetch.
 * Demo menus use paths like /sample-menus/generated/breakfast/foo.webp
 */
function resolveDemoImageUrl(url: string | null | undefined, baseUrl: string): string | undefined {
  if (!url || typeof url !== 'string') return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const path = url.startsWith('/') ? url : `/${url}`
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

/**
 * Creates a render snapshot from in-memory menu data (demo flow).
 * Used when menu data is provided in the request body instead of fetched from DB.
 *
 * @param menu - Demo menu object (items, venueInfo, logoUrl, theme, etc.)
 * @param templateId - Template identifier
 * @param exportOptions - Export configuration
 * @returns Complete render snapshot
 */
export async function createRenderSnapshotFromMenuData(
  menu: any,
  templateId: string,
  exportOptions: ExportOptions
): Promise<RenderSnapshot> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      'https://one-minute-menu.vercel.app'

    const template = await fetchTemplate(templateId)

    const menuData = menu.menu_data || {}
    const items = menuData.items || menu.items || []
    const resolveUrl = (url: string | null | undefined) => resolveDemoImageUrl(url, baseUrl)

    const snapshot: RenderSnapshot = {
      template_id: template.id,
      template_version: template.version,
      template_name: template.name,
      configuration: exportOptions.configuration,

      menu_data: {
        id: menu.id || 'demo-menu',
        name: menu.name || 'Demo Menu',
        description: menuData.description || menu.description,
        logo_url: resolveUrl(menu.logoUrl || menu.logo_url || menuData.logo_url),
        establishment_name: menuData.establishment_name || menu.venueInfo?.name || menu.venue_info?.name || menu.name,
        establishment_address: menuData.establishment_address || menu.venueInfo?.address || menu.venue_info?.address,
        establishment_phone: menuData.establishment_phone || menu.venueInfo?.phone || menu.venue_info?.phone,
        venue_info: menu.venueInfo || menu.venue_info,

        items: items.map((item: any, index: number) => ({
          id: item.id || `item-${index}`,
          name: item.name ?? '',
          description: item.description,
          price: item.price,
          currency: 'USD',
          category: item.category || 'General',
          image_url: resolveUrl(item.customImageUrl || item.imageUrl || item.image_url),
          display_order: item.display_order ?? item.displayOrder ?? item.order ?? index,

          modifiers: item.modifierGroups?.map((group: any) => ({
            id: group.id || `modifier-${group.name}`,
            name: group.name,
            options: group.options?.map((opt: any) => ({
              name: opt.name,
              price_adjustment: opt.priceDelta
            })) || []
          })),
          variants: item.variants?.map((variant: any) => ({
            id: variant.id || `variant-${variant.size}`,
            name: variant.size || variant.name,
            price: variant.price
          })),
          indicators: item.indicators || {
            dietary: [],
            spiceLevel: null,
            allergens: []
          },

          // Cutout (transparent background) image URL, when available
          cutout_url: item.cutoutUrl ? resolveUrl(item.cutoutUrl) : undefined,

          isFlagship: item.isFlagship === true || item.is_flagship === true,
          isFeatured: item.isFeatured === true || item.is_featured === true,

          // Per-mode image positioning (zoom/pan) for PDF export
          imageTransform: item.imageTransform
        })),

        categories:
          (menuData.categories || []).length > 0
            ? (menuData.categories || []).map((cat: any, index: number) => ({
                name: cat.name,
                display_order: cat.order ?? cat.display_order ?? index
              }))
            : Array.from(new Set(items.map((i: any) => i.category || 'General')))
                .filter(Boolean)
                .map((name, index) => ({ name, display_order: index }))
      },

      export_options: {
        format: exportOptions.format || 'A4',
        orientation: exportOptions.orientation || 'portrait',
        include_images: exportOptions.include_images ?? true,
        include_prices: exportOptions.include_prices ?? true
      },

      snapshot_created_at: new Date().toISOString(),
      snapshot_version: '2.0'
    }

    return snapshot
  } catch (error) {
    if (error instanceof SnapshotCreationError) {
      throw error
    }
    throw new SnapshotCreationError(
      `Demo snapshot creation failed: ${error instanceof Error ? error.message : String(error)}`,
      'SNAPSHOT_CREATION_FAILED',
      { templateId, error: error instanceof Error ? error.message : String(error) }
    )
  }
}

/**
 * Retrieves and validates a render snapshot from job metadata
 * 
 * @param jobMetadata - Export job metadata containing the snapshot
 * @returns Validated render snapshot
 * @throws SnapshotCreationError if snapshot is missing or invalid
 */
export function getRenderSnapshot(jobMetadata: any): RenderSnapshot {
  const snapshot = jobMetadata?.render_snapshot
  
  if (!snapshot) {
    throw new SnapshotCreationError(
      'Render snapshot missing from job metadata',
      'SNAPSHOT_MISSING'
    )
  }
  
  // Validate snapshot completeness
  validateSnapshot(snapshot)
  
  return snapshot
}

/**
 * Validates that a snapshot contains all required fields
 * 
 * @param snapshot - Snapshot to validate
 * @throws SnapshotCreationError if validation fails
 */
function validateSnapshot(snapshot: any): asserts snapshot is RenderSnapshot {
  const errors: string[] = []
  
  if (!snapshot.template_id) {
    errors.push('Snapshot missing template_id')
  }
  
  if (!snapshot.template_version) {
    errors.push('Snapshot missing template_version')
  }
  
  if (!snapshot.template_name) {
    errors.push('Snapshot missing template_name')
  }
  
  if (!snapshot.menu_data) {
    errors.push('Snapshot missing menu_data')
  } else {
    if (!snapshot.menu_data.id) {
      errors.push('Snapshot menu_data missing id')
    }
    
    if (!snapshot.menu_data.name) {
      errors.push('Snapshot menu_data missing name')
    }
    
    if (!snapshot.menu_data.items || !Array.isArray(snapshot.menu_data.items)) {
      errors.push('Snapshot missing or invalid menu items')
    }
  }
  
  if (!snapshot.export_options) {
    errors.push('Snapshot missing export_options')
  }
  
  if (!snapshot.snapshot_created_at) {
    errors.push('Snapshot missing creation timestamp')
  }
  
  if (!snapshot.snapshot_version) {
    errors.push('Snapshot missing schema version')
  }
  
  if (errors.length > 0) {
    throw new SnapshotCreationError(
      'Snapshot validation failed',
      'SNAPSHOT_INVALID',
      { errors }
    )
  }
}
