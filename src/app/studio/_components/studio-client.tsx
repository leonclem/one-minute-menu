'use client'

/**
 * Customer-facing Food Photo Studio — control panel + preview/variants shell.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { validateAndAcceptImage, type SourceImage } from '@/lib/photo-control/image-uploader'
import { hydrate } from '@/lib/photo-control/hydrator'
import { computeDelta, countEditableChanges } from '@/lib/photo-control/state-delta'
import { generateDirective } from '@/lib/photo-control/directive-generator'
import { MAX_PENDING_CHANGES } from '@/lib/photo-control/edit-limits'
import {
  CENTER,
  type AngleValue,
  type EditorState,
  type LightingValue,
} from '@/lib/photo-control/minimal-schema'
import { type MinimalValidationResult } from '@/lib/photo-control/schema-validator'
import { Component_Control } from '@/components/photo-controls'
import { CollapsibleSection } from '@/components/ux'
import { ConfirmDialog } from '@/components/ui'
import { buildChangeSummary, readChangeSummary } from '@/lib/studio/change-summary'
import {
  STUDIO_LIGHTING_OPTIONS,
  STUDIO_ROTATION_OPTIONS,
} from '@/lib/studio/control-options'
import {
  editorStateToMetadata,
  readEditorStateFromMetadata,
} from '@/lib/studio/editor-state-storage'
import {
  ensureAngleRestageBaseline,
  ensureLightingRestageBaseline,
} from '@/lib/studio/restage'
import type {
  StudioDishListItem,
  StudioDishRecord,
  StudioImageRecord,
} from '@/lib/studio/types'
import { StudioDishPickerModal } from './studio-dish-picker-modal'
import { StudioTextModal } from './studio-text-modal'
import { VisualOptionTiles } from './visual-option-tiles'

type ExtractResponse = MinimalValidationResult
type ControlSection = 'rotation' | 'lighting' | 'garnishes' | null

interface MutateResponse {
  imageUrl: string
  imageId: string
  model: string
  dishId?: string
}

interface StudioClientProps {
  initialDishes: StudioDishRecord[]
  initialActiveDishId: string
  initialGallery: StudioImageRecord[]
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function makeDefaultEditorState(): EditorState {
  return {
    schema: {
      scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'bright-and-airy' },
      canvas: { background: '', background_style: '', main_vessel: '' },
      food_components: { main_item: '', garnishes: [], sides: [] },
    },
    position: { ...CENTER },
  }
}

async function downloadImage(url: string, filename: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Download failed')
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

async function fetchAsSourceImage(url: string, fallbackMime: string): Promise<SourceImage> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to load image')
  const blob = await response.blob()
  const mimeType =
    blob.type === 'image/jpeg' || blob.type === 'image/webp' || blob.type === 'image/png'
      ? blob.type
      : fallbackMime === 'image/jpeg' || fallbackMime === 'image/webp'
        ? fallbackMime
        : 'image/png'
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(blob)
  })
  return { dataUrl, mimeType, bytes: blob.size }
}

async function ensureDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url
  const source = await fetchAsSourceImage(url, 'image/png')
  return source.dataUrl
}

function sortVariants(images: StudioImageRecord[]): StudioImageRecord[] {
  return [...images].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

function resolveCurrentImage(
  dish: StudioDishRecord | undefined,
  images: StudioImageRecord[],
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
  initialDishes,
  initialActiveDishId,
  initialGallery,
}: StudioClientProps) {
  const [dishes, setDishes] = useState<StudioDishRecord[]>(initialDishes)
  const [activeDishId, setActiveDishId] = useState(initialActiveDishId)
  const [gallery, setGallery] = useState<StudioImageRecord[]>(initialGallery)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(() => {
    const dish = initialDishes.find((d) => d.id === initialActiveDishId)
    return resolveCurrentImage(dish, initialGallery)?.id ?? null
  })
  const didActivateInitialRef = useRef(false)
  const [expandedSection, setExpandedSection] = useState<ControlSection>('lighting')
  const [libraryBusy, setLibraryBusy] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteDishOpen, setDeleteDishOpen] = useState(false)
  const [deleteImageOpen, setDeleteImageOpen] = useState(false)
  const [dishPickerOpen, setDishPickerOpen] = useState(false)
  const [dishPickerItems, setDishPickerItems] = useState<StudioDishListItem[]>([])
  const [dishPickerLoading, setDishPickerLoading] = useState(false)

  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null)
  const [persistedSourceId, setPersistedSourceId] = useState<string | null>(null)
  const [editorState, setEditorState] = useState<EditorState>(makeDefaultEditorState())
  const originalStateRef = useRef<EditorState>(makeDefaultEditorState())

  const [isHydrated, setIsHydrated] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const [strictConformanceWarning, setStrictConformanceWarning] = useState(false)

  const [isGenerating, setIsGenerating] = useState(false)
  const [mutatedImageUrl, setMutatedImageUrl] = useState<string | undefined>(undefined)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [pendingLimitMessage, setPendingLimitMessage] = useState<string | null>(null)
  const [baselineVersion, setBaselineVersion] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeDish = dishes.find((d) => d.id === activeDishId) ?? dishes[0]
  const variants = useMemo(() => sortVariants(gallery), [gallery])
  const selectedImage = variants.find((v) => v.id === selectedImageId) ?? null
  const currentPreviewUrl =
    mutatedImageUrl ?? sourceImage?.dataUrl ?? selectedImage?.public_url ?? null
  const changeChips = selectedImage ? readChangeSummary(selectedImage.metadata) : []

  const pendingDelta = useMemo(() => {
    void baselineVersion
    return computeDelta(originalStateRef.current, editorState)
  }, [editorState, baselineVersion])

  const pendingChangeCount = pendingDelta.isEmpty ? 0 : countEditableChanges(pendingDelta)
  const hasPendingChanges = pendingChangeCount > 0
  const controlsDisabled = !isHydrated || isGenerating
  const busy = libraryBusy || isExtracting || isGenerating

  const resetEditorForNewSource = useCallback(() => {
    setIsHydrated(false)
    setEditorState(makeDefaultEditorState())
    originalStateRef.current = makeDefaultEditorState()
    setMutatedImageUrl(undefined)
    setMutationError(null)
    setExtractionError(null)
    setStrictConformanceWarning(false)
    setPendingLimitMessage(null)
  }, [])

  const persistDishCurrent = useCallback(
    async (dishId: string, imageId: string | null) => {
      const res = await fetch(`/api/studio/dishes/${dishId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentImageId: imageId }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { dish: StudioDishRecord }
      setDishes((prev) => prev.map((d) => (d.id === dishId ? data.dish : d)))
    },
    [],
  )

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
    setPendingLimitMessage(null)
    setMutationError(null)
    setExtractionError(null)
  }, [])

  const runExtraction = useCallback(async (image: SourceImage): Promise<EditorState | null> => {
    setIsExtracting(true)
    setExtractionError(null)

    try {
      const response = await fetch('/api/studio/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: image.dataUrl }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => null)
        setExtractionError(
          (err as { error?: string } | null)?.error ??
            `Extraction failed (HTTP ${response.status})`,
        )
        return null
      }

      const data = (await response.json()) as ExtractResponse
      const { editorState: hydratedState } = hydrate({
        strictConformance: data.strictConformance,
        data: data.data,
        warnings: data.warnings,
      })

      applyHydratedState(hydratedState, !data.strictConformance)
      return hydratedState
    } catch (err) {
      setExtractionError(err instanceof Error ? err.message : 'Extraction failed unexpectedly.')
      return null
    } finally {
      setIsExtracting(false)
    }
  }, [applyHydratedState])

  const activateImage = useCallback(
    async (
      image: StudioImageRecord,
      options?: { persistCurrent?: boolean },
    ) => {
      setSelectedImageId(image.id)
      setLibraryBusy(true)
      setLibraryError(null)
      setMutatedImageUrl(undefined)
      try {
        const working = await fetchAsSourceImage(image.public_url, image.mime_type)
        setSourceImage(working)
        setPersistedSourceId(image.id)

        const stored = readEditorStateFromMetadata(image.metadata)
        if (stored) {
          applyHydratedState(stored)
        } else {
          setIsHydrated(false)
          const extracted = await runExtraction(working)
          if (extracted) {
            await persistEditorState(image.id, extracted)
          }
        }

        if (options?.persistCurrent !== false && image.dish_id) {
          await persistDishCurrent(image.dish_id, image.id)
        }
      } catch (err) {
        setLibraryError(err instanceof Error ? err.message : 'Failed to load image')
      } finally {
        setLibraryBusy(false)
      }
    },
    [applyHydratedState, persistDishCurrent, persistEditorState, runExtraction],
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
    [activateImage, dishes, resetEditorForNewSource],
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

      if (!activeDishId) {
        setExtractionError('Create a dish before uploading.')
        return
      }

      let dataUrl: string
      try {
        dataUrl = await readFileAsDataUrl(file)
      } catch {
        setExtractionError('Failed to read the selected file.')
        return
      }

      const result = validateAndAcceptImage(file, dataUrl)
      if (!result.ok) {
        setExtractionError(result.error)
        return
      }

      const accepted = result.sourceImage
      setSourceImage(accepted)
      setPersistedSourceId(null)
      resetEditorForNewSource()

      const extracted = await runExtraction(accepted)

      void fetch('/api/studio/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: accepted.dataUrl, dishId: activeDishId }),
      })
        .then(async (res) => {
          if (!res.ok) return
          const data = (await res.json()) as { imageId?: string; imageUrl?: string }
          if (data.imageId && data.imageUrl) {
            setPersistedSourceId(data.imageId)
            const metadata =
              extracted != null
                ? { editorState: editorStateToMetadata(extracted) }
                : {}
            const row: StudioImageRecord = {
              id: data.imageId,
              user_id: '',
              dish_id: activeDishId,
              role: 'source',
              source_image_id: null,
              storage_path: '',
              public_url: data.imageUrl,
              mime_type: accepted.mimeType,
              width: null,
              height: null,
              prompt: null,
              model: null,
              metadata,
              is_favourite: false,
              archived_at: null,
              created_at: new Date().toISOString(),
            }
            setGallery((prev) => [...prev, row])
            setSelectedImageId(data.imageId)
            if (extracted) {
              await persistEditorState(data.imageId, extracted)
            }
            await persistDishCurrent(activeDishId, data.imageId)
          }
        })
        .catch(() => undefined)
    },
    [
      activeDishId,
      persistDishCurrent,
      persistEditorState,
      resetEditorForNewSource,
      runExtraction,
    ],
  )

  const applyStagedChange = useCallback((nextState: EditorState) => {
    const delta = computeDelta(originalStateRef.current, nextState)
    if (delta.isEmpty) {
      setEditorState(nextState)
      setPendingLimitMessage(null)
      return
    }

    const nextCount = countEditableChanges(delta)
    if (nextCount > MAX_PENDING_CHANGES) {
      setPendingLimitMessage(
        `You can stage up to ${MAX_PENDING_CHANGES} changes before generating. Discard some changes, then try again.`,
      )
      return
    }

    setEditorState(nextState)
    setPendingLimitMessage(null)
  }, [])

  const stageAngle = useCallback(
    (angle: AngleValue) => {
      originalStateRef.current = ensureAngleRestageBaseline(
        originalStateRef.current,
        editorState,
        angle,
      )
      setBaselineVersion((v) => v + 1)
      applyStagedChange({
        ...editorState,
        schema: {
          ...editorState.schema,
          scene_setup: { ...editorState.schema.scene_setup, angle },
        },
      })
    },
    [applyStagedChange, editorState],
  )

  const stageLighting = useCallback(
    (lighting: LightingValue) => {
      originalStateRef.current = ensureLightingRestageBaseline(
        originalStateRef.current,
        editorState,
        lighting,
      )
      setBaselineVersion((v) => v + 1)
      applyStagedChange({
        ...editorState,
        schema: {
          ...editorState.schema,
          scene_setup: { ...editorState.schema.scene_setup, lighting },
        },
      })
    },
    [applyStagedChange, editorState],
  )

  const handleDiscardPending = useCallback(() => {
    setEditorState(originalStateRef.current)
    setPendingLimitMessage(null)
  }, [])

  const submitPendingChanges = useCallback(async () => {
    const original = originalStateRef.current
    const nextState = editorState
    const delta = computeDelta(original, nextState)
    if (delta.isEmpty || !sourceImage || !activeDishId) return

    const directive = generateDirective(delta, nextState)
    if (!directive) return

    const changeSummary = buildChangeSummary(delta)

    setIsGenerating(true)
    setMutationError(null)
    setPendingLimitMessage(null)

    try {
      const currentSourceUrl = await ensureDataUrl(mutatedImageUrl ?? sourceImage.dataUrl)

      const response = await fetch('/api/studio/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dishId: activeDishId,
          sourceImageDataUrl: currentSourceUrl,
          originalState: original.schema,
          targetState: nextState.schema,
          directive,
          sourceImageId: persistedSourceId,
          changeSummary,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => null)
        setMutationError(
          (err as { error?: string } | null)?.error ??
            `Generation failed (HTTP ${response.status})`,
        )
        return
      }

      const data = (await response.json()) as MutateResponse
      setMutatedImageUrl(data.imageUrl)
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
          d.id === activeDishId ? { ...d, current_image_id: data.imageId } : d,
        ),
      )
      const working = await fetchAsSourceImage(data.imageUrl, 'image/png')
      setSourceImage(working)
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Generation failed unexpectedly.')
    } finally {
      setIsGenerating(false)
    }
  }, [sourceImage, mutatedImageUrl, editorState, persistedSourceId, activeDishId])

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
    [resetEditorForNewSource],
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
    [activeDish],
  )

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
    if (!selectedImage) return
    setDeleteImageOpen(false)
    setLibraryBusy(true)
    setLibraryError(null)
    try {
      const res = await fetch(`/api/studio/images/${selectedImage.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error((err as { error?: string } | null)?.error ?? 'Failed to delete')
      }
      const next = gallery.filter((item) => item.id !== selectedImage.id)
      setGallery(next)
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
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setLibraryBusy(false)
    }
  }, [
    selectedImage,
    gallery,
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
          dishes.find((d) => d.id === dishId) ??
            dishPickerItems.find((d) => d.id === dishId),
        )
      } catch (err) {
        setLibraryError(err instanceof Error ? err.message : 'Failed to switch dish')
      } finally {
        setLibraryBusy(false)
      }
    },
    [activeDishId, dishPickerItems, dishes, loadGalleryForDish],
  )

  return (
    <div className="space-y-6">
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

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            onClick={() => void openDishPicker()}
            data-testid="studio-dishes-button"
          >
            Dishes
          </button>
          <button
            type="button"
            disabled={busy || !activeDishId}
            className="rounded-md bg-ux-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Photo
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-amber-300 disabled:opacity-50"
            onClick={() => setCreateOpen(true)}
          >
            New
          </button>
          {activeDish && dishes.length > 1 && (
            <button
              type="button"
              disabled={busy}
              className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              onClick={() => setDeleteDishOpen(true)}
            >
              Delete dish
            </button>
          )}
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

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
        {/* Control panel */}
        <section className="flex max-h-[70vh] flex-col overflow-hidden rounded-lg border border-black/[0.08] bg-white/95 shadow-md">
          <div className="border-b bg-neutral-100 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">
              Control panel
            </h2>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-3">
            {!isHydrated && !isExtracting ? (
              <p className="px-1 py-4 text-sm text-gray-500">
                Upload a photo (or select a variant) to enable controls.
              </p>
            ) : (
              <>
                <CollapsibleSection
                  title="Rotation"
                  isExpanded={expandedSection === 'rotation'}
                  onExpand={(open) => setExpandedSection(open ? 'rotation' : null)}
                >
                  <VisualOptionTiles
                    options={STUDIO_ROTATION_OPTIONS}
                    value={editorState.schema.scene_setup.angle}
                    disabled={controlsDisabled}
                    ariaLabel="Rotation"
                    onChange={stageAngle}
                  />
                </CollapsibleSection>

                <CollapsibleSection
                  title="Lighting"
                  isExpanded={expandedSection === 'lighting'}
                  onExpand={(open) => setExpandedSection(open ? 'lighting' : null)}
                >
                  <VisualOptionTiles
                    options={STUDIO_LIGHTING_OPTIONS}
                    value={editorState.schema.scene_setup.lighting}
                    disabled={controlsDisabled}
                    ariaLabel="Lighting"
                    onChange={stageLighting}
                  />
                </CollapsibleSection>

                <CollapsibleSection
                  title="Garnishes"
                  isExpanded={expandedSection === 'garnishes'}
                  onExpand={(open) => setExpandedSection(open ? 'garnishes' : null)}
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

          <div className="space-y-2 border-t bg-white p-3">
            {isHydrated && (
              <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
                <span>
                  Pending: {pendingChangeCount} / {MAX_PENDING_CHANGES}
                </span>
                {hasPendingChanges && !isGenerating && (
                  <button
                    type="button"
                    className="font-medium text-ux-primary hover:underline"
                    onClick={handleDiscardPending}
                  >
                    Discard
                  </button>
                )}
              </div>
            )}
            {pendingLimitMessage && (
              <p role="alert" className="text-xs text-amber-800">
                {pendingLimitMessage}
              </p>
            )}
            <button
              type="button"
              data-testid="generate-image-button"
              disabled={!hasPendingChanges || isGenerating || controlsDisabled || !activeDishId}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-ux-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              onClick={() => void submitPendingChanges()}
            >
              {isGenerating ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </section>

        {/* Preview + variants */}
        <section className="flex flex-col overflow-hidden rounded-lg border border-black/[0.08] bg-white/95 shadow-md">
          <div className="border-b bg-neutral-100 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">
              Preview
            </h2>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Current
              </p>
              {isGenerating ? (
                <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-ux-primary/30 bg-ux-primary/5 text-sm text-ux-primary">
                  Generating…
                </div>
              ) : currentPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentPreviewUrl}
                  alt="Current studio image"
                  className="max-h-[420px] w-full rounded-md border border-gray-200 object-contain"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-400">
                  Upload a photo to begin
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

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!currentPreviewUrl || busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-ux-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  if (!currentPreviewUrl) return
                  void downloadImage(
                    currentPreviewUrl,
                    `studio-${selectedImageId ?? Date.now()}.png`,
                  ).catch(() => setLibraryError('Download failed.'))
                }}
              >
                Download
              </button>
              <button
                type="button"
                disabled={!selectedImage || busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-rose-400 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setDeleteImageOpen(true)}
              >
                Delete
              </button>
            </div>

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
                <ul
                  className="flex gap-2 overflow-x-auto pb-1"
                  data-testid="studio-gallery"
                >
                  {variants.map((item) => {
                    const isOg = item.role === 'source'
                    const selected = item.id === selectedImageId
                    const genIndex = variants
                      .filter((v) => v.role === 'generated')
                      .findIndex((v) => v.id === item.id)
                    return (
                      <li key={item.id} className="shrink-0">
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
                          onClick={() => void activateImage(item)}
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
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>

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
      <ConfirmDialog
        open={deleteDishOpen}
        title="Delete dish?"
        description="Archive or delete all images in this dish first if any remain. This cannot be undone."
        confirmText="Delete dish"
        variant="danger"
        onCancel={() => setDeleteDishOpen(false)}
        onConfirm={() => void handleDeleteDish()}
      />
      <ConfirmDialog
        open={deleteImageOpen}
        title="Delete this image?"
        description="Permanently delete the current image from your library and storage."
        confirmText="Delete"
        variant="danger"
        onCancel={() => setDeleteImageOpen(false)}
        onConfirm={() => void handleDeleteImage()}
      />
    </div>
  )
}
