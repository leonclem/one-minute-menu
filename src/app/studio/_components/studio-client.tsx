'use client'

/**
 * Customer-facing Food Photo Studio — control panel + preview/variants shell.
 */

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import type { AllowedMimeType, SourceImage } from '@/lib/photo-control/image-uploader'
import { uploadStudioSourceFile, removeStudioStorageObject } from '@/lib/studio/client-upload'
import { hydrate } from '@/lib/photo-control/hydrator'
import { computeDelta } from '@/lib/photo-control/state-delta'
import { generateDirective } from '@/lib/photo-control/directive-generator'
import { MAX_PENDING_CHANGES } from '@/lib/photo-control/edit-limits'
import { CENTER, type EditorState } from '@/lib/photo-control/minimal-schema'
import { type MinimalValidationResult } from '@/lib/photo-control/schema-validator'
import {
  extractionDiagnosticsNeedsRefresh,
  type ExtractionDiagnostics,
} from '@/lib/studio/extraction-diagnostics'
import { isStudioProEnabled, isStudioReshootEnabled } from '@/lib/product-mode'
import { ANALYTICS_EVENTS } from '@/lib/posthog/events'
import {
  toModelClass,
  trackStudioEvent,
  trackStudioGenerationCompleted,
} from '@/lib/studio/analytics/studio-analytics'
import { ConfirmDialog } from '@/components/ui'
import { buildChangeSummary } from '@/lib/studio/change-summary'
import {
  countStudioPendingChanges,
  editorStateWithFinishingTouches,
  finishingTouchesCountBucket,
  isFinishingTouchesStaged,
  parseFinishingTouchesMetadata,
  stackFromIds,
  type FinishingTouchCatalogueItem,
} from '@/lib/studio/finishing-touches'
import {
  STUDIO_LIGHTING_OPTIONS,
  backdropStylesToOptions,
  fohLightingLabel,
  lightingStylesToOptions,
  surfaceStylesToOptions,
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
  StudioDishRecord,
  StudioImageRecord,
  StudioLightingStyleDisplay,
} from '@/lib/studio/types'
import type { StudioAccessReason } from '@/lib/studio/access/studio-access-decision'
import { resolveStudioAccessMode, type AccessMode } from '@/lib/studio/access/studio-access-mode'
import { useStudioCredits } from './studio-credits-context'
import { StudioStateNotice } from './studio-state-notice'
import { StudioFeedbackPrompt } from './studio-feedback-prompt'
import { StudioExportPanel } from './studio-export-panel'
import { StudioWorkbenchCanvas } from './studio-workbench-canvas'
import { StudioPendingChangesDialog } from './studio-pending-changes-dialog'
import { StudioCreditsDialog } from './studio-credits-dialog'
import { StudioModelSwitchDialog } from './studio-model-switch-dialog'
import { StudioReshootDialog } from './studio-reshoot-dialog'
import {
  StudioObjectEditPanel,
} from './studio-object-edit'
import {
  StudioCropPanel,
  StudioLowResNotice,
} from './studio-crop'
import { StudioExpandPanel } from './studio-expand'
import { neighboringShots, shotShortLabel, shotTitle } from '@/lib/studio/lineage'
import { degradationWarningForShot } from '@/lib/studio/degradation'
import { formatExportCreditLabel } from '@/lib/studio/export-presets'
import { STUDIO_PRO_MODEL } from '@/lib/studio/model-config'
import { applyQuickLook, type StudioQuickLook } from '@/lib/studio/quick-looks'
import {
  parseStudioWorkbenchTab,
  studioWorkbenchHref,
  type StudioWorkbenchTab,
} from '@/lib/studio/workbench-query'
import { StudioShotWorkbench } from './studio-shot-workbench'
import { StudioScenePanel } from './studio-scene-panel'
import { StudioDegradationCallout } from './studio-degradation-callout'
import {
  INITIAL_OBJECT_EDIT_EDITOR_STATE,
  objectEditEditorReducer,
} from '@/lib/studio/object-edit/editor-state'
import {
  undoSelection,
  type SelectionRejectReason,
} from '@/lib/studio/object-edit/selection'
import type { NaturalImageSize } from '@/lib/studio/object-edit/coordinate-transform'
import {
  cropForPreset,
  resolveCropPixelAspect,
  storedPixelSize,
  type CropAspectPreset,
  type NormalizedCropRect,
} from '@/lib/studio/crop'
import {
  DEFAULT_EXPAND_LAYOUT,
  DEFAULT_EXPAND_PRESET,
  type ExpandLayoutId,
  type ExpandPresetId,
} from '@/lib/studio/expand'

type ExtractResponse = MinimalValidationResult & {
  diagnostics?: ExtractionDiagnostics
}

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
  dishes?: StudioDishRecord[]
  gallery?: StudioImageRecord[]
  /** Legacy aliases retained for existing direct callers. */
  initialDishes?: StudioDishRecord[]
  initialGallery?: StudioImageRecord[]
  initialActiveDishId: string
  /** When set, select this gallery row instead of the dish current image. */
  preferredImageId?: string
  initialTab?: string
  studioFirstRunDismissed?: boolean
  isAdmin?: boolean
}

interface StudioPendingChangeCandidate {
  state: EditorState
  baseline: EditorState
  changeCount: number
  finishingSelection?: string[]
}

