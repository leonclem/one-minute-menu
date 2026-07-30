/**
 * @jest-environment node
 */

import {
  FEEDBACK_COMMENT_MAX,
  validateFeedbackSubmission,
} from '../feedback-validation'

const studioImageId = '123e4567-e89b-12d3-a456-426614174000'

describe('validateFeedbackSubmission', () => {
  /** Validates: Requirements 6.5, 6.8, 6.9, 10.4 */
  it.each([
    ['negative rating', -1],
    ['zero rating', 0],
    ['rating above five', 6],
    ['non-integer rating', 3.5],
    ['NaN rating', Number.NaN],
  ])('rejects %s with FEEDBACK_RATING_OUT_OF_RANGE', (_name, rating) => {
    expect(validateFeedbackSubmission({ studioImageId, rating })).toEqual({
      ok: false,
      code: 'FEEDBACK_RATING_OUT_OF_RANGE',
    })
  })

  it.each([
    ['an unknown tag', ['identity_changed', 'not_a_reason']],
    ['a string value', 'identity_changed'],
    ['an object value', {}],
  ])('rejects %s with FEEDBACK_UNKNOWN_REASON_TAG', (_name, reasonTags) => {
    expect(validateFeedbackSubmission({ studioImageId, reasonTags })).toEqual({
      ok: false,
      code: 'FEEDBACK_UNKNOWN_REASON_TAG',
    })
  })

  it.each([
    ['999 characters after trimming', FEEDBACK_COMMENT_MAX - 1, true],
    ['1000 characters after trimming', FEEDBACK_COMMENT_MAX, true],
    ['1001 characters after trimming', FEEDBACK_COMMENT_MAX + 1, false],
  ])(
    'handles comments with %s',
    (_name, length, accepted) => {
      const comment = `  ${'c'.repeat(length)}  `
      const result = validateFeedbackSubmission({ studioImageId, comment })

      if (accepted) {
        expect(result).toEqual({
          ok: true,
          value: {
            studioImageId,
            rating: null,
            reasonTags: [],
            comment: 'c'.repeat(length),
          },
        })
      } else {
        expect(result).toEqual({
          ok: false,
          code: 'FEEDBACK_COMMENT_TOO_LONG',
        })
      }
    },
  )

  it.each([
    ['image id only', { studioImageId }],
    ['blank comment', { studioImageId, comment: '  \t\n  ' }],
    ['empty tags', { studioImageId, reasonTags: [] }],
  ])('rejects an empty submission with FEEDBACK_EMPTY: %s', (_name, input) => {
    expect(validateFeedbackSubmission(input)).toEqual({
      ok: false,
      code: 'FEEDBACK_EMPTY',
    })
  })

  it.each([
    [
      'rating alone',
      { studioImageId, rating: 4 },
      {
        studioImageId,
        rating: 4,
        reasonTags: [],
        comment: null,
      },
    ],
    [
      'tags alone',
      {
        studioImageId,
        reasonTags: ['style_missed', 'useful_result', 'style_missed'],
      },
      {
        studioImageId,
        rating: null,
        reasonTags: ['style_missed', 'useful_result'],
        comment: null,
      },
    ],
    [
      'comment alone',
      { studioImageId, comment: '  The plating looks useful.  ' },
      {
        studioImageId,
        rating: null,
        reasonTags: [],
        comment: 'The plating looks useful.',
      },
    ],
  ])('accepts and normalizes %s', (_name, input, value) => {
    expect(validateFeedbackSubmission(input)).toEqual({ ok: true, value })
  })
})
