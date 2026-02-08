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
  
  // Collect item image URLs
  if (menu.menu_data?.items) {
    for (const item of menu.menu_data.items) {
      if (item.image_url) {
        imageUrls.push(item.image_url)
      }
    }
  }
  
  // Validate each URL
  for (const url of imageUrls) {
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
  // For now, we'll use a simple mapping since templates are likely stored
  // in the codebase rather than the database
  // TODO: Update this when template storage strategy is finalized
  
  const templateMap: Record<string, { version: string; name: string }> = {
    'elegant-dark': { version: '1.0', name: 'Elegant Dark' },
    'modern-minimal': { version: '1.0', name: 'Modern Minimal' },
    'classic-menu': { version: '1.0', name: 'Classic Menu' },
    'rustic-charm': { version: '1.0', name: 'Rustic Charm' },
    'classic-cards-v2': { version: '2.0', name: 'Classic Cards V2' },
    'italian-v2': { version: '2.0', name: 'Italian Classic V2' }
  }
  
  const template = templateMap[templateId]
  
  if (!template) {
    throw new SnapshotCreationError(
      `Template not found: ${templateId}`,
      'TEMPLATE_NOT_FOUND',
      { templateId }
    )
  }
  
  return {
    id: templateId,
    version: template.version,
    name: template.name
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
    
    // Fetch user's menu currency preference
    const { getMenuCurrency } = await import('@/lib/menu-currency-service')
    const userMenuCurrency = await getMenuCurrency(menu.user_id)
    
    // Fetch template information
    const template = await fetchTemplate(templateId)
    
    // Validate all image URLs are from trusted domains
    validateImageUrls(menu)
    
    // Extract menu_data from the menu record
    const menuData = menu.menu_data || {}
    
    console.log(`[Snapshot] Creating snapshot for menu ${menuId}. Items count: ${menuData.items?.length || 0}`)
    if (menuData.items && menuData.items.length > 0) {
      console.log(`[Snapshot] First item sample:`, JSON.stringify({
        name: menuData.items[0].name,
        price: menuData.items[0].price,
        description: menuData.items[0].description?.substring(0, 20),
        indicators: menuData.items[0].indicators
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
        
        // Map items with full details
        items: (menuData.items || []).map((item: any, index: number) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          currency: userMenuCurrency, // Use user's menu currency preference
          category: item.category,
          image_url: item.customImageUrl || item.aiImageId, // Use custom or AI image
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
          }
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
