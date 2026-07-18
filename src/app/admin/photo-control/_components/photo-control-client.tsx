'use client'

/**
 * Photo_Control_Editor — Client-side orchestrator
 *
 * Orchestrates the full two-phase editing flow:
 *
 * Phase A (upload → extract → hydrate):
 *  1. User uploads an image; `validateAndAcceptImage` checks MIME/size.
 *  2. A second upload replaces the Source_Image and resets Editor_State. (Req 1.6)
 *  3. The accepted image is POSTed to `/api/admin/photo-control/extract`.
 *  4. On success, `hydrate()` initialises Editor_State and enables controls.
 *  5. If `strictConformance === false`, a non-blocking warning badge is shown
 *     while controls remain enabled. (Req 4.8)
 *  6. On extraction failure, the error is shown and the Source_Image is
 *     retained so the user can retry without re-uploading. (Req 14.6)
 *
 * Phase B (stage changes → submit → delta → directive → mutate → display):
 *  1. Control changes update the target Editor_State locally only (no prompt).
 *  2. Up to {@link MAX_PENDING_CHANGES} distinct attribute changes may be staged
 *     before the user submits; further changes are blocked with guidance.
 *  3. On submit, `computeDelta(originalState, targetState)` runs; empty deltas
 *     are skipped. (Req 5.4, 7.4, 8.6)
 *  4. `generateDirective(delta, context)` produces the instruction string.
 *  5. The client POSTs to `/api/admin/photo-control/mutate`.
 *  6. The mutated image becomes the new basis; session prompt count increments.
 *  7. The thought signature is accepted but not passed between mutations in v1.
 *
 * State held in memory/session only; never rendered as raw JSON. (Req 4.6)
 *
 * Requirements: 1.4, 1.6, 4.6, 4.8, 5.4, 7.4, 8.6, 12.3, 14.6, 16.3
 */

import { useCallback, useMemo, useRef, useState } from 'react'

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

import { Camera_Control, Lighting_Control, Component_Control } from '@/components/photo-controls'
import { Image_Viewer, type PhotoControlError } from './Image_Viewer'

// ── Types ─────────────────────────────────────────────────────────────────────

type ExtractResponse = MinimalValidationResult

interface MutateResponse {
  imageUrl: string
  thoughtSignature?: string
  model: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Read a File into a base64 data URL. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/** Extract the base64 payload and MIME type from a data URL. */
function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mimeType: match[1], base64: match[2] }
}

