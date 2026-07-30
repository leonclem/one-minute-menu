import { trackConversionEvent } from '@/lib/conversion-tracking'
import {
  ANALYTICS_EVENTS,
  captureEvent,
  type AnalyticsProperties,
} from '@/lib/posthog'
import {
  STUDIO_ALLOWED_PROPERTY_KEYS,
  type StudioEventName,
} from './studio-events'

const ALLOWED = new Set<string>(STUDIO_ALLOWED_PROPERTY_KEYS)

export type StudioModelClass = 'nb2' | 'nb-pro' | 'unknown'
export type StudioValidationStatus = 'passed' | 'failed' | 'skipped'

function getAnalyticsCreditCost(model: string | null | undefined): number {
  const normalized = (model ?? '').toLowerCase()
  const fallback = normalized.includes('pro') ? 3 : 1
  const raw = normalized.includes('pro')
    ? process.env.STUDIO_CREDIT_COST_NB_PRO
    : process.env.STUDIO_CREDIT_COST_NB2
  const parsed = raw === undefined || raw === '' ? fallback : Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

/**
 * Purely retain the coarse, scalar properties permitted for Studio analytics.
 * Unknown keys and compound values are deliberately excluded so call sites can
 * pass their local context without making a privacy decision themselves.
 */
export function sanitizeStudioProperties(
  input: Record<string, unknown> | undefined,
): AnalyticsProperties {
  const out: AnalyticsProperties = {}
  if (!input) return out

  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED.has(key) || value === undefined) continue
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = value as AnalyticsProperties[string]
    }
  }

  return out
}

/**
 * Emit a Studio event without allowing analytics failures to affect Studio.
 * Consent, opt-out, environment, and registry checks remain owned by
 * captureEvent().
 */
export function trackStudioEvent(
  event: StudioEventName,
  properties?: Record<string, unknown>,
): void {
  try {
    captureEvent(event, sanitizeStudioProperties(properties))
  } catch {
    // Analytics must never interrupt a user-facing Studio flow.
  }
}

/** Bucket provider-specific model IDs before they reach analytics. */
export function toModelClass(model: string | null | undefined): StudioModelClass {
  const normalized = typeof model === 'string' ? model.trim().toLowerCase() : ''

  if (
    normalized === 'nb-pro' ||
    normalized.includes('gemini-3-pro-image') ||
    normalized.includes('gemini-pro-image')
  ) {
    return 'nb-pro'
  }

  if (
    normalized === 'nb2' ||
    normalized.includes('gemini-3.1-flash-image')
  ) {
    return 'nb2'
  }

  return 'unknown'
}

export interface GenerationCompletedPayloadInput {
  model: string | null | undefined
  validationStatus: StudioValidationStatus
  startedAt: number
  endedAt: number
  balanceAfter: number
  /** Use the already-computed debit when available; otherwise derive it. */
  cost?: number
}

export const STUDIO_CONVERSION_EVENTS = {
  [ANALYTICS_EVENTS.STUDIO_GENERATION_COMPLETED]: 'ux_feedback',
  [ANALYTICS_EVENTS.STUDIO_FEEDBACK_SUBMITTED]: 'demo_completed',
} as const

type StudioConversionEvent = keyof typeof STUDIO_CONVERSION_EVENTS

/** Build the allow-listed payload for a successful generation. */
export function buildGenerationCompletedPayload(
  input: GenerationCompletedPayloadInput,
): AnalyticsProperties {
  const cost = input.cost ?? getAnalyticsCreditCost(input.model)
  const duration = Math.round(input.endedAt - input.startedAt)

  return sanitizeStudioProperties({
    model_class: toModelClass(input.model),
    credit_cost: cost,
    validation_status: input.validationStatus,
    duration_ms: duration,
    outcome: 'success',
    credit_balance_after: input.balanceAfter,
  })
}

/** Alias matching the property-oriented terminology used by call sites. */
export const buildGenerationCompletedProperties = buildGenerationCompletedPayload

function emitConversion(
  event: 'ux_feedback' | 'demo_completed',
  metadata: Record<string, unknown> | undefined,
): void {
  try {
    // trackConversionEvent is fire-and-forget; handle rejected test/custom
    // implementations as well as its own internal error handling.
    void trackConversionEvent({
      event,
      metadata: sanitizeStudioProperties(metadata),
    }).catch(() => undefined)
  } catch {
    // Conversion tracking must never affect Studio UX.
  }
}

/** Emit one of the two Studio events that participate in platform analytics. */
export function trackStudioConversionEvent(
  event: StudioConversionEvent,
  properties?: Record<string, unknown>,
): void {
  try {
    emitConversion(STUDIO_CONVERSION_EVENTS[event], properties)
  } catch {
    // Keep this boundary non-throwing for hostile property objects.
  }
}

/** Emit the generation funnel event and its existing platform conversion. */
export function trackStudioGenerationCompleted(
  input: GenerationCompletedPayloadInput,
): void {
  try {
    const payload = buildGenerationCompletedPayload(input)
    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_COMPLETED, payload)
    trackStudioConversionEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_COMPLETED, payload)
  } catch {
    // Analytics must never interrupt a user-facing Studio flow.
  }
}

/** Emit the feedback funnel event and its existing platform conversion. */
export function trackStudioFeedbackSubmitted(
  properties: Record<string, unknown>,
): void {
  try {
    const payload = sanitizeStudioProperties(properties)
    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_FEEDBACK_SUBMITTED, payload)
    trackStudioConversionEvent(ANALYTICS_EVENTS.STUDIO_FEEDBACK_SUBMITTED, payload)
  } catch {
    // Analytics must never interrupt a user-facing Studio flow.
  }
}

/** Explicit conversion-only helper for callers that already emit the Studio event. */
export function trackStudioGenerationConversion(
  properties?: Record<string, unknown>,
): void {
  trackStudioConversionEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_COMPLETED, properties)
}

export function trackStudioFeedbackConversion(
  properties?: Record<string, unknown>,
): void {
  trackStudioConversionEvent(ANALYTICS_EVENTS.STUDIO_FEEDBACK_SUBMITTED, properties)
}
