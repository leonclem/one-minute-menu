import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { templateOperations, DatabaseError } from '@/lib/database'

// GET /api/templates/export/[id] - Get export job status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const renderId = params.id
    
    // Get render record
    const render = await templateOperations.getRender(renderId, user.id)
    
    if (!render) {
      return NextResponse.json(
        { error: 'Export job not found' },
        { status: 404 }
      )
    }
    
    // Build response based on status
    const response: any = {
      success: true,
      data: {
        jobId: render.id,
        status: render.status,
        format: render.format,
        createdAt: render.createdAt,
        completedAt: render.completedAt,
      }
    }
    
    // Add output URL if completed
    if (render.status === 'completed' && render.outputUrl) {
      response.data.downloadUrl = render.outputUrl
      response.data.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    }
    
    // Add error message if failed
    if (render.status === 'failed' && render.errorMessage) {
      response.data.error = render.errorMessage
    }
    
    // Add metadata if available
    if (render.renderData?.metadata) {
      response.data.metadata = render.renderData.metadata
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Error getting export status:', error)
    
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
