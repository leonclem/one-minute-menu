// Client-side conversion and performance tracking helpers
// Reuses existing analytics infrastructure via /api/analytics/conversion

/**
 * Supported conversion / UX analytics events.
 * These map to metric names in the platform_analytics table on the server.
 */
export type ConversionEvent =
  | 'landing_view'
  | 'demo_start'
  | 'demo_completed'
  | 'registration_start'
  | 'signup_completed'
  | 'export_start'
  | 'export_submitted'
  | 'export_completed'
  | 'cta_click_primary'
  | 'cta_click_secondary'
  | 'cta_click_try_own_menu'
  | 'ux_error'
  | 'ux_feedback'
  | 'web_vitals_sample'

interface ConversionPayload {
  event: ConversionEvent
  metadata?: Record<string, any>
  value?: number
}

const ENDPOINT = '/api/analytics/conversion'

/**
 * Fire-and-forget conversion event tracking.
 * Uses fetch with keepalive (when available) and never throws.
 */
export async function trackConversionEvent(payload: ConversionPayload): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const body = JSON.stringify(payload)

    // Prefer sendBeacon when available for reliability on unload
    if ('navigator' in window && 'sendBeacon' in navigator) {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon(ENDPOINT, blob)
      return
    }

    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    })
  } catch {
    // Silently ignore errors – analytics must not affect UX
  }
}

/**
 * Minimal A/B test variant helper.
 * Persists a per-test variant in localStorage to keep the experience stable
 * for a given browser.
 */
export function getABVariant(testName: string, variants: string[] = ['A', 'B']): string {
  if (typeof window === 'undefined' || variants.length === 0) {
    return variants[0] ?? 'A'
  }

  const storageKey = `ux_ab:${testName}`
  try {
    const existing = window.localStorage.getItem(storageKey)
    if (existing && variants.includes(existing)) {
      return existing
    }

    const selected = variants[Math.floor(Math.random() * variants.length)]
    window.localStorage.setItem(storageKey, selected)
    return selected
  } catch {
    return variants[0] ?? 'A'
  }
}

/**
 * Lightweight Core Web Vitals-style performance tracking.
 * Uses PerformanceObserver to sample LCP, FID, and CLS and sends a single
 * aggregated sample per page load.
 */
export function initWebVitalsTracking(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return
  }

  // Avoid duplicate initialization
  if ((window as any).__uxWebVitalsInitialized) return
  ;(window as any).__uxWebVitalsInitialized = true

  let lcp: number | undefined
  let fid: number | undefined
  let cls = 0

  try {
    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      const lastEntry = entries[entries.length - 1] as any
      if (lastEntry && typeof lastEntry.startTime === 'number') {
        lcp = lastEntry.startTime
      }
    })
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true } as any)

    // Cumulative Layout Shift
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as any) {
        if (!entry.hadRecentInput && typeof entry.value === 'number') {
          cls += entry.value
        }
      }
    })
    clsObserver.observe({ type: 'layout-shift', buffered: true } as any)

    // First Input Delay
    const fidObserver = new PerformanceObserver((entryList) => {
      const firstInput = entryList.getEntries()[0] as any
      if (firstInput) {
        fid = firstInput.processingStart - firstInput.startTime
      }
    })
    fidObserver.observe({ type: 'first-input', buffered: true } as any)

    const sendSample = () => {
      // Send a single sample per page
      trackConversionEvent({
        event: 'web_vitals_sample',
        metadata: {
          path: window.location.pathname,
          lcp,
          fid,
          cls,
          timeOrigin: performance.timeOrigin,
        },
      })

      lcpObserver.disconnect()
      clsObserver.disconnect()
      fidObserver.disconnect()
    }

    // Prefer pagehide (covers bfcache); fallback to beforeunload
    window.addEventListener('pagehide', sendSample, { once: true })
    window.addEventListener('beforeunload', sendSample, { once: true })
  } catch {
    // If any of the observers fail, skip performance tracking silently
  }
}


