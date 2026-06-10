/**
 * Photo Control — Admin Page Shell
 *
 * Server component that enforces admin access via `requireAdmin()` and renders
 * the client-side editor orchestrator.
 *
 * Requirements: 13.4
 */

import { requireAdmin } from '@/lib/auth-utils'
import { PhotoControlClient } from './_components/photo-control-client'

export const dynamic = 'force-dynamic'

export default async function PhotoControlPage() {
  await requireAdmin()

  return <PhotoControlClient />
}
