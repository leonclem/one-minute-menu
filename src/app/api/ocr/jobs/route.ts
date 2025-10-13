import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ocrOperations } from '@/lib/database'

// GET /api/ocr/jobs?limit=20 - List recent OCR jobs for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = parseInt(searchParams.get('limit') || '20', 10)
    const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 100 ? limitParam : 20

    const { data, error, count } = await supabase
      .from('menu_extraction_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const jobs = (data || []).map(ocrOperations.transformJob)
    return NextResponse.json({ success: true, data: jobs })
  } catch (err) {
    console.error('Error listing OCR jobs:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


