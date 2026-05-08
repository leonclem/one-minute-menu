'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname } from 'next/navigation'
import { UXSection, UXButton, UXCard, CollapsibleSection } from '@/components/ux'
import { getPaletteSwatchColors } from '@/components/ux/PaletteDropdown'
import { MenuThumbnailBadge } from '@/components/ux/MenuThumbnailBadge'
import { useToast } from '@/components/ui'
import type { Menu, ImageTransform, ImageTransformRecord } from '@/types'
import { normalizeImageTransformRecord } from '@/types'
import { normalizeDemoMenu } from '@/lib/demo-menu-normalizer'
import { PageRenderer } from '@/lib/templates/v2/renderer-web-v2'
import { PALETTES_V2, DEFAULT_PALETTE_V2, TEXTURE_IDS, TEXTURE_REGISTRY, DARK_PALETTE_IDS, DARK_ONLY_TEXTURE_IDS, LIGHT_ONLY_TEXTURE_IDS, FILLER_PATTERN_IDS, FILLER_PATTERN_REGISTRY, SPACER_BLANK_ID, getFontStylePresetGoogleFontsUrl } from '@/lib/templates/v2/renderer-v2'
import type { LayoutDocumentV2, ImageModeV2 } from '@/lib/templates/v2/engine-types-v2'

import { trackConversionEvent } from '@/lib/conversion-tracking'
import { markDashboardForRefresh } from '@/lib/dashboard-refresh'
import { V2_TEMPLATE_OPTIONS } from '@/lib/templates/v2/template-options'
import { captureEvent, ANALYTICS_EVENTS } from '@/lib/posthog'
import {
  getImageGenerationJobLabel,
  isActiveImageGenerationJob,
  isActiveCutoutStatus,
  useImageGenerationStatus,
} from '@/lib/image-generation/use-image-generation-status'

const TEMPLATE_DRAFT_KEY = (menuId: string) => `templateDraft-${menuId}`

/** Default settings used for the demo flow — applied on load and restored by the Reset button. */
const DEMO_DEFAULTS = {
  templateId: '3-column-portrait',
  paletteId: 'warm-earth',
  imageMode: 'stretch' as ImageModeV2,
  spacerTiles: 'matte-paper-grain',
  textureId: 'linen' as string | null,
  showMenuTitle: false,
  showVignette: true,
  itemBorders: true,
  itemDropShadow: true,
  fillItemTiles: true,
  showCategoryTitles: false,
  showLogoTile: false,
  showCategoryHeaderTiles: false,
  showFlagshipTile: false,
  centreAlignment: false,
}

/** Fine Dining specific demo defaults */
const DEMO_DEFAULTS_FINE_DINING = {
  templateId: '6-column-portrait-a3',
  paletteId: 'lunar-red-gold',
  imageMode: 'cutout' as ImageModeV2,
  spacerTiles: 'matte-paper-grain',
  textureId: null as string | null,
  showMenuTitle: false,
  showVignette: true,
  itemBorders: true,
  itemDropShadow: true,
  fillItemTiles: true,
  showCategoryTitles: true,
  showLogoTile: false,
  showCategoryHeaderTiles: false,
  showFlagshipTile: false,
  centreAlignment: false,
  bannerTitle: 'DINNER',
  bannerImageStyle: 'cutout' as const,
  fontStylePreset: 'standard' as const,
  // Logo: scaled up and anchored near top so tail overflows below banner edge
  bannerLogoTransform: { scale: 2.0, offsetX: 0, offsetY: -25 } as ImageTransform,
  // Hero: slightly bigger, shifted up ~30%
  bannerHeroTransform: { scale: 1.4, offsetX: 0, offsetY: -10 } as ImageTransform,
}

/** Build validated state from saved templateId + configuration (API or session draft). */
/** Templates that support the banner feature (banner.enabled: true in YAML) */
const BANNER_ENABLED_TEMPLATES = new Set([
  '4-column-portrait',
  '3-column-portrait',
  '2-column-portrait',
  '6-column-portrait-a3',
  '5-column-landscape',
  '1-column-tall',
])

function getRestoredState(
  savedTemplateId: string,
  config: Record<string, unknown>
): {
  templateId: string
  paletteId: string
  textureId: string | null
  spacerTiles: 'blank' | 'none' | string
  imageMode: ImageModeV2
  showMenuTitle: boolean
  showVignette: boolean
  itemBorders: boolean
  itemDropShadow: boolean
  fillItemTiles: boolean
  showCategoryTitles: boolean
  showLogoTile: boolean
  showCategoryHeaderTiles: boolean
  showFlagshipTile: boolean
  showBanner: boolean
  bannerTitle: string
  showBannerTitle: boolean
  showVenueName: boolean
  bannerSwapLayout: boolean
  bannerImageStyle: 'cutout' | 'stretch-fit' | 'none'
  fontStylePreset: 'strong' | 'fun' | 'standard' | 'serif' | 'future' | 'handwriting' | 'elegant'
  flagshipItemId: string | null
  bannerHeroTransform: ImageTransform | undefined
  bannerLogoTransform: ImageTransform | undefined
  centreAlignment: boolean
} {
  const mappedTemplateId =
    savedTemplateId === 'classic-grid-cards' || savedTemplateId === 'simple-rows' || savedTemplateId === 'classic-cards-v2' ? '4-column-portrait' :
    savedTemplateId === 'two-column-text' || savedTemplateId === 'italian-v2' ? '2-column-portrait' :
    savedTemplateId === 'three-column-modern-v2' ? '3-column-portrait' :
    savedTemplateId === 'half-a4-tall-v2' ? '1-column-tall' :
    savedTemplateId === 'classic-cards-v2-landscape' ? '5-column-landscape' :
    savedTemplateId || '6-column-portrait-a3'

  const paletteIdRaw = (config.colourPaletteId ?? config.paletteId) as string | undefined
  const paletteId = paletteIdRaw && PALETTES_V2.some(p => p.id === paletteIdRaw)
    ? paletteIdRaw
    : DEFAULT_PALETTE_V2.id

  const textureIdRaw = config.textureId as string | undefined
  const textureId = textureIdRaw && TEXTURE_REGISTRY.has(textureIdRaw) ? textureIdRaw : null

  let spacerTiles: 'blank' | 'none' | string = SPACER_BLANK_ID
  if (config.spacerTiles === 'none') spacerTiles = 'none'
  else if (config.spacerTiles === 'mix') spacerTiles = 'mix'
  else if (config.spacerTiles === SPACER_BLANK_ID) spacerTiles = SPACER_BLANK_ID
  else if (config.spacerTiles && FILLER_PATTERN_REGISTRY.has(config.spacerTiles as string)) spacerTiles = config.spacerTiles as string
  else if (config.spacerTilePatternId === SPACER_BLANK_ID) spacerTiles = SPACER_BLANK_ID
  else if (config.spacerTilePatternId && FILLER_PATTERN_REGISTRY.has(config.spacerTilePatternId as string)) spacerTiles = config.spacerTilePatternId as string

  const imageMode: ImageModeV2 =
    config.imageMode === 'none' || config.textOnly ? 'none' :
    (config.imageMode && ['none', 'compact-rect', 'compact-circle', 'stretch', 'background', 'cutout'].includes(config.imageMode as string))
      ? (config.imageMode as ImageModeV2) : 'compact-rect'

  // Banner defaults: showBanner defaults to true if the template supports it
  const bannerEnabledByDefault = BANNER_ENABLED_TEMPLATES.has(mappedTemplateId)
  const showBanner = config.showBanner !== undefined ? config.showBanner === true : bannerEnabledByDefault
  const bannerTitle = typeof config.bannerTitle === 'string' && config.bannerTitle.length > 0
    ? config.bannerTitle
    : 'MENU'
  const showBannerTitle = config.showBannerTitle !== false
  const showVenueName = config.showVenueName !== false
  const showLogoTile = config.showLogoTile === true
  const showCategoryHeaderTiles = config.showCategoryHeaderTiles === true
  const showFlagshipTile = config.showFlagshipTile === true
  const bannerSwapLayout = config.bannerSwapLayout === true
  const bannerImageStyle: 'cutout' | 'stretch-fit' | 'none' =
    config.bannerImageStyle === 'stretch-fit' ? 'stretch-fit' :
    config.bannerImageStyle === 'none' ? 'none' :
    'cutout'
  const fontStylePreset: 'strong' | 'fun' | 'standard' | 'serif' | 'future' | 'handwriting' | 'elegant' =
    config.fontStylePreset === 'strong' ? 'strong' :
    config.fontStylePreset === 'fun' ? 'fun' :
    config.fontStylePreset === 'serif' ? 'serif' :
    config.fontStylePreset === 'future' ? 'future' :
    config.fontStylePreset === 'handwriting' ? 'handwriting' :
    config.fontStylePreset === 'elegant' ? 'elegant' :
    'standard'
  const flagshipItemId = typeof config.flagshipItemId === 'string' ? config.flagshipItemId : null

  const isValidTransform = (t: unknown): t is ImageTransform =>
    !!t && typeof t === 'object' &&
    typeof (t as ImageTransform).offsetX === 'number' &&
    typeof (t as ImageTransform).offsetY === 'number' &&
    typeof (t as ImageTransform).scale === 'number'
  const bannerHeroTransform = isValidTransform(config.bannerHeroTransform) ? config.bannerHeroTransform : undefined
  const bannerLogoTransform = isValidTransform(config.bannerLogoTransform) ? config.bannerLogoTransform : undefined

  return {
    templateId: mappedTemplateId,
    paletteId,
    textureId,
    spacerTiles,
    imageMode,
    showMenuTitle: config.showMenuTitle === true,
    showVignette: config.showVignette !== false,
    itemBorders: config.itemBorders !== false,
    itemDropShadow: config.itemDropShadow !== false,
    fillItemTiles: config.fillItemTiles !== false,
    showCategoryTitles: config.showCategoryTitles !== false,
    showLogoTile,
    showCategoryHeaderTiles,
    showFlagshipTile,
    showBanner,
    bannerTitle,
    showBannerTitle,
    showVenueName,
    bannerSwapLayout,
    bannerImageStyle,
    fontStylePreset,
    flagshipItemId,
    bannerHeroTransform,
    bannerLogoTransform,
    centreAlignment: config.centreAlignment === true,
  }
}

interface UXMenuTemplateClientProps {
  menuId: string
}

