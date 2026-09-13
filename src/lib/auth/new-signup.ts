/**
 * Helpers for the Google Ads / PostHog signup conversion flag.
 *
 * Magic-link signup creates the Auth user when the email is submitted, often
 * minutes before the user clicks the link. `created_at` is therefore a poor
 * "just signed up" signal. `profiles.last_login_at` is stamped only after a
 * successful `/auth/callback` exchange, so a missing stamp means first verified
 * login — the conversion we want to fire.
 */

export function isFirstVerifiedLogin(
  lastLoginAt: Date | string | null | undefined,
): boolean {
  if (lastLoginAt == null) return true
  if (typeof lastLoginAt === 'string' && lastLoginAt.trim() === '') return true
  return false
}

/**
 * Preserve or add `?new_signup=true` on an app-relative path (and any existing
 * query string). No-op when `enabled` is false.
 */
export function withNewSignupQuery(path: string, enabled: boolean): string {
  if (!enabled) return path
  const url = new URL(path, 'https://placeholder.local')
  url.searchParams.set('new_signup', 'true')
  return `${url.pathname}${url.search}`
}
