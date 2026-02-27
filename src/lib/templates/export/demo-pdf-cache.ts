import { generateSlug } from '@/lib/utils'

/**
 * Demo PDF cache helpers.
 *
 * Goal: avoid regenerating identical demo PDFs over and over.
 * We compute a deterministic cache path from the (normalized) demo menu payload,
 * template selection, and export options.
 *
 * Version history:
 * - 1: Initial cache key (no footer / older footer styles)
 * - 2: Footer rendering updated (venue info + social). Bump to ensure
 *      new PDFs are generated with the latest footer semantics.
 */

const DEMO_PDF_CACHE_VERSION = 2

function stableStringify(value: any): string {
  // Match JSON semantics as closely as possible but with stable object key ordering.
  if (value === null) return 'null'
  const t = typeof value
  if (t === 'number' || t === 'boolean') return JSON.stringify(value)
  if (t === 'string') return JSON.stringify(value)
  if (t === 'bigint') return JSON.stringify(value.toString())
  if (t === 'undefined' || t === 'function' || t === 'symbol') return 'null'

  if (Array.isArray(value)) {
    return `[${value.map(v => stableStringify(v)).join(',')}]`
  }

  if (t === 'object') {
    const obj = value as Record<string, any>
    const keys = Object.keys(obj)
      .filter(k => obj[k] !== undefined)
      .sort()

    const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    return `{${entries.join(',')}}`
  }

  // Fallback (should be unreachable)
  return JSON.stringify(value)
}

function normalizeDemoMenuForCache(menu: any) {
  const items: any[] = Array.isArray(menu?.items) ? menu.items : []

  const normalizedItems = items.map((item, index) => ({
    // Intentionally exclude IDs/timestamps/job IDs that change per session
    name: item?.name ?? null,
    description: item?.description ?? null,
    price: item?.price ?? null,
    category: item?.category ?? null,
    displayOrder: item?.display_order ?? item?.displayOrder ?? index,
    customImageUrl: item?.customImageUrl ?? null,
    aiImageId: item?.aiImageId ?? null,
    imageUrl: item?.imageUrl ?? null,
    imageSource: item?.imageSource ?? null,
  }))

  // Ensure stable ordering even if the source array is rehydrated differently.
  normalizedItems.sort((a, b) => {
    const ao = typeof a.displayOrder === 'number' ? a.displayOrder : 0
    const bo = typeof b.displayOrder === 'number' ? b.displayOrder : 0
    if (ao !== bo) return ao - bo
    return String(a.name).localeCompare(String(b.name))
  })

  return {
    // Intentionally exclude: id, slug, createdAt, updatedAt, extractionMetadata, sampleData.jobId, etc.
    name: menu?.name ?? null,
    description: menu?.description ?? null,
    theme: menu?.theme
      ? {
          name: menu.theme?.name ?? null,
          colors: menu.theme?.colors ?? null,
        }
      : null,
    logoUrl: menu?.logoUrl ?? null,
    imageUrl: menu?.imageUrl ?? null,
    items: normalizedItems,
  }
}

export async function computeDemoPdfCachePath(params: {
  menu: any
  templateId: string
  configuration: any
  options: any
}): Promise<{ cachePath: string; filenameBase: string }> {
  const payload = {
    version: DEMO_PDF_CACHE_VERSION,
    templateId: params.templateId,
    configuration: params.configuration ?? null,
    options: params.options ?? null,
    menu: normalizeDemoMenuForCache(params.menu),
  }

  // Always use Node.js crypto here (this module is server-only).
  // Avoid relying on WebCrypto in jsdom/test environments.
  const crypto = await import('crypto')
  const hash = crypto.createHash('sha256').update(stableStringify(payload)).digest('hex')
  const shortHash = hash.slice(0, 32)

  const filenameBase = generateSlug(String(params.menu?.name || 'demo-menu')) || 'demo-menu'
  const templateIdSegment = String(params.templateId).replace(/[^a-zA-Z0-9_-]/g, '_')
  const cachePath = `demo/pdf/v${DEMO_PDF_CACHE_VERSION}/${templateIdSegment}/${shortHash}.pdf`
  return { cachePath, filenameBase }
}

