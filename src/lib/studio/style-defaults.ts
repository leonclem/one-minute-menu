/**
 * Resolve backdrop and surface style keys for re-shoot defaults.
 */

import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import type { ExtractionDiagnostics } from '@/lib/studio/extraction-diagnostics'
import { DEFAULT_STUDIO_BACKDROP_KEY, normalizeBackdropKey } from '@/lib/studio/backdrop-keys'
import { DEFAULT_STUDIO_LIGHTING_KEY, normalizeLightingKey } from '@/lib/studio/lighting-keys'
import {
  DEFAULT_STUDIO_SURFACE_KEY,
  normalizeSurfaceKey,
  type StudioSurfaceKey,
} from '@/lib/studio/surface-keys'

export interface ReshootStyleKeys {
  lighting: string
  backdrop: string
  surface: string
}

const DEFAULT_BACKDROP = DEFAULT_STUDIO_BACKDROP_KEY

const MATERIAL_KEYWORDS: Array<{ pattern: RegExp; key: StudioSurfaceKey }> = [
  { pattern: /\bconcrete\b/i, key: 'raw-concrete' },
  { pattern: /\bterrazzo\b/i, key: 'terrazzo' },
  { pattern: /\bgranite\b/i, key: 'terrazzo' },
  { pattern: /\bwalnut\b/i, key: 'dark-walnut' },
  { pattern: /\boak\b/i, key: 'natural-oak' },
  { pattern: /\bwood(?:en)?\b/i, key: 'natural-oak' },
  { pattern: /\bmarble\b/i, key: 'white-marble' },
  { pattern: /\blinen\b|\bcloth\b|\bfabric\b|\btablecloth\b/i, key: 'natural-linen' },
  { pattern: /\bslate\b|\bstone\b/i, key: 'dark-stone' },
]

function getPath(root: unknown, path: string): unknown {
  if (typeof root !== 'object' || root === null) return undefined
  let value: unknown = root
  for (const segment of path.split('.')) {
    if (typeof value !== 'object' || value === null || !(segment in value)) return undefined
    value = (value as Record<string, unknown>)[segment]
  }
  return value
}

function keywordMatch(material: string | undefined, kind: 'backdrop' | 'surface'): string | null {
  if (!material || kind !== 'surface') return null
  for (const { pattern, key } of MATERIAL_KEYWORDS) {
    if (pattern.test(material)) return key
  }
  return null
}

function observedMaterial(
  diagnostics: ExtractionDiagnostics | null | undefined,
  path: 'backdrop.material' | 'surface.material',
): string | undefined {
  const value = getPath(diagnostics?.observations, path)
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function resolveReshootStyleDefaults(
  schema: MinimalSchema,
  diagnostics?: ExtractionDiagnostics | null,
): ReshootStyleKeys {
  const lighting = normalizeLightingKey(schema.scene_setup.lighting || DEFAULT_STUDIO_LIGHTING_KEY)

  const backdropFromState = normalizeBackdropKey(schema.canvas.background_style?.trim())
  const backdrop = backdropFromState || DEFAULT_BACKDROP

  const surfaceFromState = normalizeSurfaceKey(schema.canvas.surface_style?.trim())
  const surfaceFromObserved = keywordMatch(
    observedMaterial(diagnostics, 'surface.material'),
    'surface',
  )
  const surface = surfaceFromState || surfaceFromObserved || DEFAULT_STUDIO_SURFACE_KEY

  return { lighting, backdrop, surface }
}
