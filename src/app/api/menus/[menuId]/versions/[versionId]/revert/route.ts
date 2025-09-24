import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuVersionOperations, DatabaseError } from '@/lib/database'

// POST /api/menus/[menuId]/versions/[versionId]/revert - Revert to version
export async function POST(
  request: NextRequest,
  { params }: { params: { menuId: string; versionId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const menu = await menuVersionOperations.revertToVersion(
      params.menuId, 
      user.id, 
      params.versionId
    )
    
    return NextResponse.json({
      success: true,
      data: menu,
      message: 'Menu reverted successfully'
    })
  } catch (error) {
    console.error('Error reverting menu:', error)
    
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