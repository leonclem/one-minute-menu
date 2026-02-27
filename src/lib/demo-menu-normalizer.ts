import type { Menu, VenueInfo } from '@/types'

/**
 * Normalise demo menu metadata for the current product experience.
 *
 * This lets us evolve demo contact/social details over time without
 * breaking older stored demo menus in sessionStorage.
 */
type LegacyDemoMenu = Menu & {
  /**
   * Legacy metadata shape used by older demo menus.
   * Some stored demo menus may still have venue info nested here.
   */
  metadata?: {
    venueInfo?: VenueInfo
  }
}

export function normalizeDemoMenu(menu: LegacyDemoMenu | null | undefined): Menu | null | undefined {
  if (!menu) return menu

  // Only touch anonymous demo menus
  if (menu.userId !== 'demo-user' && !`${menu.id ?? ''}`.startsWith('demo-')) {
    return menu
  }

  // Merge legacy metadata.venueInfo.socialMedia with the current top-level venueInfo.socialMedia
  const legacyMetadata = menu.metadata ?? {}
  const legacyVenueInfo: VenueInfo = legacyMetadata.venueInfo ?? {}
  const legacySocial = { ...(legacyVenueInfo.socialMedia ?? {}) }

  const currentVenueInfo: VenueInfo = menu.venueInfo ?? {}
  const currentSocial = { ...(currentVenueInfo.socialMedia ?? {}) }

  const social: NonNullable<VenueInfo['socialMedia']> = {
    ...(legacySocial as any),
    ...(currentSocial as any),
  }

  // Hide legacy Instagram handle used in early demos
  if (social.instagram === '@gridmenu_demo') {
    delete social.instagram
  }

  // Use current public handles by default if legacy placeholders are present
  if (!social.facebook || social.facebook === 'gridmenu.demo') {
    social.facebook = 'facebook.com/gridmenu'
  }

  if (!social.x || social.x === '@gridmenu_demo') {
    social.x = '@gridmenu'
  }

  if (!social.website) {
    social.website = 'https://gridmenu.ai'
  }

  const mergedVenueInfo: VenueInfo = {
    ...legacyVenueInfo,
    ...currentVenueInfo,
    socialMedia: social,
  }

  return {
    ...menu,
    venueInfo: mergedVenueInfo,
  }
}

