'use client'

import { useEffect } from 'react'
import { trackMenuView } from '@/lib/analytics-client'

interface MenuViewTrackerProps {
  menuId: string
}

/**
 * Client component that tracks menu views using cookieless analytics
 * Uses rotating localStorage identifiers for approximate unique visitor counts
 */
export default function MenuViewTracker({ menuId }: MenuViewTrackerProps) {
  useEffect(() => {
    // Track the view when component mounts
    trackMenuView(menuId)
  }, [menuId])
  
  // This component renders nothing
  return null
}
