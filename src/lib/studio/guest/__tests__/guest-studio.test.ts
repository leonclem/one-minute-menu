import { CENTER, type EditorState } from '@/lib/photo-control/minimal-schema'
import {
  isGuestAuthUser,
  isGuestStudioPathAllowed,
} from '@/lib/studio/guest/guest-path'
import { readGuestClaimToken } from '@/lib/studio/guest/guest-claim-cookie'
import {
  guestStagedIntentFromMetadata,
  overlayGuestIntentOnExtracted,
  shouldSkipExtractUntilClaimed,
  withClaimedExtract,
  withGuestSkipExtract,
} from '@/lib/studio/guest/guest-editor-intent'

function editorState(overrides?: Partial<EditorState['schema']>): EditorState {
  return {
    schema: {
      scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'bright-clean', spin: '0' },
      canvas: { background: '', background_style: '', surface_style: '', main_vessel: '' },
      food_components: { main_item: '', garnishes: [], sides: [] },
      ...overrides,
    },
    position: { ...CENTER },
  }
}

describe('guest Studio path', () => {
  it('allows guests only when Studio is enabled, open, and approval is off', () => {
    expect(
      isGuestStudioPathAllowed({
        studioEnabled: true,
        accessMode: 'open',
        requireAdminApproval: false,
      }),
    ).toBe(true)
    expect(
      isGuestStudioPathAllowed({
        studioEnabled: true,
        accessMode: 'open',
        requireAdminApproval: true,
      }),
    ).toBe(false)
    expect(
      isGuestStudioPathAllowed({
        studioEnabled: true,
        accessMode: 'beta',
        requireAdminApproval: false,
      }),
    ).toBe(false)
  })

  it('treats anonymous and placeholder emails as guests, not missing emails', () => {
    expect(isGuestAuthUser({ is_anonymous: true })).toBe(true)
    expect(isGuestAuthUser({ email: 'guest-abc@guest.gridmenu.invalid' })).toBe(true)
    expect(isGuestAuthUser({ id: 'customer-1' } as { email?: string })).toBe(false)
    expect(isGuestAuthUser({ email: 'owner@example.com' })).toBe(false)
  })
})

describe('guest claim cookie', () => {
  it('prefers the claim query param over the cookie', () => {
    const params = new URLSearchParams('claim=from-query')
    expect(
      readGuestClaimToken({
        cookieHeader: 'gm_studio_guest_claim=from-cookie',
        searchParams: params,
      }),
    ).toBe('from-query')
    expect(readGuestClaimToken({ cookieHeader: 'gm_studio_guest_claim=from-cookie' })).toBe(
      'from-cookie',
    )
  })
})

describe('guest editor intent', () => {
  const state = editorState({
    scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'golden-hour', spin: '0' },
    canvas: { background: '', background_style: 'dark-wood', surface_style: 'marble', main_vessel: '' },
  })

  it('persists skip-extract and staged treatments, then overlays them after extract', () => {
    const stored = withGuestSkipExtract({}, state)
    expect(shouldSkipExtractUntilClaimed(stored)).toBe(true)
    expect(guestStagedIntentFromMetadata(stored)).toEqual({
      lighting: 'golden-hour',
      background_style: 'dark-wood',
      surface_style: 'marble',
    })

    const extracted = editorState()
    const overlaid = overlayGuestIntentOnExtracted(extracted, guestStagedIntentFromMetadata(stored)!)
    expect(overlaid.schema.scene_setup.lighting).toBe('golden-hour')
    expect(overlaid.schema.canvas.surface_style).toBe('marble')

    const claimed = withClaimedExtract(stored, extracted)
    expect(shouldSkipExtractUntilClaimed(claimed)).toBe(false)
    expect(guestStagedIntentFromMetadata(claimed)?.lighting).toBe('golden-hour')
  })
})
