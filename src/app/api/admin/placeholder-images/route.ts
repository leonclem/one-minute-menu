import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import imageLibrary from '@/data/placeholder-menus/image-library.json'
import itemMatrix from '@/data/placeholder-menus/item-matrix.json'
import type { PlaceholderImageEntry, PlaceholderMenuSet, PlaceholderItem } from '@/data/placeholder-menus/types'

const STORAGE_BUCKET = 'menu-images'
const STORAGE_PREFIX = 'placeholder-items'

const library = imageLibrary as PlaceholderImageEntry[]
const matrix = itemMatrix as Record<string, PlaceholderMenuSet>

/**
 * Build a lookup from suggestedImageKey → representative item details
 * sourced from the Item Matrix (not the Image Library's generation_prompt).
 */
function buildItemDetailsLookup(): Record<string, {
  itemName: string
  description: string
  category: string
  cuisine: string
  establishmentType: string
}> {
  const lookup: Record<string, {
    itemName: string
    description: string
    category: string
    cuisine: string
    establishmentType: string
  }> = {}

  for (const [, menuSet] of Object.entries(matrix)) {
    for (const cat of menuSet.categories) {
      for (const item of cat.items) {
        if (item.suggestedImageKey && !lookup[item.suggestedImageKey]) {
          lookup[item.suggestedImageKey] = {
            itemName: item.name,
            description: item.description,
            category: cat.name,
            cuisine: menuSet.cuisineId,
            establishmentType: menuSet.establishmentTypeId,
          }
        }
      }
    }
  }
  return lookup
}

const itemDetailsLookup = buildItemDetailsLookup()

/**
 * GET /api/admin/placeholder-images
 *
 * Returns the full image library with status of which photos/cutouts exist in storage.
 */
export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const supabase = createServerSupabaseClient()

  // List all files in the placeholder-items prefix
  const { data: files, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(STORAGE_PREFIX, { limit: 1000 })

  // Build a set of existing directories (image keys)
  const existingDirs = new Set<string>()
  if (files && !error) {
    for (const f of files) {
      existingDirs.add(f.name)
    }
  }

  // For each directory, check which files exist
  const statusMap: Record<string, { hasPhoto: boolean; hasCutout: boolean; photoUrl?: string; cutoutUrl?: string }> = {}

  // Batch-check all image keys
  const checkPromises = library.map(async (entry) => {
    const key = entry.suggested_image_key
    const dirPath = `${STORAGE_PREFIX}/${key}`

    const { data: dirFiles } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(dirPath, { limit: 10 })

    const fileNames = new Set((dirFiles ?? []).map(f => f.name))
    const hasPhoto = fileNames.has('photo.webp')
    const hasCutout = fileNames.has('cutout.webp')

    let photoUrl: string | undefined
    let cutoutUrl: string | undefined
    if (hasPhoto) {
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(`${dirPath}/photo.webp`)
      photoUrl = data.publicUrl
    }
    if (hasCutout) {
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(`${dirPath}/cutout.webp`)
      cutoutUrl = data.publicUrl
    }

    statusMap[key] = { hasPhoto, hasCutout, photoUrl, cutoutUrl }
  })

  await Promise.all(checkPromises)

  const entries = library.map(entry => {
    const details = itemDetailsLookup[entry.suggested_image_key]
    return {
      ...entry,
      itemDetails: details ?? null,
      status: statusMap[entry.suggested_image_key] ?? { hasPhoto: false, hasCutout: false },
    }
  })

  const summary = {
    total: library.length,
    withPhoto: entries.filter(e => e.status.hasPhoto).length,
    withCutout: entries.filter(e => e.status.hasCutout).length,
    missing: entries.filter(e => !e.status.hasPhoto).length,
  }

  return NextResponse.json({ success: true, data: { entries, summary } })
}
