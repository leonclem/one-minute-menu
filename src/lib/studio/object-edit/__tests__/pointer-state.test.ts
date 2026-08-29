import {
  beginPointer,
  endPointer,
  INITIAL_POINTER_STATE,
  mayCollectAnnotationSamples,
  mayPlaceMoveDestination,
} from '../pointer-state'

describe('object-edit pointer arbitration', () => {
  it('reserves an in-bounds primary pointer for transient selection samples', () => {
    const decision = beginPointer(INITIAL_POINTER_STATE, {
      pointerId: 1,
      pointerType: 'touch',
      mode: 'selection',
      startsInsideImage: true,
      startsOnMoveGuide: false,
    })

    expect(decision.beginSelection).toBe(true)
    expect(mayCollectAnnotationSamples(decision.state, 1)).toBe(true)
  })

  it('does not start a selection outside displayed image content', () => {
    const decision = beginPointer(INITIAL_POINTER_STATE, {
      pointerId: 1,
      pointerType: 'mouse',
      mode: 'selection',
      startsInsideImage: false,
      startsOnMoveGuide: false,
    })

    expect(decision.beginSelection).toBeUndefined()
    expect(mayCollectAnnotationSamples(decision.state, 1)).toBe(false)
  })

  it('cancels only the transient interaction when a second touch starts and requires a fresh pointer after pinch', () => {
    const first = beginPointer(INITIAL_POINTER_STATE, {
      pointerId: 1,
      pointerType: 'touch',
      mode: 'selection',
      startsInsideImage: true,
      startsOnMoveGuide: false,
    })
    const pinch = beginPointer(first.state, {
      pointerId: 2,
      pointerType: 'touch',
      mode: 'selection',
      startsInsideImage: true,
      startsOnMoveGuide: false,
    })

    expect(pinch.discardTransient).toBe(true)
    expect(pinch.beginPanZoom).toBe(true)
    expect(mayCollectAnnotationSamples(pinch.state, 1)).toBe(false)

    const oneFingerLeft = endPointer(pinch.state, 2)
    expect(oneFingerLeft.phase).toBe('await-fresh-pointer')
    const complete = endPointer(oneFingerLeft, 1)
    expect(complete).toEqual(INITIAL_POINTER_STATE)
  })

  it('permits Move placement only when the pointer starts on its guide', () => {
    const rejected = beginPointer(INITIAL_POINTER_STATE, {
      pointerId: 1,
      pointerType: 'mouse',
      mode: 'move-placement',
      startsInsideImage: true,
      startsOnMoveGuide: false,
    })
    const accepted = beginPointer(INITIAL_POINTER_STATE, {
      pointerId: 2,
      pointerType: 'mouse',
      mode: 'move-placement',
      startsInsideImage: true,
      startsOnMoveGuide: true,
    })

    expect(mayPlaceMoveDestination(rejected.state, 1)).toBe(false)
    expect(mayPlaceMoveDestination(accepted.state, 2)).toBe(true)
  })
})
