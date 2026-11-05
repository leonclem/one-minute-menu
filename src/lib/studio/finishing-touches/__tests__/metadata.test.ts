/**
 * @jest-environment node
 */

import { parseFinishingTouchesMetadata } from '../metadata'

describe('parseFinishingTouchesMetadata', () => {
  it('accepts a valid blob and rejects extra or invalid fields', () => {
    expect(
      parseFinishingTouchesMetadata({
        stackIds: ['coriander', 'lime_wedge'],
        level: 2,
        auto: true,
      }),
    ).toEqual({
      stackIds: ['coriander', 'lime_wedge'],
      level: 2,
      auto: true,
      amount: 'small',
    })
    expect(
      parseFinishingTouchesMetadata({
        stackIds: ['coriander'],
        level: 1,
        auto: true,
        amount: 'high',
      }),
    ).toEqual({
      stackIds: ['coriander'],
      level: 1,
      auto: true,
      amount: 'high',
    })
    expect(
      parseFinishingTouchesMetadata({
        stackIds: ['coriander'],
        level: 1,
        auto: true,
        amount: 'huge',
      }),
    ).toBeUndefined()
    expect(parseFinishingTouchesMetadata({ level: 2, auto: true })).toBeUndefined()
    expect(
      parseFinishingTouchesMetadata({
        stackIds: ['coriander'],
        level: 9,
        auto: true,
      }),
    ).toBeUndefined()
  })
})
