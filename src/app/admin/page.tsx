/**
 * Admin Hub - Central Dashboard
 * 
 * Consolidated admin interface for:
 * - Cost monitoring and controls
 * - Extraction metrics
 * - Platform analytics
 * - User feedback
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 12.1, 12.4, 12.5, 14.1
 */

import { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth-utils'
import { AdminHubClient } from './admin-hub-client'

export const metadata: Metadata = {
  title: 'Admin Hub | QR Menu System',
  description: 'Central admin dashboard for monitoring and management'
}

export const dynamic = 'force-dynamic'

export default async function AdminHubPage() {
  // Require admin access - redirects to /dashboard if not admin
  await requireAdmin()
  
  return <AdminHubClient />
}
