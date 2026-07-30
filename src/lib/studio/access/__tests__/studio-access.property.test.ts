import fc from 'fast-check'
import { hasStudioBetaAccess } from '@/lib/studio/access/beta-access-store'
import { resolveStudioAccess } from '@/lib/studio/access/studio-access'

jest.mock('@/lib/studio/access/beta-access-store', () => ({
  hasStudioBetaAccess: jest.fn(),
}))

const mockedHasStudioBetaAccess = hasStudioBetaAccess as jest.MockedFunction<
  typeof hasStudioBetaAccess
>

const accessModeArbitrary = fc.constantFrom('admin-only', 'beta', 'open')
const userIdArbitrary = fc.uuid()

const originalAccessMode = process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE
const originalStudioEnabled = process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

describe(
  'Feature: studio-controlled-beta-readiness, Property 5: Store failure never widens access',
  () => {
    let consoleErrorSpy: jest.SpyInstance

    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
      mockedHasStudioBetaAccess.mockReset()
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    afterEach(() => {
      consoleErrorSpy.mockRestore()
      restoreEnv('NEXT_PUBLIC_STUDIO_ACCESS_MODE', originalAccessMode)
      restoreEnv('NEXT_PUBLIC_ENABLE_PHOTO_STUDIO', originalStudioEnabled)
    })

    /** **Validates: Requirements 2.11** */
    it('fails closed when the beta-access lookup rejects', async () => {
      await fc.assert(
        fc.asyncProperty(accessModeArbitrary, fc.boolean(), userIdArbitrary, async (mode, isAdmin, userId) => {
          process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE = mode
          jest.clearAllMocks()
          mockedHasStudioBetaAccess.mockImplementation(async () => {
            throw new Error(`lookup failed for ${userId}`)
          })

          const decision = await resolveStudioAccess({ userId, isAdmin })

          if (mode === 'beta' && !isAdmin) {
            expect(decision).toEqual({
              granted: false,
              reason: 'denied_beta_access_required',
            })
            expect(consoleErrorSpy).toHaveBeenCalledWith(
              '[studio-access] beta access lookup failed',
              expect.objectContaining({
                userId,
                error: `lookup failed for ${userId}`,
              }),
            )
            expect(mockedHasStudioBetaAccess).toHaveBeenCalledWith(userId)
            return
          }

          if (isAdmin) {
            expect(decision).toEqual({ granted: true, reason: 'granted_admin' })
          } else if (mode === 'open') {
            expect(decision).toEqual({ granted: true, reason: 'granted_open' })
          } else {
            expect(decision).toEqual({ granted: false, reason: 'denied_admin_only' })
          }

          expect(mockedHasStudioBetaAccess).not.toHaveBeenCalled()
          expect(consoleErrorSpy).not.toHaveBeenCalled()
        }),
        { numRuns: 100 },
      )
    })
  },
)
