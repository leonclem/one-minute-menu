import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface TrackRenderUsageParams {
  menuId: string
  menuItemId: string
  templateId: string
  imageSourceUsed: 'cutout' | 'original'
  fallbackReason?:
    | 'no_cutout'
    | 'cutout_pending'
    | 'cutout_failed'
    | 'template_unsupported'
    | 'feature_disabled'
    | 'cutout_corrupted'
}

/**
 * Record whether the cut-out or original image was used at render time.
 *
 * Best-effort: failures are logged but never block rendering.
 * Should only be called from the export/publish code path — not previews
 * or template switches.
 */
export async function trackRenderUsage(params: TrackRenderUsageParams): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient()

    const { error } = await supabase.from('cutout_render_usage').insert({
      menu_id: params.menuId,
      menu_item_id: params.menuItemId,
      template_id: params.templateId,
      image_source_used: params.imageSourceUsed,
      fallback_reason: params.fallbackReason ?? null,
    })

    if (error) {
      logger.error('[RenderTracking] Failed to insert render usage record', error)
    }
  } catch (err) {
    // Best-effort — never block rendering
    logger.error('[RenderTracking] Unexpected error tracking render usage', err)
  }
}
