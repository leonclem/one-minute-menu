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
    })
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
