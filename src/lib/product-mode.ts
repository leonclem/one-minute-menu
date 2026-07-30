/**
 * Deploy-time product-mode switches for the Photo Studio pivot.
 *
 * These are env-var flags (NEXT_PUBLIC_*) so they are readable in both server
 * and client components. Defaults preserve legacy menu-builder behaviour when
 * vars are unset — see docs/pivot/BUILD_PLAN_CHUNK_01.md.
 */

import {
  decideStudioAccess,
  type StudioAccessDecision,
  type StudioAccessReason,
} from '@/lib/studio/access/studio-access-decision'
import {
  parseStudioAccessMode,
  resolveStudioAccessMode,
  type AccessMode,
} from '@/lib/studio/access/studio-access-mode'

export {
  decideStudioAccess,
  parseStudioAccessMode,
  resolveStudioAccessMode,
}
export type { AccessMode, StudioAccessDecision, StudioAccessReason }

export type ProductMode = 'menu-builder' | 'photo-studio'

/**
 * Primary product surface. Defaults to `menu-builder` when unset or unrecognised.
 */
export function getProductMode(): ProductMode {
  return process.env.NEXT_PUBLIC_PRODUCT_MODE === 'photo-studio'
    ? 'photo-studio'
    : 'menu-builder'
}

/**
 * Whether the customer-facing Photo Studio surface is enabled.
 * Defaults to false (not yet shipped).
 */
export function isPhotoStudioEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO === 'true'
}

/**
 * Whether legacy menu-builder navigation/entry points should remain visible.
 * Defaults to true when unset.
 */
export function isLegacyMenusEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_LEGACY_MENUS !== 'false'
}

/**
 * Whether primary nav should show menu-builder links (e.g. Dashboard).
 * Hidden only when product mode is photo-studio AND legacy menus are disabled.
 */
export function shouldShowLegacyMenuNav(): boolean {
  return !(getProductMode() === 'photo-studio' && !isLegacyMenusEnabled())
}

/**
 * Whether customer-facing `/studio` is restricted to admins.
 *
 * @deprecated Prefer `resolveStudioAccessMode() === 'admin-only'`.
 * This helper is retained for existing callers and now reports the resolved
 * access mode rather than interpreting the legacy flag directly.
 */
export function isStudioAdminOnly(): boolean {
  return resolveStudioAccessMode() === 'admin-only'
}

/**
 * Whether the signed-in user may open the FOH Photo Studio surface.
 *
 * `hasBetaAccess` defaults to false so callers that do not know the
 * entitlement fail closed for non-admins in beta mode.
 */
export function canAccessPhotoStudio(
  isAdmin: boolean,
  hasBetaAccess = false,
): boolean {
  return decideStudioAccess({
    mode: resolveStudioAccessMode(),
    studioEnabled: isPhotoStudioEnabled(),
    isAdmin,
    hasBetaAccess,
  }).granted
}

/**
 * Whether primary nav should show the Studio link.
 */
export function shouldShowStudioNav(
  isAdmin = false,
  hasBetaAccess = false,
): boolean {
  return canAccessPhotoStudio(isAdmin, hasBetaAccess)
}
