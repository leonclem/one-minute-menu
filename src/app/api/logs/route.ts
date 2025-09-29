import { NextRequest, NextResponse } from 'next/server'

// Minimal, best-effort logging endpoint. In Phase 6 this can forward to a real sink.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const entry = {
      level: typeof body.level === 'string' ? body.level : 'info',
      message: typeof body.message === 'string' ? body.message : 'client-log',
      stack: typeof body.stack === 'string' ? body.stack : undefined,
      digest: typeof body.digest === 'string' ? body.digest : undefined,
      source: typeof body.source === 'string' ? body.source : 'client',
      ts: new Date().toISOString(),
    }
    // eslint-disable-next-line no-console
    console.log('[client-log]', JSON.stringify(entry))
    return NextResponse.json({ success: true })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to record client log', error)
    return NextResponse.json({ error: 'Failed to record log' }, { status: 400 })
  }
}


