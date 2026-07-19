/**
 * Admin — Studio reference library management (lighting + background).
 */

import { requireAdmin } from '@/lib/auth-utils'
import { StudioStylesClient } from './_components/studio-styles-client'

export const dynamic = 'force-dynamic'

export default async function StudioStylesAdminPage() {
  await requireAdmin()
  return <StudioStylesClient />
}
