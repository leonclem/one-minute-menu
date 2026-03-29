import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type { ImageTransformRecord } from '@/types'
import { normalizeImageTransformRecord } from '@/types'
import { validateTransform } from '@/lib/image-transform-validator'

// PATCH /api/menu-items/[itemId]/image-transform - Save per-item image transform
export async function PATCH(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  logger.info('🔄 [Image Transform API] Called')

  try {
    const supabase = createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.error('❌ [Image Transform API] Auth failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { itemId } = params
    if (!itemId) {
      return NextResponse.json({ error: 'Menu item ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const validationResult = validateTransform(body)
    if ('error' in validationResult) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 })
    }
    const { mode, transform } = validationResult

    logger.debug('📝 [Image Transform API] Request:', { itemId, mode, transform })

    // Fetch menu item with ownership check (including current image_transform for merge)
    let { data: menuItem, error: itemError } = await supabase
      .from('menu_items')
      .select('id, menu_id, image_transform, menus!inner(user_id)')
      .eq('id', itemId)
      .single()

    // If not in menu_items, create from menu_data (e.g. items that haven't gone through select-image)
    if (itemError || !menuItem) {
      const { data: menus } = await supabase
        .from('menus')
        .select('id, user_id, menu_data')
        .eq('user_id', user.id)
      let menuRow: { id: string; menu_data: any } | null = null
      let jsonbItem: any = null
      for (const m of menus || []) {
        const menuData = m.menu_data || {}
        const flatItems = (menuData.items || []).length > 0
          ? menuData.items
          : (menuData.categories || []).flatMap((cat: any) => (cat.items || []).map((item: any) => ({ ...item, category: item.category || cat.name })))
        const found = flatItems.find((item: any) => item.id === itemId)
        if (found) {
          menuRow = m
          jsonbItem = found
          break
        }
      }
      if (!menuRow || !jsonbItem) {
        return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
      }
      const { data: created, error: createErr } = await supabase
        .from('menu_items')
        .insert({
          id: itemId,
          menu_id: menuRow.id,
          name: jsonbItem.name || 'Unnamed',
          description: jsonbItem.description ?? null,
          price: typeof jsonbItem.price === 'number' ? jsonbItem.price : 0,
          category: jsonbItem.category ?? null,
          available: typeof jsonbItem.available === 'boolean' ? jsonbItem.available : true,
          order_index: jsonbItem.order ?? 0,
          image_source: jsonbItem.imageSource || 'none',
          custom_image_url: jsonbItem.customImageUrl ?? null,
        })
        .select('id, menu_id, image_transform, menus!inner(user_id)')
        .single()
      if (createErr || !created) {
        logger.error('❌ [Image Transform API] Failed to create menu_items row:', createErr)
        return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
      }
      menuItem = created
    }

    if ((menuItem.menus as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized access to menu item' }, { status: 403 })
    }

    // Merge into existing per-mode record (backward compat: normalise old flat format)
    const existingRecord = normalizeImageTransformRecord(menuItem.image_transform) ?? {}
    const mergedRecord: ImageTransformRecord = { ...existingRecord, [mode]: transform }

    // Update the relational table
    const { error: updateError } = await supabase
      .from('menu_items')
      .update({ image_transform: mergedRecord })
      .eq('id', itemId)

    if (updateError) {
      logger.error('❌ [Image Transform API] Failed to update menu_items:', updateError)
      return NextResponse.json({ error: 'Failed to save image transform' }, { status: 500 })
    }

    // Sync to menus.menu_data JSONB
    const { data: currentMenu, error: menuError } = await supabase
      .from('menus')
      .select('menu_data')
      .eq('id', menuItem.menu_id)
      .single()

    if (menuError || !currentMenu) {
      logger.error('❌ [Image Transform API] Failed to fetch menu_data for JSONB sync:', menuError)
    } else {
      const menuData = currentMenu.menu_data || {}

      const mergeItemTransform = (item: any) => {
        if (item.id !== itemId) return item
        const existing = normalizeImageTransformRecord(item.imageTransform) ?? {}
        return { ...item, imageTransform: { ...existing, [mode]: transform } }
      }

      const updatedItems = (menuData.items || []).map(mergeItemTransform)
      const updatedCategories = (menuData.categories || []).map((cat: any) => ({
        ...cat,
        items: (cat.items || []).map(mergeItemTransform),
      }))

      const { error: jsonbError } = await supabase
        .from('menus')
        .update({
          menu_data: { ...menuData, items: updatedItems, categories: updatedCategories },
          updated_at: new Date().toISOString(),
        })
        .eq('id', menuItem.menu_id)

      if (jsonbError) {
        logger.error('❌ [Image Transform API] Failed to sync JSONB:', jsonbError)
      } else {
        logger.info('✅ [Image Transform API] JSONB synced for item:', itemId)
      }
    }

    logger.info('✅ [Image Transform API] Transform saved for item:', itemId, 'mode:', mode)

    return NextResponse.json({
      success: true,
      data: { menuItemId: itemId, mode, imageTransform: mergedRecord },
    })
  } catch (error) {
    logger.error('❌ [Image Transform API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to save image transform', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
