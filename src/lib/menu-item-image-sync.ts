import type { createServerSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>

/**
 * Syncs a menu item's JSONB menu_data projection with the authoritative
 * state in the menu_items table (image_source, ai_image_id, custom_image_url).
 *
 * This should be called after any operation that changes which image is
 * selected for a menu item, including image deletions that cascade selection
 * changes, so that:
 *   - The /extracted page thumbnails (driven by menu_data.items[].customImageUrl)
 *     stay accurate.
 *   - The /template page preview stays accurate.
 *   - PDF/image exports reference the correct image.
 *
 * For AI-sourced items, the JSONB customImageUrl is re-derived from the AI
 * image's desktop_url so the JSONB is a self-contained projection.
 */
export async function syncMenuItemImageToJsonb(
  supabase: SupabaseClient,
  itemId: string
): Promise<void> {
  const { data: menuItem, error: itemError } = await supabase
    .from('menu_items')
    .select('id, menu_id, image_source, ai_image_id, custom_image_url')
    .eq('id', itemId)
    .single()

  if (itemError || !menuItem) {
    logger.warn('[syncMenuItemImageToJsonb] Menu item not found, skipping JSONB sync', { itemId })
    return
  }

  // Resolve the customImageUrl the JSONB should advertise for this item.
  // - 'ai'     → use the AI image's desktop_url (or fall back to null)
  // - 'custom' → use menu_items.custom_image_url
  // - 'none'   → null
  let resolvedCustomImageUrl: string | null = null
  let resolvedAiImageId: string | null = null

  if (menuItem.image_source === 'ai' && menuItem.ai_image_id) {
    resolvedAiImageId = menuItem.ai_image_id
    const { data: aiImage } = await supabase
      .from('ai_generated_images')
      .select('desktop_url, original_url')
      .eq('id', menuItem.ai_image_id)
      .single()
    resolvedCustomImageUrl = aiImage?.desktop_url || aiImage?.original_url || null
  } else if (menuItem.image_source === 'custom') {
    resolvedCustomImageUrl = menuItem.custom_image_url || null
  }

  const { data: menuRow, error: menuError } = await supabase
    .from('menus')
    .select('menu_data')
    .eq('id', menuItem.menu_id)
    .single()

  if (menuError || !menuRow) {
    logger.warn('[syncMenuItemImageToJsonb] Menu not found, skipping JSONB sync', { menuId: menuItem.menu_id })
    return
  }

  const menuData = menuRow.menu_data || {}
  const imageUpdate = {
    imageSource: menuItem.image_source as 'ai' | 'custom' | 'none',
    customImageUrl: resolvedCustomImageUrl,
    aiImageId: resolvedAiImageId,
  }

  const updatedItems = (menuData.items || []).map((item: any) =>
    item.id === itemId ? { ...item, ...imageUpdate } : item
  )
  const updatedCategories = (menuData.categories || []).map((cat: any) => ({
    ...cat,
    items: (cat.items || []).map((item: any) =>
      item.id === itemId ? { ...item, ...imageUpdate } : item
    ),
  }))

  const { error: updateError } = await supabase
    .from('menus')
    .update({
      menu_data: { ...menuData, items: updatedItems, categories: updatedCategories },
      updated_at: new Date().toISOString(),
    })
    .eq('id', menuItem.menu_id)

  if (updateError) {
    logger.error('[syncMenuItemImageToJsonb] Failed to update menu JSONB', updateError)
  }
}
