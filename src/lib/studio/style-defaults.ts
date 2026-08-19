/**
 * Resolve backdrop and surface style keys for re-shoot defaults.
 */

import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import type { ExtractionDiagnostics } from '@/lib/studio/extraction-diagnostics'

export interface ReshootStyleKeys {
  lighting: string
  backdrop: string
  surface: string
}

const DEFAULT_BACKDROP = 'studio-grey-white'
const DEFAULT_SURFACE = 'white-tablecloth'

const MATERIAL_KEYWORDS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /\bslate\b/i, key: 'dark-slate' },
  { pattern: /\bwood(?:en)?\b/i, key: 'rustic-wood' },
  { pattern: /\bmarble\b/i, key: 'marble-light' },
  { pattern: /\bgranite\b/i, key: 'granite-light' },
  { pattern: /\bcloth\b/i, key: 'white-tablecloth' },
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
  if (!material) return null
  for (const { pattern, key } of MATERIAL_KEYWORDS) {
    if (pattern.test(material)) {
      if (kind === 'backdrop' && key === 'white-tablecloth') continue
      if (kind === 'surface' && key === 'dark-slate' && /\bslate\b/i.test(material)) return key
      return key
    }
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
  const lighting = schema.scene_setup.lighting || 'bright-and-airy'

  const backdropFromState = schema.canvas.background_style?.trim()
  const backdropFromObserved = keywordMatch(
    observedMaterial(diagnostics, 'backdrop.material'),
    'backdrop',
  )
  const backdrop = backdropFromState || backdropFromObserved || DEFAULT_BACKDROP

  const surfaceFromState = schema.canvas.surface_style?.trim()
  const surfaceFromObserved = keywordMatch(
    observedMaterial(diagnostics, 'surface.material'),
    'surface',
  )
  const surface = surfaceFromState || surfaceFromObserved || DEFAULT_SURFACE

  return { lighting, backdrop, surface }
}
