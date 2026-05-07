import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GenerationJobRow = {
  id: string
  batch_id: string | null
  menu_id: string | null
  menu_item_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  number_of_variations: number
  result_count: number | null
  error_message: string | null
  error_code: string | null
  retry_count: number
  created_at: string
  started_at: string | null
  completed_at: string | null
}

type CutoutStatus = 'not_requested' | 'pending' | 'processing' | 'succeeded' | 'failed' | 'timed_out'

type GeneratedImageRow = {
  id: string
  menu_item_id: string
  desktop_url: string | null
  cutout_url: string | null
  cutout_status: CutoutStatus | null
  selected: boolean | null
  created_at: string
}

function getJobSummary(job: GenerationJobRow) {
  return {
    id: job.id,
    batchId: job.batch_id,
    menuId: job.menu_id,
    menuItemId: job.menu_item_id,
    status: job.status,
    numberOfVariations: job.number_of_variations,
    resultCount: job.result_count || 0,
    errorMessage: job.error_message,
    errorCode: job.error_code,
    retryCount: job.retry_count,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  }
}

function groupJobsByMenuItem<T extends { menuItemId: string }>(jobs: T[]) {
  return jobs.reduce<Record<string, T[]>>((acc, job) => {
    if (!acc[job.menuItemId]) acc[job.menuItemId] = []
    acc[job.menuItemId].push(job)
    return acc
  }, {})
}

function getImageSummary(image: GeneratedImageRow) {
  return {
    id: image.id,
    menuItemId: image.menu_item_id,
    desktopUrl: image.desktop_url,
    cutoutUrl: image.cutout_url,
    cutoutStatus: image.cutout_status ?? 'not_requested',
    selected: !!image.selected,
    createdAt: image.created_at,
  }
}

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

    const { menuId } = params
    if (!menuId) {
      return NextResponse.json(
        { error: 'Menu ID is required', code: 'MENU_ID_REQUIRED' },
        { status: 400 }
      )
    }

    const { data: menuRow, error: menuError } = await supabase
      .from('menus')
      .select('id')
      .eq('id', menuId)
      .eq('user_id', user.id)
      .single()

    if (menuError || !menuRow) {
      return NextResponse.json({ error: 'Menu not found or unauthorized' }, { status: 404 })
    }

    const url = new URL(request.url)
    const includeRecent = url.searchParams.get('includeRecent') !== 'false'
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 200), 1), 500)
    const recentHours = Math.min(Math.max(Number(url.searchParams.get('recentHours') || 24), 1), 168)
    const recentSince = new Date(Date.now() - recentHours * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('image_generation_jobs')
      .select(`
        id,
        batch_id,
        menu_id,
        menu_item_id,
        status,
        number_of_variations,
        result_count,
        error_message,
        error_code,
        retry_count,
        created_at,
        started_at,
        completed_at
      `)
      .eq('user_id', user.id)
      .eq('menu_id', menuId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (includeRecent) {
      query = query.gte('created_at', recentSince)
    } else {
      query = query.in('status', ['queued', 'processing'])
    }

    const { data: jobs, error: jobsError } = await query
    if (jobsError) {
      logger.error('[Image Generation Status] Failed to fetch jobs:', jobsError)
      return NextResponse.json(
        { error: 'Failed to fetch image generation status', code: 'STATUS_FETCH_FAILED' },
        { status: 500 }
      )
    }

    const summaries = ((jobs || []) as GenerationJobRow[]).map(getJobSummary)
    const activeJobs = summaries.filter(job => job.status === 'queued' || job.status === 'processing')
    const failedJobs = summaries.filter(job => job.status === 'failed')
    const recentCompletedJobs = summaries.filter(job => job.status === 'completed')
    const jobsByItem = groupJobsByMenuItem(summaries)
    const activeByItem = groupJobsByMenuItem(activeJobs)
    const failedByItem = groupJobsByMenuItem(failedJobs)
    const recentCompletedByItem = groupJobsByMenuItem(recentCompletedJobs)

    const latestByItem = Object.fromEntries(
      Object.entries(jobsByItem).map(([itemId, itemJobs]) => [itemId, itemJobs[0]])
    )

    const { data: menuItems, error: menuItemsError } = await supabase
      .from('menu_items')
      .select('id')
      .eq('menu_id', menuId)

    if (menuItemsError) {
      logger.error('[Image Generation Status] Failed to fetch menu items:', menuItemsError)
      return NextResponse.json(
        { error: 'Failed to fetch image generation status', code: 'STATUS_FETCH_FAILED' },
        { status: 500 }
      )
    }

    const menuItemIds = (menuItems || []).map(item => item.id).filter(Boolean)
    let imageSummaries: ReturnType<typeof getImageSummary>[] = []
    if (menuItemIds.length > 0) {
      const { data: images, error: imagesError } = await supabase
        .from('ai_generated_images')
        .select('id, menu_item_id, desktop_url, cutout_url, cutout_status, selected, created_at')
        .in('menu_item_id', menuItemIds)
        .order('selected', { ascending: false })
        .order('created_at', { ascending: false })

      if (imagesError) {
        logger.error('[Image Generation Status] Failed to fetch generated images:', imagesError)
        return NextResponse.json(
          { error: 'Failed to fetch image generation status', code: 'STATUS_FETCH_FAILED' },
          { status: 500 }
        )
      }

      imageSummaries = ((images || []) as GeneratedImageRow[]).map(getImageSummary)
    }

    const imageByItem = Object.fromEntries(
      Object.entries(
        imageSummaries.reduce<Record<string, typeof imageSummaries>>((acc, image) => {
          if (!acc[image.menuItemId]) acc[image.menuItemId] = []
          acc[image.menuItemId].push(image)
          return acc
        }, {})
      ).map(([itemId, itemImages]) => [
        itemId,
        itemImages.find(image => image.selected) ?? itemImages[0],
      ])
    )
    const activeCutoutImages = imageSummaries.filter(image =>
      image.cutoutStatus === 'pending' || image.cutoutStatus === 'processing'
    )

    const response = NextResponse.json({
      success: true,
      data: {
        menuId,
        hasActiveJobs: activeJobs.length > 0,
        activeCount: activeJobs.length,
        hasActiveCutouts: activeCutoutImages.length > 0,
        activeCutoutCount: activeCutoutImages.length,
        jobs: summaries,
        activeJobs,
        failedJobs,
        recentCompletedJobs,
        jobsByItem,
        activeByItem,
        failedByItem,
        recentCompletedByItem,
        latestByItem,
        images: imageSummaries,
        imageByItem,
        activeCutoutImages,
      },
    })

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error) {
    logger.error('[Image Generation Status] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch image generation status', code: 'STATUS_FETCH_FAILED' },
      { status: 500 }
    )
  }
}
