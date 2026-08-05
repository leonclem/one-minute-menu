'use client'

/**
 * Customer-facing Food Photo Studio — control panel + preview/variants shell.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { AllowedMimeType, SourceImage } from '@/lib/photo-control/image-uploader'
import { uploadStudioSourceFile, removeStudioStorageObject } from '@/lib/studio/client-upload'
import { hydrate } from '@/lib/photo-control/hydrator'
import { computeDelta, countEditableChanges } from '@/lib/photo-control/state-delta'
import { generateDirective } from '@/lib/photo-control/directive-generator'
import { MAX_PENDING_CHANGES } from '@/lib/photo-control/edit-limits'
import { CENTER, type AngleValue, type EditorState } from '@/lib/photo-control/minimal-schema'
import { type MinimalValidationResult } from '@/lib/photo-control/schema-validator'
import type { ExtractionDiagnostics } from '@/lib/studio/extraction-diagnostics'
import { ANALYTICS_EVENTS } from '@/lib/posthog/events'
import {
  toModelClass,
  trackStudioEvent,
  trackStudioGenerationCompleted,
} from '@/lib/studio/analytics/studio-analytics'
import { Component_Control } from '@/components/photo-controls'
import { CollapsibleSection } from '@/components/ux'
import { ConfirmDialog } from '@/components/ui'
import { buildChangeSummary, readChangeSummary } from '@/lib/studio/change-summary'
import {
  STUDIO_LIGHTING_OPTIONS,
  backgroundStylesToOptions,
  fohLightingLabel,
  lightingStylesToOptions,
  styleLabelMap,
  FOH_STYLE_EXCLUDE_PATHS,
} from '@/lib/studio/control-options'
import {
  editorStateToMetadata,
  readEditorStateFromMetadata,
} from '@/lib/studio/editor-state-storage'
import {
  ensureBackgroundRestageBaseline,
  ensureSurfaceRestageBaseline,
  ensureLightingRestageBaseline,
} from '@/lib/studio/restage'
import type {
  StudioBackgroundStyleDisplay,
  StudioDishListItem,
  StudioDishRecord,
  StudioImageRecord,
  StudioLightingStyleDisplay,
} from '@/lib/studio/types'
import type { StudioAccessReason } from '@/lib/studio/access/studio-access-decision'
import { resolveStudioAccessMode, type AccessMode } from '@/lib/studio/access/studio-access-mode'
import { getStudioViewSelection } from './studio-view-state'
import { StudioStateNotice } from './studio-state-notice'
import { StudioFirstRunPanel } from './studio-first-run-panel'
import { StudioFeedbackPrompt } from './studio-feedback-prompt'
import { StudioDishPickerModal } from './studio-dish-picker-modal'
import { StudioExportPanel } from './studio-export-panel'
import { StudioImageLightbox } from './studio-image-lightbox'
import { StudioTextModal } from './studio-text-modal'
import { StudioPendingChangesDialog } from './studio-pending-changes-dialog'
import { StudioCreditsDialog } from './studio-credits-dialog'
import { StudioModelSwitchDialog } from './studio-model-switch-dialog'
import { VisualOptionTiles } from './visual-option-tiles'
import { STUDIO_PRO_MODEL } from '@/lib/studio/model-config'

type ExtractResponse = MinimalValidationResult & {
  diagnostics?: ExtractionDiagnostics
}
type ControlSection = 'rotation' | 'lighting' | 'surface' | 'backdrop' | 'garnishes' | null

interface MutateResponse {
  imageUrl: string
  imageId: string
  model: string
  validationStatus?: 'pass' | 'warn' | 'fail' | 'skipped'
  dishId?: string
  credits?: {
    cost: number
    balanceAfter: number
  }
}

interface StudioClientProps {
  reason?: StudioAccessReason
  accessMode?: AccessMode
  creditBalance?: number | null
  dishes?: StudioDishRecord[]
  gallery?: StudioImageRecord[]
  /** Legacy aliases retained for existing direct callers. */
  initialDishes?: StudioDishRecord[]
  initialGallery?: StudioImageRecord[]
  initialActiveDishId: string
  studioFirstRunDismissed?: boolean
  isAdmin?: boolean
}

interface StudioPendingChangeCandidate {
  state: EditorState
  baseline: EditorState
  changeCount: number
}

interface DishDeletionSummary {
  imageCount: number
  exportVariantCount: number
}

function PendingEditBadge({ section }: { section: string }) {
  return (
    <span
      title={`${section} has pending changes`}
      aria-label={`${section} has pending changes`}
      className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-teal-800"
    >
      Edited
    </span>
  )
}

function sourceImageFromRecord(publicUrl: string, mimeType: string, bytes = 0): SourceImage {
  const normalizedMime: AllowedMimeType =
    mimeType === 'image/jpeg' || mimeType === 'image/webp' ? mimeType : 'image/png'
  return { dataUrl: publicUrl, mimeType: normalizedMime, bytes }
}

const STUDIO_SOURCE_REQUEST_TIMEOUT_MS = 60_000
const STUDIO_NB2_MODEL = 'gemini-3.1-flash-image-preview'
const STUDIO_PRO_WARNING_SESSION_KEY = 'gridmenu:studio:pro-model-warning-dismissed'

