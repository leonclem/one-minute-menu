'use client'

export const DASHBOARD_REFRESH_KEY = 'gridmenu:dashboard:refresh-on-next-load'

export function markDashboardForRefresh(): void {
  try {
    window.sessionStorage.setItem(DASHBOARD_REFRESH_KEY, '1')
  } catch {
    // ignore (storage may be unavailable in some environments)
  }
}

export function consumeDashboardRefreshFlag(): boolean {
  try {
    const shouldRefresh = window.sessionStorage.getItem(DASHBOARD_REFRESH_KEY) === '1'
    if (shouldRefresh) {
      window.sessionStorage.removeItem(DASHBOARD_REFRESH_KEY)
    }
    return shouldRefresh
  } catch {
    return false
  }
}

