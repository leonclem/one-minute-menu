import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, ocrOperations, DatabaseError } from '@/lib/database'
import vision from '@google-cloud/vision'

// POST /api/menus/[menuId]/ocr - Enqueue OCR job for the menu's image
export async function POST(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const menu = await menuOperations.getMenu(params.menuId, user.id)
    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }
    if (!menu.imageUrl) {
      return NextResponse.json({ error: 'No image uploaded for this menu' }, { status: 400 })
    }

    // Accept optional force flag to reprocess
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === '1'
    // Enqueue or reuse job
    const job = await ocrOperations.enqueueJob(user.id, menu.imageUrl, { force })

    // If just queued, start processing inline (dev MVP). In production, move to worker.
    if (job.status === 'queued') {
      try {
        // Mark processing
        const supabase = createServerSupabaseClient()
        await supabase
          .from('ocr_jobs')
          .update({ status: 'processing' })
          .eq('id', job.id)

        const t0 = Date.now()
        // Configure Vision client; GOOGLE_APPLICATION_CREDENTIALS must be set
        const client = new vision.ImageAnnotatorClient()
        // Fetch the image bytes (Vision cannot fetch local http URLs)
        const imgRes = await fetch(menu.imageUrl)
        if (!imgRes.ok) {
          throw new Error(`Failed to fetch image bytes: ${imgRes.status}`)
        }
        const arrayBuffer = await imgRes.arrayBuffer()
        const content = Buffer.from(arrayBuffer)
        // Use documentTextDetection for dense text like menus
        const [result] = await client.documentTextDetection({ image: { content } })
        const ocrText = (result.fullTextAnnotation?.text || '').trim()
        // Fallback if fullTextAnnotation missing
        const fallbackText = (result.textAnnotations && result.textAnnotations.length > 0)
          ? (result.textAnnotations[0]?.description || '').trim()
          : ''
        const finalText = ocrText || fallbackText
        const processingTime = Date.now() - t0

        await supabase
          .from('ocr_jobs')
          .update({ status: 'completed', result: { ocrText: finalText, extractedItems: [], confidence: 0.0, flaggedFields: [], processingTime, aiParsingUsed: false }, processing_time: processingTime })
          .eq('id', job.id)

        const updated = await ocrOperations.getJob(user.id, job.id)
        return NextResponse.json({ success: true, data: updated })
      } catch (processErr: any) {
        console.error('Vision processing error:', processErr)
        const supabase = createServerSupabaseClient()
        await supabase
          .from('ocr_jobs')
          .update({ status: 'failed', error_message: processErr?.message?.toString?.() || 'Processing failed' })
          .eq('id', job.id)
        const failed = await ocrOperations.getJob(user.id, job.id)
        return NextResponse.json({ success: true, data: failed })
      }
    }

    return NextResponse.json({ success: true, data: job })
  } catch (error) {
    console.error('Error enqueueing OCR job:', error)
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

