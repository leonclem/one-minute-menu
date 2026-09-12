import { CENTER, type EditorState } from '@/lib/photo-control/minimal-schema'
import {
  ANGLED_ANGLE,
  OVERHEAD_ANGLE,
  isOverheadAngle,
  verticalSwitchTarget,
} from '@/lib/photo-control/camera-viewpoint'
import { ensureAngleRestageBaseline } from '@/lib/studio/restage'

export function workingShotHidesBackdrop(
  workingAngle: string,
  backdropKnownFalse: boolean,
): boolean {
  return isOverheadAngle(workingAngle) || backdropKnownFalse
}

export function applyVerticalSwitch(
  current: EditorState,
  baseline: EditorState,
): { nextState: EditorState; nextBaseline: EditorState } {
  const target = verticalSwitchTarget(baseline.schema.scene_setup.angle)
  const nextBaseline = ensureAngleRestageBaseline(baseline, current, target)
  const canvas =
    target === OVERHEAD_ANGLE
      ? {
          ...current.schema.canvas,
          background_style: baseline.schema.canvas.background_style,
        }
      : current.schema.canvas

  return {
    nextBaseline,
    nextState: {
      ...current,
      position: current.position ?? { ...CENTER },
      schema: {
        ...current.schema,
        scene_setup: {
          ...current.schema.scene_setup,
          angle: target,
        },
        canvas,
      },
    },
  }
}

export function verticalSwitchLabel(workingAngle: string): string {
  return isOverheadAngle(workingAngle) ? 'Switch to angled' : 'Switch to overhead'
}

export function cameraHeightLabel(angle: string): string {
  return isOverheadAngle(angle) ? 'Overhead' : 'Angled'
}

export { ANGLED_ANGLE, OVERHEAD_ANGLE, isOverheadAngle, verticalSwitchTarget }
