/**
 * @jest-environment node
 */

import { decideStudioPageGate } from '../studio-page-gate'

describe('decideStudioPageGate', () => {
  it('shows waitlist before any studio access decision', () => {
    expect(
      decideStudioPageGate({
        accessGranted: true,
        accessReason: 'granted_open',
        pendingAccountApproval: true,
      }),
    ).toBe('waitlist')
  })

  it('shows disabled when the studio flag is off', () => {
    expect(
      decideStudioPageGate({
        accessGranted: false,
        accessReason: 'denied_studio_disabled',
        pendingAccountApproval: false,
      }),
    ).toBe('disabled')
  })

  it('shows pending invite instead of 404 for admin-only non-admins', () => {
    expect(
      decideStudioPageGate({
        accessGranted: false,
        accessReason: 'denied_admin_only',
        pendingAccountApproval: false,
      }),
    ).toBe('pending_invite')
  })

  it('shows pending invite when beta entitlement is missing', () => {
    expect(
      decideStudioPageGate({
        accessGranted: false,
        accessReason: 'denied_beta_access_required',
        pendingAccountApproval: false,
      }),
    ).toBe('pending_invite')
  })

  it('opens the editor when access is granted', () => {
    expect(
      decideStudioPageGate({
        accessGranted: true,
        accessReason: 'granted_admin',
        pendingAccountApproval: false,
      }),
    ).toBe('editor')
  })
})
