import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuVersionOperations, DatabaseError } from '@/lib/database'

// GET /api/menus/[menuId]/versions - Get version history
export async function GET(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const versions = await menuVersionOperations.getVersionHistory(params.menuId, user.id)
    
    return NextResponse.json({
      success: true,
      data: versions
    })
  } catch (error) {
    console.error('Error fetching version history:', error)
    
    if (error instanceof DatabaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}