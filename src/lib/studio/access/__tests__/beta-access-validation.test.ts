/**
 * @jest-environment node
 */

import {
  validateBetaAccessRequest,
  STUDIO_BETA_ACCESS_NOTE_MAX_LENGTH,
} from '../beta-access-validation'

const userId = '123e4567-e89b-12d3-a456-426614174000'

describe('validateBetaAccessRequest', () => {
  it('accepts grant and normalizes the note', () => {
    expect(validateBetaAccessRequest({ userId, action: 'grant', note: '  invite  ' })).toEqual({
      ok: true,
      value: { userId, action: 'grant', note: 'invite' },
    })
  })

  it('accepts revoke without a note', () => {
    expect(validateBetaAccessRequest({ userId, action: 'revoke' })).toEqual({
      ok: true,
      value: { userId, action: 'revoke', note: null },
    })
  })

  it.each([
    [undefined, 'INVALID_USER_ID'],
    ['', 'INVALID_USER_ID'],
    ['not-a-uuid', 'INVALID_USER_ID'],
    [{}, 'INVALID_USER_ID'],
  ])('rejects invalid userId (%p) with %s', (invalidUserId, code) => {
    expect(validateBetaAccessRequest({ userId: invalidUserId, action: 'grant' })).toEqual({
      ok: false,
      code,
    })
  })

  it('rejects an invalid action after a valid userId', () => {
    expect(validateBetaAccessRequest({ userId, action: 'delete' })).toEqual({
      ok: false,
      code: 'INVALID_ACTION',
    })
  })

  it('rejects a note longer than 280 characters after trimming', () => {
    const note = `  ${'a'.repeat(STUDIO_BETA_ACCESS_NOTE_MAX_LENGTH + 1)}  `
    expect(validateBetaAccessRequest({ userId, action: 'grant', note })).toEqual({
      ok: false,
      code: 'NOTE_TOO_LONG',
    })
  })

  it('accepts a trimmed note at exactly the limit and treats blank notes as absent', () => {
    const note = `  ${'a'.repeat(STUDIO_BETA_ACCESS_NOTE_MAX_LENGTH)}  `
    expect(validateBetaAccessRequest({ userId, action: 'revoke', note })).toEqual({
      ok: true,
      value: { userId, action: 'revoke', note: 'a'.repeat(280) },
    })
    expect(validateBetaAccessRequest({ userId, action: 'grant', note: '  ' })).toEqual({
      ok: true,
      value: { userId, action: 'grant', note: null },
    })
  })

  it('does not throw for arbitrary input', () => {
    expect(() => validateBetaAccessRequest(null)).not.toThrow()
    expect(() => validateBetaAccessRequest({ userId, action: 'grant', note: 42 })).not.toThrow()
  })
})
