/**
 * @jest-environment node
 */

import {
  ensureAngleRestageBaseline,
  ensureBackgroundRestageBaseline,
  ensureSurfaceRestageBaseline,
  ensureLightingRestageBaseline,
} from '../restage'
import { CENTER, type EditorState } from '@/lib/photo-control/minimal-schema'

function state(
  angle: EditorState['schema']['scene_setup']['angle'],
  lighting: EditorState['schema']['scene_setup']['lighting'],
  backgroundStyle = '',
  surfaceStyle = '',
): EditorState {
  return {
    schema: {
      scene_setup: { angle, framing: 'close-up', lighting },
      canvas: { background: '', background_style: backgroundStyle, surface_style: surfaceStyle, main_vessel: '' },
      food_components: { main_item: 'x', garnishes: [], sides: [] },
    },
    position: { ...CENTER },
  }
}

describe('restage', () => {
  it('nudges baseline when re-applying the same angle', () => {
    const current = state('45-degree', 'bright-and-airy')
    const nextBaseline = ensureAngleRestageBaseline(current, current, '45-degree')
    expect(nextBaseline.schema.scene_setup.angle).not.toBe('45-degree')
  })

  it('does not nudge when switching to a different angle', () => {
    const baseline = state('45-degree', 'bright-and-airy')
    const current = state('top-down', 'bright-and-airy')
    const nextBaseline = ensureAngleRestageBaseline(baseline, current, '45-degree')
    expect(nextBaseline.schema.scene_setup.angle).toBe('45-degree')
  })

  it('nudges lighting baseline on re-apply', () => {
    const current = state('45-degree', 'low-key')
    const nextBaseline = ensureLightingRestageBaseline(current, current, 'low-key')
    expect(nextBaseline.schema.scene_setup.lighting).not.toBe('low-key')
  })

  it('nudges background baseline on re-apply', () => {
    const current = state('45-degree', 'bright-and-airy', 'dark-slate')
    const nextBaseline = ensureBackgroundRestageBaseline(
      current,
      current,
      'dark-slate',
      ['dark-slate', 'clean-white-studio'],
    )
    expect(nextBaseline.schema.canvas.background_style).not.toBe('dark-slate')
  })

  it('nudges surface baseline on re-apply', () => {
    const current = state('45-degree', 'bright-and-airy', '', 'granite-light')
    const nextBaseline = ensureSurfaceRestageBaseline(
      current,
      current,
      'granite-light',
      ['granite-light', 'marble-light'],
    )
    expect(nextBaseline.schema.canvas.surface_style).not.toBe('granite-light')
  })
})
