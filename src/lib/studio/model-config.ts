import { logger } from '@/lib/logger'

export const STUDIO_FLASH_MODEL = 'gemini-3.1-flash-image'
export const STUDIO_PRO_MODEL = 'gemini-3-pro-image'

/** Reserved for the structured-output extraction migration in Group B. */
export const STUDIO_EXTRACTION_MODEL = 'gemini-2.5-flash'

export type ReferenceKind =
  | 'total'
  | 'style'
  | 'object'
  | 'character'
  | 'highFidelity'
  | 'high-fidelity'
  | 'high_fidelity'

type CanonicalReferenceKind = 'total' | 'style' | 'object' | 'character' | 'highFidelity'
type ModelFamily = 'pro' | 'flash' | 'legacy'

const MAX_REFS_ENV = 'STUDIO_MAX_REFS'

const REFERENCE_LIMITS: Record<ModelFamily, Record<CanonicalReferenceKind, number>> = {
  pro: { total: 14, style: 3, object: 14, character: 14, highFidelity: 5 },
  flash: { total: 10, style: 0, object: 10, character: 4, highFidelity: 0 },
  legacy: { total: 3, style: 3, object: 3, character: 3, highFidelity: 3 },
}

function normalizeModel(model: string | undefined): string {
  return (model || '').trim().toLowerCase()
}

function modelFamily(model: string | undefined): ModelFamily {
  const normalized = normalizeModel(model)
  if (normalized.includes(STUDIO_PRO_MODEL)) return 'pro'
  if (normalized.includes(STUDIO_FLASH_MODEL)) return 'flash'
  return 'legacy'
}

function canonicalKind(kind: ReferenceKind): CanonicalReferenceKind {
  if (kind === 'high-fidelity' || kind === 'high_fidelity') return 'highFidelity'
  return kind
}

/** Returns the documented model capability before any environment override is applied. */
export function documentedLimit(model: string, kind: ReferenceKind = 'total'): number {
  return REFERENCE_LIMITS[modelFamily(model)][canonicalKind(kind)]
}

/**
 * Backward-compatible aggregate cap for callers that do not know a reference kind.
 * Flash's generic attachments use its documented object-fidelity capacity.
 */
export function referenceLimitForModel(model: string): number {
  return documentedLimit(model)
}

function invalidOverride(raw: string | undefined): number {
  logger.warn('[Studio model config] Invalid STUDIO_MAX_REFS override; using the documented model limit.', {
    requested: raw ?? 'unset',
    applied: 'documented limit',
  })
  return Number.POSITIVE_INFINITY
}

/**
 * Reads the raw cap override. Infinity represents "no valid override", allowing
 * the caller to fall back to the documented limit for its model and reference kind.
 */
export function envMaxRefs(): number {
  const raw = process.env[MAX_REFS_ENV]
  if (raw === undefined || raw.trim() === '') return invalidOverride(raw)

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return invalidOverride(raw)
  }
  return parsed
}

/** Resolves a model/reference-kind cap with the optional override safely clamped. */
export function maxReferencesFor(model: string, kind: ReferenceKind = 'total'): number {
  const documented = documentedLimit(model, kind)
  const requested = envMaxRefs()
  const applied = Math.min(requested, documented)

  if (requested > documented) {
    logger.warn('[Studio model config] STUDIO_MAX_REFS override clamped to the documented reference limit.', {
      requested,
      applied,
      model,
      kind,
    })
  }

  return applied
}

/** Aggregate cap for existing callers while they migrate to per-kind limits. */
export function maxRefsFor(model: string): number {
  return maxReferencesFor(model)
}

/** Flash models accept thinking levels; Pro and unknown models deliberately do not. */
export function modelSupportsThinkingLevel(model: string): boolean {
  const normalized = normalizeModel(model)
  return normalized.includes('flash') && !normalized.includes('pro')
}

export type StudioThinkingLevel = 'minimal' | 'high'

export function configuredThinkingLevel(): StudioThinkingLevel {
  const raw = process.env.STUDIO_THINKING_LEVEL
  if (raw === undefined || raw.trim() === '') return 'high'

  const normalized = raw.trim().toLowerCase()
  if (normalized === 'minimal' || normalized === 'high') return normalized

  logger.warn('[Studio model config] Invalid STUDIO_THINKING_LEVEL; falling back to high.', {
    requested: raw,
    applied: 'high',
  })
  return 'high'
}

export function configuredStudioImageSize(): string {
  const raw = process.env.STUDIO_IMAGE_SIZE
  return raw === undefined || raw.trim() === '' ? '2K' : raw.trim().toUpperCase()
}