interface DishDeletionSummary {
  imageCount: number
  exportVariantCount: number
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
        lighting: 'bright-clean',
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
  dishes: providedDishes,
  gallery: providedGallery,
  initialDishes: legacyDishes,
  initialGallery: legacyGallery,
  initialActiveDishId,
  preferredImageId,
  initialTab,
  studioFirstRunDismissed = false,
  isAdmin = false,
}: StudioClientProps) {
  const router = useRouter()
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
    const preferred = preferredImageId
      ? initialGallery.find((image) => image.id === preferredImageId)
      : null
    return preferred?.id ?? resolveCurrentImage(dish, initialGallery)?.id ?? null
  })
  const didActivateInitialRef = useRef(false)
  const didTrackViewedRef = useRef(false)
  const [workbenchTab, setWorkbenchTab] = useState<StudioWorkbenchTab>(() =>
    parseStudioWorkbenchTab(initialTab),
  )
  const [exportReadyCount, setExportReadyCount] = useState(0)
  const [libraryBusy, setLibraryBusy] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [lightingStyles, setLightingStyles] = useState<StudioLightingStyleDisplay[]>([])
  const [backgroundStyles, setBackgroundStyles] = useState<StudioBackgroundStyleDisplay[]>([])
  const [selectedModel, setSelectedModel] = useState<string>(STUDIO_NB2_MODEL)
  const [modelWarningOpen, setModelWarningOpen] = useState(false)
  const [dontShowModelWarning, setDontShowModelWarning] = useState(false)
  const [proWarningDismissed, setProWarningDismissed] = useState(false)
  const [objectEditOpen, setObjectEditOpen] = useState(false)
  const [objectEditState, dispatchObjectEdit] = useReducer(
    objectEditEditorReducer,
    INITIAL_OBJECT_EDIT_EDITOR_STATE,
  )
  const [objectEditNaturalSize, setObjectEditNaturalSize] = useState<NaturalImageSize>({
    width: 0,
    height: 0,
  })
  const [objectEditRejection, setObjectEditRejection] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [cropPreset, setCropPreset] = useState<CropAspectPreset>('original')
  const [cropRect, setCropRect] = useState<NormalizedCropRect | null>(null)
  const [isCropping, setIsCropping] = useState(false)
  const [cropError, setCropError] = useState<string | null>(null)
  const [expandOpen, setExpandOpen] = useState(false)
  const [expandPreset, setExpandPreset] = useState<ExpandPresetId>(DEFAULT_EXPAND_PRESET)
  const [expandLayout, setExpandLayout] = useState<ExpandLayoutId>(DEFAULT_EXPAND_LAYOUT)
  const [isRefreshingExtract, setIsRefreshingExtract] = useState(false)
  const [refreshExtractError, setRefreshExtractError] = useState<string | null>(null)
  const selectedImageIdRef = useRef<string | null>(null)

  useEffect(() => {
    selectedImageIdRef.current = selectedImageId
  }, [selectedImageId])

  const [createOpen, setCreateOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteDishOpen, setDeleteDishOpen] = useState(false)
  const [deleteDishSummary, setDeleteDishSummary] = useState<DishDeletionSummary | null>(null)
  const [imageToDelete, setImageToDelete] = useState<StudioImageRecord | null>(null)
  const [workbenchImageExpanded, setWorkbenchImageExpanded] = useState(false)

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
  const [finishingStack, setFinishingStack] = useState<FinishingTouchCatalogueItem[]>([])
  const [finishingSelectedIds, setFinishingSelectedIds] = useState<string[]>([])
  const [finishingCacheKey, setFinishingCacheKey] = useState<string | null>(null)
  const [finishingLoading, setFinishingLoading] = useState(false)
  const [finishingError, setFinishingError] = useState<string | null>(null)
  const [baselineVersion, setBaselineVersion] = useState(0)
  const { creditBalance, setCreditBalance } = useStudioCredits()
  const [creditCostNb2, setCreditCostNb2] = useState(1)
  const [creditCostNbPro, setCreditCostNbPro] = useState(2)
  const [creditsDialogOpen, setCreditsDialogOpen] = useState(false)
  const [reshootDialogOpen, setReshootDialogOpen] = useState(false)
  const reshootEnabled = isStudioReshootEnabled()
  const proEnabled = isStudioProEnabled()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadAfterCreateRef = useRef(false)
  const [openFilePickerWhenReady, setOpenFilePickerWhenReady] = useState(false)

  const activeDish = dishes.find((d) => d.id === activeDishId) ?? dishes[0]
  const dishBlocked = Boolean(activeDish?.generation_blocked_at)
  const variants = useMemo(() => sortVariants(gallery), [gallery])
  const selectedImage = variants.find((v) => v.id === selectedImageId) ?? null
  const neighbors = useMemo(
    () =>
      selectedImageId
        ? neighboringShots(selectedImageId, gallery)
        : { prev: null, next: null },
    [gallery, selectedImageId],
  )
  const currentShotTitle = selectedImage ? shotTitle(selectedImage, gallery) : 'Shot'
  const selectedShotLabel = selectedImage ? shotShortLabel(selectedImage, gallery) : 'shot'
  const cropStoredSize = storedPixelSize(selectedImage)
  const degradationWarning = selectedImage
    ? degradationWarningForShot(selectedImage, gallery)
    : null
  const degradationCallout =
    degradationWarning && activeDishId ? (
      <StudioDegradationCallout dishId={activeDishId} warning={degradationWarning} />
    ) : null

  useEffect(() => {
    if (!activeDishId || !selectedImageId) return
    router.replace(studioWorkbenchHref(activeDishId, selectedImageId, workbenchTab), {
      scroll: false,
    })
  }, [activeDishId, router, selectedImageId, workbenchTab])

  const currentPreviewUrl =
    mutatedImageUrl ?? sourceImage?.dataUrl ?? selectedImage?.public_url ?? null
  const feedbackImage = selectedImage?.role === 'generated' ? selectedImage : null

  const selectedFinishingStack = useMemo(
    () => finishingStack.filter((item) => finishingSelectedIds.includes(item.id)),
    [finishingSelectedIds, finishingStack],
  )
  const finishingStaged = isFinishingTouchesStaged(
    selectedFinishingStack,
    selectedFinishingStack.length,
  )
  const pendingDelta = useMemo(() => {
    void baselineVersion
    return computeDelta(originalStateRef.current, editorState)
  }, [editorState, baselineVersion])

  const pendingChangeCount = countStudioPendingChanges(pendingDelta, finishingStaged)
  const hasPendingChanges = pendingChangeCount > 0
  const sectionHasPendingChanges = {
    lighting: pendingDelta.scalarChanges.some((change) => change.path === 'scene_setup.lighting'),
    surface: pendingDelta.scalarChanges.some((change) => change.path === 'canvas.surface_style'),
    backdrop: pendingDelta.scalarChanges.some(
      (change) => change.path === 'canvas.background_style'
    ),
    garnishes:
      finishingStaged ||
      pendingDelta.arrays.garnishes.removed.length > 0 ||
      pendingDelta.arrays.sides.removed.length > 0,
  }
  const controlsDisabled = !isHydrated || isGenerating || dishBlocked
  const generateCreditCost =
    selectedModel === STUDIO_PRO_MODEL ? creditCostNbPro : creditCostNb2
  const generateCreditLabel = formatExportCreditLabel(generateCreditCost)
  const insufficientCredits =
    creditBalance !== null && creditBalance < generateCreditCost
  const busy = libraryBusy || isUploading || isExtracting || isGenerating || isCropping

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
    return surfaceStylesToOptions(filtered)
  }, [backgroundStyles])

  const backdropOptions = useMemo(() => {
    const filtered = backgroundStyles.filter((style) => style.category === 'backdrop')
    return backdropStylesToOptions(filtered)
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
  const surfaceKeys = useMemo(
    () => surfaceOptions.map((option) => option.value),
    [surfaceOptions],
  )
  const backdropKeys = useMemo(
    () => backdropOptions.map((option) => option.value),
    [backdropOptions],
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

  const resetFinishingTouches = useCallback(() => {
    setFinishingStack([])
    setFinishingSelectedIds([])
    setFinishingCacheKey(null)
    setFinishingLoading(false)
    setFinishingError(null)
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
    resetFinishingTouches()
    dispatchObjectEdit({ type: 'SOURCE_CHANGED' })
    setObjectEditRejection(null)
  }, [resetFinishingTouches])

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
    async (imageId: string, options?: { quiet?: boolean }): Promise<EditorState | null> => {
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
        if (!options?.quiet) {
          setExtractionError(
            'Could not start extraction for this image. Refresh the page and try uploading again.'
          )
        }
        emitExtractionFailure(undefined, new Error('invalid image reference'))
        return null
      }

      if (options?.quiet) {
        setIsRefreshingExtract(true)
        setRefreshExtractError(null)
      } else {
        setIsExtracting(true)
        setExtractionError(null)
      }

      try {
        const response = await fetch('/api/studio/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageId }),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => null)
          const message =
            (err as { error?: string } | null)?.error ??
            `Extraction failed (HTTP ${response.status})`
          if (options?.quiet) setRefreshExtractError(message)
          else setExtractionError(message)
          emitExtractionFailure(response.status)
          return null
        }

        const data = (await response.json()) as ExtractResponse
        if (selectedImageIdRef.current !== imageId) return null

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
        const message = err instanceof Error ? err.message : 'Extraction failed unexpectedly.'
        if (options?.quiet) setRefreshExtractError(message)
        else setExtractionError(message)
        emitExtractionFailure(undefined, err)
        return null
      } finally {
        if (options?.quiet) setIsRefreshingExtract(false)
        else setIsExtracting(false)
      }
    },
    [applyHydratedState]
  )

  const activateImage = useCallback(
    async (image: StudioImageRecord, options?: { persistCurrent?: boolean }) => {
      dispatchObjectEdit({ type: 'SOURCE_CHANGED' })
      setObjectEditOpen(false)
      setObjectEditRejection(null)
      setCropOpen(false)
      setCropError(null)
      setExpandOpen(false)
      resetFinishingTouches()
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
        const staleSourceDiagnostics =
          image.role === 'source' &&
          extractionDiagnosticsNeedsRefresh(extractionDiagnosticsRef.current)
        if (stored && !staleSourceDiagnostics) {
          applyHydratedState(stored)
        } else if (stored && staleSourceDiagnostics) {
          setIsHydrated(false)
          const extracted = await runExtraction(image.id)
          if (extracted) {
            await persistEditorState(image.id, extracted)
          }
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
    [applyHydratedState, persistDishCurrent, persistEditorState, resetFinishingTouches, runExtraction]
  )

  const loadGalleryForDish = useCallback(
    async (
      dishId: string,
      dishRecord?: StudioDishRecord,
      preferredImageId?: string,
    ): Promise<boolean> => {
      const imagesRes = await fetch(`/api/studio/images?dishId=${encodeURIComponent(dishId)}`)
      if (!imagesRes.ok) {
        const err = await imagesRes.json().catch(() => null)
        throw new Error((err as { error?: string } | null)?.error ?? 'Failed to load library')
      }
      const data = (await imagesRes.json()) as { images: StudioImageRecord[] }
      const next = data.images ?? []
      setGallery(next)
      const dish = dishRecord ?? dishes.find((d) => d.id === dishId)
      const current =
        (preferredImageId ? next.find((image) => image.id === preferredImageId) : null) ??
        resolveCurrentImage(dish, next)
      setSelectedImageId(current?.id ?? null)
      if (current) {
        return await activateImage(current, { persistCurrent: false })
      }
      resetEditorForNewSource()
      setSourceImage(null)
      setPersistedSourceId(null)
      return false
    },
    [activateImage, dishes, resetEditorForNewSource]
  )

  useEffect(() => {
    if (didActivateInitialRef.current) return
    didActivateInitialRef.current = true
    const dish = initialDishes.find((d) => d.id === initialActiveDishId)
    const preferred = preferredImageId
      ? initialGallery.find((image) => image.id === preferredImageId)
      : null
    const current = preferred ?? resolveCurrentImage(dish, initialGallery)
    if (current) {
      void activateImage(current, { persistCurrent: false })
    }
  }, [activateImage, initialActiveDishId, initialDishes, initialGallery, preferredImageId])

  const requestUpload = useCallback(() => {
    if (!activeDishId) {
      pendingUploadAfterCreateRef.current = true
      setCreateOpen(true)
      return
    }
    fileInputRef.current?.click()
  }, [activeDishId])

  useEffect(() => {
    if (!openFilePickerWhenReady || !activeDishId || busy) return
    setOpenFilePickerWhenReady(false)
    fileInputRef.current?.click()
  }, [openFilePickerWhenReady, activeDishId, busy])

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

      const nextCount = countStudioPendingChanges(
        delta,
        finishingStaged,
      )
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
    [commitStagedChange, finishingStaged]
  )

  const handleToggleFinishingTouch = useCallback(
    (id: string) => {
      const alreadySelected = finishingSelectedIds.includes(id)
      const nextSelection = alreadySelected
        ? finishingSelectedIds.filter((selectedId) => selectedId !== id)
        : [...finishingSelectedIds, id]
      const addingFirstSelection = !alreadySelected && finishingSelectedIds.length === 0
      const delta = computeDelta(originalStateRef.current, editorState)
      const nextCount = countStudioPendingChanges(delta, nextSelection.length > 0)
      if (
        addingFirstSelection &&
        nextCount > MAX_PENDING_CHANGES &&
        !skipPendingChangeWarningRef.current
      ) {
        setPendingChangeCandidate({
          state: editorState,
          baseline: originalStateRef.current,
          changeCount: nextCount,
          finishingSelection: nextSelection,
        })
        setDontShowPendingChangeWarning(false)
        return
      }
      setFinishingSelectedIds(nextSelection)
    },
    [editorState, finishingSelectedIds],
  )

  const handleLoadFinishingTouches = useCallback(async () => {
    if (finishingLoading || isRefreshingExtract) return
    if (finishingCacheKey !== null && finishingCacheKey === persistedSourceId) {
      return
    }
    setFinishingLoading(true)
    setFinishingError(null)
    try {
      const observations = extractionDiagnosticsRef.current?.observations
      const description =
        typeof observations?.description === 'string' ? observations.description : undefined
      const response = await fetch('/api/studio/finishing-touches/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dishName: activeDish?.name,
          mainItem: editorState.schema.food_components.main_item,
          garnishes: originalStateRef.current.schema.food_components.garnishes,
          sides: originalStateRef.current.schema.food_components.sides,
          description,
        }),
      })
      if (!response.ok) {
        setFinishingError('Could not load finishing touches. Try again.')
        return
      }
      const data = (await response.json()) as { stackIds?: unknown }
      const stack = stackFromIds(Array.isArray(data.stackIds) ? data.stackIds.filter((id): id is string => typeof id === 'string') : [])
      setFinishingStack(stack)
      setFinishingCacheKey(persistedSourceId)
      trackStudioEvent(ANALYTICS_EVENTS.STUDIO_FINISHING_TOUCHES_RECOMMENDED, {
        count_bucket: finishingTouchesCountBucket(stack.length || 0),
        generation_kind: 'finishing_touches',
      })
      setFinishingSelectedIds([])
    } catch {
      setFinishingError('Could not load finishing touches. Try again.')
    } finally {
      setFinishingLoading(false)
    }
  }, [
    activeDish?.name,
    editorState.schema.food_components.main_item,
    finishingCacheKey,
    finishingLoading,
    isRefreshingExtract,
    persistedSourceId,
  ])

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

  const stageQuickLook = useCallback(
    (look: StudioQuickLook) => {
      const { nextState, nextBaseline } = applyQuickLook({
        look,
        current: editorState,
        baseline: originalStateRef.current,
        includeBackdrop: !backdropKnownFalse,
        lightingKeys,
        surfaceKeys,
        backdropKeys,
      })
      applyStagedChange(nextState, nextBaseline)
    },
    [
      applyStagedChange,
      backdropKnownFalse,
      backdropKeys,
      editorState,
      lightingKeys,
      surfaceKeys,
    ],
  )

  const handleDiscardPending = useCallback(() => {
    setEditorState(originalStateRef.current)
    setPendingChangeCandidate(null)
    setDontShowPendingChangeWarning(false)
    setFinishingSelectedIds([])
  }, [])

  const handleApplyPendingChangeAnyway = useCallback(() => {
    if (!pendingChangeCandidate) return
    if (dontShowPendingChangeWarning) {
      skipPendingChangeWarningRef.current = true
    }
    commitStagedChange(pendingChangeCandidate.state, pendingChangeCandidate.baseline)
    if (pendingChangeCandidate.finishingSelection) {
      setFinishingSelectedIds(pendingChangeCandidate.finishingSelection)
    }
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
    const nextState = editorStateWithFinishingTouches(
      editorState,
      original,
      selectedFinishingStack,
      selectedFinishingStack.length,
    )
    const delta = computeDelta(original, nextState)
    if (delta.isEmpty || !sourceImage || !activeDishId || !persistedSourceId) return

    const directive = generateDirective(delta, nextState, {
      excludePaths: FOH_STYLE_EXCLUDE_PATHS,
    })
    if (!directive) return

    const finishingTouches = parseFinishingTouchesMetadata(
      selectedFinishingStack.length > 0 &&
        (delta.arrays.garnishes.added.length > 0 || delta.arrays.sides.added.length > 0)
        ? {
            stackIds: selectedFinishingStack.map((item) => item.id),
            level: selectedFinishingStack.length,
            auto: true,
          }
        : undefined,
    )

    const changeSummary = buildChangeSummary(delta, {
      lightingLabels: lightingLabelMap,
      backgroundLabels: backgroundLabelMap,
      finishingTouchesCount: finishingTouches?.level,
    })
    const generationStartedAt = Date.now()
    const generationKind = finishingTouches ? 'finishing_touches' : undefined

    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_STARTED, {
      model_class: toModelClass(selectedModel),
      stage: 'generation',
      has_source_image: Boolean(sourceImage),
      variant_count: variants.length,
      ...(generationKind ? { generation_kind: generationKind } : {}),
      ...(finishingTouches
        ? { count_bucket: finishingTouchesCountBucket(finishingTouches.level) }
        : {}),
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
          finishingTouches,
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
        generationKind,
        ...(finishingTouches
          ? { countBucket: finishingTouchesCountBucket(finishingTouches.level) }
          : {}),
      })
      setMutatedImageUrl(data.imageUrl)
      if (data.credits && typeof data.credits.balanceAfter === 'number') {
        setCreditBalance(data.credits.balanceAfter)
      }
      setEditorState(nextState)
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
          ...(extractionDiagnosticsRef.current
            ? { extractionDiagnostics: extractionDiagnosticsRef.current }
            : {}),
          ...(finishingTouches ? { finishingTouches } : {}),
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
      resetFinishingTouches()
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
    selectedFinishingStack,
    resetFinishingTouches,
  ])

  const handleObjectEditOpen = useCallback(() => {
    setCropOpen(false)
    setExpandOpen(false)
    dispatchObjectEdit({ type: 'OPERATION_CHANGED', operation: 'remove' })
    setObjectEditRejection(null)
    setObjectEditOpen(true)
    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_OBJECT_EDIT_OPENED, {
      edit_operation: 'remove',
      surface: 'studio',
    })
    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_OBJECT_EDIT_OPERATION_SELECTED, {
      edit_operation: 'remove',
      surface: 'studio',
    })
  }, [])

  const handleObjectEditUndo = useCallback(() => {
    if (objectEditNaturalSize.width <= 0 || objectEditNaturalSize.height <= 0) return
    dispatchObjectEdit({
      type: 'UNDO_APPLIED',
      selection: undoSelection(objectEditState.selection, objectEditNaturalSize),
    })
    setObjectEditRejection(null)
  }, [objectEditNaturalSize, objectEditState.selection])

  const handleObjectEditClear = useCallback(() => {
    dispatchObjectEdit({ type: 'CLEAR' })
    setObjectEditRejection(null)
  }, [])

  const handleObjectEditClose = useCallback(() => {
    dispatchObjectEdit({ type: 'CLOSE' })
    setObjectEditOpen(false)
    setObjectEditRejection(null)
    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_OBJECT_EDIT_CANCELLED, {
      edit_operation: 'remove',
      surface: 'studio',
    })
  }, [])

  const handleCropOpen = useCallback(() => {
    setObjectEditOpen(false)
    setExpandOpen(false)
    setObjectEditRejection(null)
    setCropError(null)
    const size =
      cropStoredSize ??
      (objectEditNaturalSize.width > 0 && objectEditNaturalSize.height > 0
        ? objectEditNaturalSize
        : null)
    const preset: CropAspectPreset = 'original'
    setCropPreset(preset)
    setCropRect(size ? cropForPreset(preset, size) : { x: 0, y: 0, width: 1, height: 1 })
    setCropOpen(true)
  }, [cropStoredSize, objectEditNaturalSize])

  const handleCropPresetChange = useCallback(
    (preset: CropAspectPreset) => {
      setCropPreset(preset)
      const size =
        cropStoredSize ??
        (objectEditNaturalSize.width > 0 && objectEditNaturalSize.height > 0
          ? objectEditNaturalSize
          : null)
      if (size) setCropRect(cropForPreset(preset, size))
    },
    [cropStoredSize, objectEditNaturalSize],
  )

  const handleCropCancel = useCallback(() => {
    setCropOpen(false)
    setCropError(null)
  }, [])

  const handleCropApply = useCallback(async () => {
    if (!cropRect || !persistedSourceId || !activeDishId) return

    setIsCropping(true)
    setCropError(null)
    try {
      const response = await fetch('/api/studio/crop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceImageId: persistedSourceId,
          dishId: activeDishId,
          crop: cropRect,
          aspectPreset: cropPreset,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => null)
        const message =
          (err as { error?: string } | null)?.error ?? `Crop failed (HTTP ${response.status})`
        setCropError(message)
        trackStudioEvent(ANALYTICS_EVENTS.STUDIO_CROP_FAILED, {
          outcome: 'failed',
          failure_class: extractionFailureClass(response.status),
          variant_count: variants.length,
        })
        return
      }

      const data = (await response.json()) as { image: StudioImageRecord }
      const row = data.image
      trackStudioEvent(ANALYTICS_EVENTS.STUDIO_CROP_COMPLETED, {
        outcome: 'success',
        variant_count: variants.length + 1,
      })
      setGallery((prev) => [...prev.filter((image) => image.id !== row.id), row])
      setSelectedImageId(row.id)
      setPersistedSourceId(row.id)
      setMutatedImageUrl(undefined)
      setSourceImage(sourceImageFromRecord(row.public_url, row.mime_type))
      setDishes((prev) =>
        prev.map((d) => (d.id === activeDishId ? { ...d, current_image_id: row.id } : d)),
      )
      const stored = readEditorStateFromMetadata(row.metadata)
      if (stored) applyHydratedState(stored)
      resetFinishingTouches()
      setCropOpen(false)
      setIsCropping(false)
      const extracted = await runExtraction(row.id, { quiet: true })
      if (extracted && selectedImageIdRef.current === row.id) {
        await persistEditorState(row.id, extracted)
      }
    } catch {
      setCropError('Could not crop this image. Try again.')
      trackStudioEvent(ANALYTICS_EVENTS.STUDIO_CROP_FAILED, {
        outcome: 'failed',
        failure_class: 'network',
        variant_count: variants.length,
      })
    } finally {
      setIsCropping(false)
    }
  }, [
    activeDishId,
    applyHydratedState,
    cropPreset,
    cropRect,
    persistEditorState,
    persistedSourceId,
    resetFinishingTouches,
    runExtraction,
    variants.length,
  ])

  const handleExpandOpen = useCallback(() => {
    setObjectEditOpen(false)
    setObjectEditRejection(null)
    setCropOpen(false)
    setCropError(null)
    setExpandPreset(DEFAULT_EXPAND_PRESET)
    setExpandLayout(DEFAULT_EXPAND_LAYOUT)
    setExpandOpen(true)
  }, [])

  const handleExpandCancel = useCallback(() => {
    setExpandOpen(false)
  }, [])

  const handleExpandApply = useCallback(async () => {
    if (!persistedSourceId || !activeDishId) return
    if (insufficientCredits) {
      setCreditsDialogOpen(true)
      return
    }

    const generationStartedAt = Date.now()
    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_STARTED, {
      model_class: toModelClass(selectedModel),
      stage: 'expand',
      generation_kind: 'expand',
    })
    setIsGenerating(true)
    setMutationError(null)
    try {
      const response = await fetch('/api/studio/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dishId: activeDishId,
          sourceImageId: persistedSourceId,
          preset: expandPreset,
          layout: expandLayout,
          model: selectedModel,
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
          stage: 'expand',
          generation_kind: 'expand',
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

        setMutationError(payload?.error ?? `Expand failed (HTTP ${response.status})`)
        if (blockedByDish) {
          setDishes((prev) =>
            prev.map((d) =>
              d.id === activeDishId
                ? {
                    ...d,
                    generation_blocked_at: new Date().toISOString(),
                    generation_blocked_reason: payload?.error ?? 'Blocked',
                  }
                : d,
            ),
          )
        }
        return
      }

      const data = (await response.json()) as {
        image: StudioImageRecord
        imageUrl: string
        imageId: string
        model: string
        credits?: { cost: number; balanceAfter: number }
      }
      trackStudioGenerationCompleted({
        model: data.model,
        validationStatus: 'skipped',
        startedAt: generationStartedAt,
        endedAt: Date.now(),
        balanceAfter:
          typeof data.credits?.balanceAfter === 'number'
            ? data.credits.balanceAfter
            : (creditBalance ?? 0),
        cost: data.credits?.cost,
        generationKind: 'expand',
      })
      const row = data.image
      if (data.credits && typeof data.credits.balanceAfter === 'number') {
        setCreditBalance(data.credits.balanceAfter)
      }
      setGallery((prev) => [...prev.filter((image) => image.id !== row.id), row])
      setSelectedImageId(row.id)
      setPersistedSourceId(row.id)
      setMutatedImageUrl(undefined)
      setSourceImage(sourceImageFromRecord(row.public_url, row.mime_type))
      setDishes((prev) =>
        prev.map((d) =>
          d.id === activeDishId
            ? {
                ...d,
                current_image_id: row.id,
                generation_failure_count: 0,
                generation_blocked_at: null,
                generation_blocked_reason: null,
              }
            : d,
        ),
      )
      const stored = readEditorStateFromMetadata(row.metadata)
      if (stored) applyHydratedState(stored)
      resetFinishingTouches()
      setExpandOpen(false)
    } catch {
      setMutationError('Could not expand this image. Try again.')
      trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_FAILED, {
        model_class: toModelClass(selectedModel),
        stage: 'expand',
        generation_kind: 'expand',
        outcome: 'failure',
        failure_class: 'network',
      })
    } finally {
      setIsGenerating(false)
    }
  }, [
    activeDishId,
    applyHydratedState,
    creditBalance,
    expandLayout,
    expandPreset,
    insufficientCredits,
    persistedSourceId,
    resetFinishingTouches,
    selectedModel,
    setCreditBalance,
  ])

  const objectEditRejectionText = useCallback((reason: SelectionRejectReason): string => {
    switch (reason) {
      case 'stroke-limit':
        return 'That mark was not added because the selection limit was reached.'
      case 'point-limit':
        return 'That mark was not added because the selection is full.'
      case 'path-simplification':
        return 'That drawing was too detailed to add. Try a shorter mark.'
      default:
        return 'That mark was not added. Try tapping or drawing again.'
    }
  }, [])

  const handleObjectEditGenerate = useCallback(async () => {
    const selection = objectEditState.selection
    if (
      selection.strokes.length === 0 ||
      !selection.boundingRegion ||
      !activeDishId ||
      !persistedSourceId
    ) {
      return
    }
    if (insufficientCredits) {
      setCreditsDialogOpen(true)
      return
    }

    const generationStartedAt = Date.now()
    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_STARTED, {
      model_class: toModelClass(selectedModel),
      stage: 'object_edit',
      generation_kind: 'object_edit',
      edit_operation: 'remove',
    })
    setIsGenerating(true)
    setObjectEditRejection(null)
    setMutationError(null)
    try {
      const response = await fetch('/api/studio/object-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dishId: activeDishId,
          sourceImageId: persistedSourceId,
          model: selectedModel,
          editIntent: {
            version: 1,
            operation: 'remove',
            selection: {
              version: 1,
              strokes: selection.strokes,
              boundingRegion: selection.boundingRegion,
            },
          },
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string
          code?: string
        } | null
        if (payload?.code === 'STUDIO_INSUFFICIENT_CREDITS') setCreditsDialogOpen(true)
        trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_FAILED, {
          model_class: toModelClass(selectedModel),
          stage: 'object_edit',
          generation_kind: 'object_edit',
          edit_operation: 'remove',
          outcome: 'failure',
          failure_class: payload?.code ?? 'http_error',
        })
        setObjectEditRejection(payload?.error ?? `Remove failed (HTTP ${response.status})`)
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
        generationKind: 'object_edit',
        editOperation: 'remove',
      })
      if (data.credits && typeof data.credits.balanceAfter === 'number') {
        setCreditBalance(data.credits.balanceAfter)
      }

      const updatedDish = activeDish
        ? {
            ...activeDish,
            current_image_id: data.imageId,
            generation_failure_count: 0,
            generation_blocked_at: null,
            generation_blocked_reason: null,
          }
        : undefined
      setDishes((prev) =>
        prev.map((dish) => (dish.id === activeDishId && updatedDish ? updatedDish : dish)),
      )

      let refreshedChild = false
      try {
        refreshedChild = await loadGalleryForDish(activeDishId, updatedDish, data.imageId)
      } catch {
        // The committed child is still usable through the response fallback below.
      }

      if (!refreshedChild) {
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
          metadata: { objectEdit: { operation: 'remove' } },
          is_favourite: false,
          archived_at: null,
          created_at: new Date().toISOString(),
        }
        setGallery((prev) => [...prev.filter((image) => image.id !== row.id), row])
        setSelectedImageId(data.imageId)
        setPersistedSourceId(data.imageId)
        setSourceImage(sourceImageFromRecord(data.imageUrl, 'image/png'))
      }
      dispatchObjectEdit({ type: 'SUBMISSION_ACCEPTED' })
      setObjectEditOpen(false)
    } catch (error) {
      trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_FAILED, {
        model_class: toModelClass(selectedModel),
        stage: 'object_edit',
        generation_kind: 'object_edit',
        edit_operation: 'remove',
        outcome: 'failure',
        failure_class: error instanceof TypeError ? 'network' : 'unexpected',
      })
      setObjectEditRejection(error instanceof Error ? error.message : 'Remove failed unexpectedly.')
    } finally {
      setIsGenerating(false)
    }
  }, [
    activeDish,
    activeDishId,
    creditBalance,
    insufficientCredits,
    loadGalleryForDish,
    objectEditState.selection,
    persistedSourceId,
    selectedModel,
  ])

  const handleReshoot = useCallback(
    async (input: {
      improvePlating: boolean
      styles: { lighting: string; backdrop: string; surface: string }
    }) => {
      if (!sourceImage || !activeDishId || !persistedSourceId) return

      if (insufficientCredits) {
        setReshootDialogOpen(false)
        setCreditsDialogOpen(true)
        return
      }

      const generationStartedAt = Date.now()
      trackStudioEvent(ANALYTICS_EVENTS.STUDIO_GENERATION_STARTED, {
        model_class: toModelClass(selectedModel),
        stage: 'reshoot',
        has_source_image: Boolean(sourceImage),
        variant_count: variants.length,
      })

      setIsGenerating(true)
      setMutationError(null)
      setReshootDialogOpen(false)

      try {
        const response = await fetch('/api/studio/reshoot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dishId: activeDishId,
            sourceImageId: persistedSourceId,
            baseState: editorState.schema,
            styles: input.styles,
            improvePlating: input.improvePlating,
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
            stage: 'reshoot',
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

          setMutationError(payload?.error ?? `Re-shoot failed (HTTP ${response.status})`)
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

        const targetSchema = {
          ...editorState.schema,
          scene_setup: {
            ...editorState.schema.scene_setup,
            lighting: input.styles.lighting,
          },
          canvas: {
            ...editorState.schema.canvas,
            background_style: input.styles.backdrop,
            surface_style: input.styles.surface,
          },
        }
        const nextState: EditorState = { ...editorState, schema: targetSchema }
        originalStateRef.current = nextState
        setEditorState(nextState)
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
            mode: 'reshoot',
            improvePlating: input.improvePlating,
            reshotFrom: persistedSourceId,
            editorState: editorStateToMetadata(nextState),
            ...(extractionDiagnosticsRef.current
              ? { extractionDiagnostics: extractionDiagnosticsRef.current }
              : {}),
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
          stage: 'reshoot',
          duration_ms: Math.max(0, Date.now() - generationStartedAt),
          outcome: 'failure',
          failure_class: 'network',
        })
        setMutationError(err instanceof Error ? err.message : 'Re-shoot failed unexpectedly.')
      } finally {
        setIsGenerating(false)
      }
    },
    [
      sourceImage,
      activeDishId,
      persistedSourceId,
      editorState.schema,
      selectedModel,
      variants.length,
      creditBalance,
      insufficientCredits,
    ]
  )

  const handleCreateDish = useCallback(
    async (name: string) => {
      pendingUploadAfterCreateRef.current = false
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
        router.push(`/studio/${data.dish.id}`)
      } catch (err) {
        setLibraryError(err instanceof Error ? err.message : 'Failed to create dish')
      } finally {
        setLibraryBusy(false)
      }
    },
    [router]
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
      const nextId = remaining[0]?.id
      if (nextId) {
        router.push(`/studio/${nextId}`)
      } else {
        router.push('/studio')
      }
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Failed to delete dish')
    } finally {
      setLibraryBusy(false)
    }
  }, [activeDish, dishes, router])

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
    <div className="space-y-6" data-studio-access-reason={reason} data-testid="studio-client">
      {creditBalance !== null && creditBalance <= 0 && <StudioStateNotice kind="no_credit" />}
      {dishBlocked && <StudioStateNotice kind="blocked_dish" />}
      {libraryError ? (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {libraryError}
        </p>
      ) : null}
      {extractionError ? (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {extractionError}
        </p>
      ) : null}
      {strictConformanceWarning && isHydrated ? (
        <p role="status" className="text-xs text-[#f8bc02]">
          Some values were adjusted to match allowed options. Controls are enabled.
        </p>
      ) : null}

      <StudioShotWorkbench
        dishId={activeDishId}
        dishName={activeDish?.name ?? 'Dish'}
        shotTitle={currentShotTitle}
        tab={workbenchTab}
        onTab={setWorkbenchTab}
        sceneCount={pendingChangeCount}
        exportsCount={exportReadyCount}
        images={gallery}
        selectedId={selectedImageId}
        filmstripDisabled={busy}
        onSelectShot={(image) => void handleReuseImage(image)}
        onDeleteShot={setImageToDelete}
        hasPrev={Boolean(neighbors.prev)}
        hasNext={Boolean(neighbors.next)}
        onPrev={() => {
          if (neighbors.prev) void handleReuseImage(neighbors.prev)
        }}
        onNext={() => {
          if (neighbors.next) void handleReuseImage(neighbors.next)
        }}
        toolsDisabled={busy || dishBlocked || !sourceImage || !persistedSourceId}
        cropOpen={cropOpen}
        expandOpen={expandOpen}
        objectEditOpen={objectEditOpen}
        creditLabel={generateCreditLabel}
        onReframe={handleCropOpen}
        onExpandScene={handleExpandOpen}
        onRemove={handleObjectEditOpen}
        expanded={workbenchImageExpanded}
        onCloseExpand={() => setWorkbenchImageExpanded(false)}
        notices={
          <>
            {isUploading ? (
              <p role="status" className="text-sm text-[#5fd3da]">
                Uploading image…
              </p>
            ) : null}
            {isExtracting ? (
              <p role="status" className="text-sm text-[#5fd3da]">
                Analysing photo structure…
              </p>
            ) : null}
            <StudioLowResNotice natural={cropStoredSize} />
            {mutationError ? (
              <p role="alert" className="text-sm text-[#ff8a80]">
                {mutationError}
              </p>
            ) : null}
          </>
        }
        canvas={
          <div
            className={[
              'studio-checkerboard relative overflow-hidden rounded-[16px] border border-white/[0.1]',
              workbenchImageExpanded
                ? 'h-full min-h-0'
                : 'min-h-[16rem] lg:min-h-[28rem]',
            ].join(' ')}
            aria-busy={isUploading || isExtracting || isGenerating}
          >
            {currentPreviewUrl ? (
              <StudioWorkbenchCanvas
                src={currentPreviewUrl}
                alt="Current studio image"
                expandLabel={
                  workbenchImageExpanded
                    ? `Close ${selectedShotLabel} preview`
                    : `Expand ${selectedShotLabel} preview`
                }
                expanded={workbenchImageExpanded}
                transparent={selectedImage?.mime_type === 'image/png'}
                onExpand={() => setWorkbenchImageExpanded((open) => !open)}
                selectionMode={objectEditOpen}
                cropMode={cropOpen}
                sceneExpandMode={expandOpen}
                expandPreset={expandPreset}
                expandLayout={expandLayout}
                onExpandGestureChange={({ preset, layout }) => {
                  setExpandPreset(preset)
                  setExpandLayout(layout)
                }}
                cropRect={cropRect}
                cropPixelAspect={
                  cropStoredSize
                    ? resolveCropPixelAspect(cropPreset, cropStoredSize)
                    : objectEditNaturalSize.width > 0
                      ? resolveCropPixelAspect(cropPreset, objectEditNaturalSize)
                      : null
                }
                cropNaturalSize={cropStoredSize}
                onCropRectChange={setCropRect}
                selection={objectEditState.selection}
                naturalSize={objectEditNaturalSize}
                onNaturalSizeChange={setObjectEditNaturalSize}
                onSelectionChange={(selection) => {
                  dispatchObjectEdit({ type: 'SELECTION_ACCEPTED', selection })
                  setObjectEditRejection(null)
                  trackStudioEvent(ANALYTICS_EVENTS.STUDIO_OBJECT_EDIT_STROKE_ACCEPTED, {
                    edit_operation: 'remove',
                    count_bucket:
                      selection.strokes.length >= 8
                        ? '8'
                        : selection.strokes.length >= 4
                          ? '4-7'
                          : '1-3',
                  })
                }}
                onSelectionRejected={(reason) => {
                  setObjectEditRejection(objectEditRejectionText(reason))
                  trackStudioEvent(ANALYTICS_EVENTS.STUDIO_OBJECT_EDIT_STROKE_REJECTED, {
                    edit_operation: 'remove',
                    reason_bucket: reason,
                  })
                }}
              />
            ) : (
              <div className="flex min-h-[16rem] items-center justify-center p-6 text-sm text-white/40">
                Open a shot from this dish to edit.
              </div>
            )}
            {(isUploading || isExtracting || isGenerating) && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center rounded-[16px] border border-[#01b3bf]/30 bg-[#0c1416]/70 text-sm text-[#5fd3da] backdrop-blur-sm"
                role="status"
                aria-live="polite"
              >
                {isUploading
                  ? 'Uploading photo…'
                  : isExtracting
                    ? 'Analysing photo…'
                    : 'Generating…'}
              </div>
            )}
            {!busy && !workbenchImageExpanded && feedbackImage && currentPreviewUrl ? (
              <div className="absolute bottom-3 right-3 z-10">
                <StudioFeedbackPrompt studioImageId={feedbackImage.id} />
              </div>
            ) : null}
          </div>
        }
        cropPanel={
          cropOpen && cropRect ? (
            <StudioCropPanel
              preset={cropPreset}
              natural={cropStoredSize}
              crop={cropRect}
              busy={isCropping}
              error={cropError}
              overlay={workbenchImageExpanded}
              onPresetChange={handleCropPresetChange}
              onApply={() => void handleCropApply()}
              onCancel={handleCropCancel}
            />
          ) : null
        }
        expandPanel={
          expandOpen ? (
            <StudioExpandPanel
              preset={expandPreset}
              layout={expandLayout}
              busy={isGenerating}
              overlay={workbenchImageExpanded}
              creditLabel={generateCreditLabel}
              degradationCallout={degradationCallout}
              onPresetChange={setExpandPreset}
              onLayoutChange={setExpandLayout}
              onApply={() => void handleExpandApply()}
              onCancel={handleExpandCancel}
            />
          ) : null
        }
        removePanel={
          objectEditOpen ? (
            <StudioObjectEditPanel
              selection={objectEditState.selection}
              rejection={objectEditRejection}
              overlay={workbenchImageExpanded}
              canGenerate={
                objectEditState.operation === 'remove' &&
                objectEditState.selection.strokes.length > 0 &&
                !insufficientCredits &&
                Boolean(activeDishId && persistedSourceId && sourceImage)
              }
              busy={isGenerating}
              creditLabel={generateCreditLabel}
              onUndo={handleObjectEditUndo}
              onClear={handleObjectEditClear}
              onGenerate={() => void handleObjectEditGenerate()}
              onCancel={handleObjectEditClose}
              onClose={handleObjectEditClose}
              degradationCallout={degradationCallout}
            />
          ) : null
        }
        scene={
          <StudioScenePanel
            editorState={editorState}
            lightingOptions={lightingOptions}
            surfaceOptions={surfaceOptions}
            backdropOptions={backdropOptions}
            backdropHidden={backdropKnownFalse}
            controlsDisabled={controlsDisabled}
            isHydrated={isHydrated}
            isExtracting={isExtracting}
            isRefreshingExtract={isRefreshingExtract}
            refreshExtractError={refreshExtractError}
            pending={sectionHasPendingChanges}
            finishing={{
              disabled: controlsDisabled || isRefreshingExtract,
              loading: finishingLoading,
              error: finishingError,
              stackLoaded:
                finishingCacheKey !== null && finishingCacheKey === persistedSourceId,
              selectedIds: finishingSelectedIds,
              options: finishingStack,
              onRequestStack: () => void handleLoadFinishingTouches(),
              onToggle: handleToggleFinishingTouch,
            }}
            hasPendingChanges={hasPendingChanges}
            isGenerating={isGenerating}
            generateCreditLabel={generateCreditLabel}
            generateDisabled={
              !hasPendingChanges ||
              isGenerating ||
              controlsDisabled ||
              !activeDishId ||
              dishBlocked
            }
            onGenerate={() => {
              if (insufficientCredits) {
                setCreditsDialogOpen(true)
                return
              }
              void submitPendingChanges()
            }}
            onDiscard={handleDiscardPending}
            onQuickLook={stageQuickLook}
            onLighting={stageLighting}
            onSurface={stageSurface}
            onBackdrop={stageBackground}
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
            proEnabled={proEnabled}
            selectedModel={selectedModel}
            onTogglePro={() =>
              handleModelChange(
                selectedModel === STUDIO_PRO_MODEL ? STUDIO_NB2_MODEL : STUDIO_PRO_MODEL,
              )
            }
            reshootEnabled={reshootEnabled}
            onReshoot={() => {
              if (insufficientCredits) {
                setCreditsDialogOpen(true)
                return
              }
              setReshootDialogOpen(true)
            }}
            reshootDisabled={
              isGenerating ||
              controlsDisabled ||
              !activeDishId ||
              dishBlocked ||
              !sourceImage
            }
            degradationCallout={degradationCallout}
          />
        }
        exports={
          <StudioExportPanel
            sourceImageId={selectedImage?.id ?? null}
            sourceImageLabel={selectedShotLabel}
            dishName={activeDish?.name ?? null}
            editorBusy={busy}
            dishBlocked={dishBlocked}
            creditBalance={creditBalance}
            onCreditBalanceChange={setCreditBalance}
            onReadyCountChange={setExportReadyCount}
          />
        }
      />

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

      {reshootEnabled && (
        <StudioReshootDialog
          open={reshootDialogOpen}
          onClose={() => setReshootDialogOpen(false)}
          onConfirm={(input) => void handleReshoot(input)}
          baseSchema={editorState.schema}
          extractionDiagnostics={extractionDiagnosticsRef.current}
          lightingOptions={lightingOptions}
          backdropOptions={backdropOptions}
          surfaceOptions={surfaceOptions}
          creditLabel={generateCreditLabel}
          busy={isGenerating}
          backdropUnavailable={backdropKnownFalse}
          degradationCallout={degradationCallout}
        />
      )}

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
