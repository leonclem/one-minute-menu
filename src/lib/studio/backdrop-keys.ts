/**
 * Studio backdrop style keys, labels, and legacy migration map.
 */

export const STUDIO_BACKDROP_KEYS = [
  'soft-neutral',
  'warm-sand',
  'sage-green',
  'terracotta',
  'deep-navy',
  'charcoal',
  'mustard-yellow',
  'coral-red',
  'teal',
  'hot-pink',
] as const

export type StudioBackdropKey = (typeof STUDIO_BACKDROP_KEYS)[number]

export const DEFAULT_STUDIO_BACKDROP_KEY: StudioBackdropKey = 'soft-neutral'

const BACKDROP_FOH_LABELS: Record<StudioBackdropKey, string> = {
  'soft-neutral': 'Soft Neutral',
  'warm-sand': 'Warm Sand',
  'sage-green': 'Sage Green',
  terracotta: 'Terracotta',
  'deep-navy': 'Deep Navy',
  charcoal: 'Charcoal',
  'mustard-yellow': 'Mustard Yellow',
  'coral-red': 'Coral Red',
  teal: 'Teal',
  'hot-pink': 'Hot Pink',
}

export const LEGACY_BACKDROP_KEY_MAP: Record<string, StudioBackdropKey> = {
  'studio-grey-white': 'soft-neutral',
  'studio-yellow': 'warm-sand',
  'studio-red': 'terracotta',
  'studio-nightsky': 'deep-navy',
}

export function isStudioBackdropKey(value: string): value is StudioBackdropKey {
  return (STUDIO_BACKDROP_KEYS as readonly string[]).includes(value)
}

export function normalizeBackdropKey(value: string | undefined | null): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return ''
  if (isStudioBackdropKey(trimmed)) return trimmed
  const mapped = LEGACY_BACKDROP_KEY_MAP[trimmed]
  if (mapped) return mapped
  return trimmed
}

export function fohBackdropLabel(value: string, fallback?: string): string {
  if (isStudioBackdropKey(value)) return BACKDROP_FOH_LABELS[value]
  const mapped = LEGACY_BACKDROP_KEY_MAP[value]
  if (mapped) return BACKDROP_FOH_LABELS[mapped]
  return fallback ?? value
}

export const STUDIO_BACKDROP_OPTION_ORDER: readonly StudioBackdropKey[] = STUDIO_BACKDROP_KEYS
