'use client'

import { useEffect, useMemo, useState } from 'react'
import type { StudioVisualOption } from '@/lib/studio/control-options'
import { resolveReshootStyleDefaults } from '@/lib/studio/style-defaults'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import type { ExtractionDiagnostics } from '@/lib/studio/extraction-diagnostics'
import { VisualOptionTiles } from './visual-option-tiles'

export interface ReshootStyleSelection {
  lighting: string
  backdrop: string
  surface: string
}

interface StudioReshootDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (input: { improvePlating: boolean; styles: ReshootStyleSelection }) => void
  baseSchema: MinimalSchema
  extractionDiagnostics: ExtractionDiagnostics | null
  lightingOptions: StudioVisualOption<string>[]
  backdropOptions: StudioVisualOption<string>[]
  surfaceOptions: StudioVisualOption<string>[]
  creditLabel: string
  busy?: boolean
  backdropUnavailable?: boolean
}

export function StudioReshootDialog({
  open,
  onClose,
  onConfirm,
  baseSchema,
  extractionDiagnostics,
  lightingOptions,
  backdropOptions,
  surfaceOptions,
  creditLabel,
  busy = false,
  backdropUnavailable = false,
}: StudioReshootDialogProps) {
  const defaults = useMemo(
    () => resolveReshootStyleDefaults(baseSchema, extractionDiagnostics),
    [baseSchema, extractionDiagnostics],
  )

  const [improvePlating, setImprovePlating] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [lighting, setLighting] = useState(defaults.lighting)
  const [backdrop, setBackdrop] = useState(defaults.backdrop)
  const [surface, setSurface] = useState(defaults.surface)

  useEffect(() => {
    if (!open) return
    setImprovePlating(false)
    setAdvancedOpen(false)
    setLighting(defaults.lighting)
    setBackdrop(defaults.backdrop)
    setSurface(defaults.surface)
  }, [open, defaults])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-reshoot-dialog-title"
        aria-describedby="studio-reshoot-dialog-description"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl"
      >
        <div className="border-b px-4 py-3">
          <h2 id="studio-reshoot-dialog-title" className="font-medium text-gray-900">
            Re-shoot this dish
          </h2>
        </div>

        <div className="space-y-4 px-4 py-4">
          <p id="studio-reshoot-dialog-description" className="text-sm leading-6 text-gray-700">
            Use when controlled edits cannot fix the photo — for example a bad crop, harsh lighting,
            or a missing studio backdrop.
            {backdropUnavailable
              ? ' This is also the only way to add a backdrop when none was detected in your upload.'
              : ''}
          </p>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={improvePlating}
              onChange={(event) => setImprovePlating(event.target.checked)}
              disabled={busy}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-ux-primary focus:ring-ux-primary"
            />
            <span>Improve plating</span>
          </label>

          <details
            open={advancedOpen}
            onToggle={(event) => setAdvancedOpen((event.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-sm font-medium text-gray-800">
              Advanced styles
            </summary>
            <div className="mt-3 space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Lighting
                </p>
                <VisualOptionTiles
                  options={lightingOptions}
                  value={lighting}
                  disabled={busy}
                  ariaLabel="Re-shoot lighting"
                  onChange={setLighting}
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Backdrop
                </p>
                <VisualOptionTiles
                  options={backdropOptions}
                  value={backdrop}
                  disabled={busy}
                  ariaLabel="Re-shoot backdrop"
                  onChange={setBackdrop}
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Surface
                </p>
                <VisualOptionTiles
                  options={surfaceOptions}
                  value={surface}
                  disabled={busy}
                  ariaLabel="Re-shoot surface"
                  onChange={setSurface}
                />
              </div>
            </div>
          </details>
        </div>

        <div className="flex justify-end gap-2 border-t bg-gray-50/50 px-4 py-3">
          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-ux-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300"
            disabled={busy}
            onClick={() =>
              onConfirm({
                improvePlating,
                styles: { lighting, backdrop, surface },
              })
            }
          >
            Re-shoot · {creditLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
