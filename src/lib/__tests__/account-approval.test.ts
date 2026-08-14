/**
 * @jest-environment node
 */

import { isAccountPendingApproval } from '../account-approval'

describe('isAccountPendingApproval', () => {
  it('is false when approval is not required', () => {
    expect(
      isAccountPendingApproval({
        requireAdminApproval: false,
        isAdmin: false,
        isApproved: false,
      }),
    ).toBe(false)
  })

  it('is true for unapproved non-admins when gating is on', () => {
    expect(
      isAccountPendingApproval({
        requireAdminApproval: true,
        isAdmin: false,
        isApproved: false,
      }),
    ).toBe(true)
  })

  it('is false for admins and approved users', () => {
    expect(
      isAccountPendingApproval({
        requireAdminApproval: true,
        isAdmin: true,
        isApproved: false,
      }),
    ).toBe(false)
    expect(
      isAccountPendingApproval({
        requireAdminApproval: true,
        isAdmin: false,
        isApproved: true,
      }),
    ).toBe(false)
  })
})
