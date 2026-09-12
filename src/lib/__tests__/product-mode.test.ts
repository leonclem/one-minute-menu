/**
 * @jest-environment node
 */

describe('product-mode', () => {
  const ENV_KEYS = [
    'NEXT_PUBLIC_PRODUCT_MODE',
    'NEXT_PUBLIC_ENABLE_PHOTO_STUDIO',
    'NEXT_PUBLIC_ENABLE_LEGACY_MENUS',
    'NEXT_PUBLIC_STUDIO_ADMIN_ONLY',
    'NEXT_PUBLIC_STUDIO_ACCESS_MODE',
    'NEXT_PUBLIC_STUDIO_ENABLE_PRO',
    'NEXT_PUBLIC_STUDIO_ENABLE_VERTICAL_SWITCH',
  ] as const

  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key]
      delete process.env[key]
    }
    jest.resetModules()
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalEnv[key]
      }
    }
  })

  async function loadModule() {
    return import('../product-mode')
  }

  describe('getProductMode', () => {
    it('defaults to menu-builder when unset', async () => {
      const { getProductMode } = await loadModule()
      expect(getProductMode()).toBe('menu-builder')
    })

    it('returns photo-studio when set', async () => {
      process.env.NEXT_PUBLIC_PRODUCT_MODE = 'photo-studio'
      const { getProductMode } = await loadModule()
      expect(getProductMode()).toBe('photo-studio')
    })

    it('falls back to menu-builder for unrecognised values', async () => {
      process.env.NEXT_PUBLIC_PRODUCT_MODE = 'something-else'
      const { getProductMode } = await loadModule()
      expect(getProductMode()).toBe('menu-builder')
    })
  })

  describe('isPhotoStudioEnabled', () => {
    it('defaults to false when unset', async () => {
      const { isPhotoStudioEnabled } = await loadModule()
      expect(isPhotoStudioEnabled()).toBe(false)
    })

    it('returns true only when exactly "true"', async () => {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
      const { isPhotoStudioEnabled } = await loadModule()
      expect(isPhotoStudioEnabled()).toBe(true)
    })

    it('returns false for other truthy-looking values', async () => {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = '1'
      const { isPhotoStudioEnabled } = await loadModule()
      expect(isPhotoStudioEnabled()).toBe(false)
    })
  })

  describe('isLegacyMenusEnabled', () => {
    it('defaults to true when unset', async () => {
      const { isLegacyMenusEnabled } = await loadModule()
      expect(isLegacyMenusEnabled()).toBe(true)
    })

    it('returns false when explicitly "false"', async () => {
      process.env.NEXT_PUBLIC_ENABLE_LEGACY_MENUS = 'false'
      const { isLegacyMenusEnabled } = await loadModule()
      expect(isLegacyMenusEnabled()).toBe(false)
    })

    it('returns true when explicitly "true"', async () => {
      process.env.NEXT_PUBLIC_ENABLE_LEGACY_MENUS = 'true'
      const { isLegacyMenusEnabled } = await loadModule()
      expect(isLegacyMenusEnabled()).toBe(true)
    })
  })

  describe('shouldShowLegacyMenuNav', () => {
    it('shows nav by default (legacy behaviour)', async () => {
      const { shouldShowLegacyMenuNav } = await loadModule()
      expect(shouldShowLegacyMenuNav()).toBe(true)
    })

    it('hides nav only when photo-studio mode and legacy menus disabled', async () => {
      process.env.NEXT_PUBLIC_PRODUCT_MODE = 'photo-studio'
      process.env.NEXT_PUBLIC_ENABLE_LEGACY_MENUS = 'false'
      const { shouldShowLegacyMenuNav } = await loadModule()
      expect(shouldShowLegacyMenuNav()).toBe(false)
    })

    it('still shows nav in photo-studio mode if legacy menus remain enabled', async () => {
      process.env.NEXT_PUBLIC_PRODUCT_MODE = 'photo-studio'
      process.env.NEXT_PUBLIC_ENABLE_LEGACY_MENUS = 'true'
      const { shouldShowLegacyMenuNav } = await loadModule()
      expect(shouldShowLegacyMenuNav()).toBe(true)
    })

    it('still shows nav if legacy menus disabled but mode is still menu-builder', async () => {
      process.env.NEXT_PUBLIC_PRODUCT_MODE = 'menu-builder'
      process.env.NEXT_PUBLIC_ENABLE_LEGACY_MENUS = 'false'
      const { shouldShowLegacyMenuNav } = await loadModule()
      expect(shouldShowLegacyMenuNav()).toBe(true)
    })
  })

  describe('shouldRequireRestaurantOnboarding', () => {
    it('matches legacy menu nav: required by default', async () => {
      const { shouldRequireRestaurantOnboarding } = await loadModule()
      expect(shouldRequireRestaurantOnboarding()).toBe(true)
    })

    it('is skipped when the studio-first public surface is on', async () => {
      process.env.NEXT_PUBLIC_PRODUCT_MODE = 'photo-studio'
      process.env.NEXT_PUBLIC_ENABLE_LEGACY_MENUS = 'false'
      const { shouldRequireRestaurantOnboarding } = await loadModule()
      expect(shouldRequireRestaurantOnboarding()).toBe(false)
    })
  })

  describe('isStudioPublicSurface', () => {
    it('defaults to false when flags are unset', async () => {
      const { isStudioPublicSurface } = await loadModule()
      expect(isStudioPublicSurface()).toBe(false)
    })

    it('is true only when studio mode, legacy menus off, and photo studio enabled', async () => {
      process.env.NEXT_PUBLIC_PRODUCT_MODE = 'photo-studio'
      process.env.NEXT_PUBLIC_ENABLE_LEGACY_MENUS = 'false'
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
      const { isStudioPublicSurface } = await loadModule()
      expect(isStudioPublicSurface()).toBe(true)
    })

    it('stays false if photo studio is still disabled', async () => {
      process.env.NEXT_PUBLIC_PRODUCT_MODE = 'photo-studio'
      process.env.NEXT_PUBLIC_ENABLE_LEGACY_MENUS = 'false'
      const { isStudioPublicSurface } = await loadModule()
      expect(isStudioPublicSurface()).toBe(false)
    })
  })

  describe('getPostLoginPath', () => {
    it('defaults to onboarding when studio is off', async () => {
      const { getPostLoginPath } = await loadModule()
      expect(getPostLoginPath()).toBe('/onboarding')
    })

    it('returns /studio when photo studio is enabled', async () => {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
      const { getPostLoginPath } = await loadModule()
      expect(getPostLoginPath()).toBe('/studio')
    })
  })

  describe('getAuthenticatedHomePath', () => {
    it('defaults to dashboard when studio is off', async () => {
      const { getAuthenticatedHomePath } = await loadModule()
      expect(getAuthenticatedHomePath()).toBe('/dashboard')
    })

    it('returns /studio when photo studio is enabled', async () => {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
      const { getAuthenticatedHomePath } = await loadModule()
      expect(getAuthenticatedHomePath()).toBe('/studio')
    })
  })

  describe('isStudioAdminOnly', () => {
    it('defaults to true when unset', async () => {
      const { isStudioAdminOnly } = await loadModule()
      expect(isStudioAdminOnly()).toBe(true)
    })

    it('returns false only when explicitly "false"', async () => {
      process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY = 'false'
      const { isStudioAdminOnly } = await loadModule()
      expect(isStudioAdminOnly()).toBe(false)
    })

    it('preserves the legacy fallback for every value other than exact "false"', async () => {
      const { isStudioAdminOnly } = await loadModule()

      for (const legacyValue of [undefined, '', 'true', '1', 'FALSE']) {
        if (legacyValue === undefined) {
          delete process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY
        } else {
          process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY = legacyValue
        }
        expect(isStudioAdminOnly()).toBe(true)
      }

      process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY = 'false'
      expect(isStudioAdminOnly()).toBe(false)
    })
  })

  describe('canAccessPhotoStudio', () => {
    it('denies everyone when studio flag is off', async () => {
      const { canAccessPhotoStudio } = await loadModule()
      expect(canAccessPhotoStudio(true)).toBe(false)
      expect(canAccessPhotoStudio(false)).toBe(false)
    })

    it('allows only admins when studio on and admin-only default', async () => {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
      const { canAccessPhotoStudio } = await loadModule()
      expect(canAccessPhotoStudio(true)).toBe(true)
      expect(canAccessPhotoStudio(false)).toBe(false)
    })

    it('denies non-admins when beta access is omitted in beta mode', async () => {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
      process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE = 'beta'
      const { canAccessPhotoStudio } = await loadModule()
      expect(canAccessPhotoStudio(false)).toBe(false)
      expect(canAccessPhotoStudio(false, true)).toBe(true)
    })

    it('grants admins in admin-only, beta, and open modes', async () => {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
      const { canAccessPhotoStudio } = await loadModule()

      for (const mode of ['admin-only', 'beta', 'open'] as const) {
        process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE = mode
        expect(canAccessPhotoStudio(true)).toBe(true)
      }
    })

    it('allows any user when admin-only is disabled', async () => {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
      process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY = 'false'
      const { canAccessPhotoStudio } = await loadModule()
      expect(canAccessPhotoStudio(false)).toBe(true)
      expect(canAccessPhotoStudio(true)).toBe(true)
    })
  })

  describe('shouldShowStudioNav', () => {
    it('hides Studio by default', async () => {
      const { shouldShowStudioNav } = await loadModule()
      expect(shouldShowStudioNav(true)).toBe(false)
    })

    it('hides Studio for non-admins when photo studio is enabled (admin-only default)', async () => {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
      const { shouldShowStudioNav } = await loadModule()
      expect(shouldShowStudioNav(false)).toBe(false)
      expect(shouldShowStudioNav(true)).toBe(true)
    })

    it('denies non-admins when beta access is omitted in beta mode', async () => {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
      process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE = 'beta'
      const { shouldShowStudioNav } = await loadModule()
      expect(shouldShowStudioNav(false)).toBe(false)
      expect(shouldShowStudioNav(false, true)).toBe(true)
    })

    it('preserves results for existing one-argument callers', async () => {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
      const { shouldShowStudioNav } = await loadModule()

      expect(shouldShowStudioNav(false)).toBe(false)
      expect(shouldShowStudioNav(true)).toBe(true)

      process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY = 'false'
      expect(shouldShowStudioNav(false)).toBe(true)
      expect(shouldShowStudioNav(true)).toBe(true)
    })

    it('shows Studio for non-admins when admin-only is off', async () => {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
      process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY = 'false'
      const { shouldShowStudioNav } = await loadModule()
      expect(shouldShowStudioNav(false)).toBe(true)
    })
  })

  describe('isStudioProEnabled', () => {
    it('defaults to false when unset', async () => {
      const { isStudioProEnabled } = await loadModule()
      expect(isStudioProEnabled()).toBe(false)
    })

    it('returns true only when exactly "true"', async () => {
      process.env.NEXT_PUBLIC_STUDIO_ENABLE_PRO = 'true'
      const { isStudioProEnabled } = await loadModule()
      expect(isStudioProEnabled()).toBe(true)
    })
  })

  describe('isStudioVerticalSwitchEnabled', () => {
    it('defaults to false when unset', async () => {
      const { isStudioVerticalSwitchEnabled } = await loadModule()
      expect(isStudioVerticalSwitchEnabled()).toBe(false)
    })

    it('returns true only when exactly "true"', async () => {
      process.env.NEXT_PUBLIC_STUDIO_ENABLE_VERTICAL_SWITCH = 'true'
      const { isStudioVerticalSwitchEnabled } = await loadModule()
      expect(isStudioVerticalSwitchEnabled()).toBe(true)
    })
  })
})
