import { trackConversionEvent } from '@/lib/conversion-tracking'
import { ANALYTICS_EVENTS, captureEvent } from '@/lib/posthog'

export const AI_FOOD_PHOTOGRAPHY_STUDIO_HREF = '/studio'
export const AI_FOOD_PHOTOGRAPHY_PRIMARY_LABEL = 'Try GridMenu Free'

export function trackAiFoodPhotographyCta(location: string, label: string, destination: string) {
  trackConversionEvent({
    event: 'cta_click_primary',
    metadata: { path: '/ai-food-photography', location, destination },
  })
  captureEvent(ANALYTICS_EVENTS.LANDING_CTA_CLICKED, { location, label, destination })
  captureEvent(ANALYTICS_EVENTS.CTA_CLICKED, { location, label, destination })
}
