'use client'

/**
 * Image_Viewer — Displays the mutated image with progress, error, and actions
 *
 * - Displays the mutated image when the API returns one. (Req 12.1)
 * - Shows a progress indicator while a mutation is in progress and disables
 *   mutation-dispatching controls. (Req 12.2)
 * - Provides download and view-full-size actions for both the source image and
 *   any mutated image, via `/api/admin/download-image` and
 *   `/api/admin/image-url/create`. (Req 12.4)
 * - On a structured error, displays the message together with its suggestions,
 *   and shows suggestions only when the message can also be displayed. (Req 14.5)
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 14.5
 */

import { useState } from 'react'

// ── Error shape ───────────────────────────────────────────────────────────────

/**
 * A structured error from the mutation or extraction API, mirroring the
 * `NanoBananaError` shape.
 */
export interface PhotoControlError {
  /** Human-readable error message. */
  error: string
  /** Machine-readable error code (e.g. 'CONTENT_POLICY', 'RATE_LIMIT'). */
  code?: string
  /** Retry-after seconds for rate-limit errors. */
  retryAfter?: number
  /** The safety filter reason when the model blocked the request. */
  filterReason?: string
  /** User-facing suggestions for resolving the error. */
  suggestions?: string[]
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ImageViewerProps {
  /** The source image data URL (always available after upload). */
  sourceImageUrl?: string
  /** The most recently mutated image data URL, or undefined if none yet. */
  mutatedImageUrl?: string
  /** Whether a mutation request is currently in flight. */
  isGenerating: boolean
  /** A structured error from the last mutation attempt, or null if none. */
  error: PhotoControlError | null
}

// ── Image action helpers ──────────────────────────────────────────────────────

async function downloadImage(dataUrl: string, filename: string): Promise<void> {
  const response = await fetch('/api/admin/download-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData: dataUrl, filename }),
  })
  if (!response.ok) throw new Error('Download failed')
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

async function viewFullSize(dataUrl: string): Promise<void> {
  const response = await fetch('/api/admin/image-url/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData: dataUrl }),
  })
  if (!response.ok) throw new Error('Failed to create viewable URL')
  const data = await response.json()
  window.open(data.imageUrl, '_blank')
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ImageCardProps {
  label: string
  dataUrl: string
  filename: string
}

function ImageCard({ label, dataUrl, filename }: ImageCardProps) {
  const [actionError, setActionError] = useState<string | null>(null)

  const handleDownload = async () => {
    try {
      setActionError(null)
      await downloadImage(dataUrl, filename)
    } catch {
      setActionError('Failed to download image')
    }
  }

  const handleViewFullSize = async () => {
    try {
      setActionError(null)
      await viewFullSize(dataUrl)
    } catch {
      setActionError('Failed to open full-size view')
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-2 text-sm font-medium text-gray-700">{label}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={label}
        className="mb-3 max-h-64 w-full rounded-md object-contain"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          Download
        </button>
        <button
          type="button"
          onClick={handleViewFullSize}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          View Full Size
        </button>
      </div>
      {actionError && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {actionError}
        </p>
      )}
    </div>
  )
}

// ── Progress indicator ────────────────────────────────────────────────────────

function ProgressIndicator() {
  return (
    <div
      role="status"
      aria-label="Generating image"
      className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4"
    >
      <svg
        className="h-5 w-5 animate-spin text-blue-600"
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
      <span className="text-sm font-medium text-blue-800">Generating image…</span>
    </div>
  )
}

// ── Error display ─────────────────────────────────────────────────────────────

interface ErrorDisplayProps {
  error: PhotoControlError
}

/**
 * Renders the structured error message and, when the message is present,
 * also renders the suggestions list. Suggestions are only shown when the
 * message can also be displayed. (Requirement 14.5)
 */
function ErrorDisplay({ error }: ErrorDisplayProps) {
  const hasMessage = typeof error.error === 'string' && error.error.length > 0
  const hasSuggestions =
    hasMessage &&
    Array.isArray(error.suggestions) &&
    error.suggestions.length > 0

  if (!hasMessage) return null

  return (
    <div
      role="alert"
      aria-label="Mutation error"
      className="rounded-lg border border-red-200 bg-red-50 p-4"
    >
      <div className="flex items-start gap-2">
        <svg
          className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800">{error.error}</p>
          {error.code && (
            <p className="mt-0.5 text-xs text-red-600">Code: {error.code}</p>
          )}
          {error.filterReason && (
            <p className="mt-0.5 text-xs text-red-600">
              Filter reason: {error.filterReason}
            </p>
          )}
          {error.retryAfter !== undefined && (
            <p className="mt-0.5 text-xs text-red-600">
              Retry after: {error.retryAfter}s
            </p>
          )}
          {hasSuggestions && (
            <div className="mt-2">
              <p className="text-xs font-medium text-red-700">Suggestions:</p>
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                {error.suggestions!.map((suggestion, i) => (
                  <li key={i} className="text-xs text-red-700">
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function Image_Viewer({
  sourceImageUrl,
  mutatedImageUrl,
  isGenerating,
  error,
}: ImageViewerProps) {
  const hasSource = typeof sourceImageUrl === 'string' && sourceImageUrl.length > 0
  const hasMutated = typeof mutatedImageUrl === 'string' && mutatedImageUrl.length > 0

  return (
    <div className="space-y-4">
      {/* Progress indicator — shown while a mutation is in flight */}
      {isGenerating && <ProgressIndicator />}

      {/* Structured error display */}
      {!isGenerating && error && <ErrorDisplay error={error} />}

      {/* Image panels */}
      <div className="grid gap-4 sm:grid-cols-2">
        {hasSource && (
          <ImageCard
            label="Source Image"
            dataUrl={sourceImageUrl!}
            filename={`source-image-${Date.now()}.png`}
          />
        )}
        {hasMutated && (
          <ImageCard
            label="Mutated Image"
            dataUrl={mutatedImageUrl!}
            filename={`mutated-image-${Date.now()}.png`}
          />
        )}
      </div>

      {/* Empty state — no images yet */}
      {!hasSource && !hasMutated && !isGenerating && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">
            Upload a food photo to begin editing.
          </p>
        </div>
      )}
    </div>
  )
}
