/**
 * Human-readable change chips for a Studio generation (vs previous working image).
 */

import type { StateDelta } from '@/lib/photo-control/minimal-schema'
import { fohAngleLabel, fohLightingLabel } from '@/lib/studio/control-options'

export function buildChangeSummary(delta: StateDelta): string[] {
  if (delta.isEmpty) return []

  const chips: string[] = []

  for (const change of delta.scalarChanges ?? []) {
    if (change.path === 'scene_setup.lighting') {
      chips.push(`Lighting → ${fohLightingLabel(change.to)}`)
    } else if (change.path === 'scene_setup.angle') {
      chips.push(`Rotation → ${fohAngleLabel(change.to)}`)
    } else if (change.path === 'scene_setup.framing') {
      chips.push(`Framing → ${change.to}`)
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
