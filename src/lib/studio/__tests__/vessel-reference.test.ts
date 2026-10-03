/**
 * @jest-environment node
 */

import { CENTER, type EditorState, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { computeDelta } from '@/lib/photo-control/state-delta'
import { loadStudioVesselReference } from '../vessel-reference'
import { STUDIO_VESSEL_OPTIONS, stagedVesselSwap, studioVesselPromptName } from '../vessels'

function schema(vesselStyle = ''): MinimalSchema {
  return {
    scene_setup: {
      angle: '45-degree',
      framing: 'medium',
      lighting: 'soft-natural',
      spin: '0',
    },
    canvas: {
      background: 'table',
      background_style: '',
      surface_style: '',
      vessel_style: vesselStyle,
      main_vessel: 'white round plate',
    },
    food_components: {
      main_item: 'stew',
      garnishes: [],
      sides: [],
    },
  }
}

describe('studio vessel swap', () => {
  it('loads a PNG for every catalogue vessel', () => {
    expect(STUDIO_VESSEL_OPTIONS).toHaveLength(11)
    for (const option of STUDIO_VESSEL_OPTIONS) {
      const reference = loadStudioVesselReference(option.value)
      expect(reference?.mimeType).toBe('image/png')
      expect(reference?.comment).toContain(option.promptName)
      expect(reference?.data.length).toBeGreaterThan(100)
    }
    expect(loadStudioVesselReference('skillet')).toBeNull()
  })

  it('stages a swap only when the selected key changes', () => {
    expect(stagedVesselSwap(schema(), schema('wooden-board'))?.promptName).toBe(
      'light wooden serving board with a handle',
    )
    expect(stagedVesselSwap(schema('blue-plate'), schema('blue-plate'))).toBeNull()
    expect(studioVesselPromptName('blue-plate')).toBe('speckled blue ceramic plate')
  })

  it('records the vessel key as one editable change', () => {
    const original: EditorState = { schema: schema(), position: { ...CENTER } }
    const target: EditorState = {
      schema: schema('wooden-board'),
      position: { ...CENTER },
    }
    const delta = computeDelta(original, target)
    expect(delta.scalarChanges).toEqual([
      { path: 'canvas.vessel_style', from: '', to: 'wooden-board' },
    ])
  })
})
