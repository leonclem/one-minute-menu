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
            from: 'bright-and-airy',
            to: 'low-key',
          },
          {
            path: 'scene_setup.angle',
            from: '45-degree',
            to: 'top-down',
          },
        ],
      }),
    )
    expect(chips).toEqual(['Lighting → Moody', 'Rotation → Overhead'])
  })

  it('builds chips for background style with label map', () => {
    const chips = buildChangeSummary(
      emptyDelta({
        scalarChanges: [
          {
            path: 'canvas.background_style',
            from: '',
            to: 'dark-slate',
          },
        ],
      }),
      { backgroundLabels: { 'dark-slate': 'Dark Slate' } },
    )
    expect(chips).toEqual(['Background → Dark Slate'])
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
    expect(readChangeSummary({ changeSummary: ['Lighting → Studio'] })).toEqual([
      'Lighting → Studio',
    ])
    expect(readChangeSummary({})).toEqual([])
  })
})
