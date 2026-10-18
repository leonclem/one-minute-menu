import type { StateDelta } from '@/lib/photo-control/minimal-schema'
import type { StudioProp } from './catalogue'

/**
 * Shared restraint for target.props. Descriptions and placement stay on each prop.
 * Lock sentences about lighting, surface, and backdrop are omitted: those axes
 * are either in target themselves, or left alone because they are not named.
 */
export const PROPS_RULE =
  'These are tabletop props, not garnishes on the food. Cast a soft contact shadow on the tabletop. Do not cover the food. Do not add a prop that is not named in target.props.'

/** Pointer only. The catalogue text is already on target.props. */
export function buildPropsAdditionClause(
  props: readonly StudioProp[],
  _delta: StateDelta,
): string {
  if (props.length === 0) return ''
  return 'Add only the props in target.props.'
}
