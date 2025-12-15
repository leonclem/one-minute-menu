import type { PromptHelperValues, ReferenceMode } from './prompt-helper'

export interface PromptPreset {
  id: string
  name: string
  description: string
  mode: ReferenceMode
  values: PromptHelperValues
}

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: 'style-match-menu-hero',
    name: 'Style match: Menu hero shot',
    description: 'Clean, appetizing, consistent style for menu listings.',
    mode: 'style_match',
    values: {
      cameraAngle: 'three_quarter',
      lighting: 'natural_soft',
      background: 'neutral',
      platingStyle: 'clean, modern plating on a white plate',
      mood: 'premium, appetizing, sharp, minimal',
      avoid: 'clutter, extra props, messy sauce drips, overly stylized effects',
    },
  },
  {
    id: 'style-match-moody-restaurant',
    name: 'Style match: Moody restaurant',
    description: 'Warm, intimate lighting and premium restaurant feel.',
    mode: 'style_match',
    values: {
      cameraAngle: 'three_quarter',
      lighting: 'moody_restaurant',
      background: 'wood_table',
      platingStyle: 'fine dining plating with intentional negative space',
      mood: 'warm, intimate, premium',
      avoid: 'overexposure, harsh shadows, neon colors',
    },
  },
  {
    id: 'composite-on-table',
    name: 'Composite: Plate on restaurant table',
    description: 'Place the plated dish into the provided table scene.',
    mode: 'composite',
    values: {
      cameraAngle: 'three_quarter',
      lighting: 'natural_soft',
      background: 'restaurant_table',
      platingStyle: 'restaurant plating on the same type of plate as reference',
      mood: 'realistic, natural, consistent with the reference',
      avoid: 'warped plates, floating food, incorrect shadows, mismatched perspective',
    },
  },
  {
    id: 'composite-flatlay',
    name: 'Composite: Top-down flat lay',
    description: 'Overhead style with clean composition and consistent shadows.',
    mode: 'composite',
    values: {
      cameraAngle: 'top_down',
      lighting: 'studio_softbox',
      background: 'white_marble',
      platingStyle: 'clean plating with tidy garnish placement',
      mood: 'editorial, crisp, modern',
      avoid: 'tilted perspective, clutter, busy backgrounds',
    },
  },
]


