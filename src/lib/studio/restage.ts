/**
 * Allow re-applying an already-selected FOH control by nudging the baseline
 * only when the control is already at that value with no pending change.
 */

import {
  ANGLE_VALUES,
  LIGHTING_VALUES,
  type AngleValue,
  type EditorState,
  type SpinValue,
} from '@/lib/photo-control/minimal-schema'

function alternateAngle(value: AngleValue): AngleValue {
  return (ANGLE_VALUES.find((candidate) => candidate !== value) ?? 'top-down') as AngleValue
}

function alternateSpin(value: SpinValue): SpinValue {
  return value === '0' ? 'left-45' : '0'
}

function alternateLighting(value: string, knownKeys?: readonly string[]): string {
  const pool = knownKeys && knownKeys.length > 0 ? knownKeys : LIGHTING_VALUES
  return pool.find((candidate) => candidate !== value) ?? `${value}__restage`
}

function alternateBackgroundStyle(value: string, knownKeys?: readonly string[]): string {
  if (knownKeys && knownKeys.length > 0) {
    const alt = knownKeys.find((candidate) => candidate !== value)
    if (alt) return alt
  }
  // Empty ↔ sentinel so re-clicking the same style still produces a delta.
  return value === '' ? '__restage__' : ''
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
  value: string,
  knownKeys?: readonly string[],
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
        lighting: alternateLighting(value, knownKeys),
      },
    },
  }
}

export function ensureBackgroundRestageBaseline(
  baseline: EditorState,
  current: EditorState,
  value: string,
  knownKeys?: readonly string[],
): EditorState {
  const currentStyle = current.schema.canvas.background_style ?? ''
  const baselineStyle = baseline.schema.canvas.background_style ?? ''
  if (baselineStyle !== value || currentStyle !== value) {
    return baseline
  }
  return {
    ...baseline,
    schema: {
      ...baseline.schema,
      canvas: {
        ...baseline.schema.canvas,
        background_style: alternateBackgroundStyle(value, knownKeys),
      },
    },
  }
}

export function ensureSurfaceRestageBaseline(
  baseline: EditorState,
  current: EditorState,
  value: string,
  knownKeys?: readonly string[],
): EditorState {
  const currentStyle = current.schema.canvas.surface_style ?? ''
  const baselineStyle = baseline.schema.canvas.surface_style ?? ''
  if (baselineStyle !== value || currentStyle !== value) {
    return baseline
  }
  return {
    ...baseline,
    schema: {
      ...baseline.schema,
      canvas: {
        ...baseline.schema.canvas,
        surface_style: alternateBackgroundStyle(value, knownKeys),
      },
    },
  }
}

export function ensureSpinRestageBaseline(
  baseline: EditorState,
  current: EditorState,
  value: string,
): EditorState {
  const currentSpin = current.schema.scene_setup.spin ?? '0'
  const baselineSpin = baseline.schema.scene_setup.spin ?? '0'
  if (baselineSpin !== value || currentSpin !== value) {
    return baseline
  }
  return {
    ...baseline,
    schema: {
      ...baseline.schema,
      scene_setup: {
        ...baseline.schema.scene_setup,
        spin: alternateSpin(value as SpinValue),
      },
    },
  }
}
