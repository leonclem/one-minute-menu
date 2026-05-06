import { SENSITIVE_KEYS, PERSON_PROPERTY_ALLOWLIST } from './config'

/**
 * Returns a shallow copy of `input` with:
 * - any key whose lowercase form is in SENSITIVE_KEYS removed
 * - any entry whose value is exactly `undefined` removed
 * - `null` values preserved
 * Never mutates the input object.
 */
export function sanitizeProperties(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue
    if (value === undefined) continue
    result[key] = value
  }
  return result
}

/**
 * Returns `false` if `id` contains an '@' character (i.e. looks like an email),
 * otherwise `true`.
 */
export function isDistinctIdSafe(id: string): boolean {
  return !id.includes('@')
}

/**
 * Returns a new object containing only keys that are in PERSON_PROPERTY_ALLOWLIST.
 * Never mutates the input object.
 */
export function sanitizePersonProperties(
  input: Partial<Record<string, unknown>>,
): Partial<Record<string, unknown>> {
  const result: Partial<Record<string, unknown>> = {}
  for (const key of PERSON_PROPERTY_ALLOWLIST) {
    if (key in input) {
      result[key] = input[key]
    }
  }
  return result
}
