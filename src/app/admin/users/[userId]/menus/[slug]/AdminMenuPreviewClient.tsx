'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageRenderer } from '@/lib/templates/v2/renderer-web-v2'
import {
  PALETTES_V2,
  DEFAULT_PALETTE_V2,
  SPACER_BLANK_ID,
  getFontStylePresetGoogleFontsUrl,
} from '@/lib/templates/v2/renderer-v2'
import type { LayoutDocumentV2, ImageModeV2 } from '@/lib/templates/v2/engine-types-v2'
import type { ImageTransform } from '@/types'

interface AdminMenuPreviewClientProps {
  userId: string
  slug: string
}

const KNOWN_TEMPLATE_IDS = new Set([
  '6-column-portrait-a3',
  '4-column-portrait',
  '3-column-portrait',
  '2-column-portrait',
  '1-column-tall',
  '5-column-landscape',
])

/** Mirrors getRestoredState in template-client — normalises the raw DB config blob */
function parseConfig(templateId: string, c: Record<string, unknown>) {
  // Sanitise templateId: collapse double-dashes caused by data corruption,
  // then fall back to the default if the result still isn't a known template.
  const sanitisedTemplateId = templateId.replace(/--+/g, '-')
  templateId = KNOWN_TEMPLATE_IDS.has(sanitisedTemplateId)
    ? sanitisedTemplateId
    : '6-column-portrait-a3'
  // palette: stored as colourPaletteId in DB config
  const paletteIdRaw = (c.colourPaletteId ?? c.paletteId) as string | undefined
  const paletteId =
    paletteIdRaw && PALETTES_V2.some((p) => p.id === paletteIdRaw)
      ? paletteIdRaw
      : DEFAULT_PALETTE_V2.id

  const imageMode: ImageModeV2 =
    c.imageMode === 'none' || c.textOnly
      ? 'none'
      : ['none', 'compact-rect', 'compact-circle', 'stretch', 'background', 'cutout'].includes(
          c.imageMode as string
        )
      ? (c.imageMode as ImageModeV2)
      : 'compact-rect'

  const spacerTilePatternId =
    c.spacerTiles === 'none'
      ? undefined
      : typeof c.spacerTiles === 'string'
      ? c.spacerTiles
      : typeof c.spacerTilePatternId === 'string'
      ? c.spacerTilePatternId
      : SPACER_BLANK_ID

  const fillersEnabled = c.spacerTiles !== 'none' && c.fillersEnabled !== false

  const isValidTransform = (t: unknown): t is ImageTransform =>
    !!t &&
    typeof t === 'object' &&
    typeof (t as ImageTransform).offsetX === 'number' &&
    typeof (t as ImageTransform).offsetY === 'number' &&
    typeof (t as ImageTransform).scale === 'number'

  return {
    templateId,
    paletteId,
    imageMode,
    fillersEnabled,
    spacerTilePatternId,
    texturesEnabled: c.texturesEnabled !== false,
    textureId: typeof c.textureId === 'string' ? c.textureId : undefined,
    showMenuTitle: c.showMenuTitle === true,
    showVignette: c.showVignette !== false,
    itemBorders: c.itemBorders !== false,
    itemDropShadow: c.itemDropShadow !== false,
    fillItemTiles: c.fillItemTiles !== false,
    showCategoryTitles: c.showCategoryTitles !== false,
    centreAlignment: c.centreAlignment === true,
    showBanner: c.showBanner !== false,
    bannerTitle: typeof c.bannerTitle === 'string' ? c.bannerTitle : 'MENU',
    showBannerTitle: c.showBannerTitle !== false,
    showVenueName: c.showVenueName !== false,
    bannerSwapLayout: c.bannerSwapLayout === true,
    bannerImageStyle:
      c.bannerImageStyle === 'stretch-fit'
        ? 'stretch-fit'
        : c.bannerImageStyle === 'none'
        ? 'none'
        : ('cutout' as 'cutout' | 'stretch-fit' | 'none'),
    fontStylePreset:
      c.fontStylePreset === 'strong'
        ? 'strong'
        : c.fontStylePreset === 'fun'
        ? 'fun'
        : c.fontStylePreset === 'serif'
        ? 'serif'
        : ('standard' as 'strong' | 'fun' | 'standard' | 'serif'),
    flagshipItemId: typeof c.flagshipItemId === 'string' ? c.flagshipItemId : undefined,
    bannerHeroTransform: isValidTransform(c.bannerHeroTransform)
      ? c.bannerHeroTransform
      : undefined,
    bannerLogoTransform: isValidTransform(c.bannerLogoTransform)
      ? c.bannerLogoTransform
      : undefined,
  }
}

