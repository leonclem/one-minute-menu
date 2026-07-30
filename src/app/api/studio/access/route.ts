import { NextResponse } from 'next/server'
import { requireUserApi } from '@/lib/user-api-auth'
import { resolveStudioAccess } from '@/lib/studio/access/studio-access'
import { isAdminUser } from '@/lib/studio/studio-api-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireUserApi()

  if (!auth.ok) {
    return auth.response
  }

  const isAdmin = await isAdminUser(auth.supabase, auth.user.id)
  const decision = await resolveStudioAccess({
    userId: auth.user.id,
    isAdmin,
  })

  return NextResponse.json({
    success: true,
    granted: decision.granted,
    reason: decision.reason,
  })
}
