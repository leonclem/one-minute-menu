import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { imageOperations, DatabaseError } from '@/lib/database'

// POST /api/menus/[menuId]/image - Upload menu image
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

    const formData = await request.formData()
    const file = formData.get('image') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG and PNG are allowed.' },
        { status: 400 }
      )
    }

    const maxSize = 8 * 1024 * 1024 // 8MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 8MB.' },
        { status: 400 }
      )
    }

    // Upload image
    const imageUrl = await imageOperations.uploadMenuImage(user.id, file)
    
    // Update menu with image URL
    const menu = await imageOperations.updateMenuImage(params.menuId, user.id, imageUrl)
    
    return NextResponse.json({
      success: true,
      data: {
        menu,
        imageUrl
      }
    })
    
  } catch (error) {
    console.error('Error uploading menu image:', error)
    
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

// DELETE /api/menus/[menuId]/image - Remove menu image
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

    // Update menu to remove image URL
    const menu = await imageOperations.updateMenuImage(params.menuId, user.id, '')
    
    return NextResponse.json({
      success: true,
      data: menu
    })
    
  } catch (error) {
    console.error('Error removing menu image:', error)
    
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