import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { applyExtractionToMenu } from '@/lib/extraction/menu-integration'
import type { ExtractionResultType as Stage1ExtractionResult } from '@/lib/extraction/schema-stage1'
import type { ExtractionResultV2Type as Stage2ExtractionResult } from '@/lib/extraction/schema-stage2'

type ExtractionResult = Stage1ExtractionResult | Stage2ExtractionResult

interface ApplyExtractionBody {
  result: ExtractionResult
  schemaVersion: 'stage1' | 'stage2'
  promptVersion?: string
  jobId?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: ApplyExtractionBody
    try {
      body = (await request.json()) as ApplyExtractionBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body?.result || !body?.schemaVersion) {
      return NextResponse.json(
        { error: 'result and schemaVersion are required' },
        { status: 400 }
      )
    }

    const menu = await applyExtractionToMenu(
      params.menuId,
      user.id,
      body.result,
      body.schemaVersion,
      body.promptVersion || 'unknown',
      body.jobId
    )

    return NextResponse.json({ success: true, data: menu })
  } catch (error) {
    console.error('Error applying extraction to menu:', error)
    return NextResponse.json(
      { error: 'Failed to apply extraction to menu' },
      { status: 500 }
    )
  }
}


