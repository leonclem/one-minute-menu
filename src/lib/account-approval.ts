/**
 * Account waitlist (profiles.is_approved + require_admin_approval).
 * Independent of Studio beta access.
 */

export function isAccountPendingApproval(input: {
  requireAdminApproval: boolean
  isAdmin: boolean
  isApproved?: boolean | null
}): boolean {
  return Boolean(input.requireAdminApproval && !input.isAdmin && !input.isApproved)
}
