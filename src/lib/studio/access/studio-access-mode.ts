/**
 * The access policy used by the Photo Studio gate.
 */
export type AccessMode = 'admin-only' | 'beta' | 'open'

const ACCESS_MODES: readonly AccessMode[] = ['admin-only', 'beta', 'open']

/**
 * Resolve the Studio access mode without reading from the environment.
 *
 * An explicitly recognised mode wins after surrounding whitespace is removed
 * and casing is normalised. Unset, empty, and unrecognised modes preserve the
 * legacy flag semantics; only the exact legacy value "false" opens Studio.
 */
export function parseStudioAccessMode(
  rawMode: string | undefined,
  rawLegacyAdminOnly: string | undefined,
): AccessMode {
  const normalizedMode = rawMode?.trim().toLowerCase()

  if (ACCESS_MODES.includes(normalizedMode as AccessMode)) {
    return normalizedMode as AccessMode
  }

  return rawLegacyAdminOnly === 'false' ? 'open' : 'admin-only'
}

/**
 * Resolve the configured Studio access mode for the current environment.
 */
export function resolveStudioAccessMode(): AccessMode {
  return parseStudioAccessMode(
    process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE,
    process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY,
  )
}
