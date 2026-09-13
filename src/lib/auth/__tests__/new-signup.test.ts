import { isFirstVerifiedLogin, withNewSignupQuery } from '../new-signup'

describe('isFirstVerifiedLogin', () => {
  it('treats a missing stamp as first verified login', () => {
    expect(isFirstVerifiedLogin(undefined)).toBe(true)
    expect(isFirstVerifiedLogin(null)).toBe(true)
    expect(isFirstVerifiedLogin('')).toBe(true)
    expect(isFirstVerifiedLogin('   ')).toBe(true)
  })

  it('treats a previous last_login_at as a returning user', () => {
    expect(isFirstVerifiedLogin(new Date('2026-01-01T00:00:00.000Z'))).toBe(false)
    expect(isFirstVerifiedLogin('2026-01-01T00:00:00.000Z')).toBe(false)
  })
})

describe('withNewSignupQuery', () => {
  it('returns the path unchanged when disabled', () => {
    expect(withNewSignupQuery('/studio', false)).toBe('/studio')
    expect(withNewSignupQuery('/studio?tab=1', false)).toBe('/studio?tab=1')
  })

  it('appends new_signup on a bare path', () => {
    expect(withNewSignupQuery('/studio', true)).toBe('/studio?new_signup=true')
  })

  it('preserves existing query params', () => {
    expect(withNewSignupQuery('/dashboard?next=/menus', true)).toBe(
      '/dashboard?next=%2Fmenus&new_signup=true',
    )
  })
})