function hasDismissedStudioProWarning(): boolean {
  try {
    return window.sessionStorage.getItem(STUDIO_PRO_WARNING_SESSION_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberStudioProWarningDismissal(): void {
  try {
    window.sessionStorage.setItem(STUDIO_PRO_WARNING_SESSION_KEY, 'true')
  } catch {
    // Component state still suppresses the warning for the current mount.
  }
}

async function fetchStudioSourceRequest(
  input: RequestInfo | URL,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), STUDIO_SOURCE_REQUEST_TIMEOUT_MS)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

function fileSizeBucket(bytes: number): string {
  const megabyte = 1024 * 1024
  if (!Number.isFinite(bytes) || bytes < megabyte) return 'under_1mb'
  if (bytes < 5 * megabyte) return '1_to_5mb'
  if (bytes <= 9 * megabyte) return '5_to_9mb'
  return 'over_9mb'
}

function mimeClass(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpeg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return 'other'
  }
}

function extractionFailureClass(status?: number, error?: unknown): string {
  if (status === 401 || status === 403) return 'access_denied'
  if (typeof status === 'number' && status >= 500) return 'server'
  if (typeof status === 'number' && status >= 400) return 'request_rejected'
  if (error instanceof Error && error.name === 'AbortError') return 'cancelled'
  return typeof status === 'number' ? 'request_failed' : 'network'
}

function generationFailureClass(status?: number, code?: string): string {
  if (code === 'STUDIO_DAILY_LIMIT') return 'quota'
  if (typeof status === 'number' && status >= 500) return 'network'
  if (code) return 'provider'
  return 'unknown'
}

function generationValidationStatus(
  status: MutateResponse['validationStatus']
): 'passed' | 'failed' | 'skipped' {
  if (status === 'pass' || status === 'warn') return 'passed'
  if (status === 'fail') return 'failed'
  return 'skipped'
}

function knownBackdropVisibility(diagnostics: ExtractionDiagnostics | null): boolean | undefined {
  const value = diagnostics?.observations?.backdrop_visible
  return typeof value === 'boolean' ? value : undefined
}

function makeDefaultEditorState(): EditorState {
  return {
    schema: {
      scene_setup: {
        angle: '45-degree',
        framing: 'close-up',
        lighting: 'bright-and-airy',
        spin: '0',
      },
      canvas: { background: '', background_style: '', surface_style: '', main_vessel: '' },
      food_components: { main_item: '', garnishes: [], sides: [] },
    },
    position: { ...CENTER },
  }
}

function sortVariants(images: StudioImageRecord[]): StudioImageRecord[] {
  return [...images].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}

function resolveCurrentImage(
  dish: StudioDishRecord | undefined,
  images: StudioImageRecord[]
): StudioImageRecord | null {
  const sorted = sortVariants(images)
  if (sorted.length === 0) return null
  if (dish?.current_image_id) {
    const match = sorted.find((img) => img.id === dish.current_image_id)
    if (match) return match
  }
  return sorted[sorted.length - 1] ?? null
}

export function StudioClient({
  reason = 'granted_admin',
  accessMode: providedAccessMode,
  creditBalance: initialCreditBalance = null,
  dishes: providedDishes,
  gallery: providedGallery,
  initialDishes: legacyDishes,
  initialGallery: legacyGallery,
  initialActiveDishId,
  studioFirstRunDismissed = false,
  isAdmin = false,
}: StudioClientProps) {
  const initialDishes = useMemo(
    () => providedDishes ?? legacyDishes ?? [],
    [legacyDishes, providedDishes]
  )
  const initialGallery = useMemo(
    () => providedGallery ?? legacyGallery ?? [],
    [legacyGallery, providedGallery]
  )
  const accessMode = providedAccessMode ?? resolveStudioAccessMode()
  const [dishes, setDishes] = useState<StudioDishRecord[]>(initialDishes)
  const [activeDishId, setActiveDishId] = useState(initialActiveDishId)
  const [gallery, setGallery] = useState<StudioImageRecord[]>(initialGallery)
  const [firstRunDismissed, setFirstRunDismissed] = useState(studioFirstRunDismissed)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(() => {
    const dish = initialDishes.find((d) => d.id === initialActiveDishId)
    return resolveCurrentImage(dish, initialGallery)?.id ?? null
  })
  const didActivateInitialRef = useRef(false)
  const didTrackViewedRef = useRef(false)
  const didAnnounceExportContextRef = useRef(false)
  const [expandedStudioPanel, setExpandedStudioPanel] = useState<'controls' | 'exports'>('controls')
  const [exportContextFlash, setExportContextFlash] = useState(false)
  const [expandedSection, setExpandedSection] = useState<ControlSection>('lighting')
  const [libraryBusy, setLibraryBusy] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [lightingStyles, setLightingStyles] = useState<StudioLightingStyleDisplay[]>([])
  const [backgroundStyles, setBackgroundStyles] = useState<StudioBackgroundStyleDisplay[]>([])
  const [selectedModel, setSelectedModel] = useState<string>(STUDIO_NB2_MODEL)
  const [modelWarningOpen, setModelWarningOpen] = useState(false)
  const [dontShowModelWarning, setDontShowModelWarning] = useState(false)
  const [proWarningDismissed, setProWarningDismissed] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteDishOpen, setDeleteDishOpen] = useState(false)
  const [deleteDishSummary, setDeleteDishSummary] = useState<DishDeletionSummary | null>(null)
  const [imageToDelete, setImageToDelete] = useState<StudioImageRecord | null>(null)
  const [workbenchImageExpanded, setWorkbenchImageExpanded] = useState(false)
  const [dishPickerOpen, setDishPickerOpen] = useState(false)
  const [dishPickerItems, setDishPickerItems] = useState<StudioDishListItem[]>([])
  const [dishPickerLoading, setDishPickerLoading] = useState(false)

  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null)
  const [persistedSourceId, setPersistedSourceId] = useState<string | null>(null)
  const [editorState, setEditorState] = useState<EditorState>(makeDefaultEditorState())
  const originalStateRef = useRef<EditorState>(makeDefaultEditorState())
  const extractionDiagnosticsRef = useRef<ExtractionDiagnostics | null>(null)
  const [backdropVisible, setBackdropVisible] = useState<boolean | undefined>(undefined)

  const [isHydrated, setIsHydrated] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const [strictConformanceWarning, setStrictConformanceWarning] = useState(false)

  const [isGenerating, setIsGenerating] = useState(false)
  const [mutatedImageUrl, setMutatedImageUrl] = useState<string | undefined>(undefined)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [pendingChangeCandidate, setPendingChangeCandidate] =
    useState<StudioPendingChangeCandidate | null>(null)
  const [dontShowPendingChangeWarning, setDontShowPendingChangeWarning] = useState(false)
  const skipPendingChangeWarningRef = useRef(false)
  const [baselineVersion, setBaselineVersion] = useState(0)
  const [creditBalance, setCreditBalance] = useState<number | null>(initialCreditBalance)
  const [creditCostNb2, setCreditCostNb2] = useState(1)
  const [creditCostNbPro, setCreditCostNbPro] = useState(3)
  const [creditsDialogOpen, setCreditsDialogOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeDish = dishes.find((d) => d.id === activeDishId) ?? dishes[0]
  const dishBlocked = Boolean(activeDish?.generation_blocked_at)
  const variants = useMemo(() => sortVariants(gallery), [gallery])
  const selectedImage = variants.find((v) => v.id === selectedImageId) ?? null
  const selectedVariantLabel = useMemo(() => {
    if (!selectedImage) return 'No image selected'
    if (selectedImage.role === 'source') return 'Original image'
    const generatedIndex = variants
      .filter((image) => image.role === 'generated')
      .findIndex((image) => image.id === selectedImage.id)
    return `Variant ${generatedIndex + 1}`
  }, [selectedImage, variants])

  useEffect(() => {
    if (!didAnnounceExportContextRef.current) {
      didAnnounceExportContextRef.current = true
      return
    }

    setExportContextFlash(true)
    const timeout = window.setTimeout(() => setExportContextFlash(false), 1800)
    return () => window.clearTimeout(timeout)
  }, [selectedImageId])

  const currentPreviewUrl =
    mutatedImageUrl ?? sourceImage?.dataUrl ?? selectedImage?.public_url ?? null
  const changeChips = selectedImage ? readChangeSummary(selectedImage.metadata) : []
  const studioView = getStudioViewSelection(gallery)
  const handleFirstRunDismiss = useCallback(async () => {
    const res = await fetch('/api/studio/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissed: true }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error((err as { error?: string } | null)?.error ?? 'Failed to save preference')
    }
    setFirstRunDismissed(true)
  }, [])
  const feedbackImage = selectedImage?.role === 'generated' ? selectedImage : null

  const pendingDelta = useMemo(() => {
    void baselineVersion
    return computeDelta(originalStateRef.current, editorState)
  }, [editorState, baselineVersion])

  const pendingChangeCount = pendingDelta.isEmpty ? 0 : countEditableChanges(pendingDelta)
  const hasPendingChanges = pendingChangeCount > 0
  const sectionHasPendingChanges = {
    lighting: pendingDelta.scalarChanges.some((change) => change.path === 'scene_setup.lighting'),
    surface: pendingDelta.scalarChanges.some((change) => change.path === 'canvas.surface_style'),
    backdrop: pendingDelta.scalarChanges.some(
      (change) => change.path === 'canvas.background_style'
    ),
    garnishes:
      pendingDelta.arrays.garnishes.added.length > 0 ||
      pendingDelta.arrays.garnishes.removed.length > 0 ||
      pendingDelta.arrays.sides.added.length > 0 ||
      pendingDelta.arrays.sides.removed.length > 0,
  }
  const controlsDisabled = !isHydrated || isGenerating || dishBlocked
  const insufficientCredits = creditBalance !== null && creditBalance < creditCostNb2
  const busy = libraryBusy || isUploading || isExtracting || isGenerating

  useEffect(() => {
    setProWarningDismissed(hasDismissedStudioProWarning())
  }, [])

  const handleModelChange = useCallback(
    (nextModel: string) => {
      if (nextModel === selectedModel) return
      if (nextModel === STUDIO_PRO_MODEL && !proWarningDismissed) {
        setDontShowModelWarning(false)
        setModelWarningOpen(true)
        return
      }
      setSelectedModel(nextModel)
    },
    [proWarningDismissed, selectedModel]
  )

  const handleConfirmProModel = useCallback(() => {
    if (dontShowModelWarning) {
      setProWarningDismissed(true)
      rememberStudioProWarningDismissal()
    }
    setSelectedModel(STUDIO_PRO_MODEL)
    setDontShowModelWarning(false)
    setModelWarningOpen(false)
  }, [dontShowModelWarning])

  const handleCancelProModel = useCallback(() => {
    setDontShowModelWarning(false)
    setModelWarningOpen(false)
  }, [])

  useEffect(() => {
    if (didTrackViewedRef.current) return
    didTrackViewedRef.current = true
    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_VIEWED, {
      surface: 'studio',
      access_mode: accessMode,
      access_reason: reason,
      is_admin: isAdmin === true,
      gallery_size: initialGallery.length,
    })
  }, [accessMode, initialGallery.length, isAdmin, reason])

  const lightingOptions = useMemo(() => {
    if (lightingStyles.length > 0) return lightingStylesToOptions(lightingStyles)
    return STUDIO_LIGHTING_OPTIONS
  }, [lightingStyles])

  const surfaceOptions = useMemo(() => {
    const filtered = backgroundStyles.filter((style) => style.category === 'surface')
    return backgroundStylesToOptions(filtered)
  }, [backgroundStyles])

  const backdropOptions = useMemo(() => {
    const filtered = backgroundStyles.filter((style) => style.category === 'backdrop')
    return backgroundStylesToOptions(filtered)
  }, [backgroundStyles])
  const backdropKnownFalse = backdropVisible === false

  const lightingLabelMap = useMemo(
    () =>
      Object.fromEntries(
        lightingStyles.map((style) => [style.key, fohLightingLabel(style.key, style.name)])
      ),
    [lightingStyles]
  )
  const backgroundLabelMap = useMemo(() => styleLabelMap(backgroundStyles), [backgroundStyles])

  const lightingKeys = useMemo(
    () => lightingOptions.map((option) => option.value),
    [lightingOptions]
  )
  const backgroundKeys = useMemo(
    () => backgroundStyles.map((style) => style.key),
    [backgroundStyles]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch('/api/studio/styles')
        if (!response.ok) return
        const data = (await response.json()) as {
          lighting?: StudioLightingStyleDisplay[]
          background?: StudioBackgroundStyleDisplay[]
        }
        if (cancelled) return
        setLightingStyles(Array.isArray(data.lighting) ? data.lighting : [])
        setBackgroundStyles(Array.isArray(data.background) ? data.background : [])
      } catch {
        // Keep static lighting fallback when styles API is unavailable.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch('/api/studio/credits')
        if (!response.ok) return
        const data = (await response.json()) as {
          balance?: number
          costs?: { nb2?: number; nbPro?: number }
        }
        if (cancelled) return
        if (typeof data.balance === 'number') setCreditBalance(data.balance)
        if (typeof data.costs?.nb2 === 'number') setCreditCostNb2(data.costs.nb2)
        if (typeof data.costs?.nbPro === 'number') setCreditCostNbPro(data.costs.nbPro)
      } catch {
        // Credits UI stays blank until available.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const resetEditorForNewSource = useCallback(() => {
    setIsHydrated(false)
    setEditorState(makeDefaultEditorState())
    originalStateRef.current = makeDefaultEditorState()
    setMutatedImageUrl(undefined)
    setMutationError(null)
    setExtractionError(null)
    setStrictConformanceWarning(false)
    extractionDiagnosticsRef.current = null
    setBackdropVisible(undefined)
    setPendingChangeCandidate(null)
    setDontShowPendingChangeWarning(false)
  }, [])

  const persistDishCurrent = useCallback(async (dishId: string, imageId: string | null) => {
    const res = await fetch(`/api/studio/dishes/${dishId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentImageId: imageId }),
    })
    if (!res.ok) return
    const data = (await res.json()) as { dish: StudioDishRecord }
    setDishes((prev) => prev.map((d) => (d.id === dishId ? data.dish : d)))
  }, [])

  const persistEditorState = useCallback(async (imageId: string, state: EditorState) => {
    const res = await fetch(`/api/studio/images/${imageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editorState: state }),
    })
    if (!res.ok) return
    const data = (await res.json()) as { image: StudioImageRecord }
    setGallery((prev) => prev.map((img) => (img.id === imageId ? data.image : img)))
  }, [])

  const applyHydratedState = useCallback((state: EditorState, strictWarning = false) => {
    setEditorState(state)
    originalStateRef.current = state
    setBaselineVersion((v) => v + 1)
    setIsHydrated(true)
    setStrictConformanceWarning(strictWarning)
    setPendingChangeCandidate(null)
    setDontShowPendingChangeWarning(false)
    setMutationError(null)
    setExtractionError(null)
  }, [])

  const runExtraction = useCallback(
    async (imageId: string): Promise<EditorState | null> => {
      const startedAt = Date.now()
      const duration = () => Math.max(0, Date.now() - startedAt)
      const emitExtractionFailure = (status?: number, error?: unknown) => {
        trackStudioEvent(ANALYTICS_EVENTS.STUDIO_EXTRACTION_FAILED, {
          duration_ms: duration(),
          failure_class: extractionFailureClass(status, error),
          outcome: 'failed',
        })
      }

      if (typeof imageId !== 'string' || !imageId) {
        setExtractionError(
          'Could not start extraction for this image. Refresh the page and try uploading again.'
        )
        emitExtractionFailure(undefined, new Error('invalid image reference'))
        return null
      }

      setIsExtracting(true)
      setExtractionError(null)

      try {
        const response = await fetch('/api/studio/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageId }),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => null)
          setExtractionError(
            (err as { error?: string } | null)?.error ??
              `Extraction failed (HTTP ${response.status})`
          )
          emitExtractionFailure(response.status)
          return null
        }

        const data = (await response.json()) as ExtractResponse
        extractionDiagnosticsRef.current = data.diagnostics ?? null
        setBackdropVisible(knownBackdropVisibility(data.diagnostics ?? null))
        const { editorState: hydratedState } = hydrate({
          strictConformance: data.strictConformance,
          data: data.data,
          warnings: data.warnings,
        })

        applyHydratedState(hydratedState, !data.strictConformance)
        trackStudioEvent(ANALYTICS_EVENTS.STUDIO_EXTRACTION_COMPLETED, {
          duration_ms: duration(),
          outcome: 'success',
        })
        return hydratedState
      } catch (err) {
        setExtractionError(err instanceof Error ? err.message : 'Extraction failed unexpectedly.')
        emitExtractionFailure(undefined, err)
        return null
      } finally {
        setIsExtracting(false)
      }
    },
    [applyHydratedState]
  )

  const activateImage = useCallback(
    async (image: StudioImageRecord, options?: { persistCurrent?: boolean }) => {
      setSelectedImageId(image.id)
      setLibraryBusy(true)
      setLibraryError(null)
      setMutatedImageUrl(undefined)
      try {
        setSourceImage(sourceImageFromRecord(image.public_url, image.mime_type))
        setPersistedSourceId(image.id)
        extractionDiagnosticsRef.current =
          (image.metadata?.extractionDiagnostics as ExtractionDiagnostics | undefined) ?? null
        setBackdropVisible(knownBackdropVisibility(extractionDiagnosticsRef.current))

        const stored = readEditorStateFromMetadata(image.metadata)
        if (stored) {
          applyHydratedState(stored)
        } else {
          setIsHydrated(false)
          const extracted = await runExtraction(image.id)
          if (extracted) {
            await persistEditorState(image.id, extracted)
          }
        }

        if (options?.persistCurrent !== false && image.dish_id) {
          await persistDishCurrent(image.dish_id, image.id)
        }
        return true
      } catch (err) {
        setLibraryError(err instanceof Error ? err.message : 'Failed to load image')
        return false
      } finally {
        setLibraryBusy(false)
      }
    },
    [applyHydratedState, persistDishCurrent, persistEditorState, runExtraction]
  )

  const loadGalleryForDish = useCallback(
    async (dishId: string, dishRecord?: StudioDishRecord) => {
      const imagesRes = await fetch(`/api/studio/images?dishId=${encodeURIComponent(dishId)}`)
      if (!imagesRes.ok) {
        const err = await imagesRes.json().catch(() => null)
        throw new Error((err as { error?: string } | null)?.error ?? 'Failed to load library')
      }
      const data = (await imagesRes.json()) as { images: StudioImageRecord[] }
      const next = data.images ?? []
      setGallery(next)
      const dish = dishRecord ?? dishes.find((d) => d.id === dishId)
      const current = resolveCurrentImage(dish, next)
      setSelectedImageId(current?.id ?? null)
      if (current) {
        await activateImage(current, { persistCurrent: false })
      } else {
        resetEditorForNewSource()
        setSourceImage(null)
        setPersistedSourceId(null)
      }
    },
    [activateImage, dishes, resetEditorForNewSource]
  )

  useEffect(() => {
    if (didActivateInitialRef.current) return
    didActivateInitialRef.current = true
    const dish = initialDishes.find((d) => d.id === initialActiveDishId)
    const current = resolveCurrentImage(dish, initialGallery)
    if (current) {
      void activateImage(current, { persistCurrent: false })
    }
  }, [activateImage, initialActiveDishId, initialDishes, initialGallery])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''

      const uploadProperties = {
        file_size_bucket: fileSizeBucket(file.size),
        mime_class: mimeClass(file.type),
      }
      const emitUploadRejected = () => {
        trackStudioEvent(ANALYTICS_EVENTS.STUDIO_UPLOAD_REJECTED, {
          ...uploadProperties,
          outcome: 'rejected',
        })
      }
      trackStudioEvent(ANALYTICS_EVENTS.STUDIO_UPLOAD_STARTED, {
        ...uploadProperties,
        outcome: 'started',
      })

      if (!activeDishId) {
        setExtractionError('Create a dish before uploading.')
        emitUploadRejected()
        return
      }

      setIsUploading(true)
      setExtractionError(null)
      resetEditorForNewSource()
      setSourceImage(null)
      setPersistedSourceId(null)

      let uploadedStoragePath: string | null = null
      try {
        const upload = await uploadStudioSourceFile(file)
        if (!upload.ok) {
          setExtractionError(upload.error)
          emitUploadRejected()
          return
        }

        if (!upload.imageId) {
          setExtractionError(
            'Upload succeeded but the image reference was missing. Refresh and try again.'
          )
          emitUploadRejected()
          return
        }

        uploadedStoragePath = upload.storagePath
        setSourceImage(sourceImageFromRecord(upload.publicUrl, upload.mimeType, upload.bytes))

        const sourceRes = await fetchStudioSourceRequest('/api/studio/source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageId: upload.imageId,
            dishId: activeDishId,
            mimeType: upload.mimeType,
          }),
        })

        if (!sourceRes.ok) {
          const err = await sourceRes.json().catch(() => null)
          void removeStudioStorageObject(upload.storagePath)
          setExtractionError(
            (err as { error?: string } | null)?.error ?? 'Failed to save uploaded image.'
          )
          emitUploadRejected()
          return
        }

        const sourceData = (await sourceRes.json()) as {
          imageId?: string
          imageUrl?: string
        }

        if (!sourceData.imageId || !sourceData.imageUrl) {
          void removeStudioStorageObject(upload.storagePath)
          setExtractionError('Failed to save uploaded image.')
          emitUploadRejected()
          return
        }

        const sourceRow: StudioImageRecord = {
          id: sourceData.imageId,
          user_id: '',
          dish_id: activeDishId,
          role: 'source',
          source_image_id: null,
          storage_path: upload.storagePath,
          public_url: sourceData.imageUrl,
          mime_type: upload.mimeType,
          width: null,
          height: null,
          prompt: null,
          model: null,
          metadata: {},
          is_favourite: false,
          archived_at: null,
          created_at: new Date().toISOString(),
        }

        setPersistedSourceId(sourceData.imageId)
        setSourceImage(sourceImageFromRecord(sourceData.imageUrl, upload.mimeType, upload.bytes))
        setGallery((prev) => [...prev, sourceRow])
        setSelectedImageId(sourceData.imageId)
        uploadedStoragePath = null
        // The source is registered and immediately visible. Persisting the selected
        // image and extracting metadata are separate phases from the upload itself.
        setIsUploading(false)
        trackStudioEvent(ANALYTICS_EVENTS.STUDIO_UPLOAD_COMPLETED, {
          ...uploadProperties,
          outcome: 'success',
        })

        await persistDishCurrent(activeDishId, sourceData.imageId)
        const extracted = await runExtraction(sourceData.imageId)

        if (extracted) {
          await persistEditorState(sourceData.imageId, extracted)
        }
      } catch (error) {
        if (uploadedStoragePath) {
          void removeStudioStorageObject(uploadedStoragePath)
        }
        setExtractionError(error instanceof Error ? error.message : 'Upload failed unexpectedly.')
        emitUploadRejected()
      } finally {
        setIsUploading(false)
      }
    },
    [activeDishId, persistDishCurrent, persistEditorState, resetEditorForNewSource, runExtraction]
  )

  const commitStagedChange = useCallback((nextState: EditorState, nextBaseline: EditorState) => {
    originalStateRef.current = nextBaseline
    setBaselineVersion((v) => v + 1)
    setEditorState(nextState)
  }, [])

  const applyStagedChange = useCallback(
    (nextState: EditorState, nextBaseline = originalStateRef.current) => {
      const delta = computeDelta(nextBaseline, nextState)
      if (delta.isEmpty) {
        commitStagedChange(nextState, nextBaseline)
        return
      }

      const nextCount = countEditableChanges(delta)
      if (nextCount > MAX_PENDING_CHANGES && !skipPendingChangeWarningRef.current) {
        setPendingChangeCandidate({
          state: nextState,
          baseline: nextBaseline,
          changeCount: nextCount,
        })
        setDontShowPendingChangeWarning(false)
        return
      }

      commitStagedChange(nextState, nextBaseline)
    },
    [commitStagedChange]
  )

  const stageLighting = useCallback(
    (lighting: string) => {
      const nextBaseline = ensureLightingRestageBaseline(
        originalStateRef.current,
        editorState,
        lighting,
        lightingKeys
      )
      applyStagedChange(
        {
          ...editorState,
          schema: {
            ...editorState.schema,
            scene_setup: { ...editorState.schema.scene_setup, lighting },
          },
        },
        nextBaseline
      )
    },
    [applyStagedChange, editorState, lightingKeys]
  )

  const stageBackground = useCallback(
    (backgroundStyle: string) => {
      const nextBaseline = ensureBackgroundRestageBaseline(
        originalStateRef.current,
        editorState,
        backgroundStyle,
        backgroundKeys
      )
      applyStagedChange(
        {
          ...editorState,
          schema: {
            ...editorState.schema,
            canvas: {
              ...editorState.schema.canvas,
              background_style: backgroundStyle,
            },
          },
        },
        nextBaseline
      )
    },
    [applyStagedChange, backgroundKeys, editorState]
  )

  const stageSurface = useCallback(
    (surfaceStyle: string) => {
      const nextBaseline = ensureSurfaceRestageBaseline(
        originalStateRef.current,
        editorState,
        surfaceStyle,
        backgroundKeys
      )
      applyStagedChange(
        {
          ...editorState,
          schema: {
            ...editorState.schema,
            canvas: {
              ...editorState.schema.canvas,
              surface_style: surfaceStyle,
            },
          },
        },
        nextBaseline
      )
    },
    [applyStagedChange, backgroundKeys, editorState]
  )

  const handleDiscardPending = useCallback(() => {
    setEditorState(originalStateRef.current)
    setPendingChangeCandidate(null)
    setDontShowPendingChangeWarning(false)
  }, [])

  const handleApplyPendingChangeAnyway = useCallback(() => {
    if (!pendingChangeCandidate) return
    if (dontShowPendingChangeWarning) {
      skipPendingChangeWarningRef.current = true
    }
    commitStagedChange(pendingChangeCandidate.state, pendingChangeCandidate.baseline)
    setPendingChangeCandidate(null)
    setDontShowPendingChangeWarning(false)
  }, [commitStagedChange, dontShowPendingChangeWarning, pendingChangeCandidate])

  const handleReviewPendingChange = useCallback(() => {
    if (dontShowPendingChangeWarning) {
      skipPendingChangeWarningRef.current = true
    }
    setPendingChangeCandidate(null)
    setDontShowPendingChangeWarning(false)
  }, [dontShowPendingChangeWarning])

  const submitPendingChanges = useCallback(async () => {
    const original = originalStateRef.current
    const nextState = editorState
    const delta = computeDelta(original, nextState)
    if (delta.isEmpty || !sourceImage || !activeDishId || !persistedSourceId) return

    const directive = generateDirective(delta, nextState, {
      excludePaths: FOH_STYLE_EXCLUDE_PATHS,
    })
    if (!directive) return

    const changeSummary = buildChangeSummary(delta, {
      lightingLabels: lightingLabelMap,
      backgroundLabels: backgroundLabelMap,
    })
    const generationStartedAt = Date.now()

    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_STARTED, {
      model_class: toModelClass(selectedModel),
      stage: 'generation',
      has_source_image: Boolean(sourceImage),
      variant_count: variants.length,
    })

    setIsGenerating(true)
    setMutationError(null)

    try {
      const response = await fetch('/api/studio/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dishId: activeDishId,
          sourceImageId: persistedSourceId,
          originalState: original.schema,
          targetState: nextState.schema,
          directive,
          changeSummary,
          model: selectedModel,
          extractionDiagnostics: extractionDiagnosticsRef.current,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => null)
        const payload = err as {
          error?: string
          code?: string
          dishBlocked?: boolean
        } | null
        const blockedByCredits = payload?.code === 'STUDIO_INSUFFICIENT_CREDITS'
        const blockedByDish =
          payload?.code === 'STUDIO_DISH_GENERATION_BLOCKED' || payload?.dishBlocked
        const failureProperties = {
          model_class: toModelClass(selectedModel),
          stage: 'generation',
          duration_ms: Math.max(0, Date.now() - generationStartedAt),
        }

        if (blockedByCredits) {
          setCreditsDialogOpen(true)
          trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_BLOCKED_CREDITS, {
            ...failureProperties,
            outcome: 'blocked',
            blocked_by: 'credits',
          })
        } else if (blockedByDish) {
          trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_BLOCKED_DISH, {
            ...failureProperties,
            outcome: 'blocked',
            blocked_by: 'dish_breaker',
          })
        } else {
          trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_FAILED, {
            ...failureProperties,
            outcome: 'failure',
            failure_class: generationFailureClass(response.status, payload?.code),
          })
        }

        setMutationError(payload?.error ?? `Generation failed (HTTP ${response.status})`)
        if (blockedByDish) {
          setDishes((prev) =>
            prev.map((d) =>
              d.id === activeDishId
                ? {
                    ...d,
                    generation_blocked_at: new Date().toISOString(),
                    generation_blocked_reason: payload?.error ?? 'Blocked',
                  }
                : d
            )
          )
        }
        return
      }

      const data = (await response.json()) as MutateResponse
      trackStudioGenerationCompleted({
        model: data.model,
        validationStatus: generationValidationStatus(data.validationStatus),
        startedAt: generationStartedAt,
        endedAt: Date.now(),
        balanceAfter:
          typeof data.credits?.balanceAfter === 'number'
            ? data.credits.balanceAfter
            : (creditBalance ?? 0),
        cost: data.credits?.cost,
      })
      setMutatedImageUrl(data.imageUrl)
      if (data.credits && typeof data.credits.balanceAfter === 'number') {
        setCreditBalance(data.credits.balanceAfter)
      }
      originalStateRef.current = nextState
      setBaselineVersion((v) => v + 1)
      const row: StudioImageRecord = {
        id: data.imageId,
        user_id: '',
        dish_id: activeDishId,
        role: 'generated',
        source_image_id: persistedSourceId,
        storage_path: '',
        public_url: data.imageUrl,
        mime_type: 'image/png',
        width: null,
        height: null,
        prompt: null,
        model: data.model,
        metadata: {
          changeSummary,
          editorState: editorStateToMetadata(nextState),
        },
        is_favourite: false,
        archived_at: null,
        created_at: new Date().toISOString(),
      }
      setGallery((prev) => [...prev, row])
      setSelectedImageId(data.imageId)
      setPersistedSourceId(data.imageId)
      setDishes((prev) =>
        prev.map((d) =>
          d.id === activeDishId
            ? {
                ...d,
                current_image_id: data.imageId,
                generation_failure_count: 0,
                generation_blocked_at: null,
                generation_blocked_reason: null,
              }
            : d
        )
      )
      setSourceImage(sourceImageFromRecord(data.imageUrl, 'image/png'))
    } catch (err) {
      trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_FAILED, {
        model_class: toModelClass(selectedModel),
        stage: 'generation',
        duration_ms: Math.max(0, Date.now() - generationStartedAt),
        outcome: 'failure',
        failure_class: 'network',
      })
      setMutationError(err instanceof Error ? err.message : 'Generation failed unexpectedly.')
    } finally {
      setIsGenerating(false)
    }
  }, [
    sourceImage,
    editorState,
    persistedSourceId,
    activeDishId,
    lightingLabelMap,
    backgroundLabelMap,
    selectedModel,
    variants.length,
    creditBalance,
  ])

  const handleCreateDish = useCallback(
    async (name: string) => {
      setCreateOpen(false)
      setLibraryBusy(true)
      setLibraryError(null)
      try {
        const res = await fetch('/api/studio/dishes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error((err as { error?: string } | null)?.error ?? 'Failed to create dish')
        }
        const data = (await res.json()) as { dish: StudioDishRecord }
        setDishes((prev) => [data.dish, ...prev])
        setActiveDishId(data.dish.id)
        setGallery([])
        setSelectedImageId(null)
        resetEditorForNewSource()
        setSourceImage(null)
        setPersistedSourceId(null)
      } catch (err) {
        setLibraryError(err instanceof Error ? err.message : 'Failed to create dish')
      } finally {
        setLibraryBusy(false)
      }
    },
    [resetEditorForNewSource]
  )

  const handleRenameDish = useCallback(
    async (name: string) => {
      if (!activeDish) return
      setRenameOpen(false)
      setLibraryBusy(true)
      setLibraryError(null)
      try {
        const res = await fetch(`/api/studio/dishes/${activeDish.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error((err as { error?: string } | null)?.error ?? 'Failed to rename dish')
        }
        const data = (await res.json()) as { dish: StudioDishRecord }
        setDishes((prev) => prev.map((d) => (d.id === data.dish.id ? data.dish : d)))
      } catch (err) {
        setLibraryError(err instanceof Error ? err.message : 'Failed to rename dish')
      } finally {
        setLibraryBusy(false)
      }
    },
    [activeDish]
  )

  const openDeleteDishDialog = useCallback(async () => {
    if (!activeDish) return
    setLibraryBusy(true)
    setLibraryError(null)
    try {
      const res = await fetch(`/api/studio/dishes/${activeDish.id}`)
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error((err as { error?: string } | null)?.error ?? 'Failed to prepare deletion')
      }
      const data = (await res.json()) as { deletionSummary: DishDeletionSummary }
      setDeleteDishSummary(data.deletionSummary)
      setDeleteDishOpen(true)
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Failed to prepare deletion')
    } finally {
      setLibraryBusy(false)
    }
  }, [activeDish])

  const handleDeleteDish = useCallback(async () => {
    if (!activeDish) return
    setDeleteDishOpen(false)
    setLibraryBusy(true)
    setLibraryError(null)
    try {
      const res = await fetch(`/api/studio/dishes/${activeDish.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error((err as { error?: string } | null)?.error ?? 'Failed to delete dish')
      }
      const remaining = dishes.filter((d) => d.id !== activeDish.id)
      setDishes(remaining)
      const nextId = remaining[0]?.id
      if (nextId) {
        setActiveDishId(nextId)
        await loadGalleryForDish(nextId)
      } else {
        setActiveDishId('')
        setGallery([])
        setSelectedImageId(null)
      }
      resetEditorForNewSource()
      setSourceImage(null)
      setPersistedSourceId(null)
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Failed to delete dish')
    } finally {
      setLibraryBusy(false)
    }
  }, [activeDish, dishes, loadGalleryForDish, resetEditorForNewSource])

  const handleDeleteImage = useCallback(async () => {
    if (!imageToDelete) return
    const image = imageToDelete
    setImageToDelete(null)
    setLibraryBusy(true)
    setLibraryError(null)
    try {
      const res = await fetch(`/api/studio/images/${image.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error((err as { error?: string } | null)?.error ?? 'Failed to delete')
      }
      const next = gallery.filter((item) => item.id !== image.id)
      setGallery(next)

      if (image.id === selectedImage?.id) {
        const fallback = sortVariants(next).at(-1) ?? null
        setSelectedImageId(fallback?.id ?? null)
        setMutatedImageUrl(undefined)
        if (fallback) {
          await activateImage(fallback)
        } else {
          setSourceImage(null)
          setPersistedSourceId(null)
          resetEditorForNewSource()
          if (activeDishId) {
            await persistDishCurrent(activeDishId, null)
          }
        }
      }
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setLibraryBusy(false)
    }
  }, [
    imageToDelete,
    gallery,
    selectedImage,
    activateImage,
    resetEditorForNewSource,
    activeDishId,
    persistDishCurrent,
  ])

  const openDishPicker = useCallback(async () => {
    setDishPickerOpen(true)
    setDishPickerLoading(true)
    try {
      const res = await fetch('/api/studio/dishes')
      if (!res.ok) throw new Error('Failed to load dishes')
      const data = (await res.json()) as { dishes: StudioDishListItem[] }
      setDishPickerItems(data.dishes ?? [])
      // Keep local dish list in sync (without requiring thumbnails on every row).
      if (data.dishes?.length) {
        setDishes(data.dishes.map(({ current_image_url: _url, ...dish }) => dish))
      }
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Failed to load dishes')
      setDishPickerOpen(false)
    } finally {
      setDishPickerLoading(false)
    }
  }, [])

  const handlePickDish = useCallback(
    async (dishId: string) => {
      setDishPickerOpen(false)
      if (dishId === activeDishId) return
      setLibraryBusy(true)
      setLibraryError(null)
      setActiveDishId(dishId)
      try {
        await loadGalleryForDish(
          dishId,
          dishes.find((d) => d.id === dishId) ?? dishPickerItems.find((d) => d.id === dishId)
        )
      } catch (err) {
        setLibraryError(err instanceof Error ? err.message : 'Failed to switch dish')
      } finally {
        setLibraryBusy(false)
      }
    },
    [activeDishId, dishPickerItems, dishes, loadGalleryForDish]
  )

  const handleReuseImage = useCallback(
    async (image: StudioImageRecord) => {
      const activated = await activateImage(image)
      if (!activated) return

      trackStudioEvent(ANALYTICS_EVENTS.STUDIO_IMAGE_REUSED, {
        surface: 'gallery',
        outcome: 'success',
      })
    },
    [activateImage]
  )

  return (
    <div className="space-y-6" data-studio-access-reason={reason}>
      {studioView.showFirstRun && !firstRunDismissed && (
        <StudioFirstRunPanel
          onOpenFilePicker={() => fileInputRef.current?.click()}
          onDismiss={handleFirstRunDismiss}
          accessMode={accessMode}
          accessReason={reason}
          isAdmin={isAdmin === true}
        />
      )}
      {creditBalance !== null && creditBalance <= 0 && <StudioStateNotice kind="no_credit" />}
      {dishBlocked && <StudioStateNotice kind="blocked_dish" />}
      {/* Header: dish title aligned with action buttons */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-2xl font-bold leading-none text-gray-900">
            {activeDish?.name ?? 'Food Photo Studio'}
          </h1>
          {activeDish && (
            <button
              type="button"
              aria-label="Rename dish"
              disabled={busy}
              className="rounded p-1 text-ux-primary hover:bg-ux-primary/10 disabled:opacity-50"
              onClick={() => setRenameOpen(true)}
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5A2 2 0 016.5 15.5H5v-1.5a2 2 0 01.586-1.414l8-8z" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          {(isAdmin && isHydrated) || creditBalance !== null ? (
            <>
              <div className="flex items-center gap-2">
                {isAdmin && isHydrated && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={selectedModel === STUDIO_PRO_MODEL}
                    aria-label={`Use ${selectedModel === STUDIO_PRO_MODEL ? 'Nano Banana 2' : 'Nano Banana Pro'}`}
                    title="Choose the Studio image engine"
                    disabled={busy || dishBlocked}
                    onClick={() =>
                      handleModelChange(
                        selectedModel === STUDIO_PRO_MODEL ? STUDIO_NB2_MODEL : STUDIO_PRO_MODEL
                      )
                    }
                    className={`relative h-8 w-20 rounded-full border-[3px] bg-white text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ux-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                      selectedModel === STUDIO_PRO_MODEL
                        ? 'border-ux-primary'
                        : 'border-gray-300'
                    }`}
                  >
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-gray-700">
                      {selectedModel === STUDIO_PRO_MODEL ? 'Pro' : 'NB2'}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`absolute right-1 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-colors ${
                        selectedModel === STUDIO_PRO_MODEL ? 'bg-ux-primary' : 'bg-gray-400'
                      }`}
                    />
                  </button>
                )}
                {creditBalance !== null && (
                  <span
                    role="status"
                    aria-label={`${creditBalance} Studio credits remaining`}
                    data-testid="studio-credits-balance"
                    className={`pointer-events-none inline-flex h-9 items-center whitespace-nowrap rounded-full border px-3 text-sm font-semibold tracking-wide ${
                      creditBalance <= 5
                        ? 'animate-pulse border-red-200 bg-red-50 text-red-700 motion-reduce:animate-none'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                  >
                    Credits: {creditBalance}
                  </span>
                )}
              </div>
              <span aria-hidden="true" className="hidden h-9 w-px bg-gray-200 md:block" />
            </>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-md bg-ux-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              onClick={() => setCreateOpen(true)}
            >
              New
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-amber-300 disabled:opacity-50"
              onClick={() => void openDishPicker()}
              data-testid="studio-dishes-button"
            >
              Dishes
            </button>
            {activeDish && dishes.length > 1 && (
              <button
                type="button"
                disabled={busy}
                className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                onClick={() => void openDeleteDishDialog()}
              >
                Delete dish
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={handleFileChange}
            disabled={busy || !activeDishId}
            aria-label="Upload food photo"
          />
        </div>
      </div>

      {libraryError && (
        <p role="alert" className="text-sm text-red-800">
          {libraryError}
        </p>
      )}
      {extractionError && (
        <p role="alert" className="text-sm text-red-800">
          {extractionError}
        </p>
      )}
      {isUploading && (
        <p role="status" className="text-sm text-ux-primary">
          Uploading image…
        </p>
      )}
      {isExtracting && (
        <p role="status" className="text-sm text-ux-primary">
          Analysing photo structure…
        </p>
      )}
      {strictConformanceWarning && isHydrated && (
        <p role="status" className="text-xs text-amber-800">
          Some values were adjusted to match allowed options. Controls are enabled.
        </p>
      )}

      {/*
        The Workbench stays visible in every workflow. At desktop width, only
        one companion panel expands at a time; the other remains a live rail so
        its selected-image context is always discoverable without inviting
        accidental export generation.
      */}
      <div
        className={[
          'grid items-stretch gap-6 transition-[grid-template-columns] duration-300 ease-in-out motion-reduce:transition-none lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]',
          expandedStudioPanel === 'controls'
            ? 'xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)_4rem]'
            : 'xl:grid-cols-[4rem_minmax(0,1fr)_minmax(300px,380px)]',
        ].join(' ')}
      >
        {/* Control panel */}
        <div className="min-w-0">
          <button
            type="button"
            aria-controls="studio-control-panel"
            aria-expanded={expandedStudioPanel === 'controls'}
            title="Expand control panel"
            data-testid="studio-controls-rail"
            className={[
              'hidden h-full min-h-[360px] w-16 flex-col items-center justify-center gap-3 rounded-lg border border-black/[0.08] bg-white/95 px-2 text-ux-text-secondary shadow-md transition-colors hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ux-primary focus-visible:ring-offset-2',
              expandedStudioPanel === 'controls' ? 'xl:hidden' : 'xl:flex',
            ].join(' ')}
            onClick={() => setExpandedStudioPanel('controls')}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider [writing-mode:vertical-rl]">
              Control panel
            </span>
          </button>
          <section
            id="studio-control-panel"
            className={[
              'flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-black/[0.08] bg-white/95 shadow-md',
              expandedStudioPanel === 'controls' ? 'xl:flex' : 'xl:hidden',
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-3 border-b bg-neutral-100 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">
                Control panel
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                {hasPendingChanges && !isGenerating && (
                  <button
                    type="button"
                    className="rounded-md px-2 py-1.5 text-xs font-medium text-ux-primary hover:bg-white/70 hover:underline"
                    onClick={handleDiscardPending}
                  >
                    Discard
                  </button>
                )}
                <button
                  type="button"
                  data-testid="generate-image-button"
                  disabled={
                    !hasPendingChanges ||
                    isGenerating ||
                    controlsDisabled ||
                    !activeDishId ||
                    dishBlocked
                  }
                  className="flex items-center justify-center gap-2 rounded-md bg-ux-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                  onClick={() => {
                    if (insufficientCredits) {
                      setCreditsDialogOpen(true)
                      return
                    }
                    void submitPendingChanges()
                  }}
                >
                  {isGenerating ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
              {!isHydrated && !isExtracting ? (
                <p className="px-1 py-4 text-sm text-gray-500">
                  Upload a photo (or select a variant) to enable controls.
                </p>
              ) : (
                <>
                  <CollapsibleSection
                    title="Lighting"
                    isExpanded={expandedSection === 'lighting'}
                    onExpand={(open) => setExpandedSection(open ? 'lighting' : null)}
                    badge={
                      sectionHasPendingChanges.lighting ? (
                        <PendingEditBadge section="Lighting" />
                      ) : null
                    }
                  >
                    <VisualOptionTiles
                      options={lightingOptions}
                      value={editorState.schema.scene_setup.lighting}
                      disabled={controlsDisabled}
                      ariaLabel="Lighting"
                      onChange={stageLighting}
                    />
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="Tabletop Surface"
                    isExpanded={expandedSection === 'surface'}
                    onExpand={(open) => setExpandedSection(open ? 'surface' : null)}
                    badge={
                      sectionHasPendingChanges.surface ? (
                        <PendingEditBadge section="Tabletop Surface" />
                      ) : null
                    }
                  >
                    {surfaceOptions.length === 0 ? (
                      <p className="text-xs text-gray-500">No tabletop surfaces available yet.</p>
                    ) : (
                      <VisualOptionTiles
                        options={surfaceOptions}
                        value={editorState.schema.canvas.surface_style ?? ''}
                        disabled={controlsDisabled}
                        ariaLabel="Tabletop Surface"
                        onChange={stageSurface}
                      />
                    )}
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="Studio Backdrop"
                    isExpanded={expandedSection === 'backdrop'}
                    onExpand={(open) => setExpandedSection(open ? 'backdrop' : null)}
                    badge={
                      sectionHasPendingChanges.backdrop ? (
                        <PendingEditBadge section="Studio Backdrop" />
                      ) : null
                    }
                  >
                    {backdropKnownFalse && (
                      <p role="status" className="mb-2 text-xs text-amber-800">
                        No vertical backdrop was detected in this photo, so backdrop changes are
                        unavailable.
                      </p>
                    )}
                    {backdropOptions.length === 0 ? (
                      <p className="text-xs text-gray-500">No studio backdrops available yet.</p>
                    ) : (
                      <VisualOptionTiles
                        options={backdropOptions}
                        value={editorState.schema.canvas.background_style ?? ''}
                        disabled={controlsDisabled || backdropKnownFalse}
                        ariaLabel="Studio Backdrop"
                        onChange={stageBackground}
                      />
                    )}
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="Other Elements"
                    isExpanded={expandedSection === 'garnishes'}
                    onExpand={(open) => setExpandedSection(open ? 'garnishes' : null)}
                    badge={
                      sectionHasPendingChanges.garnishes ? (
                        <PendingEditBadge section="Other Elements" />
                      ) : null
                    }
                  >
                    <Component_Control
                      garnishes={editorState.schema.food_components.garnishes}
                      sides={editorState.schema.food_components.sides}
                      allowAdd={false}
                      disabled={controlsDisabled}
                      onGarnishesChange={(garnishes) =>
                        applyStagedChange({
                          ...editorState,
                          schema: {
                            ...editorState.schema,
                            food_components: {
                              ...editorState.schema.food_components,
                              garnishes,
                            },
                          },
                        })
                      }
                      onSidesChange={(sides) =>
                        applyStagedChange({
                          ...editorState,
                          schema: {
                            ...editorState.schema,
                            food_components: {
                              ...editorState.schema.food_components,
                              sides,
                            },
                          },
                        })
                      }
                    />
                  </CollapsibleSection>
                </>
              )}
            </div>

            {dishBlocked && (
              <div className="space-y-2 border-t bg-white p-3">
                <p role="alert" className="text-xs text-amber-900">
                  Generations for this dish are paused after repeated provider failures. Contact
                  support to unblock.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Preview + variants */}
        <section className="order-first flex h-full flex-col overflow-hidden rounded-lg border border-black/[0.08] bg-white/95 shadow-md lg:order-none">
          <div className="border-b bg-neutral-100 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">
              Workbench
            </h2>
          </div>
          <div className="space-y-4 p-4">
            <div className="relative">
              {isGenerating ? (
                <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-ux-primary/30 bg-ux-primary/5 text-sm text-ux-primary">
                  Generating…
                </div>
              ) : currentPreviewUrl ? (
                <button
                  type="button"
                  aria-label={`Expand ${selectedVariantLabel} preview`}
                  className="group relative block w-full rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ux-primary"
                  onClick={() => setWorkbenchImageExpanded(true)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentPreviewUrl}
                    alt="Current studio image"
                    className="max-h-[420px] w-full rounded-md border border-gray-200 object-contain"
                  />
                  <span className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-md bg-black/40 text-[11px] font-bold uppercase tracking-wide text-white group-hover:flex">
                    Expand
                  </span>
                </button>
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 text-sm text-gray-400">
                  <button
                    type="button"
                    disabled={busy || !activeDishId}
                    className="rounded-md bg-ux-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Photo
                  </button>
                  <p className="text-xs text-gray-500">PNG, JPEG, or WebP · up to 9 MB</p>
                </div>
              )}
              {!isGenerating && feedbackImage && currentPreviewUrl && (
                <div className="absolute bottom-3 right-3 z-10">
                  <StudioFeedbackPrompt studioImageId={feedbackImage.id} />
                </div>
              )}
            </div>

            {changeChips.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Changes vs previous image">
                {changeChips.map((chip) => (
                  <li
                    key={chip}
                    className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700"
                  >
                    {chip}
                  </li>
                ))}
              </ul>
            )}

            {mutationError && (
              <p role="alert" className="text-sm text-red-800">
                {mutationError}
              </p>
            )}

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ux-text-secondary">
                Variants
              </p>
              {variants.length === 0 ? (
                <p className="text-sm text-gray-500" data-testid="studio-gallery-empty">
                  Variants appear here after you upload and generate.
                </p>
              ) : (
                <ul className="flex gap-2 overflow-x-auto pb-1" data-testid="studio-gallery">
                  {variants.map((item) => {
                    const isOg = item.role === 'source'
                    const selected = item.id === selectedImageId
                    const genIndex = variants
                      .filter((v) => v.role === 'generated')
                      .findIndex((v) => v.id === item.id)
                    return (
                      <li key={item.id} className="group relative shrink-0">
                        <button
                          type="button"
                          disabled={busy}
                          aria-pressed={selected}
                          aria-label={isOg ? 'Original' : `Variant ${genIndex + 1}`}
                          className={[
                            'block w-20 overflow-hidden rounded-md border-2 transition-colors',
                            selected
                              ? 'border-ux-primary'
                              : 'border-transparent hover:border-gray-300',
                            busy && 'opacity-60',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => void handleReuseImage(item)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.public_url}
                            alt=""
                            className="aspect-square w-full object-cover"
                          />
                          <span className="block truncate bg-gray-50 px-1 py-0.5 text-center text-[10px] font-medium text-gray-600">
                            {isOg ? 'OG' : `V${genIndex + 1}`}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Delete ${isOg ? 'original image' : `variant ${genIndex + 1}`}`}
                          title={`Delete ${isOg ? 'original image' : `variant ${genIndex + 1}`}`}
                          className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-rose-100/75 p-0 text-rose-700 shadow-sm transition hover:bg-rose-200/90 disabled:cursor-not-allowed disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                          style={{
                            boxSizing: 'border-box',
                            width: '1.5rem',
                            height: '1.5rem',
                            minWidth: '1.5rem',
                            minHeight: '1.5rem',
                          }}
                          onClick={() => setImageToDelete(item)}
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5 fill-none stroke-current stroke-[2.25]"
                          >
                            <path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13" />
                          </svg>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Export variants — live, selected-image-specific assets. */}
        <div className="min-w-0 lg:col-span-2 xl:col-span-1">
          <button
            type="button"
            aria-controls="studio-export-panel"
            aria-expanded={expandedStudioPanel === 'exports'}
            title={`Expand exports for ${selectedVariantLabel}`}
            data-testid="studio-exports-rail"
            className={[
              'hidden h-full min-h-[360px] w-16 flex-col items-center justify-center gap-3 rounded-lg border border-black/[0.08] bg-white/95 px-2 text-ux-text-secondary shadow-md transition-[background-color,box-shadow] hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ux-primary focus-visible:ring-offset-2',
              expandedStudioPanel === 'exports' ? 'xl:hidden' : 'xl:flex',
              exportContextFlash && 'studio-export-context-flash',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setExpandedStudioPanel('exports')}
          >
            <span
              className={[
                'text-[11px] font-bold uppercase tracking-wider [writing-mode:vertical-rl] transition-colors duration-200',
                exportContextFlash && 'relative z-30 text-white',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              Export variants
            </span>
            <span className="sr-only" aria-live="polite">
              Exports now show {selectedVariantLabel}.
            </span>
          </button>
          <div className={expandedStudioPanel === 'exports' ? 'xl:block' : 'xl:hidden'}>
            <StudioExportPanel
              sourceImageId={selectedImage?.id ?? null}
              sourceImageLabel={selectedVariantLabel}
              contextFlash={exportContextFlash}
              dishName={activeDish?.name ?? null}
              editorBusy={busy}
              dishBlocked={dishBlocked}
              creditBalance={creditBalance}
              onCreditBalanceChange={setCreditBalance}
            />
          </div>
        </div>
      </div>

      <StudioPendingChangesDialog
        open={pendingChangeCandidate !== null}
        maxChanges={MAX_PENDING_CHANGES}
        changeCount={pendingChangeCandidate?.changeCount ?? MAX_PENDING_CHANGES}
        dontShowAgain={dontShowPendingChangeWarning}
        onDontShowAgainChange={setDontShowPendingChangeWarning}
        onApplyAnyway={handleApplyPendingChangeAnyway}
        onReview={handleReviewPendingChange}
      />

      <StudioModelSwitchDialog
        open={modelWarningOpen}
        dontShowAgain={dontShowModelWarning}
        nb2Cost={creditCostNb2}
        proCost={creditCostNbPro}
        onDontShowAgainChange={setDontShowModelWarning}
        onConfirm={handleConfirmProModel}
        onCancel={handleCancelProModel}
      />

      <StudioCreditsDialog open={creditsDialogOpen} onClose={() => setCreditsDialogOpen(false)} />

      <StudioDishPickerModal
        open={dishPickerOpen}
        dishes={dishPickerItems}
        activeDishId={activeDishId}
        busy={busy}
        loading={dishPickerLoading}
        onClose={() => setDishPickerOpen(false)}
        onSelect={(id) => void handlePickDish(id)}
      />

      <StudioTextModal
        open={createOpen}
        title="New dish"
        label="Dish name"
        confirmText="Create"
        onCancel={() => setCreateOpen(false)}
        onConfirm={(name) => void handleCreateDish(name)}
      />
      <StudioTextModal
        open={renameOpen}
        title="Rename dish"
        label="Dish name"
        initialValue={activeDish?.name ?? ''}
        confirmText="Save"
        onCancel={() => setRenameOpen(false)}
        onConfirm={(name) => void handleRenameDish(name)}
      />
      <StudioImageLightbox
        open={workbenchImageExpanded}
        imageUrl={currentPreviewUrl ?? null}
        title={selectedVariantLabel}
        subtitle={activeDish?.name ?? undefined}
        transparent={selectedImage?.mime_type === 'image/png'}
        onClose={() => setWorkbenchImageExpanded(false)}
      />

      <ConfirmDialog
        open={deleteDishOpen}
        title="Permanently delete this dish?"
        description={`This will permanently delete ${deleteDishSummary?.imageCount ?? 0} image variant${(deleteDishSummary?.imageCount ?? 0) === 1 ? '' : 's'} and ${deleteDishSummary?.exportVariantCount ?? 0} export variant${(deleteDishSummary?.exportVariantCount ?? 0) === 1 ? '' : 's'}. This cannot be undone.`}
        confirmText="Delete dish"
        variant="danger"
        onCancel={() => {
          setDeleteDishOpen(false)
          setDeleteDishSummary(null)
        }}
        onConfirm={() => void handleDeleteDish()}
      />
      <ConfirmDialog
        open={imageToDelete !== null}
        title="Delete this image?"
        description="Permanently delete this image and any export variants made from it. This cannot be undone."
        confirmText="Delete image"
        variant="danger"
        onCancel={() => setImageToDelete(null)}
        onConfirm={() => void handleDeleteImage()}
      />
    </div>
  )
}
