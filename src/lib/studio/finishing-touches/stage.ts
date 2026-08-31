import type { EditorState, StateDelta } from '@/lib/photo-control/minimal-schema'
import { countEditableChanges } from '@/lib/photo-control/state-delta'
import { applyFinishingTouchesLevel } from './apply-level'
import type { FinishingTouchCatalogueItem } from './catalogue'

export function isFinishingTouchesStaged(
  stack: readonly FinishingTouchCatalogueItem[],
  level: number | null,
): boolean {
  return stack.length > 0 && level != null && level > 0
}

/**
 * Apply the selected dressing level onto a copy of `current` for Generate.
 * `current` itself is left unchanged so Elements can keep showing the extract.
 */
export function editorStateWithFinishingTouches(
  current: EditorState,
  baseline: EditorState,
  stack: readonly FinishingTouchCatalogueItem[],
  level: number | null,
): EditorState {
  if (!isFinishingTouchesStaged(stack, level) || level == null) return current
  return {
    ...current,
    schema: applyFinishingTouchesLevel({
      baseline: baseline.schema,
      current: current.schema,
      stack,
      level,
    }),
  }
}

/**
 * Finishing-touch additions live outside the Elements schema until Generate.
 * Count them as one bundle unless the delta already includes garnish/side adds.
 */
export function countStudioPendingChanges(
  delta: StateDelta,
  finishingStaged: boolean,
): number {
  const base = delta.isEmpty ? 0 : countEditableChanges(delta)
  if (!finishingStaged) return base
  const addsAlreadyCounted =
    delta.arrays.garnishes.added.length > 0 || delta.arrays.sides.added.length > 0
  return addsAlreadyCounted ? base : base + 1
}
