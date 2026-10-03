/**
 * Experimental vessel-swap tiles. Thumbnails in public/studio/vessels/ are also
 * the reference images sent with a Studio generation.
 */

import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import type { StudioVisualOption } from '@/lib/studio/control-options'

export interface StudioVesselOption {
  id: string
  label: string
  /** Noun phrase used in the edit prompt. */
  promptName: string
  filename: string
  assetBasename: string
  value: string
}

export const STUDIO_VESSEL_OPTIONS: readonly StudioVesselOption[] = [
  {
    id: 'blue-plate',
    label: 'Blue plate',
    promptName: 'speckled blue ceramic plate',
    filename: 'blue-plate.png',
    assetBasename: 'vessels/blue-plate',
    value: 'blue-plate',
  },
  {
    id: 'blue-rim-plate',
    label: 'Blue rim plate',
    promptName: 'white plate with a thin blue rim',
    filename: 'blue-rim-plate.png',
    assetBasename: 'vessels/blue-rim-plate',
    value: 'blue-rim-plate',
  },
  {
    id: 'beige-brown-rim-plate',
    label: 'Brown rim plate',
    promptName: 'beige plate with a brown rim',
    filename: 'beige-brown-rim-plate.png',
    assetBasename: 'vessels/beige-brown-rim-plate',
    value: 'beige-brown-rim-plate',
  },
  {
    id: 'egg-shell-with-lip-plate',
    label: 'Speckled plate',
    promptName: 'speckled eggshell plate with a raised lip',
    filename: 'egg-shell-with-lip-plate.png',
    assetBasename: 'vessels/egg-shell-with-lip-plate',
    value: 'egg-shell-with-lip-plate',
  },
  {
    id: 'square-white-plate',
    label: 'Square white plate',
    promptName: 'square white plate',
    filename: 'square-white-plate.png',
    assetBasename: 'vessels/square-white-plate',
    value: 'square-white-plate',
  },
  {
    id: 'pasta-bowl',
    label: 'Pasta bowl',
    promptName: 'wide white pasta bowl',
    filename: 'pasta-bowl.png',
    assetBasename: 'vessels/pasta-bowl',
    value: 'pasta-bowl',
  },
  {
    id: 'egg-shell-ceramic-bowl',
    label: 'Speckled bowl',
    promptName: 'speckled eggshell ceramic bowl',
    filename: 'egg-shell-ceramic-bowl.png',
    assetBasename: 'vessels/egg-shell-ceramic-bowl',
    value: 'egg-shell-ceramic-bowl',
  },
  {
    id: 'wooden-bowl',
    label: 'Wooden bowl',
    promptName: 'round wooden bowl',
    filename: 'wooden-bowl.png',
    assetBasename: 'vessels/wooden-bowl',
    value: 'wooden-bowl',
  },
  {
    id: 'wooden-board',
    label: 'Wooden board',
    promptName: 'light wooden serving board with a handle',
    filename: 'wooden-board.png',
    assetBasename: 'vessels/wooden-board',
    value: 'wooden-board',
  },
  {
    id: 'dark-chopping-board',
    label: 'Chopping board',
    promptName: 'square end-grain wooden chopping board',
    filename: 'dark-chopping-board.png',
    assetBasename: 'vessels/dark-chopping-board',
    value: 'dark-chopping-board',
  },
  {
    id: 'slate',
    label: 'Slate',
    promptName: 'dark rectangular slate platter',
    filename: 'slate.png',
    assetBasename: 'vessels/slate',
    value: 'slate',
  },
]

export const STUDIO_VESSEL_TILES: StudioVisualOption<string>[] = STUDIO_VESSEL_OPTIONS.map(
  (option) => ({
    id: option.id,
    label: option.label,
    assetBasename: option.assetBasename,
    value: option.value,
  }),
)

export function getStudioVessel(key: string): StudioVesselOption | null {
  const normalized = key.trim()
  if (!normalized) return null
  return STUDIO_VESSEL_OPTIONS.find((option) => option.value === normalized) ?? null
}

export function studioVesselPromptName(key: string): string | null {
  return getStudioVessel(key)?.promptName ?? null
}

export function vesselReferenceComment(promptName: string): string {
  return (
    `Replacement vessel only (${promptName}). ` +
    'Use its shape, material, and colour. Do not copy its background, lighting, or any food.'
  )
}

/** The selected replacement when the target vessel key differs from the original. */
export function stagedVesselSwap(
  original: MinimalSchema,
  target: MinimalSchema,
): StudioVesselOption | null {
  const from = original.canvas.vessel_style ?? ''
  const to = target.canvas.vessel_style ?? ''
  if (!to || from === to) return null
  return getStudioVessel(to)
}
