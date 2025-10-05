// Client-side analytics implementation using rotating localStorage identifiers
// No cookies, no IP addresses, only aggregated counts

/**
 * Generate a rotating visitor identifier that changes daily
 * This provides approximate unique visitor counts without persistent tracking
 */
export function generateRotatingVisitorId(): string {
  const today = new Date().toISOString().split('T')[0]
  const randomSeed = Math.random().toString(36).substring(2, 15)
  return `${today}-${randomSeed}`
}

/**
 * Get or create a visitor identifier from localStorage
 * Identifier rotates daily to prevent long-term tracking
 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return ''
  
  const storageKey = 'qr_menu_visitor_id'
  const storedData = localStorage.getItem(storageKey)
  
  if (storedData) {
    try {
      const { id, date } = JSON.parse(storedData)
      const today = new Date().toISOString().split('T')[0]
      
      // If the stored ID is from today, reuse it
      if (date === today) {
        return id
      }
    } catch (e) {
      // Invalid data, generate new ID
    }
  }
  
  // Generate new ID for today
  const newId = generateRotatingVisitorId()
  const today = new Date().toISOString().split('T')[0]
  
  localStorage.setItem(storageKey, JSON.stringify({ id: newId, date: today }))
  
  return newId
}

/**
 * Track a menu view (client-side)
 * Sends minimal data: menu ID and rotating visitor ID
 */
export async function trackMenuView(menuId: string): Promise<void> {
  try {
    const visitorId = getVisitorId()
    
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menuId,
        visitorId,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (error) {
    // Silently fail - analytics should never break the user experience
    console.error('Analytics tracking failed:', error)
  }
}
