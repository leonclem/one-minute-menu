import { NextRequest, NextResponse } from 'next/server'
import { userOperations } from '@/lib/database'
import { requireAdmin } from '@/lib/auth-utils'
import { sendUserApprovalNotification } from '@/lib/notifications'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

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
    
    // Send notification to user
    await sendUserApprovalNotification(updatedProfile)
    
    return NextResponse.json({
      success: true,
      data: updatedProfile
    })
    
  } catch (error) {
    console.error(`[admin-users] Approve error for ${params.userId}:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
