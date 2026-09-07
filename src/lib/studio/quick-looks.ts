import type { EditorState } from '@/lib/photo-control/minimal-schema'
import {
  ensureBackgroundRestageBaseline,
  ensureLightingRestageBaseline,
  ensureSurfaceRestageBaseline,
} from '@/lib/studio/restage'

export interface StudioQuickLook {
  id: string
  name: string
  lighting: string
  surface: string
  backdrop: string
  assetBasename: string
}

export const STUDIO_QUICK_LOOKS: readonly StudioQuickLook[] = [
  {
    id: 'bright-clean',
    name: 'Bright & Clean',
    lighting: 'bright-clean',
    surface: 'white-marble',
    backdrop: 'soft-neutral',
    assetBasename: 'lighting/lighting-bright-clean',
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    lighting: 'golden-hour',
    surface: 'natural-oak',
    backdrop: 'warm-sand',
    assetBasename: 'lighting/lighting-golden-hour',
  },
  {
    id: 'dark-moody',
    name: 'Dark & Moody',
    lighting: 'dark-moody',
    surface: 'dark-walnut',
    backdrop: 'charcoal',
    assetBasename: 'lighting/lighting-dark-moody',
  },
  {
    id: 'colour-pop',
    name: 'Colour Pop',
    lighting: 'bold-sunlight',
    surface: 'dark-stone',
    backdrop: 'mustard-yellow',
    assetBasename: 'lighting/lighting-bold-sunlight',
  },
]

export function applyQuickLook(input: {
  look: StudioQuickLook
  current: EditorState
  baseline: EditorState
  includeBackdrop: boolean
  lightingKeys?: readonly string[]
  surfaceKeys?: readonly string[]
  backdropKeys?: readonly string[]
}): { nextState: EditorState; nextBaseline: EditorState } {
  const { look, current, includeBackdrop } = input
  let nextBaseline = ensureLightingRestageBaseline(
    input.baseline,
    current,
    look.lighting,
    input.lightingKeys,
  )
  nextBaseline = ensureSurfaceRestageBaseline(
    nextBaseline,
    current,
    look.surface,
    input.surfaceKeys,
  )
  if (includeBackdrop) {
    nextBaseline = ensureBackgroundRestageBaseline(
      nextBaseline,
      current,
      look.backdrop,
      input.backdropKeys,
    )
  }

  return {
    nextBaseline,
    nextState: {
      ...current,
      schema: {
        ...current.schema,
        scene_setup: {
          ...current.schema.scene_setup,
          lighting: look.lighting,
        },
        canvas: {
          ...current.schema.canvas,
          surface_style: look.surface,
          ...(includeBackdrop ? { background_style: look.backdrop } : {}),
        },
      },
    },
  }
}
