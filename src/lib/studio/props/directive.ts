import type { StateDelta } from '@/lib/photo-control/minimal-schema'
import type { StudioProp } from './catalogue'

function scalarChanged(delta: StateDelta, path: string): boolean {
  return delta.scalarChanges.some((change) => change.path === path)
}

/**
 * One addition clause for every staged prop.
 * Descriptions are the model input. No reference image is attached.
 */
export function buildPropsAdditionClause(
  props: readonly StudioProp[],
  delta: StateDelta,
): string {
  if (props.length === 0) return ''

  const lines = props.map(
    (prop) => `- ${prop.label}: ${prop.description} ${prop.placement}`,
  )
  const locks = [
    'These are tabletop props, not garnishes on the food.',
    'Match the existing light and cast a soft contact shadow on the current tabletop.',
    'Do not cover the food.',
    scalarChanged(delta, 'canvas.vessel_style')
      ? 'Do not change the dish, plating, crop, or camera.'
      : 'Do not change the dish, plating, vessel shape, crop, or camera.',
    'Do not add any prop that is not named here.',
  ]
  if (!scalarChanged(delta, 'scene_setup.lighting')) {
    locks.push('Keep the existing lighting unchanged.')
  }
  if (!scalarChanged(delta, 'canvas.surface_style')) {
    locks.push('Keep the existing tabletop surface, its colour, and texture unchanged.')
  }
  if (!scalarChanged(delta, 'canvas.background_style')) {
    locks.push('Keep the existing backdrop unchanged.')
  }

  return `Add only these named props:\n${lines.join('\n')} ${locks.join(' ')}`
}
