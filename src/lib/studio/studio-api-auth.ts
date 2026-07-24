/**
 * Auth gate for customer-facing `/api/studio/*` routes.
 *
 * When `NEXT_PUBLIC_STUDIO_ADMIN_ONLY` is on (default), requires admin.
 * When off, any authenticated user may call Studio APIs.
 */

import { requireAdminApi } from '@/lib/admin-api-auth'
import { requireUserApi, type RequireUserApiResult } from '@/lib/user-api-auth'
import { isStudioAdminOnly } from '@/lib/product-mode'

export type RequireStudioApiResult = RequireUserApiResult

export async function requireStudioApi(): Promise<RequireStudioApiResult> {
  if (isStudioAdminOnly()) {
    const admin = await requireAdminApi()
    if (!admin.ok) return admin
    return { ok: true, supabase: admin.supabase, user: admin.user }
  }
  return requireUserApi()
}
