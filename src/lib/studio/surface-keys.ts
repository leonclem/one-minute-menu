/**
 * Studio tabletop surface style keys, labels, and legacy migration map.
 */

export const STUDIO_SURFACE_KEYS = [
  'natural-oak',
  'dark-walnut',
  'white-marble',
  'raw-concrete',
  'dark-stone',
  'natural-linen',
  'terrazzo',
] as const

export type StudioSurfaceKey = (typeof STUDIO_SURFACE_KEYS)[number]

/** Default when re-shoot or extraction cannot infer a surface. */
export const DEFAULT_STUDIO_SURFACE_KEY: StudioSurfaceKey = 'natural-oak'

const SURFACE_FOH_LABELS: Record<StudioSurfaceKey, string> = {
  'natural-oak': 'Natural Oak',
  'dark-walnut': 'Dark Walnut',
  'white-marble': 'White Marble',
  'raw-concrete': 'Raw Concrete',
  'dark-stone': 'Dark Stone',
  'natural-linen': 'Natural Linen',
  terrazzo: 'Terrazzo',
}

/** Maps retired v1 surface keys to their v2 replacements for persisted editor state. */
export const LEGACY_SURFACE_KEY_MAP: Record<string, StudioSurfaceKey> = {
  'dark-slate': 'dark-stone',
  'rustic-wood': 'natural-oak',
  'granite-light': 'terrazzo',
  'marble-light': 'white-marble',
  'white-tablecloth': 'natural-linen',
}

export function isStudioSurfaceKey(value: string): value is StudioSurfaceKey {
  return (STUDIO_SURFACE_KEYS as readonly string[]).includes(value)
}

export function normalizeSurfaceKey(value: string | undefined | null): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return ''
  if (isStudioSurfaceKey(trimmed)) return trimmed
  const mapped = LEGACY_SURFACE_KEY_MAP[trimmed]
  if (mapped) return mapped
  return trimmed
}

export function fohSurfaceLabel(value: string, fallback?: string): string {
  if (isStudioSurfaceKey(value)) return SURFACE_FOH_LABELS[value]
  const mapped = LEGACY_SURFACE_KEY_MAP[value]
  if (mapped) return SURFACE_FOH_LABELS[mapped]
  return fallback ?? value
}

export const STUDIO_SURFACE_OPTION_ORDER: readonly StudioSurfaceKey[] = STUDIO_SURFACE_KEYS
