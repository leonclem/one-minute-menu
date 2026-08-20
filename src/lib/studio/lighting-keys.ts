/**
 * Studio lighting style keys, labels, and legacy migration map.
 */

export const STUDIO_LIGHTING_KEYS = [
  'bright-clean',
  'bold-sunlight',
  'soft-natural',
  'golden-hour',
  'dark-moody',
] as const

export type StudioLightingKey = (typeof STUDIO_LIGHTING_KEYS)[number]

/** Default when extraction omits lighting or persisted state is invalid. */
export const DEFAULT_STUDIO_LIGHTING_KEY: StudioLightingKey = 'bright-clean'

const LIGHTING_FOH_LABELS: Record<StudioLightingKey, string> = {
  'bright-clean': 'Bright & Clean',
  'soft-natural': 'Soft Natural',
  'golden-hour': 'Golden Hour',
  'dark-moody': 'Dark & Moody',
  'bold-sunlight': 'Bold Sunlight',
}

/** Maps retired v1 keys to their v2 replacements for persisted editor state. */
export const LEGACY_LIGHTING_KEY_MAP: Record<string, StudioLightingKey> = {
  studio: 'bright-clean',
  'bright-and-airy': 'soft-natural',
  'low-key': 'dark-moody',
}

export function isStudioLightingKey(value: string): value is StudioLightingKey {
  return (STUDIO_LIGHTING_KEYS as readonly string[]).includes(value)
}

export function normalizeLightingKey(value: string | undefined | null): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return DEFAULT_STUDIO_LIGHTING_KEY
  if (isStudioLightingKey(trimmed)) return trimmed
  const mapped = LEGACY_LIGHTING_KEY_MAP[trimmed]
  if (mapped) return mapped
  return trimmed
}

export function fohLightingLabel(value: string, fallback?: string): string {
  if (isStudioLightingKey(value)) return LIGHTING_FOH_LABELS[value]
  const mapped = LEGACY_LIGHTING_KEY_MAP[value]
  if (mapped) return LIGHTING_FOH_LABELS[mapped]
  return fallback ?? value
}

export const STUDIO_LIGHTING_OPTION_ORDER: readonly StudioLightingKey[] = STUDIO_LIGHTING_KEYS
