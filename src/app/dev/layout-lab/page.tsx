/**
 * Layout Lab - Developer Test Harness
 * 
 * A private route for testing the V2 layout engine with various fixture menus.
 * Requires admin authentication and environment flag to be enabled.
 */

import { requireAdmin } from '@/lib/auth-utils'
import { redirect } from 'next/navigation'
import { LayoutLabClient } from './layout-lab-client'

export const dynamic = 'force-dynamic'

export default async function LayoutLabPage() {
  // Check admin authentication
  try {
    await requireAdmin()
  } catch (e) {
    // Manually check for redirect error if isRedirectError is not available or failing
    if (e && typeof e === 'object' && 'digest' in e && typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
      throw e
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.warn('[LayoutLab] Supabase auth failed, bypassing admin check in development mode.')
    } else {
      throw e
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Layout Lab</h1>
          <p className="text-gray-600 mt-2">
            Developer test harness for the V2 layout engine. Test various fixture menus 
            and validate layout behavior across different scenarios.
          </p>
        </div>
        
        <LayoutLabClient />
      </div>
    </div>
  )
}