/**
 * Allow re-applying an already-selected FOH control by nudging the baseline
 * only when the control is already at that value with no pending change.
 */

import {
  ANGLE_VALUES,
  LIGHTING_VALUES,
  type AngleValue,
  type EditorState,
  type LightingValue,
} from '@/lib/photo-control/minimal-schema'

function alternateAngle(value: AngleValue): AngleValue {
  return (ANGLE_VALUES.find((candidate) => candidate !== value) ?? 'top-down') as AngleValue
}

function alternateLighting(value: LightingValue): LightingValue {
  return (
    LIGHTING_VALUES.find((candidate) => candidate !== value) ?? 'low-key'
  ) as LightingValue
}

/** Restage only when baseline and current already match `value`. */
export function ensureAngleRestageBaseline(
  baseline: EditorState,
  current: EditorState,
  value: AngleValue,
): EditorState {
  if (
    baseline.schema.scene_setup.angle !== value ||
    current.schema.scene_setup.angle !== value
  ) {
    return baseline
  }
  return {
    ...baseline,
    schema: {
      ...baseline.schema,
      scene_setup: {
        ...baseline.schema.scene_setup,
        angle: alternateAngle(value),
      },
    },
  }
}

export function ensureLightingRestageBaseline(
  baseline: EditorState,
  current: EditorState,
  value: LightingValue,
): EditorState {
  if (
    baseline.schema.scene_setup.lighting !== value ||
    current.schema.scene_setup.lighting !== value
  ) {
    return baseline
  }
  return {
    ...baseline,
    schema: {
      ...baseline.schema,
      scene_setup: {
        ...baseline.schema.scene_setup,
        lighting: alternateLighting(value),
      },
    },
  }
}
