import { NextResponse } from 'next/server'

// POST /api/menus/[menuId]/ocr - Deprecated endpoint
export async function POST() {
  return NextResponse.json(
    {
      error: 'OCR endpoint has been deprecated. Use /api/extraction/submit instead.',
      code: 'OCR_DEPRECATED',
      next: {
        href: '/api/extraction/submit',
        method: 'POST',
        body: {
          imageUrl: 'https://...'
        }
      }
    },
    { status: 410 }
  )
}

