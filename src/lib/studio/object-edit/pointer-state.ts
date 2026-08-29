export type PointerKind = 'mouse' | 'pen' | 'touch'
export type PointerInteractionMode = 'selection' | 'move-placement' | 'pan-zoom'
export type PointerPhase = 'idle' | 'selecting' | 'placing-move' | 'pinch-pan' | 'await-fresh-pointer'

export type ObjectEditPointerState = {
  phase: PointerPhase
  activePointerIds: readonly number[]
  transientPointerId: number | null
}

export type PointerDecision = {
  state: ObjectEditPointerState
  beginSelection?: true
  beginMovePlacement?: true
  beginPanZoom?: true
  discardTransient?: true
}

export const INITIAL_POINTER_STATE: ObjectEditPointerState = Object.freeze({
  phase: 'idle',
  activePointerIds: [],
  transientPointerId: null,
})

function addPointer(ids: readonly number[], pointerId: number): readonly number[] {
  return ids.includes(pointerId) ? ids : [...ids, pointerId]
}

function removePointer(ids: readonly number[], pointerId: number): readonly number[] {
  return ids.filter((id) => id !== pointerId)
}

/**
 * Assigns pointer ownership without mutating editor data. The caller keeps raw
 * samples transiently until pointer-up and only then attempts atomic addition.
 */
export function beginPointer(
  state: ObjectEditPointerState,
  input: {
    pointerId: number
    pointerType: PointerKind
    mode: PointerInteractionMode
    startsInsideImage: boolean
    startsOnMoveGuide: boolean
  },
): PointerDecision {
  const activePointerIds = addPointer(state.activePointerIds, input.pointerId)
  const secondTouch = input.pointerType === 'touch' && activePointerIds.length >= 2
  if (secondTouch) {
    return {
      state: { phase: 'pinch-pan', activePointerIds, transientPointerId: null },
      beginPanZoom: true,
      discardTransient: state.transientPointerId !== null ? true : undefined,
    }
  }

  if (state.phase === 'pinch-pan' || state.phase === 'await-fresh-pointer') {
    return { state: { ...state, activePointerIds } }
  }
  if (state.transientPointerId !== null) {
    return { state: { ...state, activePointerIds } }
  }

  if (input.mode === 'selection') {
    if (!input.startsInsideImage) return { state: { ...state, activePointerIds } }
    return {
      state: { phase: 'selecting', activePointerIds, transientPointerId: input.pointerId },
      beginSelection: true,
    }
  }

  if (input.mode === 'move-placement') {
    if (!input.startsOnMoveGuide) return { state: { ...state, activePointerIds } }
    return {
      state: { phase: 'placing-move', activePointerIds, transientPointerId: input.pointerId },
      beginMovePlacement: true,
    }
  }

  return {
    state: { phase: 'pinch-pan', activePointerIds, transientPointerId: null },
    beginPanZoom: true,
  }
}

export function endPointer(
  state: ObjectEditPointerState,
  pointerId: number,
): ObjectEditPointerState {
  const activePointerIds = removePointer(state.activePointerIds, pointerId)
  if (state.phase === 'pinch-pan') {
    return {
      phase: activePointerIds.length === 0 ? 'idle' : 'await-fresh-pointer',
      activePointerIds,
      transientPointerId: null,
    }
  }
  if (state.phase === 'await-fresh-pointer') {
    return {
      phase: activePointerIds.length === 0 ? 'idle' : 'await-fresh-pointer',
      activePointerIds,
      transientPointerId: null,
    }
  }
  if (state.transientPointerId === pointerId) {
    return { phase: 'idle', activePointerIds, transientPointerId: null }
  }
  return { ...state, activePointerIds }
}

export const cancelPointer = endPointer

export function mayCollectAnnotationSamples(state: ObjectEditPointerState, pointerId: number): boolean {
  return state.phase === 'selecting' && state.transientPointerId === pointerId
}

export function mayPlaceMoveDestination(state: ObjectEditPointerState, pointerId: number): boolean {
  return state.phase === 'placing-move' && state.transientPointerId === pointerId
}
