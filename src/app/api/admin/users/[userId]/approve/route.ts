import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/database'
import { requireAdmin } from '@/lib/auth-utils'
import { sendUserApprovalNotification } from '@/lib/notifications'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { getFeatureFlag } from '@/lib/feature-flags'

// PATCH /api/admin/users/[userId]/approve - Approve a user
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await requireAdmin()
    
    const { userId } = params
    const adminSupabase = createAdminSupabaseClient()
    
    // Update profile using Admin client to bypass RLS
    const updatedProfile = await userOperations.updateProfile(userId, {
      isApproved: true
    }, adminSupabase)
    
    // Only send approval email if admin approval is actually required —
    // if approval is disabled, the user already has access and the email would confuse them
    const requireAdminApproval = await getFeatureFlag('require_admin_approval')
    if (requireAdminApproval) {
      await sendUserApprovalNotification(updatedProfile)
    } else {
      console.log(`[admin-users] Skipping approval email for ${updatedProfile.email} — approval not required`)
    }
    
    return NextResponse.json({
      success: true,
      data: updatedProfile
    })
    
  } catch (error) {
    console.error(`[admin-users] Approve error for ${params.userId}:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
