export type ReferenceMode = 'style_match' | 'composite'

export interface PromptHelperValues {
  dishName?: string
  cuisine?: string
  platingStyle?: string
  cameraAngle?: 'top_down' | 'three_quarter' | 'eye_level' | 'macro'
  lighting?: 'natural_soft' | 'studio_softbox' | 'moody_restaurant' | 'bright_daylight'
  background?: 'neutral' | 'restaurant_table' | 'dark_slate' | 'white_marble' | 'wood_table'
  mood?: string
  mustInclude?: string
  avoid?: string
}

function labelForCameraAngle(v: PromptHelperValues['cameraAngle']) {
  switch (v) {
    case 'top_down':
      return 'top-down (90°)'
    case 'three_quarter':
      return 'three-quarter (45°)'
    case 'eye_level':
      return 'eye-level'
    case 'macro':
      return 'macro close-up'
    default:
      return 'three-quarter (45°)'
  }
}

function labelForLighting(v: PromptHelperValues['lighting']) {
  switch (v) {
    case 'natural_soft':
      return 'soft natural window light'
    case 'studio_softbox':
      return 'soft studio softbox light'
    case 'moody_restaurant':
      return 'moody restaurant lighting'
    case 'bright_daylight':
      return 'bright daylight'
    default:
      return 'soft natural window light'
  }
}

function labelForBackground(v: PromptHelperValues['background']) {
  switch (v) {
    case 'neutral':
      return 'neutral, uncluttered background'
    case 'restaurant_table':
      return 'restaurant table setting'
    case 'dark_slate':
      return 'dark slate surface'
    case 'white_marble':
      return 'white marble surface'
    case 'wood_table':
      return 'warm wooden table'
    default:
      return 'restaurant table setting'
  }
}

function compactLines(lines: string[]) {
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * Build a reusable “instruction block” that can be appended to a user prompt.
 * This is intentionally plain text (prompt-engineering only), not a model parameter.
 */
export function buildPromptHelperText(mode: ReferenceMode, v: PromptHelperValues): string {
  const dish = v.dishName?.trim()
  const cuisine = v.cuisine?.trim()
  const plating = v.platingStyle?.trim()
  const mood = v.mood?.trim()
  const mustInclude = v.mustInclude?.trim()
  const avoid = v.avoid?.trim()
  const camera = labelForCameraAngle(v.cameraAngle)
  const lighting = labelForLighting(v.lighting)
  const background = labelForBackground(v.background)

  const header =
    mode === 'composite'
      ? 'Reference-image COMPOSITE instructions:'
      : 'Reference-image STYLE MATCH instructions:'

  const modeLines =
    mode === 'composite'
      ? [
          '- Use the reference image as the scene/context.',
          '- Place the generated plated dish naturally INTO the reference setting.',
          '- Match perspective, camera angle, shadows, and lighting direction to the reference.',
          '- Keep the table/plate context realistic and avoid warped geometry.',
        ]
      : [
          '- Use the reference image as the style reference (lighting, grading, lens, background).',
          '- Keep the output consistent with the reference aesthetic and photography style.',
          '- Do not copy logos/text; keep it clean and brand-safe.',
        ]

  const details: string[] = []
  if (dish) details.push(`Dish: ${dish}`)
  if (cuisine) details.push(`Cuisine: ${cuisine}`)
  if (plating) details.push(`Plating: ${plating}`)
  details.push(`Camera: ${camera}`)
  details.push(`Lighting: ${lighting}`)
  details.push(`Background: ${background}`)
  if (mood) details.push(`Mood: ${mood}`)
  if (mustInclude) details.push(`Must include: ${mustInclude}`)
  if (avoid) details.push(`Avoid: ${avoid}`)

  return compactLines([
    header,
    ...modeLines,
    '',
    'Constraints:',
    '- Photoreal food photography.',
    '- Crisp focus on the dish, natural textures, appetizing presentation.',
    '- No people, no hands, no text, no watermarks.',
    '',
    'Details:',
    ...details.map((d) => `- ${d}`),
  ])
}


