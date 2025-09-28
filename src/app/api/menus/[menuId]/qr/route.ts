import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError } from '@/lib/database'
import { buildPublicMenuUrl, generateQrPng } from '@/lib/qr'
export const runtime = 'nodejs'

// GET /api/menus/[menuId]/qr?format=png|pdf&size=512
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

    const menu = await menuOperations.getMenu(params.menuId, user.id)
    if (!menu) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Build public URL: /u/:userId/:slug
    // Use robust origin detection: prefer env override, then request.nextUrl.origin, then host/proto headers
    const envOrigin = (process.env.NEXT_PUBLIC_APP_ORIGIN || '').trim()
    const derivedOrigin = envOrigin || (request as any).nextUrl?.origin || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`
    const origin = derivedOrigin.replace(/\/$/, '')
    const targetUrl = buildPublicMenuUrl(origin, menu.userId, menu.slug)

    const { searchParams } = new URL(request.url)
    const format = (searchParams.get('format') || 'png').toLowerCase()
    const size = Math.min(Math.max(parseInt(searchParams.get('size') || '512', 10) || 512, 128), 2048)

    if (format === 'png') {
      const pngBuffer = await generateQrPng(targetUrl, size)
      return new NextResponse(pngBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    if (format === 'pdf') {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
      const pngBuffer = await generateQrPng(targetUrl, size)
      const pdfDoc = await PDFDocument.create()
      const page = pdfDoc.addPage([595.28, 841.89]) // A4 in points
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const qrImage = await pdfDoc.embedPng(pngBuffer)

      const qrSide = Math.min(300, size)
      const x = (page.getWidth() - qrSide) / 2
      const y = page.getHeight() - 150 - qrSide

      page.drawText(menu.name, { x: 72, y: y + qrSide + 40, size: 18, font, color: rgb(0, 0, 0) })
      page.drawImage(qrImage, { x, y, width: qrSide, height: qrSide })
      page.drawText(targetUrl, { x: 72, y: 72, size: 12, font, color: rgb(0, 0, 1) })

      const pdfBytes = await pdfDoc.save()
      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
  } catch (error: any) {
    console.error('Error generating QR:', error)
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    const dev = process.env.NODE_ENV !== 'production'
    return NextResponse.json({ error: dev ? (error?.message || 'Internal server error') : 'Internal server error' }, { status: 500 })
  }
}


