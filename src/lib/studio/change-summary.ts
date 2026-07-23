/**
 * Human-readable change chips for a Studio generation (vs previous working image).
 */

import type { StateDelta } from '@/lib/photo-control/minimal-schema'
import { fohAngleLabel, fohLightingLabel } from '@/lib/studio/control-options'

export interface ChangeSummaryLabelMaps {
  lightingLabels?: Record<string, string>
  backgroundLabels?: Record<string, string>
}

export function buildChangeSummary(
  delta: StateDelta,
  labels?: ChangeSummaryLabelMaps,
): string[] {
  if (delta.isEmpty) return []

  const chips: string[] = []

  for (const change of delta.scalarChanges ?? []) {
    if (change.path === 'scene_setup.lighting') {
      const label =
        labels?.lightingLabels?.[change.to] ?? fohLightingLabel(change.to)
      chips.push(`Lighting → ${label}`)
    } else if (change.path === 'scene_setup.angle') {
      chips.push(`Camera Height → ${fohAngleLabel(change.to)}`)
    } else if (change.path === 'scene_setup.spin') {
      const spinLabel = change.to === 'left-45' ? 'Spin Left 45°' : change.to === 'right-45' ? 'Spin Right 45°' : 'Original'
      chips.push(`Dish Spin → ${spinLabel}`)
    } else if (change.path === 'scene_setup.framing') {
      chips.push(`Framing → ${change.to}`)
    } else if (change.path === 'canvas.background_style') {
      const label =
        labels?.backgroundLabels?.[change.to] ??
        (change.to.trim() ? change.to : 'Original')
      chips.push(`Background → ${label}`)
    } else if (change.path === 'canvas.surface_style') {
      const label =
        labels?.backgroundLabels?.[change.to] ??
        (change.to.trim() ? change.to : 'Original')
      chips.push(`Surface → ${label}`)
    }
  }

  const garnishes = delta.arrays?.garnishes
  if (garnishes) {
    for (const name of garnishes.removed) {
      chips.push(`Removed garnish: ${name}`)
    }
    for (const name of garnishes.added) {
      chips.push(`Added garnish: ${name}`)
    }
  }

  const sides = delta.arrays?.sides
  if (sides) {
    for (const name of sides.removed) {
      chips.push(`Removed side: ${name}`)
    }
    for (const name of sides.added) {
      chips.push(`Added side: ${name}`)
    }
  }

  return chips
}

export function readChangeSummary(metadata: Record<string, unknown> | null | undefined): string[] {
  if (!metadata) return []
  const raw = metadata.changeSummary
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === 'string')
}
