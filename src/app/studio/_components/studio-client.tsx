'use client'

/**
 * Customer-facing Food Photo Studio client.
 *
 * Upload → extract → hydrate → stage lighting/garnish/sides → generate → gallery.
 */

import { useCallback, useMemo, useRef, useState } from 'react'

import { validateAndAcceptImage, type SourceImage } from '@/lib/photo-control/image-uploader'
import { hydrate } from '@/lib/photo-control/hydrator'
import { computeDelta, countEditableChanges } from '@/lib/photo-control/state-delta'
import { generateDirective } from '@/lib/photo-control/directive-generator'
import { MAX_PENDING_CHANGES } from '@/lib/photo-control/edit-limits'
import {
  CENTER,
  type EditorState,
  type LightingValue,
} from '@/lib/photo-control/minimal-schema'
import { type MinimalValidationResult } from '@/lib/photo-control/schema-validator'
import { Lighting_Control, Component_Control } from '@/components/photo-controls'
import type { StudioImageRecord } from '@/lib/studio/types'

type ExtractResponse = MinimalValidationResult

interface MutateResponse {
  imageUrl: string
  imageId: string
  model: string
}

interface StudioClientProps {
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
      canvas: { background: '', main_vessel: '' },
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

export function StudioClient({ initialGallery }: StudioClientProps) {
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
  const [gallery, setGallery] = useState<StudioImageRecord[]>(initialGallery)

  const pendingDelta = useMemo(() => {
    void baselineVersion
    return computeDelta(originalStateRef.current, editorState)
  }, [editorState, baselineVersion])

  const pendingChangeCount = pendingDelta.isEmpty ? 0 : countEditableChanges(pendingDelta)
  const hasPendingChanges = pendingChangeCount > 0
  const controlsDisabled = !isHydrated || isGenerating

  const runExtraction = useCallback(async (image: SourceImage) => {
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
        return
      }

      const data = (await response.json()) as ExtractResponse
      const { editorState: hydratedState } = hydrate({
        strictConformance: data.strictConformance,
        data: data.data,
        warnings: data.warnings,
      })

      setEditorState(hydratedState)
      originalStateRef.current = hydratedState
      setBaselineVersion((v) => v + 1)
      setIsHydrated(true)
      setStrictConformanceWarning(!data.strictConformance)
    } catch (err) {
      setExtractionError(err instanceof Error ? err.message : 'Extraction failed unexpectedly.')
    } finally {
      setIsExtracting(false)
    }
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''

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
      setIsHydrated(false)
      setEditorState(makeDefaultEditorState())
      originalStateRef.current = makeDefaultEditorState()
      setMutatedImageUrl(undefined)
      setMutationError(null)
      setExtractionError(null)
      setStrictConformanceWarning(false)
      setPendingLimitMessage(null)

      // Persist source in the background; do not block extraction.
      void fetch('/api/studio/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: accepted.dataUrl }),
      })
        .then(async (res) => {
          if (!res.ok) return
          const data = (await res.json()) as { imageId?: string; imageUrl?: string }
          if (data.imageId) {
            setPersistedSourceId(data.imageId)
            if (data.imageUrl) {
              setGallery((prev) => [
                {
                  id: data.imageId!,
                  user_id: '',
                  role: 'source',
                  source_image_id: null,
                  storage_path: '',
                  public_url: data.imageUrl!,
                  mime_type: accepted.mimeType,
                  width: null,
                  height: null,
                  prompt: null,
                  model: null,
                  metadata: {},
                  created_at: new Date().toISOString(),
                },
                ...prev,
              ])
            }
          }
        })
        .catch(() => undefined)

