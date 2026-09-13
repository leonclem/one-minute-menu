import { CENTER, type EditorState } from '@/lib/photo-control/minimal-schema'
import {
  YAW_LEFT_90,
  YAW_RIGHT_90,
  isYawSpin,
} from '@/lib/photo-control/camera-viewpoint'
import { ensureSpinRestageBaseline } from '@/lib/studio/restage'
import { cameraHeightLabel } from '@/lib/studio/vertical-switch'

export type YawDirection = 'left' | 'right'

export function yawTarget(direction: YawDirection): typeof YAW_LEFT_90 | typeof YAW_RIGHT_90 {
  return direction === 'left' ? YAW_LEFT_90 : YAW_RIGHT_90
}

export function yawButtonLabel(direction: YawDirection): string {
  return direction === 'left' ? 'Anti-clockwise' : 'Clockwise'
}

export function yawStagingLabel(spin: string): string | null {
  if (spin === YAW_LEFT_90) return 'Anti-clockwise'
  if (spin === YAW_RIGHT_90) return 'Clockwise'
  return null
}

export function cameraSectionLabel(angle: string, spin: string): string {
  const yaw = yawStagingLabel(spin)
  const height = cameraHeightLabel(angle)
  return yaw ? `${height} · ${yaw}` : height
}

/** After a rotate generate, the new photo is the new zero — not a leftover staging key. */
export function clearConsumedYaw(state: EditorState): EditorState {
  const spin = state.schema.scene_setup.spin ?? '0'
  if (!isYawSpin(spin)) return state
  return {
    ...state,
    position: state.position ?? { ...CENTER },
    schema: {
      ...state.schema,
      scene_setup: {
        ...state.schema.scene_setup,
        spin: '0',
      },
    },
  }
}

export function applyYaw(
  current: EditorState,
  baseline: EditorState,
  direction: YawDirection,
): { nextState: EditorState; nextBaseline: EditorState } {
  const target = yawTarget(direction)
  const currentSpin = current.schema.scene_setup.spin ?? '0'
  if (currentSpin === target) {
    return {
      nextBaseline: baseline,
      nextState: {
        ...current,
        position: current.position ?? { ...CENTER },
        schema: {
          ...current.schema,
          scene_setup: {
            ...current.schema.scene_setup,
            spin: baseline.schema.scene_setup.spin ?? '0',
          },
        },
      },
    }
  }

  const nextBaseline = ensureSpinRestageBaseline(baseline, current, target)
  return {
    nextBaseline,
    nextState: {
      ...current,
      position: current.position ?? { ...CENTER },
      schema: {
        ...current.schema,
        scene_setup: {
          ...current.schema.scene_setup,
          spin: target,
        },
      },
    },
  }
}

export { isYawSpin, YAW_LEFT_90, YAW_RIGHT_90 }
