import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DatabaseError, menuOperations } from '@/lib/database'

// POST /api/menus/[menuId]/payment - Upload PayNow QR or update payment settings
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

    const contentType = request.headers.get('content-type') || ''
    const requiredDisclaimer = 'Payment handled by your bank app; platform does not process funds'

    // If multipart/form-data, treat as image upload for PayNow QR
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('qr') as File
      if (!file) {
        return NextResponse.json({ error: 'No QR image provided' }, { status: 400 })
      }
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Invalid file type. Only JPEG and PNG are allowed.' }, { status: 400 })
      }
      if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large. Max 8MB.' }, { status: 400 })
      }

      // Store in same public bucket for MVP; prefix with userId/payment-
      const filename = `${user.id}/payment-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(filename, file, { cacheControl: '3600', upsert: false })
      if (uploadError) {
        return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 400 })
      }
      const { data: pub } = supabase.storage.from('menu-images').getPublicUrl(filename)
      const payNowQR = pub.publicUrl

      // For MVP, skip QR content decoding; mark as not validated
      const paymentInfo = { payNowQR, disclaimer: requiredDisclaimer, validated: false }
      const updated = await menuOperations.updateMenu(params.menuId, user.id, { paymentInfo })
      return NextResponse.json({ success: true, data: updated })
    }

    // Otherwise expect JSON for settings update
    const body = await request.json().catch(() => ({})) as {
      instructions?: string
      alternativePayments?: string[]
      payNowQR?: string
      validated?: boolean
      disclaimer?: string
    }

    const paymentInfo = {
      payNowQR: body.payNowQR,
      instructions: body.instructions,
      alternativePayments: Array.isArray(body.alternativePayments) ? body.alternativePayments.filter(Boolean) : undefined,
      disclaimer: body.disclaimer && body.disclaimer.trim().length > 0 ? body.disclaimer : requiredDisclaimer,
      validated: body.validated === true
    }

    const updated = await menuOperations.updateMenu(params.menuId, user.id, { paymentInfo })
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating payment info:', error)
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/menus/[menuId]/payment - Clear payment info
export async function DELETE(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const updated = await menuOperations.updateMenu(params.menuId, user.id, { paymentInfo: undefined })
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error clearing payment info:', error)
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


