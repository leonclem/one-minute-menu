/** Shared, side-effect-free validation for admin beta-access requests. */

export const STUDIO_BETA_ACCESS_NOTE_MAX_LENGTH = 280

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type BetaAccessAction = 'grant' | 'revoke'

export type BetaAccessRequest = {
  userId: string
  action: BetaAccessAction
  note?: string | null
}

export type BetaAccessValidationError =
  | 'INVALID_USER_ID'
  | 'INVALID_ACTION'
  | 'NOTE_TOO_LONG'

export type NormalizedBetaAccessRequest = {
  userId: string
  action: BetaAccessAction
  note: string | null
}

export type BetaAccessValidationResult =
  | { ok: true; value: NormalizedBetaAccessRequest }
  | { ok: false; code: BetaAccessValidationError }

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/**
 * Validate and normalize an admin beta-access request without throwing.
 * Validation order is stable so routes can expose deterministic error codes.
 */
export function validateBetaAccessRequest(input: unknown): BetaAccessValidationResult {
  const body = (input ?? {}) as Partial<BetaAccessRequest>

  if (!isUuid(body.userId)) {
    return { ok: false, code: 'INVALID_USER_ID' }
  }

  if (body.action !== 'grant' && body.action !== 'revoke') {
    return { ok: false, code: 'INVALID_ACTION' }
  }

  let note: string | null = null
  if (typeof body.note === 'string') {
    const trimmed = body.note.trim()
    if (trimmed.length > STUDIO_BETA_ACCESS_NOTE_MAX_LENGTH) {
      return { ok: false, code: 'NOTE_TOO_LONG' }
    }
    note = trimmed || null
  } else if (body.note !== undefined && body.note !== null) {
    return { ok: false, code: 'NOTE_TOO_LONG' }
  }

  return {
    ok: true,
    value: { userId: body.userId, action: body.action, note },
  }
}
