import { hasAnalyticsConsent } from '@/lib/consent'
import {
  getPostHogHost,
  getPostHogToken,
  getPostHogUiHost,
  isAnalyticsEnabledEnv,
  isDev,
} from './config'

// Module-level state
let initialized = false
let posthogModule: typeof import('posthog-js') | null = null

/**
 * Returns whether PostHog has been successfully initialized on this page load.
 */
export function isPostHogInitialized(): boolean {
  return initialized
}

/**
 * Returns the loaded posthog-js default export, or null if not yet loaded.
 */
export function getPostHog(): import('posthog-js').PostHog | null {
  return posthogModule?.default ?? null
}

/**
 * Initializes PostHog if all gating conditions are met.
 * Idempotent — at most one posthog.init() per page load.
 *
 * Gating order (design §5 step 3):
 * 1. SSR guard
 * 2. Idempotence
 * 3. Token present
 * 4. Enable flag
 * 5. Consent
 * 6. Admin opt-out
 */
export async function initializePostHogIfAllowed(): Promise<void> {
  // 1. SSR guard
  if (typeof window === 'undefined') return

  // 2. Idempotence
  if (initialized) return

  // 3. Token present
  const token = getPostHogToken()
  if (!token) return

  // 4. Enable flag
  if (!isAnalyticsEnabledEnv()) return

  // 5. Consent
  if (!hasAnalyticsConsent()) return

  // 6. Admin opt-out
  if (localStorage.getItem('gridmenu_analytics_disabled') === 'true') return

  try {
    posthogModule = await import('posthog-js')

    const uiHost = getPostHogUiHost()

    posthogModule.default.init(token, {
      defaults: '2026-01-30',
      api_host: getPostHogHost(),
      ...(uiHost ? { ui_host: uiHost } : {}),
      capture_pageview: 'history_change',
      capture_pageleave: true,
      autocapture: true,
      session_recording: {
        maskAllInputs: true,
        maskInputOptions: { password: true, email: true },
        // Only mask text nodes that live inside an element tagged with
        // `data-ph-mask` (e.g. address fields on settings/new-menu, or the
        // admin route subtree via src/app/admin/layout.tsx). GridMenu's UI
        // is public-facing by design, so menu text, labels, and buttons are
        // visible in replays. See docs/ANALYTICS.md.
        maskTextSelector: '[data-ph-mask], [data-ph-mask] *',
      },
      persistence: 'localStorage+cookie',
      loaded: (_ph: unknown) => {
        initialized = true
        // Dynamic import avoids a circular dependency: helper.ts imports from
        // client.ts (isPostHogInitialized, getPostHog), so we cannot statically
        // import helper.ts here. The dynamic import is safe because by the time
        // the `loaded` callback fires, the module graph is fully resolved.
        import('./helper')
          .then((m: { flushPreInitQueue: () => void }) => m.flushPreInitQueue())
          .catch(() => {})
      },
    })
  } catch (error) {
    if (isDev()) {
      console.warn('[PostHog] init failed:', error)
    }
  }
}

/**
 * Calls posthog.opt_out_capturing() only if the SDK module is already loaded.
 * Consent-withdrawal before init stays a pure no-op.
 */
export function posthogOptOutCapturingIfLoaded(): void {
  try {
    if (posthogModule) {
      posthogModule.default.opt_out_capturing()
    }
  } catch {
    /* swallow */
  }
}

/**
 * Calls posthog.opt_in_capturing() only if the SDK module is already loaded.
 */
export function posthogOptInCapturingIfLoaded(): void {
  try {
    if (posthogModule) {
      posthogModule.default.opt_in_capturing()
    }
  } catch {
    /* swallow */
  }
}