      await runExtraction(accepted)
    },
    [runExtraction],
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

  const handleDiscardPending = useCallback(() => {
    setEditorState(originalStateRef.current)
    setPendingLimitMessage(null)
  }, [])

  const submitPendingChanges = useCallback(async () => {
    const original = originalStateRef.current
    const nextState = editorState
    const delta = computeDelta(original, nextState)
    if (delta.isEmpty || !sourceImage) return

    const directive = generateDirective(delta, nextState)
    if (!directive) return

    setIsGenerating(true)
    setMutationError(null)
    setPendingLimitMessage(null)

    const currentSourceUrl = mutatedImageUrl ?? sourceImage.dataUrl

    try {
      const response = await fetch('/api/studio/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceImageDataUrl: currentSourceUrl,
          originalState: original.schema,
          targetState: nextState.schema,
          directive,
          sourceImageId: persistedSourceId,
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
      setGallery((prev) => [
        {
          id: data.imageId,
          user_id: '',
          role: 'generated',
          source_image_id: persistedSourceId,
          storage_path: '',
          public_url: data.imageUrl,
          mime_type: 'image/png',
          width: null,
          height: null,
          prompt: null,
          model: data.model,
          metadata: {},
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Generation failed unexpectedly.')
    } finally {
      setIsGenerating(false)
    }
  }, [sourceImage, mutatedImageUrl, editorState, persistedSourceId])

  const handleLightingChange = useCallback(
    (lighting: LightingValue) => {
      applyStagedChange({
        ...editorState,
        schema: {
          ...editorState.schema,
          scene_setup: { ...editorState.schema.scene_setup, lighting },
        },
      })
    },
    [editorState, applyStagedChange],
  )

  const handleGarnishesChange = useCallback(
    (garnishes: string[]) => {
      applyStagedChange({
        ...editorState,
        schema: {
          ...editorState.schema,
          food_components: { ...editorState.schema.food_components, garnishes },
        },
      })
    },
    [editorState, applyStagedChange],
  )

  const handleSidesChange = useCallback(
    (sides: string[]) => {
      applyStagedChange({
        ...editorState,
        schema: {
          ...editorState.schema,
          food_components: { ...editorState.schema.food_components, sides },
        },
      })
    },
    [editorState, applyStagedChange],
  )

  const generatedGallery = gallery.filter((item) => item.role === 'generated')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Food Photo Studio</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload a dish photo, stage a few edits, and generate a polished version — no prompts
          required.
        </p>
      </div>

      {isHydrated && (
        <div
          className="rounded-lg border border-ux-primary/25 bg-white/90 p-5 shadow-md backdrop-blur-sm"
          data-testid="generate-panel"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-blue-900">Pending changes:</p>
                <span
                  className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                  data-testid="pending-change-count"
                >
                  {pendingChangeCount} / {MAX_PENDING_CHANGES}
                </span>
              </div>
              <p className="text-xs text-blue-700">
                Fewer changes per generate usually produce better results.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasPendingChanges && !isGenerating && (
                <button
                  type="button"
                  onClick={handleDiscardPending}
                  className="text-sm font-medium text-blue-700 hover:text-blue-900"
                >
                  Discard all
                </button>
              )}
              <button
                type="button"
                onClick={() => void submitPendingChanges()}
                disabled={!hasPendingChanges || isGenerating || controlsDisabled}
                className="min-w-[160px] rounded-md bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                data-testid="generate-image-button"
              >
                {isGenerating ? 'Generating…' : 'Generate image'}
              </button>
            </div>
          </div>
          {pendingLimitMessage && (
            <p role="alert" className="mt-4 text-xs text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              {pendingLimitMessage}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
        <div className="space-y-6">
          <section className="rounded-lg border border-black/[0.08] bg-white/90 p-5 shadow-md backdrop-blur-sm">
            <h2 className="mb-3 text-base font-semibold text-gray-900">Upload Photo</h2>
            <label
              htmlFor="studio-photo-upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center hover:border-blue-400 hover:bg-blue-50"
            >
              <span className="text-sm font-medium text-gray-700">
                {sourceImage ? 'Replace photo' : 'Upload a food photo'}
              </span>
              <span className="mt-1 text-xs text-gray-500">PNG, JPEG, or WebP · max 7 MB</span>
              <input
                id="studio-photo-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleFileChange}
                disabled={isExtracting || isGenerating}
                aria-label="Upload food photo"
              />
            </label>

            {isExtracting && (
              <p role="status" className="mt-3 text-sm text-blue-800">
                Analysing photo structure…
              </p>
            )}
            {!isExtracting && extractionError && (
              <p role="alert" className="mt-3 text-sm text-red-800">
                {extractionError}
              </p>
            )}
            {isHydrated && strictConformanceWarning && (
              <p role="status" className="mt-3 text-xs text-amber-800">
                Some values were adjusted to match allowed options. Controls are enabled.
              </p>
            )}
          </section>

          <section className="rounded-lg border border-black/[0.08] bg-white/90 p-5 shadow-md backdrop-blur-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Edit Controls</h2>
            {!isHydrated && !isExtracting && (
              <p className="text-sm text-gray-500">
                Upload a food photo to enable the editing controls.
              </p>
            )}
            {(isHydrated || isExtracting) && (
              <div className="space-y-5">
                <Lighting_Control
                  value={editorState.schema.scene_setup.lighting}
                  onChange={handleLightingChange}
                  disabled={controlsDisabled}
                />
                <Component_Control
                  garnishes={editorState.schema.food_components.garnishes}
                  sides={editorState.schema.food_components.sides}
                  onGarnishesChange={handleGarnishesChange}
                  onSidesChange={handleSidesChange}
                  disabled={controlsDisabled}
                />
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-black/[0.08] bg-white/90 p-5 shadow-md backdrop-blur-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Preview</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Source
                </p>
                {sourceImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sourceImage.dataUrl}
                    alt="Source food photo"
                    className="w-full rounded-md border border-gray-200 object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-400">
                    No photo yet
                  </div>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Generated
                </p>
                {isGenerating ? (
                  <div className="flex h-48 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-sm text-blue-700">
                    Generating…
                  </div>
                ) : mutatedImageUrl ? (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mutatedImageUrl}
                      alt="Generated food photo"
                      className="w-full rounded-md border border-gray-200 object-cover"
                    />
                    <button
                      type="button"
                      className="text-sm font-medium text-blue-700 hover:text-blue-900"
                      onClick={() =>
                        void downloadImage(mutatedImageUrl, `studio-${Date.now()}.png`).catch(
                          () => setMutationError('Download failed.'),
                        )
                      }
                    >
                      Download
                    </button>
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-400">
                    Generate to see output
                  </div>
                )}
              </div>
            </div>
            {mutationError && (
              <p role="alert" className="mt-3 text-sm text-red-800">
                {mutationError}
              </p>
            )}
          </section>

          <section className="rounded-lg border border-black/[0.08] bg-white/90 p-5 shadow-md backdrop-blur-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Recent generations</h2>
            {generatedGallery.length === 0 ? (
              <p className="text-sm text-gray-500">Generated images will appear here.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="studio-gallery">
                {generatedGallery.slice(0, 12).map((item) => (
                  <li key={item.id} className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.public_url}
                      alt="Generated studio image"
                      className="aspect-square w-full rounded-md border border-gray-200 object-cover"
                    />
                    <button
                      type="button"
                      className="text-xs font-medium text-blue-700 hover:text-blue-900"
                      onClick={() =>
                        void downloadImage(item.public_url, `studio-${item.id}.png`).catch(
                          () => setMutationError('Download failed.'),
                        )
                      }
                    >
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
