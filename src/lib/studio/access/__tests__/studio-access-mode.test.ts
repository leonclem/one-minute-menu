import {
  parseStudioAccessMode,
  resolveStudioAccessMode,
} from '@/lib/studio/access/studio-access-mode'

describe('parseStudioAccessMode', () => {
  it.each([
    ['admin-only', 'admin-only'],
    [' ADMIN-ONLY ', 'admin-only'],
    ['Beta', 'beta'],
    ['  bEtA  ', 'beta'],
    ['OPEN', 'open'],
    [' open ', 'open'],
  ] as const)('accepts %j as %s after normalization', (rawMode, expected) => {
    expect(parseStudioAccessMode(rawMode, 'true')).toBe(expected)
  })

  const fallbackRawModes: Array<string | undefined> = [
    undefined,
    '',
    '   ',
    'unsupported',
    ' admin ',
  ]
  const nonFalseLegacyValues: Array<string | undefined> = [
    undefined,
    '',
    'true',
    'TRUE',
    ' false ',
    '0',
  ]

  it.each(
    fallbackRawModes.flatMap((rawMode) =>
      nonFalseLegacyValues.map((rawLegacyAdminOnly) => [rawMode, rawLegacyAdminOnly] as const),
    ),
  )(
    'resolves raw mode %j with legacy value %j to admin-only',
    (rawMode, rawLegacyAdminOnly) => {
      expect(parseStudioAccessMode(rawMode, rawLegacyAdminOnly)).toBe('admin-only')
    },
  )
})

describe('resolveStudioAccessMode', () => {
  const originalMode = process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE
  const originalLegacyAdminOnly = process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE
    } else {
      process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE = originalMode
    }

    if (originalLegacyAdminOnly === undefined) {
      delete process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY
    } else {
      process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY = originalLegacyAdminOnly
    }
  })

  it('resolves to open for the exact legacy false fallback when the new mode is unset', () => {
    delete process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE
    process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY = 'false'

    expect(resolveStudioAccessMode()).toBe('open')
  })
})
