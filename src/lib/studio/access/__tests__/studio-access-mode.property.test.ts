/**
 * **Validates: Requirements 2.3, 2.4, 2.8, 10.3**
 */

import fc from 'fast-check'
import { decideStudioAccess } from '@/lib/studio/access/studio-access-decision'
import { parseStudioAccessMode } from '@/lib/studio/access/studio-access-mode'

const accessModeVariants = [
  'admin-only',
  ' ADMIN-ONLY ',
  '\tAdmin-Only\n',
  'beta',
  ' BETA ',
  '\tbEtA\n',
  'open',
  ' OPEN ',
  '\tOpEn\n',
]

const rawModeArbitrary = fc.oneof(
  fc.string(),
  fc.constantFrom(...accessModeVariants),
)

function isEntitlementMode(rawMode: string): boolean {
  const normalizedMode = rawMode.trim().toLowerCase()
  return normalizedMode === 'open' || normalizedMode === 'beta'
}

describe(
  'Feature: studio-controlled-beta-readiness, Property 2: No mode value grants access to an unentitled non-admin',
  () => {
    it('denies an unentitled non-admin for every non-open and non-beta mode while Studio is enabled', () => {
      fc.assert(
        fc.property(rawModeArbitrary, (rawMode) => {
          // Open mode grants without an entitlement, and beta mode is covered
          // by the explicit denial assertion below. Property 2 concerns every
          // other raw value, which must fail closed through the admin-only mode.
          const mode = parseStudioAccessMode(rawMode, undefined)
          const decision = decideStudioAccess({
            mode,
            studioEnabled: true,
            isAdmin: false,
            hasBetaAccess: false,
          })

          if (isEntitlementMode(rawMode)) {
            if (mode === 'open') {
              expect(decision.granted).toBe(true)
            } else {
              expect(decision.granted).toBe(false)
            }
            return
          }

          expect(decision.granted).toBe(false)
        }),
        { numRuns: 100 },
      )
    })
  },
)
