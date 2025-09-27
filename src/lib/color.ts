// Color utilities: palette extraction and accessibility helpers

export interface RGB {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): RGB {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map(c => c + c).join('')
    : normalized
  const num = parseInt(value, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function relativeLuminance(rgb: RGB): number {
  const srgb = [rgb.r, rgb.g, rgb.b]
    .map(v => v / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
}

export function contrastRatio(hex1: string, hex2: string): number {
  const L1 = relativeLuminance(hexToRgb(hex1))
  const L2 = relativeLuminance(hexToRgb(hex2))
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function isWcagAA(ratio: number): boolean {
  return ratio >= 4.5
}

export function ensureTextContrast(bg: string, preferredText: string = '#111827'): string {
  // Chooses the best among preferredText, black, or white
  const options = [preferredText, '#111827', '#000000', '#FFFFFF']
  let best = options[0]
  let bestRatio = 0
  for (const opt of options) {
    const ratio = contrastRatio(bg, opt)
    if (ratio > bestRatio) {
      bestRatio = ratio
      best = opt
    }
  }
  return best
}

// Lightweight color quantization on client-provided ImageData
export function pickDominantColorsFromImageData(imageData: ImageData, maxColors: number = 5): string[] {
  const { data, width, height } = imageData
  const buckets = new Map<string, { count: number; rgb: RGB }>()
  const step = Math.max(1, Math.floor(Math.min(width, height) / 256))

  // Helper: RGB -> HSV saturation (0..1)
  const rgbToSaturation = (r: number, g: number, b: number): number => {
    const rn = r / 255, gn = g / 255, bn = b / 255
    const max = Math.max(rn, gn, bn)
    const min = Math.min(rn, gn, bn)
    const delta = max - min
    if (max === 0) return 0
    return delta / max
  }

  const margin = 0.10 // ignore 10% outer margin
  const cx = width / 2
  const cy = height / 2
  const maxRadius = Math.hypot(cx, cy)

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      // Skip outer margin band to reduce background dominance
      if (x < width * margin || x > width * (1 - margin) || y < height * margin || y > height * (1 - margin)) {
        continue
      }

      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]

      // Skip near-white background pixels
      if (r > 245 && g > 245 && b > 245) continue

      // Compute saturation and luminance for heuristics
      const s = rgbToSaturation(r, g, b)
      const luma = relativeLuminance({ r, g, b }) // 0..1
      const isNearBlack = luma < 0.12
      const isNearWhite = luma > 0.88

      // De-emphasize low-saturation wood-like regions while preserving true black/white
      if (s < 0.25 && !isNearBlack && !isNearWhite) continue

      // Center weighting: pixels nearer center count more
      const dist = Math.hypot(x - cx, y - cy)
      const centerFactor = 1 + (1 - Math.min(1, dist / maxRadius)) // 1..2

      const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}` // slightly finer buckets
      const existing = buckets.get(key)
      if (existing) existing.count += centerFactor
      else buckets.set(key, { count: centerFactor, rgb: { r, g, b } })
    }
  }

  // If nothing made it through filters, fallback to simple sampling across the whole image
  if (buckets.size === 0) {
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4
        const r = data[idx], g = data[idx + 1], b = data[idx + 2]
        const key = `${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`
        const existing = buckets.get(key)
        if (existing) existing.count += 1
        else buckets.set(key, { count: 1, rgb: { r, g, b } })
      }
    }
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count)
  const selected = sorted.slice(0, maxColors).map(v => rgbToHex(v.rgb))
  while (selected.length < 3) selected.push('#6B7280')
  return selected
}


