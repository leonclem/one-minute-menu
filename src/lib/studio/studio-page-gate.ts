import type { StudioAccessReason } from './access/studio-access-decision'

export type StudioPageGate = 'disabled' | 'waitlist' | 'pending_invite' | 'editor'

/**
 * Decide what /studio should render. Account waitlist wins so unapproved
 * signups never reach the editor. Access-mode denials show a pending invite
 * instead of a 404.
 */
export function decideStudioPageGate(input: {
  accessGranted: boolean
  accessReason: StudioAccessReason
  pendingAccountApproval: boolean
}): StudioPageGate {
  if (input.pendingAccountApproval) return 'waitlist'
  if (input.accessReason === 'denied_studio_disabled') return 'disabled'
  if (!input.accessGranted) return 'pending_invite'
  return 'editor'
}
