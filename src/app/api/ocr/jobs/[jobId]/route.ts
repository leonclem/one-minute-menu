import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ocrOperations, DatabaseError } from '@/lib/database'
import { parseMenuWithAI, parseMenuFallback } from '@/lib/ai-parser'

// GET /api/ocr/jobs/[jobId] - Fetch OCR job status
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const job = await ocrOperations.getJob(user.id, params.jobId)
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: job })
  } catch (error) {
    console.error('Error getting OCR job:', error)
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/ocr/jobs/[jobId] - Trigger AI parsing for a completed OCR job
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const job = await ocrOperations.getJob(user.id, params.jobId)
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (job.status !== 'completed' || !job.result?.ocrText) {
      return NextResponse.json({ error: 'OCR text not ready' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({} as any))
    const useAI = body?.useAI !== false // default true
    const currency = body?.currency || 'SGD'

    let items = [] as any[]
    let usage: { input: number; output: number; cost: number } | undefined
    if (useAI) {
      try {
        const ai = await parseMenuWithAI(job.result.ocrText, { currency })
        items = ai.items
        usage = ai.usage
      } catch (e) {
        // Fall back silently to heuristic parser
        items = parseMenuFallback(job.result.ocrText)
      }
    } else {
      items = parseMenuFallback(job.result.ocrText)
    }

    const updated = await ocrOperations.updateJobResult(user.id, job.id, {
      ...job.result,
      extractedItems: items,
      aiParsingUsed: useAI,
      tokenUsage: usage,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error parsing OCR job:', error)
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}