import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations } from '@/lib/database'

// GET /api/debug/menu/[userId]/[slug] - Debug menu lookup
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string; slug: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Check if menu exists in database
    const { data: menuData, error: menuError } = await supabase
      .from('menus')
      .select('*')
      .eq('user_id', params.userId)
      .eq('slug', params.slug)
      .single()
    
    if (menuError) {
      return NextResponse.json({
        error: 'Menu not found in database',
        details: menuError,
        userId: params.userId,
        slug: params.slug
      })
    }
    
    // Try the database operations
    const draft = await menuOperations.getDraftByUserAndSlug(params.userId, params.slug)
    const published = await menuOperations.getLatestPublishedSnapshotByUserAndSlug(params.userId, params.slug)
    
    return NextResponse.json({
      success: true,
      rawMenuData: menuData,
      draftResult: draft ? 'Found' : 'Not found',
      publishedResult: published ? 'Found' : 'Not found',
      menuStatus: menuData.status,
      menuVersion: menuData.current_version
    })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}