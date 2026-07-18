/**
 * Deploy-time product-mode switches for the Photo Studio pivot.
 *
 * These are env-var flags (NEXT_PUBLIC_*) so they are readable in both server
 * and client components. Defaults preserve legacy menu-builder behaviour when
 * vars are unset — see docs/pivot/BUILD_PLAN_CHUNK_01.md.
 */

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
 * Whether primary nav should show the Studio link.
 * Shown when the Photo Studio feature flag is enabled.
 */
export function shouldShowStudioNav(): boolean {
  return isPhotoStudioEnabled()
}
