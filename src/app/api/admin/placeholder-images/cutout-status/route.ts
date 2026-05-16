import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'

/**
 * GET /api/admin/placeholder-images/cutout-status?imageId=xxx
 *
 * Check the cutout generation status for a specific ai_generated_images row.
 * Used during the post-generation poll to wait for the cutout before copying.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { supabase } = admin
  const imageId = request.nextUrl.searchParams.get('imageId')

  if (!imageId) {
    return NextResponse.json({ error: 'imageId is required' }, { status: 400 })
  }

  const { data: image, error } = await supabase
    .from('ai_generated_images')
    .select('cutout_url, cutout_status')
    .eq('id', imageId)
    .maybeSingle()

  if (error || !image) {
    return NextResponse.json({
      success: true,
      data: { status: 'unknown', cutoutUrl: null },
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      status: image.cutout_status || 'not_requested',
      cutoutUrl: image.cutout_url || null,
    },
  })
}
