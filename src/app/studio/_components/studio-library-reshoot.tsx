'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { CENTER, type EditorState } from '@/lib/photo-control/minimal-schema'
import {
  backdropStylesToOptions,
  lightingStylesToOptions,
  STUDIO_LIGHTING_OPTIONS,
  surfaceStylesToOptions,
} from '@/lib/studio/control-options'
import { readEditorStateFromMetadata } from '@/lib/studio/editor-state-storage'
import { isStudioReshootEnabled } from '@/lib/product-mode'
import type {
  StudioBackgroundStyleDisplay,
  StudioImageRecord,
  StudioLightingStyleDisplay,
} from '@/lib/studio/types'

import { StudioReshootDialog } from './studio-reshoot-dialog'

const NB2_MODEL = 'gemini-3.1-flash-image-preview'

function defaultEditorState(): EditorState {
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

interface StudioLibraryReshootProps {
  dishId: string
  sourceImage: StudioImageRecord | null
  disabled?: boolean
  onCreated: (image: StudioImageRecord) => void
}

export function StudioLibraryReshoot({
  dishId,
  sourceImage,
  disabled = false,
  onCreated,
}: StudioLibraryReshootProps) {
  const enabled = isStudioReshootEnabled()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creditLabel, setCreditLabel] = useState('1 credit')
  const [lighting, setLighting] = useState(STUDIO_LIGHTING_OPTIONS)
  const [surfaces, setSurfaces] = useState(surfaceStylesToOptions([]))
  const [backdrops, setBackdrops] = useState(backdropStylesToOptions([]))

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      try {
        const [stylesRes, creditsRes] = await Promise.all([
          fetch('/api/studio/styles'),
          fetch('/api/studio/credits'),
        ])
        if (cancelled) return
        if (stylesRes.ok) {
          const data = (await stylesRes.json()) as {
            lighting?: StudioLightingStyleDisplay[]
            background?: StudioBackgroundStyleDisplay[]
          }
          if (data.lighting?.length) setLighting(lightingStylesToOptions(data.lighting))
          const backgrounds = data.background ?? []
          setSurfaces(surfaceStylesToOptions(backgrounds.filter((item) => item.category === 'surface')))
          setBackdrops(backdropStylesToOptions(backgrounds.filter((item) => item.category === 'backdrop')))
        }
        if (creditsRes.ok) {
          const data = (await creditsRes.json()) as { costs?: { nb2?: number } }
          if (typeof data.costs?.nb2 === 'number') {
            setCreditLabel(`${data.costs.nb2} credit${data.costs.nb2 === 1 ? '' : 's'}`)
          }
        }
      } catch {
        // Keep lighting fallbacks.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  const baseSchema = useMemo(() => {
    if (!sourceImage) return defaultEditorState().schema
    return readEditorStateFromMetadata(sourceImage.metadata)?.schema ?? defaultEditorState().schema
  }, [sourceImage])

  const handleConfirm = useCallback(
    async (input: {
      improvePlating: boolean
      styles: { lighting: string; backdrop: string; surface: string }
    }) => {
      if (!sourceImage) return
      setBusy(true)
      setError(null)
      try {
        const res = await fetch('/api/studio/reshoot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dishId,
            sourceImageId: sourceImage.id,
            baseState: baseSchema,
            styles: input.styles,
            improvePlating: input.improvePlating,
            model: NB2_MODEL,
          }),
        })
        const data = (await res.json().catch(() => null)) as {
          error?: string
          imageId?: string
          imageUrl?: string
          model?: string
        } | null
        if (!res.ok || !data?.imageId || !data.imageUrl) {
          throw new Error(data?.error ?? 'Re-shoot failed')
        }
        setOpen(false)
        onCreated({
          ...sourceImage,
          id: data.imageId,
          role: 'generated',
          source_image_id: sourceImage.id,
          public_url: data.imageUrl,
          mime_type: 'image/png',
          metadata: { mode: 'reshoot', reshotFrom: sourceImage.id },
          created_at: new Date().toISOString(),
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Re-shoot failed')
      } finally {
        setBusy(false)
      }
    },
    [baseSchema, dishId, onCreated, sourceImage],
  )

  if (!enabled) return null

  return (
    <>
      <button
        type="button"
        className="studio-btn-ghost"
        disabled={disabled || !sourceImage || busy}
        onClick={() => setOpen(true)}
      >
        Re-shoot
      </button>
      {error ? (
        <p role="alert" className="max-w-[12rem] text-right text-xs text-[#ff8a80]">
          {error}
        </p>
      ) : null}
      <StudioReshootDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={(input) => void handleConfirm(input)}
        baseSchema={baseSchema}
        extractionDiagnostics={null}
        lightingOptions={lighting}
        backdropOptions={backdrops}
        surfaceOptions={surfaces}
        creditLabel={creditLabel}
        busy={busy}
      />
    </>
  )
}
