/**
 * @jest-environment node
 */

import { buildChangeSummary, readChangeSummary } from '../change-summary'
import type { StateDelta } from '@/lib/photo-control/minimal-schema'

function emptyDelta(overrides: Partial<StateDelta> = {}): StateDelta {
  return {
    isEmpty: false,
    scalarChanges: [],
    arrays: {
      garnishes: { added: [], removed: [] },
      sides: { added: [], removed: [] },
    },
    ...overrides,
  }
}

describe('change-summary', () => {
  it('builds chips for lighting and rotation', () => {
    const chips = buildChangeSummary(
      emptyDelta({
        scalarChanges: [
          {
            path: 'scene_setup.lighting',
            from: 'soft-natural',
            to: 'dark-moody',
          },
          {
            path: 'scene_setup.angle',
            from: '45-degree',
            to: 'top-down',
          },
        ],
      }),
    )
    expect(chips).toEqual(['Lighting → Dark & Moody', 'Camera Height → Overhead'])
  })

  it('builds chips for background style with label map', () => {
    const chips = buildChangeSummary(
      emptyDelta({
        scalarChanges: [
          {
            path: 'canvas.background_style',
            from: '',
            to: 'soft-neutral',
          },
          {
            path: 'canvas.surface_style',
            from: '',
            to: 'white-marble',
          },
        ],
      }),
      { backgroundLabels: { 'soft-neutral': 'Soft Neutral', 'white-marble': 'White Marble' } },
    )
    expect(chips).toEqual(['Background → Soft Neutral', 'Surface → White Marble'])
  })

  it('builds chips for dish spin', () => {
    const chips = buildChangeSummary(
      emptyDelta({
        scalarChanges: [
          {
            path: 'scene_setup.spin',
            from: '0',
            to: 'left-45',
          },
        ],
      }),
    )
    expect(chips).toEqual(['Dish Spin → Spin Left 45°'])
  })

  it('builds chips for removed garnishes', () => {
    const chips = buildChangeSummary(
      emptyDelta({
        arrays: {
          garnishes: { added: [], removed: ['cilantro'] },
          sides: { added: [], removed: [] },
        },
      }),
    )
    expect(chips).toEqual(['Removed garnish: cilantro'])
  })

  it('returns empty for empty delta', () => {
    expect(buildChangeSummary(emptyDelta({ isEmpty: true }))).toEqual([])
  })

  it('reads changeSummary from metadata', () => {
    expect(readChangeSummary({ changeSummary: ['Lighting → Bright & Clean'] })).toEqual([
      'Lighting → Bright & Clean',
    ])
    expect(readChangeSummary({})).toEqual([])
  })
})
