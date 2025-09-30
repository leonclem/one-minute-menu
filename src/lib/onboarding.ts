import type { Menu } from '@/types'

export interface OnboardingStepState {
  hasMenu: boolean
  hasImage: boolean
  hasItems: boolean
  isPublished: boolean
}

export interface OnboardingStatus extends OnboardingStepState {
  /** 0-100 integer percent */
  completionPercent: number
  /** The menu we consider the primary working menu for onboarding */
  primaryMenuId?: string
}

/**
 * Compute onboarding status from the user's menus.
 * We consider the most recently updated menu as the primary working menu
 * unless any menu is already published, in which case we mark complete.
 */
export function computeOnboardingStatus(menus: Menu[] | any[] | null | undefined): OnboardingStatus {
  const list = Array.isArray(menus) ? menus : []
  const hasMenu = list.length > 0

  const isPublishedMenu = (m: any) => m?.status === 'published'
  const getImageUrl = (m: any): string | undefined => m?.imageUrl || m?.image_url
  const getItemsLength = (m: any): number => (m?.items?.length || 0)
  const getUpdatedTime = (m: any): number => {
    const val = m?.updatedAt || m?.updated_at
    if (!val) return 0
    if (val instanceof Date) return val.getTime()
    const t = new Date(val as any).getTime()
    return Number.isFinite(t) ? t : 0
  }

  const published = list.find(isPublishedMenu)
  if (published) {
    return {
      hasMenu: true,
      hasImage: !!getImageUrl(published),
      hasItems: getItemsLength(published) > 0,
      isPublished: true,
      completionPercent: 100,
      primaryMenuId: published.id,
    }
  }

  // Choose primary by latest updated time if present, else first
  const primary = list.slice().sort((a, b) => getUpdatedTime(b) - getUpdatedTime(a))[0]

  const hasImage = !!getImageUrl(primary)
  const hasItems = getItemsLength(primary) > 0
  const isPublished = false

  // Weighting: menu 25, image 25, items 30, publish 20
  let pct = 0
  if (hasMenu) pct += 25
  if (hasImage) pct += 25
  if (hasItems) pct += 30
  if (isPublished) pct += 20
  const completionPercent = Math.min(100, Math.max(0, Math.round(pct)))

  return {
    hasMenu,
    hasImage,
    hasItems,
    isPublished,
    completionPercent,
    primaryMenuId: primary?.id,
  }
}


