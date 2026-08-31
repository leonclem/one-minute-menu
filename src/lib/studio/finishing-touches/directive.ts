import type { StateDelta } from '@/lib/photo-control/minimal-schema'
import {
  type FinishingTouchPlacement,
  getFinishingTouchByName,
} from './catalogue'

const PLACEMENT_PHRASES: Record<FinishingTouchPlacement, string> = {
  'on-food': 'on the food',
  'on-vessel': 'on or beside the vessel rim, without covering the main dish',
  scene:
    'a few matching pieces lightly scattered on the existing tabletop around the vessel',
}

function quoteList(items: readonly string[]): string {
  const quoted = items.map((item) => `"${item}"`)
  if (quoted.length === 1) return quoted[0]
  if (quoted.length === 2) return `${quoted[0]} and ${quoted[1]}`
  return `${quoted.slice(0, -1).join(', ')}, and ${quoted[quoted.length - 1]}`
}

function placementLine(name: string): string {
  const item = getFinishingTouchByName(name)
  const placements = item?.placements ?? (['on-food', 'scene'] as const)
  const phrases = placements.map((placement) => PLACEMENT_PHRASES[placement])
  return `- ${name}: ${phrases.join('; ')}.`
}

function scalarChanged(delta: StateDelta, path: string): boolean {
  return delta.scalarChanges.some((change) => change.path === path)
}

/**
 * Single bundled addition clause for garnish/side adds.
 * Table scatter is prompt-only. Extra bowls and props are forbidden.
 */
export function buildFinishingTouchesAdditionClause(
  addedItems: readonly string[],
  delta: StateDelta,
): string {
  if (addedItems.length === 0) return ''

  const locks: string[] = [
    'Do not add extra bowls, serving dishes, cutlery, napkins, glasses, ramekins, or unrelated props.',
    'Do not change the dish, plating, vessel shape, crop, or camera.',
    'Place items naturally and irregularly, not in a grid, and keep quantities restrained.',
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

  return (
    `Add only these named finishing touches: ${quoteList(addedItems)}. ` +
    `Place each item as follows:\n${addedItems.map(placementLine).join('\n')} ` +
    locks.join(' ')
  )
}