// ── Default editor state (used before hydration) ──────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export function PhotoControlClient() {
  // ── Source image ────────────────────────────────────────────────────────────
  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null)

  // ── Editor state ────────────────────────────────────────────────────────────
  // `editorState` is the live target state updated by controls.
  // `originalState` is the baseline used for delta computation; it is updated
  // to the mutated result after each successful mutation.
  const [editorState, setEditorState] = useState<EditorState>(makeDefaultEditorState())
  const originalStateRef = useRef<EditorState>(makeDefaultEditorState())

  // ── Hydration / extraction ──────────────────────────────────────────────────
  const [isHydrated, setIsHydrated] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const [strictConformanceWarning, setStrictConformanceWarning] = useState(false)

  // ── Mutation / staging ──────────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false)
  const [mutatedImageUrl, setMutatedImageUrl] = useState<string | undefined>(undefined)
  const [mutationError, setMutationError] = useState<PhotoControlError | null>(null)
  const [pendingLimitMessage, setPendingLimitMessage] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-image-preview')
  /** AI prompts consumed this browser session (extract + mutate). */
  const [sessionPromptCount, setSessionPromptCount] = useState(0)
  /** Bumps when the committed baseline updates so pending counts recompute. */
  const [baselineVersion, setBaselineVersion] = useState(0)

  const pendingDelta = useMemo(() => {
    void baselineVersion
    return computeDelta(originalStateRef.current, editorState)
  }, [editorState, baselineVersion])

  const pendingChangeCount = pendingDelta.isEmpty ? 0 : countEditableChanges(pendingDelta)
  const hasPendingChanges = pendingChangeCount > 0

  // ── Upload handler ──────────────────────────────────────────────────────────

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Reset the input so the same file can be re-selected after a failure
      e.target.value = ''

      // Read the file first so we can pass the data URL to the validator
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

      // A new upload resets all editor state (Req 1.6)
      const accepted = result.sourceImage
      setSourceImage(accepted)
      setIsHydrated(false)
      setEditorState(makeDefaultEditorState())
      originalStateRef.current = makeDefaultEditorState()
      setMutatedImageUrl(undefined)
      setMutationError(null)
      setExtractionError(null)
      setStrictConformanceWarning(false)
      setPendingLimitMessage(null)
      setSessionPromptCount(0)

      // Immediately kick off extraction
      await runExtraction(accepted)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // ── Extraction ──────────────────────────────────────────────────────────────

  const runExtraction = useCallback(async (image: SourceImage) => {
    setIsExtracting(true)
    setExtractionError(null)

    try {
      const response = await fetch('/api/admin/photo-control/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: image.dataUrl,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => null)
        const message =
          (err as { error?: string } | null)?.error ??
          `Extraction failed (HTTP ${response.status})`
        setExtractionError(message)
        return
      }

      const data = (await response.json()) as ExtractResponse

      // Hydrate controls from the validated/coerced data (Req 4.1)
      const { editorState: hydratedState } = hydrate({
        strictConformance: data.strictConformance,
        data: data.data,
        warnings: data.warnings,
      })

      setEditorState(hydratedState)
      originalStateRef.current = hydratedState
      setBaselineVersion((v) => v + 1)
      setIsHydrated(true)
      setSessionPromptCount((n) => n + 1)

      // Non-blocking warning badge when coercion occurred (Req 4.8)
      if (!data.strictConformance) {
        setStrictConformanceWarning(true)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extraction failed unexpectedly.'
      setExtractionError(message)
      // Source image is retained so the user can retry (Req 14.6)
    } finally {
      setIsExtracting(false)
    }
  }, [])

  // ── Retry extraction ────────────────────────────────────────────────────────

  const handleRetryExtraction = useCallback(() => {
    if (!sourceImage) return
    runExtraction(sourceImage)
  }, [sourceImage, runExtraction])

  // ── Stage control changes (no prompt until submit) ─────────────────────────

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
        `You can stage up to ${MAX_PENDING_CHANGES} changes before applying. Apply your current edits or undo some changes, then try again.`,
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

  // ── Submit staged changes → delta → directive → mutate ───────────────────

  const submitPendingChanges = useCallback(async () => {
    const original = originalStateRef.current
    const nextState = editorState
    const delta = computeDelta(original, nextState)

    if (delta.isEmpty) {
      return
    }

    const directive = generateDirective(delta, nextState)
    if (!directive) {
      return
    }

    if (!sourceImage) return

    setIsGenerating(true)
    setMutationError(null)
    setPendingLimitMessage(null)

    const currentSourceUrl = mutatedImageUrl ?? sourceImage.dataUrl

    try {
      const response = await fetch('/api/admin/photo-control/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceImageDataUrl: currentSourceUrl,
          originalState: original.schema,
          targetState: nextState.schema,
          directive,
          model: selectedModel,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => null)
        const errObj = err as {
          error?: string
          code?: string
          retryAfter?: number
          filterReason?: string
          suggestions?: string[]
        } | null
        setMutationError({
          error: errObj?.error ?? `Mutation failed (HTTP ${response.status})`,
          code: errObj?.code,
          retryAfter: errObj?.retryAfter,
          filterReason: errObj?.filterReason,
          suggestions: errObj?.suggestions,
        })
        return
      }

      const data = (await response.json()) as MutateResponse

      setMutatedImageUrl(data.imageUrl)
      originalStateRef.current = nextState
      setBaselineVersion((v) => v + 1)
      setSessionPromptCount((n) => n + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mutation failed unexpectedly.'
      setMutationError({ error: message })
    } finally {
      setIsGenerating(false)
    }
  }, [sourceImage, mutatedImageUrl, editorState, selectedModel])

  // ── Control change handlers (stage only) ─────────────────────────────────

  const handleAngleChange = useCallback(
    (angle: AngleValue) => {
      const next: EditorState = {
        ...editorState,
        schema: {
          ...editorState.schema,
          scene_setup: { ...editorState.schema.scene_setup, angle },
        },
      }
      applyStagedChange(next)
    },
    [editorState, applyStagedChange],
  )

  const handleLightingChange = useCallback(
    (lighting: LightingValue) => {
      const next: EditorState = {
        ...editorState,
        schema: {
          ...editorState.schema,
          scene_setup: { ...editorState.schema.scene_setup, lighting },
        },
      }
      applyStagedChange(next)
    },
    [editorState, applyStagedChange],
  )

  const handleGarnishesChange = useCallback(
    (garnishes: string[]) => {
      const next: EditorState = {
        ...editorState,
        schema: {
          ...editorState.schema,
          food_components: { ...editorState.schema.food_components, garnishes },
        },
      }
      applyStagedChange(next)
    },
    [editorState, applyStagedChange],
  )

  const handleSidesChange = useCallback(
    (sides: string[]) => {
      const next: EditorState = {
        ...editorState,
        schema: {
          ...editorState.schema,
          food_components: { ...editorState.schema.food_components, sides },
        },
      }
      applyStagedChange(next)
    },
    [editorState, applyStagedChange],
  )

  // ── Controls disabled state ──────────────────────────────────────────────

  const controlsDisabled = !isHydrated || isGenerating

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Photo Control</h1>
              <p className="text-sm text-gray-600 mt-0.5">AI Food Image Editor</p>
              {sessionPromptCount > 0 && (
                <p
                  className="mt-1 text-xs text-gray-500"
                  aria-live="polite"
                  data-testid="session-prompt-count"
                >
                  AI prompts this session: {sessionPromptCount}
                  <span className="text-gray-400">
                    {' '}
                    (package limits will apply when this ships to customers)
                  </span>
                </p>
              )}
            </div>
            <a
              href="/admin"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Back to Admin
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Apply changes panel (moved to top) */}
        {isHydrated && (
          <div
            className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-5 shadow-sm"
            data-testid="apply-changes-panel"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-blue-900">
                    Pending changes:
                  </p>
                  <span
                    className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                    data-testid="pending-change-count"
                  >
                    {pendingChangeCount} / {MAX_PENDING_CHANGES}
                  </span>
                </div>
                <p className="text-xs text-blue-700">
                  Fewer changes per apply usually produce better results—avoid stacking unrelated
                  edits.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {hasPendingChanges && !isGenerating && (
                  <button
                    type="button"
                    onClick={handleDiscardPending}
                    className="text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors"
                  >
                    Discard all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void submitPendingChanges()}
                  disabled={!hasPendingChanges || isGenerating || controlsDisabled}
                  className="rounded-md bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 transition-all min-w-[180px]"
                  data-testid="apply-changes-button"
                >
                  {isGenerating ? 'Applying changes…' : 'Apply changes to photo'}
                </button>
              </div>
            </div>

            {pendingLimitMessage && (
              <div className="mt-4">
                <p
                  role="alert"
                  className="text-xs text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
                  data-testid="pending-limit-message"
                >
                  {pendingLimitMessage}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
          {/* ── Left column: upload + controls ─────────────────────────── */}
          <div className="space-y-6">
            {/* Upload section */}
            <section className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-base font-semibold text-gray-900">Upload Photo</h2>

              <label
                htmlFor="photo-upload"
                className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <svg
                  className="mb-2 h-8 w-8 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700">
                  {sourceImage ? 'Replace photo' : 'Upload a food photo'}
                </span>
                <span className="mt-1 text-xs text-gray-500">PNG, JPEG, or WebP · max 7 MB</span>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={isExtracting || isGenerating}
                  aria-label="Upload food photo"
                />
              </label>

              {/* Extraction in-progress */}
              {isExtracting && (
                <div
                  role="status"
                  aria-label="Extracting image structure"
                  className="mt-3 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2"
                >
                  <svg
                    className="h-4 w-4 animate-spin text-blue-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="text-sm text-blue-800">Analysing photo structure…</span>
                </div>
              )}

              {/* Extraction error — retain image for retry (Req 14.6) */}
              {!isExtracting && extractionError && (
                <div
                  role="alert"
                  className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2"
                >
                  <p className="text-sm font-medium text-red-800">{extractionError}</p>
                  {sourceImage && (
                    <button
                      type="button"
                      onClick={handleRetryExtraction}
                      className="mt-2 text-xs font-medium text-red-700 underline hover:text-red-900"
                    >
                      Retry extraction
                    </button>
                  )}
                </div>
              )}

              {/* Non-blocking strict-conformance warning badge (Req 4.8) */}
              {isHydrated && strictConformanceWarning && (
                <div
                  role="status"
                  aria-label="Schema conformance warning"
                  className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
                >
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-amber-600"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs text-amber-800">
                    Some values were adjusted to match the allowed options. Controls are fully
                    enabled.
                  </span>
                </div>
              )}
            </section>

            {/* Controls section */}
            <section className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Edit Controls</h2>

              {/* Before hydration: placeholder message */}
              {!isHydrated && !isExtracting && (
                <p className="text-sm text-gray-500">
                  Upload a food photo to enable the editing controls.
                </p>
              )}

              {/* Controls — rendered once hydrated */}
              {(isHydrated || isExtracting) && (
                <div className="space-y-5">
                  <Camera_Control
                    value={editorState.schema.scene_setup.angle}
                    onChange={handleAngleChange}
                    disabled={controlsDisabled}
                  />

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

                  {/* Model Selector (Admin only) */}
                  <div className="border-t border-gray-100 pt-4">
                    <label htmlFor="model-selector" className="block text-sm font-medium text-gray-700 mb-2">
                      AI Generation Model
                    </label>
                    <select
                      id="model-selector"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={controlsDisabled}
                      className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    >
                      <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image (Nano Banana 2)</option>
                      <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image (Nano Banana Pro)</option>
                    </select>
                    <p className="mt-1.5 text-[11px] text-gray-500">
                      Note: Pro Preview is optimized for reasoning and may have different image generation characteristics.
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ── Right column: image viewer ──────────────────────────────── */}
          <div>
            <section className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Image Preview</h2>
              <Image_Viewer
                sourceImageUrl={sourceImage?.dataUrl}
                mutatedImageUrl={mutatedImageUrl}
                isGenerating={isGenerating}
                error={mutationError}
              />
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
