import { isPhotoStudioEnabled } from '@/lib/product-mode'
import { resolveStudioAccessMode, type AccessMode } from '@/lib/studio/access/studio-access-mode'

export const GUEST_MAX_DISHES = 1
export const GUEST_MAX_SOURCE_IMAGES = 1
export const GUEST_MAX_CROP_CHILDREN = 3

export const GUEST_AUTH_REQUIRED_CODE = 'GUEST_AUTH_REQUIRED'

export function isGuestStudioPathAllowed(input: {
  studioEnabled: boolean
  accessMode: AccessMode
  requireAdminApproval: boolean
}): boolean {
  return (
    input.studioEnabled &&
    input.accessMode === 'open' &&
    !input.requireAdminApproval
  )
}

export function resolveGuestStudioPathAllowed(requireAdminApproval: boolean): boolean {
  return isGuestStudioPathAllowed({
    studioEnabled: isPhotoStudioEnabled(),
    accessMode: resolveStudioAccessMode(),
    requireAdminApproval,
  })
}

export function isGuestAuthUser(user: { email?: string | null; is_anonymous?: boolean }): boolean {
  if (user.is_anonymous === true) return true
  if (!user.email) return false
  return user.email.startsWith('guest-') && user.email.endsWith('@guest.gridmenu.invalid')
}