export default function UXMenuTemplateClient({ menuId }: UXMenuTemplateClientProps) {
  const [menu, setMenu] = useState<Menu | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemoUser, setIsDemoUser] = useState(false)
  const [deliveryEmail, setDeliveryEmail] = useState<string | null>(null)

  const isDemo = menuId.startsWith('demo-')
  const {
    data: imageGenerationStatus,
    refresh: refreshImageGenerationStatus,
  } = useImageGenerationStatus(menuId, !isDemo)
  const latestImageJobByItem = useMemo(
    () => imageGenerationStatus?.latestByItem ?? {},
    [imageGenerationStatus?.latestByItem]
  )
  const imageStatusByItem = useMemo(
    () => imageGenerationStatus?.imageByItem ?? {},
    [imageGenerationStatus?.imageByItem]
  )
  const activeImageJobCount = imageGenerationStatus?.activeCount ?? 0
  const activeCutoutCount = imageGenerationStatus?.activeCutoutCount ?? 0
  const hasActiveImageJobs = activeImageJobCount > 0
  const hasActiveCutouts = activeCutoutCount > 0
  const hasActivePreviewImageWork = hasActiveImageJobs || hasActiveCutouts
  const previousActiveImageItemIds = useRef<Set<string>>(new Set())
  const previousImageFingerprintsByItem = useRef<Record<string, string>>({})
  const [refreshingCompletedImageItemIds, setRefreshingCompletedImageItemIds] = useState<Set<string>>(() => new Set())
  const [previewImageReadyPulse, setPreviewImageReadyPulse] = useState(false)

  // Selection State — demo users get curated defaults for best first impression
  const [templateId, setTemplateId] = useState(isDemo ? DEMO_DEFAULTS.templateId : '6-column-portrait-a3')
  const [paletteId, setPaletteId] = useState(isDemo ? DEMO_DEFAULTS.paletteId : 'elegant-cream')
  const [imageMode, setImageMode] = useState<ImageModeV2>(isDemo ? DEMO_DEFAULTS.imageMode : 'compact-rect')
  /** 'blank' = plain rectangle fillers, 'none' = no fillers, otherwise pattern ID */
  const [spacerTiles, setSpacerTiles] = useState<'blank' | 'none' | string>(isDemo ? DEMO_DEFAULTS.spacerTiles : SPACER_BLANK_ID)
  /** Derived: when imageMode is 'none', layout is text-only (no images). */
  const textOnly = imageMode === 'none'
  // Texture is applied as overlay when textureId is set; no separate "textures enabled" toggle
  const [textureId, setTextureId] = useState<string | null>(isDemo ? DEMO_DEFAULTS.textureId : 'linen')
  const [showMenuTitle, setShowMenuTitle] = useState(isDemo ? DEMO_DEFAULTS.showMenuTitle : false)
  const [showVignette, setShowVignette] = useState(isDemo ? DEMO_DEFAULTS.showVignette : true)
  const [itemBorders, setItemBorders] = useState(isDemo ? DEMO_DEFAULTS.itemBorders : true)
  const [itemDropShadow, setItemDropShadow] = useState(isDemo ? DEMO_DEFAULTS.itemDropShadow : true)
  const [fillItemTiles, setFillItemTiles] = useState(isDemo ? DEMO_DEFAULTS.fillItemTiles : true)
  const [showCategoryTitles, setShowCategoryTitles] = useState(isDemo ? DEMO_DEFAULTS.showCategoryTitles : true)
  const [showLogoTile, setShowLogoTile] = useState(isDemo ? DEMO_DEFAULTS.showLogoTile : false)
  const [showCategoryHeaderTiles, setShowCategoryHeaderTiles] = useState(isDemo ? DEMO_DEFAULTS.showCategoryHeaderTiles : false)
  const [centreAlignment, setCentreAlignment] = useState(isDemo ? DEMO_DEFAULTS.centreAlignment : false)
  
  // Banner & footer state
  const [showBanner, setShowBanner] = useState(true)
  const [bannerTitle, setBannerTitle] = useState('MENU')
  const [showBannerTitle, setShowBannerTitle] = useState(true)
  const [showVenueName, setShowVenueName] = useState(true)
  const [bannerSwapLayout, setBannerSwapLayout] = useState(false)
  const [bannerImageStyle, setBannerImageStyle] = useState<'cutout' | 'stretch-fit' | 'none'>('cutout')
  const [fontStylePreset, setFontStylePreset] = useState<'strong' | 'fun' | 'standard' | 'serif' | 'future' | 'handwriting' | 'elegant'>('standard')
  const [flagshipItemId, setFlagshipItemId] = useState<string | null>(null)

  // Derived: whether the currently selected template supports the banner feature
  const bannerSupported = BANNER_ENABLED_TEMPLATES.has(templateId)
  
  // Control panel state — only one section expanded at a time
  const [expandedSection, setExpandedSection] = useState<string | null>('Grid Layout')
  
  // Preview State
  const [layoutDocument, setLayoutDocument] = useState<LayoutDocumentV2 | null>(null)
  const [isPreviewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewAssetVersion, setPreviewAssetVersion] = useState<string | undefined>(undefined)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [zoom, setZoom] = useState(1.0)

  // Image Edit State — per-item, per-mode transform records
  const [imageEditUnlocked, setImageEditUnlocked] = useState(false)
  const [imageTransformRecords, setImageTransformRecords] = useState<Map<string, ImageTransformRecord>>(new Map())
  const imageTransformSaveTimeout = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const imageTransformRecordsRef = useRef<Map<string, ImageTransformRecord>>(new Map())

  // Banner image transforms (hero + logo) — persisted in template configuration
  const [bannerHeroTransform, setBannerHeroTransform] = useState<ImageTransform | undefined>(undefined)
  const [bannerLogoTransform, setBannerLogoTransform] = useState<ImageTransform | undefined>(undefined)
  const bannerTransformSaveTimeout = useRef<NodeJS.Timeout | null>(null)
  
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [exportSuccessModalOpen, setExportSuccessModalOpen] = useState(false)
  const [cooldownResetAt, setCooldownResetAt] = useState<Date | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Initialize imageTransformRecords from menu items when menu changes
  useEffect(() => {
    if (!menu) return
    const allItems = [
      ...(menu.items ?? []),
      ...(menu.categories?.flatMap(c => c.items) ?? []),
    ]
    const recordsMap = new Map<string, ImageTransformRecord>()
    for (const item of allItems) {
      const normalized = normalizeImageTransformRecord(item.imageTransform)
      if (normalized) {
        recordsMap.set(item.id, normalized)
      }
    }
    setImageTransformRecords(recordsMap)
    imageTransformRecordsRef.current = recordsMap
  }, [menu])

  // Keep ref in sync for flush-on-unmount
  useEffect(() => {
    imageTransformRecordsRef.current = imageTransformRecords
  }, [imageTransformRecords])

  // Derive a flat Map<itemId, ImageTransform> for the current mode (passed to renderer)
  const imageTransforms = (() => {
    const resolved = new Map<string, ImageTransform>()
    const mode = imageMode === 'none' ? 'stretch' : imageMode
    const entries = Array.from(imageTransformRecords.entries())
    for (let i = 0; i < entries.length; i++) {
      const [itemId, record] = entries[i]
      const t = record[mode as keyof ImageTransformRecord]
      if (t) resolved.set(itemId, t)
    }
    return resolved
  })()

  const router = useRouter()
  const pathname = usePathname()
  const { showToast } = useToast()
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)
  const draftWriteTimeout = useRef<NodeJS.Timeout | null>(null)
  const draftConfigRef = useRef<{ templateId: string; configuration: Record<string, unknown> } | null>(null)
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null)
  const flatMenuItems = useMemo(() => [
    ...(menu?.items ?? []),
    ...(menu?.categories?.flatMap(category => category.items) ?? []),
  ], [menu])

  const currentFlagshipItem = useMemo(() => {
    const dbFlagship = flatMenuItems.find((item: any) => item.isFlagship)
    if (flagshipItemId) {
      return flatMenuItems.find((item: any) => item.id === flagshipItemId) ?? dbFlagship ?? null
    }
    return dbFlagship ?? null
  }, [flagshipItemId, flatMenuItems])

  const effectiveFlagshipItemId = currentFlagshipItem?.id ?? null
  const isFlagshipTileVisible = effectiveFlagshipItemId !== null

  const palettesForGrid = useMemo(() => {
    return PALETTES_V2
  }, [])

  const buildCurrentConfiguration = useCallback(() => ({
    textOnly,
    fillersEnabled: spacerTiles !== 'none',
    spacerTiles,
    spacerTilePatternId: spacerTiles !== 'none' ? spacerTiles : undefined,
    texturesEnabled: !!textureId,
    textureId: textureId ?? undefined,
    showMenuTitle,
    showVignette,
    itemBorders,
    itemDropShadow,
    fillItemTiles,
    showCategoryTitles,
    showLogoTile,
    showCategoryHeaderTiles,
    showFlagshipTile: isFlagshipTileVisible,
    centreAlignment,
    colourPaletteId: paletteId,
    imageMode,
    showBanner,
    bannerTitle,
    showBannerTitle,
    showVenueName,
    bannerSwapLayout,
    bannerImageStyle,
    fontStylePreset,
    flagshipItemId: effectiveFlagshipItemId ?? undefined,
    bannerHeroTransform: bannerHeroTransform ?? undefined,
    bannerLogoTransform: bannerLogoTransform ?? undefined,
  }), [
    textOnly,
    spacerTiles,
    textureId,
    showMenuTitle,
    showVignette,
    itemBorders,
    itemDropShadow,
    fillItemTiles,
    showCategoryTitles,
    showLogoTile,
    showCategoryHeaderTiles,
    isFlagshipTileVisible,
    centreAlignment,
    paletteId,
    imageMode,
    showBanner,
    bannerTitle,
    showBannerTitle,
    showVenueName,
    bannerSwapLayout,
    bannerImageStyle,
    fontStylePreset,
    effectiveFlagshipItemId,
    bannerHeroTransform,
    bannerLogoTransform,
  ])

  const handleSelectPalette = useCallback((nextPaletteId: string) => {
    setPaletteId(nextPaletteId)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Inject Google Fonts <link> for the active font style preset
  useEffect(() => {
    const url = getFontStylePresetGoogleFontsUrl(fontStylePreset)
    if (!url || typeof document === 'undefined') return
    const existing = document.querySelector(`link[href="${url}"]`)
    if (existing) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
  }, [fontStylePreset])

  // Neon Blue palette: force-uncheck tile options that don't render well with this palette
  useEffect(() => {
    if (paletteId !== 'galactic-menu') return
    if (showLogoTile) setShowLogoTile(false)
    if (showCategoryHeaderTiles) setShowCategoryHeaderTiles(false)
  }, [paletteId, showLogoTile, showCategoryHeaderTiles])

  // Cooldown countdown timer for export rate limiting
  useEffect(() => {
    if (!cooldownResetAt) {
      setCooldownRemaining(null)
      return
    }
    const tick = () => {
      const diff = cooldownResetAt.getTime() - Date.now()
      if (diff <= 0) {
        setCooldownResetAt(null)
        setCooldownRemaining(null)
        return
      }
      const mins = Math.floor(diff / 60_000)
      const secs = Math.ceil((diff % 60_000) / 1000)
      setCooldownRemaining(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [cooldownResetAt])  // Load menu data
  useEffect(() => {
    const loadMenuData = async () => {
      setLoading(true)
      if (menuId.startsWith('demo-')) {
        setIsDemoUser(true)
        const storedDemoMenu = sessionStorage.getItem('demoMenu')
        if (storedDemoMenu) {
          try {
            const parsedMenu = JSON.parse(storedDemoMenu)
            const normalized = normalizeDemoMenu(parsedMenu) as Menu
            setMenu(normalized)
            // Restore template config: session draft first, then saved selection, else defaults
            const draftRaw = sessionStorage.getItem(TEMPLATE_DRAFT_KEY(menuId))
            if (draftRaw) {
              try {
                const draft = JSON.parse(draftRaw) as { templateId?: string; configuration?: Record<string, unknown> }
                if (draft.templateId && draft.configuration) {
                  const r = getRestoredState(draft.templateId, draft.configuration)
                  setTemplateId(r.templateId)
                  setPaletteId(r.paletteId)
                  setTextureId(r.textureId)
                  setSpacerTiles(r.spacerTiles)
                  setImageMode(r.imageMode)
                  setShowMenuTitle(r.showMenuTitle)
                  setShowVignette(r.showVignette)
                  setItemBorders(r.itemBorders)
                  setItemDropShadow(r.itemDropShadow)
                  setFillItemTiles(r.fillItemTiles)
                  setShowCategoryTitles(r.showCategoryTitles)
                  setShowLogoTile(r.showLogoTile)
                  setShowCategoryHeaderTiles(r.showCategoryHeaderTiles)
                  setShowBanner(r.showBanner)
                  setBannerTitle(r.bannerTitle)
                  setShowBannerTitle(r.showBannerTitle)
                  setShowVenueName(r.showVenueName)
                  setBannerSwapLayout(r.bannerSwapLayout)
                  setBannerImageStyle(r.bannerImageStyle)
                  setFontStylePreset(r.fontStylePreset)
                  // DB state is authoritative: use DB flagship if present, null if DB has no flagship.
                // Do NOT fall back to the stale draft value when the flagship was cleared in the DB.
                const dbFlagshipId = normalized.items?.find((i: any) => i.isFlagship)?.id ?? 
                                   normalized.categories?.flatMap((c: any) => c.items).find((i: any) => i.isFlagship)?.id
                setFlagshipItemId(dbFlagshipId ?? null)
                  setBannerHeroTransform(r.bannerHeroTransform)
                  setBannerLogoTransform(r.bannerLogoTransform)
                  setCentreAlignment(r.centreAlignment)
                  setLoading(false)
                  return
                }
              } catch {
                // ignore invalid draft
              }
            }
            const selectionRaw = sessionStorage.getItem(`templateSelection-${menuId}`)
            let restoredFromSelection = false
            if (selectionRaw) {
              try {
                const sel = JSON.parse(selectionRaw) as { templateId?: string; configuration?: Record<string, unknown> }
                if (sel.templateId && sel.configuration) {
                  const r = getRestoredState(sel.templateId, sel.configuration)
                  setTemplateId(r.templateId)
                  setPaletteId(r.paletteId)
                  setTextureId(r.textureId)
                  setSpacerTiles(r.spacerTiles)
                  setImageMode(r.imageMode)
                  setShowMenuTitle(r.showMenuTitle)
                  setShowVignette(r.showVignette)
                  setItemBorders(r.itemBorders)
                  setItemDropShadow(r.itemDropShadow)
                  setFillItemTiles(r.fillItemTiles)
                  setShowCategoryTitles(r.showCategoryTitles)
                  setShowLogoTile(r.showLogoTile)
                  setShowCategoryHeaderTiles(r.showCategoryHeaderTiles)
                  setShowBanner(r.showBanner)
                  setBannerTitle(r.bannerTitle)
                  setShowBannerTitle(r.showBannerTitle)
                  setShowVenueName(r.showVenueName)
                  setBannerSwapLayout(r.bannerSwapLayout)
                  setBannerImageStyle(r.bannerImageStyle)
                  setFontStylePreset(r.fontStylePreset)
                  // DB state is authoritative: use DB flagship if present, null if DB has no flagship.
                // Do NOT fall back to the stale saved-selection value when the flagship was cleared in the DB.
                const dbFlagshipId = normalized.items?.find((i: any) => i.isFlagship)?.id ?? 
                                   normalized.categories?.flatMap((c: any) => c.items).find((i: any) => i.isFlagship)?.id
                setFlagshipItemId(dbFlagshipId ?? null)
                  setBannerHeroTransform(r.bannerHeroTransform)
                  setBannerLogoTransform(r.bannerLogoTransform)
                  setCentreAlignment(r.centreAlignment)
                  restoredFromSelection = true
                }
              } catch {
                // ignore invalid selection
              }
            }
            // No saved config — apply per-menu defaults for flagship and banner style
            if (!restoredFromSelection) {
              const isBreakfastMenu = normalized.name.toLowerCase().includes('breakfast')
              const isFineDiningMenu = !isBreakfastMenu
              const defaultFlagshipName = isBreakfastMenu ? 'Country Tartine' : 'Tenderloin of Beef Wellington'
              const defaultBannerStyle: 'cutout' | 'stretch-fit' = isBreakfastMenu ? 'cutout' : 'stretch-fit'
              const flagshipItem = normalized.items?.find((item: any) => item.isFlagship || item.name === defaultFlagshipName)
              if (flagshipItem) {
                setFlagshipItemId(flagshipItem.id)
                setBannerImageStyle(defaultBannerStyle)
              }
              if (isBreakfastMenu) {
                setBannerTitle('BRUNCH')
                setFontStylePreset('fun')
              }
              if (isFineDiningMenu) {
                const d = DEMO_DEFAULTS_FINE_DINING
                setTemplateId(d.templateId)
                setPaletteId(d.paletteId)
                setImageMode(d.imageMode)
                setSpacerTiles(d.spacerTiles)
                setTextureId(d.textureId)
                setShowMenuTitle(d.showMenuTitle)
                setShowVignette(d.showVignette)
                setItemBorders(d.itemBorders)
                setItemDropShadow(d.itemDropShadow)
                setFillItemTiles(d.fillItemTiles)
                setShowCategoryTitles(d.showCategoryTitles)
                setShowLogoTile(d.showLogoTile)
                setShowCategoryHeaderTiles(d.showCategoryHeaderTiles)
                setCentreAlignment(d.centreAlignment)
                setBannerTitle(d.bannerTitle)
                setBannerImageStyle(d.bannerImageStyle)
                setFontStylePreset(d.fontStylePreset)
                setBannerLogoTransform(d.bannerLogoTransform)
                setBannerHeroTransform(d.bannerHeroTransform)
                setZoom(0.8)
              }
            }
          } catch (error) {
            console.error('Error parsing demo menu:', error)
            router.push('/demo/sample')
          }
        } else {
          router.push('/demo/sample')
        }
      } else {
        try {
          setIsDemoUser(false)
          const resp = await fetch(`/api/menus/${menuId}`, { cache: 'no-store' })
          const data = await resp.json()
          if (!resp.ok) {
            if (resp.status === 401) {
              showToast({ type: 'error', title: 'Sign in required' })
              router.push('/auth/signin')
              return
            }
            throw new Error(data?.error || 'Failed to load menu')
          }
          setMenu(data.data)

          // Session draft takes precedence so navigating template ↔ extracted preserves config
          const draftRaw = sessionStorage.getItem(TEMPLATE_DRAFT_KEY(menuId))
          if (draftRaw) {
            try {
              const draft = JSON.parse(draftRaw) as { templateId?: string; configuration?: Record<string, unknown> }
              if (draft.templateId && draft.configuration) {
                const r = getRestoredState(draft.templateId, draft.configuration)
                setTemplateId(r.templateId)
                setPaletteId(r.paletteId)
                setTextureId(r.textureId)
                setSpacerTiles(r.spacerTiles)
                setImageMode(r.imageMode)
                setShowMenuTitle(r.showMenuTitle)
                setShowVignette(r.showVignette)
                setItemBorders(r.itemBorders)
                setItemDropShadow(r.itemDropShadow)
                setFillItemTiles(r.fillItemTiles)
                setShowCategoryTitles(r.showCategoryTitles)
                setShowLogoTile(r.showLogoTile)
                setShowCategoryHeaderTiles(r.showCategoryHeaderTiles)
                setShowBanner(r.showBanner)
                setBannerTitle(r.bannerTitle)
                setShowBannerTitle(r.showBannerTitle)
                setShowVenueName(r.showVenueName)
                setBannerSwapLayout(r.bannerSwapLayout)
                setBannerImageStyle(r.bannerImageStyle)
                setFontStylePreset(r.fontStylePreset)
                // DB state is authoritative: use DB flagship if present, null if DB has no flagship.
                // Do NOT fall back to the stale draft value when the flagship was cleared in the DB.
                const dbFlagshipId = data.data.items?.find((i: any) => i.isFlagship)?.id ?? 
                                   data.data.categories?.flatMap((c: any) => c.items).find((i: any) => i.isFlagship)?.id
                setFlagshipItemId(dbFlagshipId ?? null)
                setBannerHeroTransform(r.bannerHeroTransform)
                setBannerLogoTransform(r.bannerLogoTransform)
                  setCentreAlignment(r.centreAlignment)
                setLoading(false)
                return
              }
            } catch {
              // ignore invalid draft
            }
          }

          // Else load saved selection from API (full restore including palette, texture, etc.)
          const selectionResp = await fetch(`/api/menus/${menuId}/template-selection`, { cache: 'no-store' })
          if (selectionResp.ok) {
            const selectionData = await selectionResp.json()
            if (selectionData.data) {
              const config = selectionData.data.configuration || {}
              const savedTemplateId = selectionData.data.templateId || '6-column-portrait-a3'
              const r = getRestoredState(savedTemplateId, config)
              setTemplateId(r.templateId)
              setPaletteId(r.paletteId)
              setTextureId(r.textureId)
              setSpacerTiles(r.spacerTiles)
              setImageMode(r.imageMode)
              setShowMenuTitle(r.showMenuTitle)
              setShowVignette(r.showVignette)
              setItemBorders(r.itemBorders)
              setItemDropShadow(r.itemDropShadow)
              setFillItemTiles(r.fillItemTiles)
              setShowCategoryTitles(r.showCategoryTitles)
              setShowLogoTile(r.showLogoTile)
              setShowCategoryHeaderTiles(r.showCategoryHeaderTiles)
              setShowBanner(r.showBanner)
              setBannerTitle(r.bannerTitle)
              setShowBannerTitle(r.showBannerTitle)
              setShowVenueName(r.showVenueName)
              setBannerSwapLayout(r.bannerSwapLayout)
              setBannerImageStyle(r.bannerImageStyle)
              setFontStylePreset(r.fontStylePreset)
              // DB state is authoritative: use DB flagship if present, null if DB has no flagship.
              // Do NOT fall back to the stale saved-selection value when the flagship was cleared in the DB.
              const dbFlagshipId = data.data.items?.find((i: any) => i.isFlagship)?.id ?? 
                                 data.data.categories?.flatMap((c: any) => c.items).find((i: any) => i.isFlagship)?.id
              setFlagshipItemId(dbFlagshipId ?? null)
              setBannerHeroTransform(r.bannerHeroTransform)
              setBannerLogoTransform(r.bannerLogoTransform)
                  setCentreAlignment(r.centreAlignment)
            }
          }
        } catch (e) {
          console.error('Menu loading error:', e)
          showToast({
            type: 'error',
            title: 'Failed to load menu',
            description: e instanceof Error ? e.message : 'Unknown error'
          })
        }
      }
      setLoading(false)
    }

    loadMenuData()
  }, [menuId, pathname, router, showToast])

  // Load user's email address for export notifications (best-effort)
  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const resp = await fetch('/api/profile')
        if (!resp.ok) return
        const json = await resp.json().catch(() => ({}))
        const email = json?.data?.email
        if (!mounted) return
        if (typeof email === 'string' && email.includes('@')) {
          setDeliveryEmail(email)
        }
      } catch {
        // best-effort
      }
    })()

    return () => {
      mounted = false
    }
  }, [menuId])

  const refreshMenuData = useCallback(async () => {
    if (isDemoUser || isDemo) return null

    const resp = await fetch(`/api/menus/${menuId}`, { cache: 'no-store' })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok || !data?.data) {
      throw new Error(data?.error || 'Failed to refresh menu')
    }
    setMenu(data.data)
    return data.data as Menu
  }, [isDemo, isDemoUser, menuId])

  // Fetch layout preview
  const fetchLayoutPreview = useCallback(async (assetVersion?: string) => {
    if (!menu) return

    setPreviewLoading(true)
    setPreviewError(null)

    try {
      let resp
      const config = {
        paletteId,
        imageMode,
        fillersEnabled: spacerTiles !== 'none',
        spacerTilePatternId: (spacerTiles !== 'none' ? spacerTiles : undefined),
        textOnly,
        showMenuTitle,
        showCategoryTitles,
        showLogoTile,
        showCategoryHeaderTiles,
        showFlagshipTile: isFlagshipTileVisible,
        centreAlignment,
        showBanner,
        bannerTitle,
        showBannerTitle,
        showVenueName,
        bannerSwapLayout,
        bannerImageStyle,
        fontStylePreset,
        flagshipItemId: effectiveFlagshipItemId ?? undefined,
        engineVersion: 'v2'
      }

      if (isDemoUser) {
        resp = await fetch(`/api/menus/${menuId}/layout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu,
            templateId,
            configuration: config
          })
        })
      } else {
        const params = new URLSearchParams({
          templateId,
          paletteId,
          imageMode,
          fillersEnabled: (spacerTiles !== 'none').toString(),
          spacerTilePatternId: spacerTiles !== 'none' ? spacerTiles : '',
          textOnly: textOnly.toString(),
          showMenuTitle: showMenuTitle.toString(),
          showCategoryTitles: showCategoryTitles.toString(),
          showLogoTile: showLogoTile.toString(),
          showCategoryHeaderTiles: showCategoryHeaderTiles.toString(),
          showFlagshipTile: isFlagshipTileVisible.toString(),
          centreAlignment: centreAlignment.toString(),
          showBanner: showBanner.toString(),
          bannerTitle,
          showBannerTitle: showBannerTitle.toString(),
          showVenueName: showVenueName.toString(),
          bannerSwapLayout: bannerSwapLayout.toString(),
          bannerImageStyle,
          fontStylePreset,
          ...(effectiveFlagshipItemId ? { flagshipItemId: effectiveFlagshipItemId } : {}),
          engineVersion: 'v2'
        })
        const effectiveAssetVersion = assetVersion ?? previewAssetVersion
        if (effectiveAssetVersion) params.set('assetVersion', effectiveAssetVersion)
        resp = await fetch(`/api/menus/${menuId}/layout?${params.toString()}`)
      }
      
      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data?.error || 'Failed to generate layout')
      }

      setLayoutDocument(data.data)
      // Reset page index if current is out of bounds
      if (data.data.pages && currentPageIndex >= data.data.pages.length) {
        setCurrentPageIndex(0)
      }
    } catch (e) {
      console.error('Error fetching layout:', e)
      setPreviewError(e instanceof Error ? e.message : 'Failed to load preview')
    } finally {
      setPreviewLoading(false)
    }
  }, [menu, menuId, templateId, paletteId, imageMode, spacerTiles, textOnly, showMenuTitle, showCategoryTitles, showLogoTile, showCategoryHeaderTiles, isFlagshipTileVisible, centreAlignment, showBanner, bannerTitle, showBannerTitle, showVenueName, bannerSwapLayout, bannerImageStyle, fontStylePreset, effectiveFlagshipItemId, isDemoUser, previewAssetVersion])

  useEffect(() => {
    if (isDemo) return

    const currentActiveItemIds = new Set(
      (imageGenerationStatus?.activeJobs ?? []).map(job => job.menuItemId)
    )
    const completedItemIds = Array.from(previousActiveImageItemIds.current)
      .filter(itemId => !currentActiveItemIds.has(itemId))

    previousActiveImageItemIds.current = currentActiveItemIds

    const currentImageFingerprints = Object.fromEntries(
      Object.entries(imageStatusByItem).map(([itemId, image]) => [
        itemId,
        [
          image.id,
          image.desktopUrl ?? '',
          image.cutoutUrl ?? '',
          image.cutoutStatus,
        ].join('|'),
      ])
    )
    const previousImageFingerprints = previousImageFingerprintsByItem.current
    const hasPreviousImageFingerprint = Object.keys(previousImageFingerprints).length > 0
    previousImageFingerprintsByItem.current = currentImageFingerprints

    const changedImageItemIds = hasPreviousImageFingerprint
      ? Object.entries(currentImageFingerprints)
          .filter(([itemId, fingerprint]) => previousImageFingerprints[itemId] !== fingerprint)
          .map(([itemId]) => itemId)
      : []

    const refreshItemIds = Array.from(new Set([...completedItemIds, ...changedImageItemIds]))
    if (refreshItemIds.length === 0) return

    setRefreshingCompletedImageItemIds(prev => {
      const next = new Set(prev)
      refreshItemIds.forEach(itemId => next.add(itemId))
      return next
    })

    const assetVersion = `${Date.now()}-${refreshItemIds.join('-')}`
    setPreviewAssetVersion(assetVersion)
    void refreshMenuData()
      .catch((error) => {
        console.warn('[Template] Failed to refresh menu after image update', error)
      })
      .then(() => fetchLayoutPreview(assetVersion))
      .then(() => {
        setPreviewImageReadyPulse(true)
        window.setTimeout(() => setPreviewImageReadyPulse(false), 700)
      })
      .finally(() => {
      setRefreshingCompletedImageItemIds(prev => {
        const next = new Set(prev)
        refreshItemIds.forEach(itemId => next.delete(itemId))
        return next
      })
    })
  }, [fetchLayoutPreview, imageGenerationStatus?.activeJobs, imageStatusByItem, isDemo, refreshMenuData])

  const handleImageTransformChange = useCallback((itemId: string, transform: ImageTransform) => {
    const mode = imageMode === 'none' ? 'stretch' : imageMode

    setImageTransformRecords(prev => {
      const next = new Map(prev)
      const existing = next.get(itemId) ?? {}
      next.set(itemId, { ...existing, [mode]: transform })
      return next
    })

    // Debounced save (per item)
    const existingTimeout = imageTransformSaveTimeout.current.get(itemId)
    if (existingTimeout) clearTimeout(existingTimeout)

    const timeout = setTimeout(async () => {
      imageTransformSaveTimeout.current.delete(itemId)
      try {
        if (isDemoUser) {
          const storedDemoMenu = sessionStorage.getItem('demoMenu')
          if (storedDemoMenu) {
            const parsed = JSON.parse(storedDemoMenu)
            const mergeTransform = (items: Array<Record<string, unknown>>) =>
              items.map(item => {
                if (item.id !== itemId) return item
                const existing = normalizeImageTransformRecord(item.imageTransform) ?? {}
                return { ...item, imageTransform: { ...existing, [mode]: transform } }
              })
            if (Array.isArray(parsed.items)) parsed.items = mergeTransform(parsed.items)
            if (Array.isArray(parsed.categories)) {
              parsed.categories = parsed.categories.map((cat: Record<string, unknown>) => ({
                ...cat,
                items: Array.isArray(cat.items) ? mergeTransform(cat.items as Array<Record<string, unknown>>) : cat.items
              }))
            }
            sessionStorage.setItem('demoMenu', JSON.stringify(parsed))
          }
        } else {
          await fetch(`/api/menu-items/${itemId}/image-transform`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, ...transform })
          })
        }
      } catch {
        // best-effort save; local state already updated
      }
    }, 500)

    imageTransformSaveTimeout.current.set(itemId, timeout)
  }, [isDemoUser, imageMode])

  /** Handle banner hero/logo transform changes — debounced save into configuration */
  const handleBannerTransformChange = useCallback((target: 'hero' | 'logo', transform: ImageTransform) => {
    if (target === 'hero') setBannerHeroTransform(transform)
    else setBannerLogoTransform(transform)

    // Debounced save: banner transforms are stored in the template configuration
    if (bannerTransformSaveTimeout.current) clearTimeout(bannerTransformSaveTimeout.current)
    bannerTransformSaveTimeout.current = setTimeout(async () => {
      bannerTransformSaveTimeout.current = null
      if (isDemoUser) return // demo: state is enough, no API call needed
      // Transforms are persisted via the template-selection save on navigation/export
      // No separate API call needed here — the draft effect handles persistence
    }, 500)
  }, [isDemoUser])
  const flushImageTransformSaves = useCallback(async () => {
    const pendingItemIds = Array.from(imageTransformSaveTimeout.current.keys())
    if (pendingItemIds.length === 0) return

    for (const id of pendingItemIds) {
      clearTimeout(imageTransformSaveTimeout.current.get(id)!)
      imageTransformSaveTimeout.current.delete(id)
    }

    const mode = imageMode === 'none' ? 'stretch' : imageMode
    const records = imageTransformRecordsRef.current

    for (const itemId of pendingItemIds) {
      const record = records.get(itemId)
      const transform = record?.[mode]
      if (!transform) continue

      try {
        if (isDemoUser) {
          const storedDemoMenu = sessionStorage.getItem('demoMenu')
          if (storedDemoMenu) {
            const parsed = JSON.parse(storedDemoMenu)
            const mergeTransform = (items: Array<Record<string, unknown>>) =>
              items.map(item => {
                if (item.id !== itemId) return item
                const existing = normalizeImageTransformRecord(item.imageTransform) ?? {}
                return { ...item, imageTransform: { ...existing, [mode]: transform } }
              })
            if (Array.isArray(parsed.items)) parsed.items = mergeTransform(parsed.items)
            if (Array.isArray(parsed.categories)) {
              parsed.categories = parsed.categories.map((cat: Record<string, unknown>) => ({
                ...cat,
                items: Array.isArray(cat.items) ? mergeTransform(cat.items as Array<Record<string, unknown>>) : cat.items
              }))
            }
            sessionStorage.setItem('demoMenu', JSON.stringify(parsed))
          }
        } else {
          await fetch(`/api/menu-items/${itemId}/image-transform`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, ...transform })
          })
        }
      } catch {
        // best-effort
      }
    }
  }, [isDemoUser, imageMode])

  // Flush pending image transforms on unmount (e.g. browser back, tab close)
  useEffect(() => {
    return () => {
      if (imageTransformSaveTimeout.current.size > 0) {
        // Fire-and-forget: attempt to save before page unload (best-effort)
        flushImageTransformSaves()
      }
    }
  }, [flushImageTransformSaves])

  // Debounced preview update
  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    debounceTimeout.current = setTimeout(() => {
      fetchLayoutPreview()
    }, 400)
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
    }
  }, [fetchLayoutPreview])

  // Persist current config to session draft so template ↔ extracted preserves state
  useEffect(() => {
    if (!menu) return
    const configuration = {
      textOnly,
      fillersEnabled: spacerTiles !== 'none',
      spacerTiles,
      spacerTilePatternId: spacerTiles !== 'none' ? spacerTiles : undefined,
      texturesEnabled: !!textureId,
      textureId: textureId ?? undefined,
      showMenuTitle,
      showVignette,
      itemBorders,
      itemDropShadow,
      fillItemTiles,
      showCategoryTitles,
      showLogoTile,
      showCategoryHeaderTiles,
      showFlagshipTile: isFlagshipTileVisible,
      centreAlignment,
      colourPaletteId: paletteId,
      imageMode,
      showBanner,
      bannerTitle,
      showBannerTitle,
      showVenueName,
      bannerSwapLayout,
      bannerImageStyle,
      fontStylePreset,
      flagshipItemId: effectiveFlagshipItemId ?? undefined,
      bannerHeroTransform: bannerHeroTransform ?? undefined,
      bannerLogoTransform: bannerLogoTransform ?? undefined,
    }
    draftConfigRef.current = { templateId, configuration }
    if (draftWriteTimeout.current) clearTimeout(draftWriteTimeout.current)
    draftWriteTimeout.current = setTimeout(() => {
      sessionStorage.setItem(TEMPLATE_DRAFT_KEY(menuId), JSON.stringify(draftConfigRef.current))
    }, 500)

    // Auto-save to DB for authenticated users (3s debounce, silent)
    if (!isDemo) {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current)
      autoSaveTimeout.current = setTimeout(async () => {
        if (!draftConfigRef.current) return
        try {
          await fetch(`/api/menus/${menuId}/template-selection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateId: draftConfigRef.current.templateId,
              configuration: draftConfigRef.current.configuration,
            }),
          })
        } catch {
          // Silent — auto-save failures don't interrupt the user
        }
      }, 3000)
    }

    return () => {
      if (draftWriteTimeout.current) clearTimeout(draftWriteTimeout.current)
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current)
      if (draftConfigRef.current) {
        sessionStorage.setItem(TEMPLATE_DRAFT_KEY(menuId), JSON.stringify(draftConfigRef.current))
      }
    }
  }, [menu, menuId, templateId, paletteId, imageMode, spacerTiles, textOnly, textureId, showMenuTitle, showVignette, itemBorders, itemDropShadow, fillItemTiles, showCategoryTitles, showLogoTile, showCategoryHeaderTiles, isFlagshipTileVisible, centreAlignment, showBanner, bannerTitle, showBannerTitle, showVenueName, bannerSwapLayout, bannerImageStyle, fontStylePreset, flagshipItemId, bannerHeroTransform, bannerLogoTransform, isDemo])

  const handleSelectTemplate = async () => {
    if (!menu) return

    // Cancel any pending auto-save — the explicit save below takes over
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current)
      autoSaveTimeout.current = null
    }

    setIsSaving(true)
    try {
      await flushImageTransformSaves()
      const configuration = buildCurrentConfiguration()

      // Fire template_selected when the user confirms their template choice.
      // orientation is derived from the templateId (landscape vs portrait).
      // template_name is looked up from V2_TEMPLATE_OPTIONS.
      const selectedTemplateOption = V2_TEMPLATE_OPTIONS.find(t => t.id === templateId)
      captureEvent(ANALYTICS_EVENTS.TEMPLATE_SELECTED, {
        template_id: templateId,
        template_name: selectedTemplateOption?.name ?? templateId,
        orientation: templateId.includes('landscape') ? 'landscape' : 'portrait',
      })

      if (isDemoUser) {
        sessionStorage.setItem(`templateSelection-${menuId}`, JSON.stringify({
          menuId,
          templateId,
          templateVersion: '2.0.0',
          configuration
        }))
        sessionStorage.removeItem(TEMPLATE_DRAFT_KEY(menuId))
        router.push(`/menus/${menuId}/export`)
      } else {
        const resp = await fetch(`/api/menus/${menuId}/template-selection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId,
            configuration
          })
        })

        if (!resp.ok) {
          const data = await resp.json()
          throw new Error(data?.error || 'Failed to save template selection')
        }
        markDashboardForRefresh()
        sessionStorage.removeItem(TEMPLATE_DRAFT_KEY(menuId))
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error applying template:', error)
      showToast({
        type: 'error',
        title: 'Selection failed',
        description: error instanceof Error ? error.message : 'Please try again.'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleExportPDF = async () => {
    if (!menu || !layoutDocument || isExporting) return

    if (!isDemoUser) {
      const latestImageStatus = await refreshImageGenerationStatus()
      const activeCount = latestImageStatus?.activeCount ?? activeImageJobCount
      const activeCutouts = latestImageStatus?.activeCutoutCount ?? activeCutoutCount
      if (activeCount > 0 || activeCutouts > 0) {
        showToast({
          type: 'info',
          title: activeCount > 0 ? 'Photos still generating' : 'Cutouts still preparing',
          description: 'Export will be available once background image processing finishes.',
        })
        return
      }
    }

    setIsExporting(true)
    setExportStatus('Submitting...')
    await flushImageTransformSaves()
    
    // Track export start
    trackConversionEvent({
      event: 'export_start',
      metadata: {
        path: `/menus/${menuId}/template`,
        format: 'pdf',
        isDemo: isDemoUser,
      },
    })

    // Fire pdf_export_started BEFORE any network call (Req 4.9)
    captureEvent(ANALYTICS_EVENTS.PDF_EXPORT_STARTED, {
      menu_id: menuId,
      template_id: templateId,
      orientation: templateId.includes('landscape') ? 'landscape' : 'portrait',
    })

    try {
      const configuration = {
        ...buildCurrentConfiguration(),
        palette: palette,
      }

      // Persist the current configuration and create the export job in parallel.
      // The save must complete before navigation so the dashboard reads the latest config.
      const savePromise = (!isDemoUser && templateId)
        ? fetch(`/api/menus/${menuId}/template-selection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateId, configuration: buildCurrentConfiguration() }),
          }).catch(() => null)
        : Promise.resolve(null)

      const jobPromise = fetch('/api/export/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_id: menuId,
          export_type: 'pdf',
          template_id: templateId,
          configuration,
          metadata: {
            format: templateId.includes('a3') ? 'A3' : 'A4',
            orientation: templateId.includes('landscape') ? 'landscape' : 'portrait'
          }
        })
      })

      const [, jobResp] = await Promise.all([savePromise, jobPromise])

      const jobData = await jobResp.json().catch(() => ({}))

      if (!jobResp.ok) {
        if (jobResp.status === 429) {
          if (jobData.resetAt) setCooldownResetAt(new Date(jobData.resetAt))
          showToast({
            type: 'info',
            title: 'Export limit reached',
            description: jobData?.error || 'Please wait and try again.',
          })
          setIsExporting(false)
          setExportStatus(null)
          return
        }
        throw new Error(jobData?.error || 'Failed to create export job')
      }

      // Signal to the dashboard that a recent export is pending so it can gate download buttons.
      // Include the full configuration so MenuCard can use it directly for subsequent exports
      // without relying on the auto-save having reached the DB yet.
      if (jobData.job_id) {
        try {
          sessionStorage.setItem(`pendingExportJob-${menuId}`, JSON.stringify({
            jobId: jobData.job_id,
            createdAt: Date.now(),
            configuration: buildCurrentConfiguration(),
            templateId,
          }))
        } catch { /* sessionStorage unavailable */ }
        markDashboardForRefresh()
      }

      trackConversionEvent({
        event: 'export_submitted',
        metadata: {
          path: `/menus/${menuId}/template`,
          format: 'pdf',
          isDemo: isDemoUser,
        },
      })

      setExportStatus(null)
      setExportSuccessModalOpen(true)

    } catch (error) {
      console.error('Error exporting PDF:', error)
      showToast({
        type: 'error',
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'Failed to submit export request.'
      })
      
      trackConversionEvent({
        event: 'ux_error',
        metadata: {
          path: `/menus/${menuId}/template`,
          format: 'pdf',
          isDemo: isDemoUser,
        },
      })
      setIsExporting(false)
      setExportStatus(null)
    }
  }

  const totalPages = layoutDocument?.pages?.length || 0
  const currentPage = layoutDocument?.pages?.[currentPageIndex]
  const pendingPreviewOverlays = useMemo(() => {
    if (!layoutDocument?.pageSpec || !currentPage || imageMode === 'none') return []

    return currentPage.tiles.flatMap((tile) => {
      const content = tile.content as { itemId?: string; name?: string; showImage?: boolean }
      if (!content.itemId || content.showImage === false) return []

      const job = latestImageJobByItem[content.itemId]
      const image = imageStatusByItem[content.itemId]
      const cutoutIsActive = isActiveCutoutStatus(image?.cutoutStatus)
      const isRefreshingCompleted = refreshingCompletedImageItemIds.has(content.itemId)
      if (!job && !cutoutIsActive && !isRefreshingCompleted) return []
      if (job?.status === 'completed' && !cutoutIsActive && !isRefreshingCompleted) return []

      const region = currentPage.regions.find(r => r.id === tile.regionId)
      if (!region) return []

      const isFullBleed = tile.regionId === 'banner' || tile.regionId === 'footer'
      const left = (isFullBleed ? 0 : layoutDocument.pageSpec.margins.left) + region.x + tile.x
      const top = (isFullBleed ? 0 : layoutDocument.pageSpec.margins.top) + region.y + tile.y

      return [{
        id: `${tile.id}-${job?.id ?? image?.id ?? content.itemId}-${image?.cutoutStatus ?? 'image'}`,
        left,
        top,
        width: tile.width,
        height: tile.height,
        label: isRefreshingCompleted
          ? 'Updating photo'
          : cutoutIsActive
            ? 'Generating cutout'
            : getImageGenerationJobLabel(job) || 'Generating',
        isActive: isActiveImageGenerationJob(job) || cutoutIsActive,
        isFailed: job?.status === 'failed' || image?.cutoutStatus === 'failed' || image?.cutoutStatus === 'timed_out',
      }]
    })
  }, [currentPage, imageMode, imageStatusByItem, latestImageJobByItem, layoutDocument?.pageSpec, refreshingCompletedImageItemIds])

  if (loading) {
    return (
      <UXSection>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ux-primary"></div>
        </div>
      </UXSection>
    )
  }

  const palette = PALETTES_V2.find(p => p.id === paletteId) ?? DEFAULT_PALETTE_V2

  return (
    <UXSection>
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
          Configure Your Menu Layout
        </h1>
        <p className="mt-2 text-white/90 text-hero-shadow-strong">
          Choose a style, colors, and options. See the live preview below.
        </p>
      </div>

      {!isDemo && hasActivePreviewImageWork && (
        <div className="mx-auto mb-6 max-w-[1600px] rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
          <div className="font-semibold">
            {hasActiveImageJobs
              ? `${activeImageJobCount} photo ${activeImageJobCount === 1 ? 'is' : 'photos are'} still generating`
              : `${activeCutoutCount} cutout ${activeCutoutCount === 1 ? 'is' : 'cutouts are'} still preparing`}
          </div>
          <p className="mt-1 text-amber-800">
            Pending image tiles are marked in the preview. They will update automatically as soon as processing finishes.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1600px] mx-auto">
        {/* Left Column: Controls */}
        <div className="lg:col-span-4 space-y-6">
          <UXCard className="overflow-visible">
            <div className="p-6 space-y-2">
              {/* Menu Summary */}
              <div className="flex items-center space-x-4 border-b pb-6 mb-2">
                <MenuThumbnailBadge imageUrl={menu?.imageUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-ux-text">{menu?.name}</h3>
                  <p className="text-xs text-ux-text-secondary">{menu?.items?.length || 0} items ready</p>
                </div>
                {isDemoUser && (
                  <button
                    onClick={() => {
                      setTemplateId(DEMO_DEFAULTS.templateId)
                      setPaletteId(DEMO_DEFAULTS.paletteId)
                      setImageMode(DEMO_DEFAULTS.imageMode)
                      setSpacerTiles(DEMO_DEFAULTS.spacerTiles)
                      setTextureId(DEMO_DEFAULTS.textureId)
                      setShowMenuTitle(DEMO_DEFAULTS.showMenuTitle)
                      setShowVignette(DEMO_DEFAULTS.showVignette)
                      setItemBorders(DEMO_DEFAULTS.itemBorders)
                      setItemDropShadow(DEMO_DEFAULTS.itemDropShadow)
                      setFillItemTiles(DEMO_DEFAULTS.fillItemTiles)
                      setShowCategoryTitles(DEMO_DEFAULTS.showCategoryTitles)
                      setShowLogoTile(DEMO_DEFAULTS.showLogoTile)
                      setShowCategoryHeaderTiles(DEMO_DEFAULTS.showCategoryHeaderTiles)
                    }}
                    className="shrink-0 text-xs text-ux-text-secondary hover:text-ux-primary border border-ux-border hover:border-ux-primary rounded px-2 py-1 transition-colors"
                    title="Reset all settings to defaults"
                  >
                    ↺ Reset
                  </button>
                )}
              </div>

              {/* Template Selection */}
              <CollapsibleSection 
                title="Grid Layout" 
                isExpanded={expandedSection === 'Grid Layout'}
                onExpand={(expanded) => setExpandedSection(expanded ? 'Grid Layout' : null)}
              >
                <div className="pt-2 space-y-1.5">
                  {V2_TEMPLATE_OPTIONS.map((t) => {
                    const isSelected = t.id === templateId
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTemplateId(t.id)}
                        className={`w-full text-left rounded-lg border-2 px-3 py-2 transition-all hover:border-ux-primary ${
                          isSelected ? 'border-ux-primary bg-ux-primary/5' : 'border-ux-border bg-white'
                        }`}
                      >
                        <div className={`text-sm font-semibold ${isSelected ? 'text-ux-primary' : 'text-ux-text'}`}>{t.name}</div>
                        <div className="text-[11px] text-ux-text-secondary leading-tight mt-0.5">{t.description}</div>
                      </button>
                    )
                  })}
                </div>
              </CollapsibleSection>

              {/* Palette Selection */}
              <CollapsibleSection 
                title="Color Palette" 
                isExpanded={expandedSection === 'Color Palette'}
                onExpand={(expanded) => setExpandedSection(expanded ? 'Color Palette' : null)}
              >
                <div className="pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    {palettesForGrid.map((p) => {
                      const colors = getPaletteSwatchColors(p)
                      const isSelected = p.id === paletteId
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPalette(p.id)}
                          className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all hover:border-ux-primary ${
                            isSelected ? 'border-ux-primary bg-ux-primary/5' : 'border-ux-border bg-white'
                          }`}
                          title={p.name}
                        >
                          <div className="flex -space-x-1.5">
                            {colors.map((color, i) => (
                              <div key={i} className="h-5 w-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
                            ))}
                          </div>
                          <span className="text-[10px] font-medium text-ux-text text-center leading-tight line-clamp-1">{p.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </CollapsibleSection>

              {/* Banner & Footer */}
              <CollapsibleSection 
                title="Banner & Footer" 
                isExpanded={expandedSection === 'Banner & Footer'}
                onExpand={(expanded) => setExpandedSection(expanded ? 'Banner & Footer' : null)}
              >
                <div className="pt-2 space-y-3">
                  {/* Show Banner toggle — only shown when template supports banner */}
                  {bannerSupported && (
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Show banner</span>
                      <input
                        type="checkbox"
                        checked={showBanner}
                        onChange={(e) => setShowBanner(e.target.checked)}
                        className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                      />
                    </label>
                  )}

                  {/* Controls below are only relevant when banner is supported and enabled */}
                  {bannerSupported && showBanner && (
                    <>
                      {/* Title text input */}
                      <div>
                        <label htmlFor="banner-title-input" className="block text-xs font-semibold text-ux-text-secondary uppercase tracking-wider mb-1 pl-2">
                          Title
                        </label>
                        <input
                          id="banner-title-input"
                          type="text"
                          value={bannerTitle}
                          maxLength={30}
                          onChange={(e) => setBannerTitle(e.target.value.slice(0, 30))}
                          placeholder="MENU"
                          className="w-full px-3 py-2 text-sm border border-ux-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ux-primary bg-white text-ux-text"
                        />
                        <div className="flex justify-between mt-1">
                          {bannerTitle.length >= 16 && (
                            <p className="text-xs text-amber-600">Long titles may wrap or be truncated in the banner</p>
                          )}
                          <p className={`text-xs ml-auto ${bannerTitle.length >= 28 ? 'text-red-500' : 'text-ux-text-secondary'}`}>
                            {bannerTitle.length}/30
                          </p>
                        </div>
                      </div>

                      {/* Banner Image Style selector — immediately after Title */}
                      <div>
                        <p className="text-xs font-semibold text-ux-text-secondary uppercase tracking-wider mb-2 pl-2">Banner image style</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(['cutout', 'stretch-fit', 'none'] as const).map((style) => {
                            const labels = { cutout: 'Cutout', 'stretch-fit': 'Stretch', none: 'None' }
                            const isSelected = bannerImageStyle === style
                            return (
                              <button
                                key={style}
                                type="button"
                                onClick={() => setBannerImageStyle(style)}
                                className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-2 transition-all ${
                                  isSelected ? 'border-ux-primary bg-ux-primary/5 hover:border-ux-primary' : 'border-ux-border bg-white hover:border-ux-primary'
                                }`}
                              >
                                <span className="text-[10px] font-medium text-ux-text text-center leading-tight">{labels[style]}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Show menu title toggle */}
                      <div className="flex items-center justify-between">
                        <label htmlFor="show-banner-title-cb" className="text-sm text-ux-text cursor-pointer">
                          Show menu title
                        </label>
                        <input
                          id="show-banner-title-cb"
                          type="checkbox"
                          checked={showBannerTitle}
                          onChange={(e) => setShowBannerTitle(e.target.checked)}
                          className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                        />
                      </div>

                      {/* Show venue name / logo toggle */}
                      <div className="flex items-center justify-between">
                        <label htmlFor="show-venue-name-cb" className="text-sm text-ux-text cursor-pointer">
                          {menu?.logoUrl ? 'Show venue logo' : 'Show venue name'}
                        </label>
                        <input
                          id="show-venue-name-cb"
                          type="checkbox"
                          checked={showVenueName}
                          onChange={(e) => setShowVenueName(e.target.checked)}
                          className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                        />
                      </div>

                      {/* Switch layout — only relevant when venue name is shown */}
                      {showVenueName && (
                        <div className="flex items-center justify-between">
                          <label htmlFor="banner-swap-layout-cb" className="text-sm text-ux-text cursor-pointer">
                            Switch layout
                          </label>
                          <input
                            id="banner-swap-layout-cb"
                            type="checkbox"
                            checked={bannerSwapLayout}
                            onChange={(e) => setBannerSwapLayout(e.target.checked)}
                            className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CollapsibleSection>

              {/* Background Texture */}
              {(() => {
                const isDark = DARK_PALETTE_IDS.has(paletteId)
                const textureIncompatible = !!textureId && (
                  (DARK_ONLY_TEXTURE_IDS.has(textureId) && !isDark) ||
                  (LIGHT_ONLY_TEXTURE_IDS.has(textureId) && isDark)
                )
                return (
                  <CollapsibleSection
                    title="Background Texture"
                    isExpanded={expandedSection === 'Background Texture'}
                    onExpand={(expanded) => setExpandedSection(expanded ? 'Background Texture' : null)}
                    badge={textureIncompatible ? (
                      <span
                        title="Current texture doesn't suit this palette — consider updating it"
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-bold leading-none shrink-0"
                        aria-label="Texture may not suit this palette"
                      >
                        !
                      </span>
                    ) : undefined}
                  >
                <div className="pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setTextureId(null)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-2 h-14 transition-all hover:border-ux-primary ${
                        textureId === null ? 'border-ux-primary bg-ux-primary/5' : 'border-ux-border bg-white'
                      }`}
                    >
                      <span className="text-[10px] font-medium text-ux-text-secondary">None</span>
                    </button>
                    {TEXTURE_IDS.map((id) => {
                      const isSelected = textureId === id
                      const label = TEXTURE_REGISTRY.get(id)?.label ?? id
                      const isDark = DARK_PALETTE_IDS.has(paletteId)
                      const incompatible =
                        (DARK_ONLY_TEXTURE_IDS.has(id) && !isDark) ||
                        (LIGHT_ONLY_TEXTURE_IDS.has(id) && isDark)
                      const tooltip = incompatible
                        ? DARK_ONLY_TEXTURE_IDS.has(id)
                          ? 'Best with dark palettes (Midnight Gold, Lunar Red & Gold)'
                          : 'Best with light palettes'
                        : label
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => !incompatible && setTextureId(id)}
                          disabled={incompatible}
                          className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-2 h-14 transition-all ${
                            incompatible
                              ? 'border-ux-border bg-white opacity-35 cursor-not-allowed'
                              : isSelected
                                ? 'border-ux-primary bg-ux-primary/5 hover:border-ux-primary'
                                : 'border-ux-border bg-white hover:border-ux-primary'
                          }`}
                          title={tooltip}
                        >
                          <span className="text-[10px] font-medium text-ux-text text-center leading-tight">{label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </CollapsibleSection>
                )
              })()}

              {/* Image Style */}
              <CollapsibleSection 
                title="Image Style" 
                isExpanded={expandedSection === 'Image Style'}
                onExpand={(expanded) => setExpandedSection(expanded ? 'Image Style' : null)}
              >
                <div className="pt-2 space-y-1.5">
                  {(() => {
                    const cutoutAvailable = (() => {
                      const allItems = [
                        ...(menu?.items ?? []),
                        ...(menu?.categories?.flatMap(c => c.items) ?? []),
                      ]
                      return allItems.some(item => item.cutoutStatus === 'succeeded')
                    })()
                    const IMAGE_MODE_OPTIONS = [
                      { value: 'none' as ImageModeV2, label: 'None', description: 'Text only, no images' },
                      { value: 'compact-rect' as ImageModeV2, label: 'Compact (rectangular)', description: 'Smaller image, preserves aspect ratio' },
                      { value: 'compact-circle' as ImageModeV2, label: 'Compact (circular)', description: 'Square crop with circular border' },
                      { value: 'stretch' as ImageModeV2, label: 'Stretch fit', description: 'Image fills tile width' },
                      { value: 'background' as ImageModeV2, label: 'Background', description: 'Full-tile image with text overlay' },
                      { value: 'cutout' as ImageModeV2, label: 'Cutout', description: 'Transparent cut-out images', beta: true, requiresCutout: true },
                    ]
                    return IMAGE_MODE_OPTIONS.map((opt) => {
                      const isSelected = imageMode === opt.value
                      const isDisabled = opt.requiresCutout && !cutoutAvailable
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => !isDisabled && setImageMode(opt.value)}
                          className={`w-full text-left rounded-lg border-2 px-3 py-2 transition-all ${
                            isDisabled ? 'opacity-40 cursor-not-allowed border-ux-border bg-white' :
                            isSelected ? 'border-ux-primary bg-ux-primary/5' : 'border-ux-border bg-white hover:border-ux-primary'
                          }`}
                        >
                          <div className={`text-sm font-semibold flex items-center gap-1.5 ${isSelected ? 'text-ux-primary' : 'text-ux-text'}`}>
                            {opt.label}
                            {opt.beta && <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700">Beta</span>}
                          </div>
                          <div className="text-[11px] text-ux-text-secondary leading-tight mt-0.5">{opt.description}</div>
                        </button>
                      )
                    })
                  })()}
                  {imageMode === 'cutout' && (
                    <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <span className="shrink-0 mt-0.5">⚠</span>
                      <span>Cutout is a beta feature. Results vary by dish — if a cutout looks off, try a different image style.</span>
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* Spacer Tiles */}
              <CollapsibleSection 
                title="Spacer Tiles" 
                isExpanded={expandedSection === 'Spacer Tiles'}
                onExpand={(expanded) => setExpandedSection(expanded ? 'Spacer Tiles' : null)}
              >
                <div className="pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'none', label: 'None' },
                      { value: SPACER_BLANK_ID, label: 'Blank' },
                      { value: 'mix', label: 'Mix' },
                      ...FILLER_PATTERN_IDS.map(id => ({ value: id, label: FILLER_PATTERN_REGISTRY.get(id)?.label ?? id })),
                    ].map(({ value, label }) => {
                      const isSelected = spacerTiles === value
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSpacerTiles(value as 'blank' | 'none' | string)}
                          className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-2 h-14 transition-all hover:border-ux-primary ${
                            isSelected
                              ? 'border-ux-primary bg-ux-primary/5'
                              : 'border-ux-border bg-white'
                          }`}
                          title={label}
                        >
                          <span className="text-[10px] font-medium text-center leading-tight text-ux-text">{label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </CollapsibleSection>

              {/* Font Style */}
              <CollapsibleSection 
                title="Font Style" 
                isExpanded={expandedSection === 'Font Style'}
                onExpand={(expanded) => setExpandedSection(expanded ? 'Font Style' : null)}
              >
                <div className="pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    {(['standard', 'serif', 'fun', 'strong', 'future', 'handwriting', 'elegant'] as const).map((preset) => {
                      const labels: Record<string, string> = { standard: 'Standard', strong: 'Strong', fun: 'Fun', serif: 'Serif', future: 'Future', handwriting: 'Handwriting', elegant: 'Elegant' }
                      const isSelected = fontStylePreset === preset
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setFontStylePreset(preset)}
                          className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-2 transition-all ${
                            isSelected ? 'border-ux-primary bg-ux-primary/5 hover:border-ux-primary' : 'border-ux-border bg-white hover:border-ux-primary'
                          }`}
                        >
                          <span className="text-[10px] font-medium text-ux-text text-center leading-tight">{labels[preset]}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </CollapsibleSection>

              {/* Display Options */}
              <CollapsibleSection 
                title="Display Options" 
                isExpanded={expandedSection === 'Display Options'}
                onExpand={(expanded) => setExpandedSection(expanded ? 'Display Options' : null)}
              >
                <div className="pt-2 space-y-3">
                  {(() => {
                    const tileOptionsDisabled = paletteId === 'galactic-menu'
                    return (
                      <>
                        <label className={`flex items-center justify-between group ${tileOptionsDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <span className={`text-sm text-ux-text transition-colors ${tileOptionsDisabled ? '' : 'group-hover:text-ux-primary'}`}>Logo / title as tile</span>
                          <input
                            type="checkbox"
                            checked={tileOptionsDisabled ? false : showLogoTile}
                            disabled={tileOptionsDisabled}
                            onChange={(e) => setShowLogoTile(e.target.checked)}
                            className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5 disabled:cursor-not-allowed"
                          />
                        </label>

                        <label className={`flex items-center justify-between group ${(tileOptionsDisabled || !showCategoryTitles) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <span className={`text-sm text-ux-text transition-colors ${(tileOptionsDisabled || !showCategoryTitles) ? '' : 'group-hover:text-ux-primary'}`}>Category name as tiles</span>
                          <input
                            type="checkbox"
                            checked={tileOptionsDisabled ? false : showCategoryHeaderTiles}
                            disabled={tileOptionsDisabled || !showCategoryTitles}
                            onChange={(e) => setShowCategoryHeaderTiles(e.target.checked)}
                            className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5 disabled:cursor-not-allowed"
                          />
                        </label>
                      </>
                    )
                  })()}

                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Show category title(s)</span>
                    <input
                      type="checkbox"
                      checked={showCategoryTitles}
                      onChange={(e) => setShowCategoryTitles(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Vignette edges</span>
                    <input
                      type="checkbox"
                      checked={showVignette}
                      onChange={(e) => setShowVignette(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Fill item tiles</span>
                    <input
                      type="checkbox"
                      checked={fillItemTiles}
                      onChange={(e) => setFillItemTiles(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Item borders</span>
                    <input
                      type="checkbox"
                      checked={itemBorders}
                      onChange={(e) => setItemBorders(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Item drop shadow</span>
                    <input
                      type="checkbox"
                      checked={itemDropShadow}
                      onChange={(e) => setItemDropShadow(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-ux-text group-hover:text-ux-primary transition-colors">Centre alignment</span>
                    <input
                      type="checkbox"
                      checked={centreAlignment}
                      onChange={(e) => setCentreAlignment(e.target.checked)}
                      className="rounded text-ux-primary focus:ring-ux-primary h-5 w-5"
                    />
                  </label>
                </div>
              </CollapsibleSection>
            </div>
          </UXCard>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-8 space-y-4">
          <UXCard className="bg-neutral-100 min-h-[600px] flex flex-col">
            <div className="p-4 border-b bg-white flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isPreviewLoading ? 'bg-amber-400 animate-pulse' : 'bg-green-500'}`} />
                <span className="text-xs font-bold uppercase tracking-tighter text-ux-text-secondary">
                  {isPreviewLoading ? 'Updating Preview...' : 'Live Preview'}
                </span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center bg-neutral-100 rounded-lg p-1">
                  <button
                    onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                    disabled={currentPageIndex === 0}
                    className="p-1 px-3 hover:bg-white rounded-md disabled:opacity-30 transition-all text-xs font-bold"
                  >
                    ←
                  </button>
                  <span className="px-4 text-xs font-mono">
                    Page {currentPageIndex + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPageIndex(Math.min(totalPages - 1, currentPageIndex + 1))}
                    disabled={currentPageIndex === totalPages - 1}
                    className="p-1 px-3 hover:bg-white rounded-md disabled:opacity-30 transition-all text-xs font-bold"
                  >
                    →
                  </button>
                </div>
              )}

              <div className="flex items-center space-x-4">
                {/* Image Edit Lock toggle — shown when there's something editable:
                    item images (imageMode active), banner hero image (banner on + image style set),
                    or banner logo image (banner on + menu has a logo) */}
                {(imageMode !== 'none' || (showBanner && bannerImageStyle !== 'none') || (showBanner && !!menu?.logoUrl)) && (
                  <button
                    onClick={() => setImageEditUnlocked(v => !v)}
                    title={imageEditUnlocked ? 'Lock image edits' : 'Unlock image edits (drag to reposition, scroll to zoom)'}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      imageEditUnlocked
                        ? 'bg-teal-500 text-white hover:bg-teal-600'
                        : 'bg-neutral-200 text-ux-text-secondary hover:bg-neutral-300'
                    }`}
                  >
                    {imageEditUnlocked ? (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 018 0v4M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z" />
                        </svg>
                        Image Edit On
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Image Edit
                      </>
                    )}
                  </button>
                )}
              <div className="flex items-center space-x-2">
              <span className="text-[8px] font-bold text-ux-text-secondary uppercase">Zoom</span>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-24 h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-ux-primary"
                  />
                  <span className="text-[8px] font-mono w-8">{Math.round(zoom * 100)}%</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-8 bg-neutral-200/50 relative">
              {previewError ? (
                <div className="flex justify-center items-start h-full">
                  <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center">
                    <div className="text-4xl mb-4">⚠️</div>
                    <h3 className="text-lg font-bold text-red-600 mb-2">Preview Generation Failed</h3>
                    <p className="text-sm text-ux-text-secondary mb-6">{previewError}</p>
                    <UXButton variant="outline" size="sm" onClick={() => void fetchLayoutPreview()}>Try Again</UXButton>
                  </div>
                </div>
              ) : layoutDocument?.pageSpec && currentPage ? (
                <div
                  className="transition-all duration-300 ease-out"
                  style={{
                    width: layoutDocument.pageSpec.width * zoom,
                    height: layoutDocument.pageSpec.height * zoom,
                    margin: '0 auto',
                    flexShrink: 0,
                  }}
                >
                  <div 
                    className={`shadow-2xl bg-white transition-[filter,opacity,transform] duration-500 ease-out ${
                      previewImageReadyPulse ? 'scale-[1.004] brightness-105' : ''
                    }`}
                    style={{
                      width: layoutDocument.pageSpec.width,
                      height: layoutDocument.pageSpec.height,
                      position: 'relative',
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
                        texturesEnabled: !!textureId,
                        textureId: textureId ?? undefined,
                        // Pass real 'none' so the renderer matches text-only + featured layout (ITEM_TEXT_ROW
                        // must not reserve badge height when image style is None). Layout is already built
                        // with textOnly; coercing to 'stretch' here incorrectly re-enabled that reserve.
                        imageMode,
                        showVignette,
                        itemBorders,
                        itemDropShadow,
                        fillItemTiles,
                        showCategoryTitles,
                        centreAlignment,
                        showGridOverlay: false,
                        showRegionBounds: false,
                        showTileIds: false,
                        isExport: false,
                        spacerTilePatternId: spacerTiles !== 'none' ? spacerTiles : undefined,
                        fontStylePreset,
                        imageEditMode: imageEditUnlocked,
                        imageTransforms,
                        onImageTransformChange: imageEditUnlocked ? handleImageTransformChange : undefined,
                        bannerHeroTransform,
                        bannerLogoTransform,
                        onBannerTransformChange: imageEditUnlocked ? handleBannerTransformChange : undefined
                      }}
                    />
                    {pendingPreviewOverlays.length > 0 && (
                      <div className="pointer-events-none absolute inset-0 z-20">
                        {pendingPreviewOverlays.map((overlay) => (
                          <div
                            key={overlay.id}
                            className={`absolute flex items-center justify-center rounded-md border-2 border-dashed px-2 text-center text-[10px] font-bold uppercase tracking-wide transition-opacity duration-300 ${
                              overlay.isFailed
                                ? 'border-red-500 bg-red-500/20 text-red-900'
                                : 'border-amber-500 bg-amber-400/25 text-amber-950'
                            }`}
                            style={{
                              left: overlay.left,
                              top: overlay.top,
                              width: overlay.width,
                              height: overlay.height,
                            }}
                            aria-hidden="true"
                          >
                            <span className="rounded bg-white/85 px-2 py-1 shadow-sm">
                              {overlay.isActive && overlay.label !== 'Generating cutout' ? 'Generating photo' : overlay.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full opacity-40 py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ux-primary mb-4"></div>
                  <p className="text-sm font-medium">Generating your preview...</p>
                </div>
              )}
            </div>
          </UXCard>
          
          <div className="text-center text-[8px] text-white/50 uppercase tracking-widest py-2">
            The preview accurately represents your final PDF export
          </div>
        </div>
      </div>

      {/* Action Buttons at bottom */}
      <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
        <UXButton
          variant="outline"
          size="lg"
          className="bg-white/20 border-white/40 text-white hover:bg-white/30 w-full sm:w-auto min-w-[200px]"
          onClick={async () => {
            await flushImageTransformSaves()
            // Flush draft immediately so Back to Items always preserves current config
            if (menu) {
              const configuration = {
                textOnly,
                fillersEnabled: spacerTiles !== 'none',
                spacerTiles,
                spacerTilePatternId: spacerTiles !== 'none' ? spacerTiles : undefined,
                texturesEnabled: !!textureId,
                textureId: textureId ?? undefined,
                showMenuTitle,
                showVignette,
                itemBorders,
                itemDropShadow,
                fillItemTiles,
                showCategoryTitles,
                showLogoTile,
                showCategoryHeaderTiles,
                showFlagshipTile: isFlagshipTileVisible,
                colourPaletteId: paletteId,
                imageMode,
                centreAlignment,
                flagshipItemId: effectiveFlagshipItemId ?? undefined
              }
              sessionStorage.setItem(TEMPLATE_DRAFT_KEY(menuId), JSON.stringify({ templateId, configuration }))
            }
            router.push(`/menus/${menuId}/extracted`)
          }}
          disabled={isSaving || isExporting}
        >
          ← Back to Items
        </UXButton>

        {!isDemoUser && (
          <UXButton
            variant="warning"
            size="lg"
            className="w-full sm:w-auto min-w-[200px] shadow-lg"
            onClick={handleExportPDF}
            loading={isExporting}
          disabled={!layoutDocument || !!previewError || isSaving || isExporting || !!cooldownRemaining || hasActivePreviewImageWork}
          >
            <span className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {hasActivePreviewImageWork ? 'Waiting for photos' : cooldownRemaining ? `Available in ${cooldownRemaining}` : (exportStatus || 'Export PDF')}
            </span>
          </UXButton>
        )}

        <UXButton
          variant="primary"
          size="lg"
          className="w-full sm:w-auto min-w-[200px] shadow-lg"
          onClick={handleSelectTemplate}
          loading={isSaving}
          disabled={!layoutDocument || !!previewError || isExporting}
        >
          {isDemoUser ? 'Confirm and Export →' : 'Save & Return'}
        </UXButton>
      </div>

      {!isDemoUser && hasActivePreviewImageWork && (
        <p className="mt-3 text-center text-sm text-white/85 text-hero-shadow-strong">
          Export is locked until all queued photos and cutouts have finished.
        </p>
      )}

      {exportSuccessModalOpen && mounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-lg overflow-hidden my-8">
            <div className="px-4 py-3 border-b">
              <h3 className="font-medium text-secondary-900">Export started</h3>
            </div>
            <div className="px-4 py-3 text-sm text-secondary-700">
              Your PDF is being generated and will be emailed to you when it&apos;s ready. You can return to your dashboard now.
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2 bg-gray-50/50">
              <button
                className="px-3 py-2 text-sm rounded-md text-white shadow-sm bg-primary-600 hover:bg-primary-700"
                onClick={async () => {
                  setExportSuccessModalOpen(false)
                  setIsExporting(false)
                  await flushImageTransformSaves()
                  router.push('/dashboard')
                }}
              >
                Okay
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </UXSection>
  )
}