type ParsedConfig = ReturnType<typeof parseConfig>

const DEFAULT_CONFIG: ParsedConfig = parseConfig('6-column-portrait-a3', {
  colourPaletteId: DEFAULT_PALETTE_V2.id,
  imageMode: 'compact-rect',
  texturesEnabled: true,
  textureId: 'linen',
  showVignette: true,
  showCategoryTitles: true,
  showBanner: true,
})

export default function AdminMenuPreviewClient({ userId, slug }: AdminMenuPreviewClientProps) {
  const [config, setConfig] = useState<ParsedConfig>(DEFAULT_CONFIG)
  const [layoutDocument, setLayoutDocument] = useState<LayoutDocumentV2 | null>(null)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [menuName, setMenuName] = useState('')
  const [menuStatus, setMenuStatus] = useState('')
  const [configLoaded, setConfigLoaded] = useState(false)

  // Inject Google Fonts for the active font style preset
  useEffect(() => {
    const url = getFontStylePresetGoogleFontsUrl(config.fontStylePreset)
    if (!url || typeof document === 'undefined') return
    const existing = document.querySelector(`link[href="${url}"]`)
    if (existing) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
  }, [config.fontStylePreset])

  // Step 1: load menu metadata + saved template config via admin routes
  useEffect(() => {
    const load = async () => {
      try {
        // Fetch menu list to get name/status
        const menusRes = await fetch(`/api/admin/users/${userId}/menus`)
        if (menusRes.ok) {
          const menusData = await menusRes.json()
          const found = menusData.data?.find((m: any) => m.slug === slug)
          if (found) {
            setMenuName(found.name)
            setMenuStatus(found.status)
          } else {
            setError('Menu not found for this user.')
            setLoading(false)
            return
          }
        }

        // Fetch saved template selection via admin route (bypasses RLS)
        const selRes = await fetch(
          `/api/admin/users/${userId}/menus/${slug}/template-selection`
        )
        if (selRes.ok) {
          const selData = await selRes.json()
          if (selData.data?.configuration) {
            const parsed = parseConfig(
              selData.data.templateId || DEFAULT_CONFIG.templateId,
              selData.data.configuration
            )
            setConfig(parsed)
          }
        }
      } catch (e) {
        console.error('[AdminMenuPreview] Failed to load config:', e)
      } finally {
        setConfigLoaded(true)
      }
    }
    load()
  }, [userId, slug])

  // Step 2: fetch layout once config is ready
  const fetchLayout = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        templateId: config.templateId,
        paletteId: config.paletteId,
        imageMode: config.imageMode === 'none' ? 'none' : config.imageMode,
        fillersEnabled: config.fillersEnabled.toString(),
        spacerTilePatternId: config.spacerTilePatternId ?? SPACER_BLANK_ID,
        textOnly: (config.imageMode === 'none').toString(),
        texturesEnabled: (config.texturesEnabled && !!config.textureId).toString(),
        showMenuTitle: config.showMenuTitle.toString(),
        showVignette: config.showVignette.toString(),
        showCategoryTitles: config.showCategoryTitles.toString(),
        centreAlignment: config.centreAlignment.toString(),
        showBanner: config.showBanner.toString(),
        bannerTitle: config.bannerTitle,
        showBannerTitle: config.showBannerTitle.toString(),
        showVenueName: config.showVenueName.toString(),
        bannerSwapLayout: config.bannerSwapLayout.toString(),
        bannerImageStyle: config.bannerImageStyle,
        fontStylePreset: config.fontStylePreset,
        engineVersion: 'v2',
      })
      if (config.textureId) params.set('textureId', config.textureId)
      if (config.flagshipItemId) params.set('flagshipItemId', config.flagshipItemId)

      const res = await fetch(
        `/api/admin/users/${userId}/menus/${slug}/layout?${params.toString()}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate layout')
      setLayoutDocument(data.data)
      setCurrentPageIndex(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }, [userId, slug, config])

  useEffect(() => {
    if (configLoaded) fetchLayout()
  }, [configLoaded, fetchLayout])

  const palette = PALETTES_V2.find((p) => p.id === config.paletteId) ?? DEFAULT_PALETTE_V2
  const currentPage = layoutDocument?.pages?.[currentPageIndex] ?? null
  const totalPages = layoutDocument?.pages?.length ?? 0
  const pageWidth = layoutDocument?.pageSpec?.width ?? 595
  const pageHeight = layoutDocument?.pageSpec?.height ?? 842

  // Fit to viewport
  const maxWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 48, 860) : 800
  const zoom = Math.min(1.0, maxWidth / pageWidth)

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Admin banner */}
      <div className="bg-blue-600 px-4 py-2 text-center text-xs font-medium text-white">
        Admin preview — read-only
        {menuName && <> · <span className="font-semibold">{menuName}</span></>}
        {menuStatus && <> · <span className="capitalize">{menuStatus}</span></>}
        {' · '}
        <a href="/admin?tab=user-management" className="underline hover:opacity-80">
          Back to Users
        </a>
      </div>

      <div className="flex flex-col items-center py-8 px-4">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-24 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="text-sm">Generating preview…</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <button
              onClick={fetchLayout}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && layoutDocument?.pageSpec && currentPage && (
          <>
            <div
              style={{
                width: pageWidth * zoom,
                height: pageHeight * zoom,
                flexShrink: 0,
              }}
            >
              <div
                className="shadow-2xl bg-white"
                style={{
                  width: pageWidth,
                  height: pageHeight,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
              >
                <PageRenderer
                  page={currentPage}
                  pageSpec={layoutDocument.pageSpec}
                  options={{
                    scale: 1.0,
                    palette,
                    texturesEnabled: config.texturesEnabled && !!config.textureId,
                    textureId: config.textureId,
                    imageMode: config.imageMode === 'none' ? 'stretch' : config.imageMode,
                    showVignette: config.showVignette,
                    itemBorders: config.itemBorders,
                    itemDropShadow: config.itemDropShadow,
                    fillItemTiles: config.fillItemTiles,
                    showCategoryTitles: config.showCategoryTitles,
                    centreAlignment: config.centreAlignment,
                    showGridOverlay: false,
                    showRegionBounds: false,
                    showTileIds: false,
                    isExport: false,
                    spacerTilePatternId: config.fillersEnabled
                      ? config.spacerTilePatternId
                      : undefined,
                    fontStylePreset: config.fontStylePreset,
                    bannerHeroTransform: config.bannerHeroTransform,
                    bannerLogoTransform: config.bannerLogoTransform,
                  }}
                />
              </div>
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center gap-4">
                <button
                  onClick={() => setCurrentPageIndex((i) => Math.max(0, i - 1))}
                  disabled={currentPageIndex === 0}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Prev
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPageIndex + 1} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPageIndex((i) => Math.min(totalPages - 1, i + 1))
                  }
                  disabled={currentPageIndex === totalPages - 1}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
