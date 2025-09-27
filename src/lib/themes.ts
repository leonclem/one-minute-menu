import type { ColorPalette, FontConfiguration, LayoutConfiguration, MenuTheme, MenuItem } from '@/types'
import { contrastRatio, ensureTextContrast, isWcagAA } from './color'

const FONT_WHITELIST = {
  primary: 'Inter',
  secondary: 'Inter',
} satisfies Record<'primary' | 'secondary', string>

const SIZES: FontConfiguration['sizes'] = {
  heading: '1.5rem',
  body: '1rem',
  price: '1.125rem',
}

const LAYOUTS: Record<'modern' | 'classic' | 'minimal', LayoutConfiguration> = {
  modern: { style: 'modern', spacing: 'comfortable', itemLayout: 'list' },
  classic: { style: 'classic', spacing: 'comfortable', itemLayout: 'card' },
  minimal: { style: 'minimal', spacing: 'compact', itemLayout: 'list' },
}

export const MENU_TEMPLATES: Array<{ id: string; name: string; base: Pick<MenuTheme, 'id' | 'name' | 'fonts' | 'layout'> }> = [
  { id: 'modern', name: 'Modern', base: { id: 'modern', name: 'Modern', fonts: { primary: FONT_WHITELIST.primary, secondary: FONT_WHITELIST.secondary, sizes: SIZES }, layout: LAYOUTS.modern } },
  { id: 'classic', name: 'Classic', base: { id: 'classic', name: 'Classic', fonts: { primary: FONT_WHITELIST.primary, secondary: FONT_WHITELIST.secondary, sizes: SIZES }, layout: LAYOUTS.classic } },
  { id: 'minimal', name: 'Minimal', base: { id: 'minimal', name: 'Minimal', fonts: { primary: FONT_WHITELIST.primary, secondary: FONT_WHITELIST.secondary, sizes: SIZES }, layout: LAYOUTS.minimal } },
]

export function buildPaletteFromColors(colors: string[]): ColorPalette {
  const [c0 = '#3B82F6', c1 = '#6B7280', c2 = '#10B981', c3 = '#FFFFFF', c4 = '#111827'] = colors
  const background = c3
  const primary = c0
  const secondary = c1
  const accent = c2
  const text = ensureTextContrast(background, c4)
  return { primary, secondary, accent, background, text, extractionConfidence: 0.8 }
}

export function validateAccessibility(colors: ColorPalette): { wcagCompliant: boolean; contrast: Record<string, number> } {
  const ratios = {
    textOnBackground: contrastRatio(colors.text, colors.background),
    textOnPrimary: contrastRatio(colors.text, colors.primary),
    textOnSecondary: contrastRatio(colors.text, colors.secondary),
  }
  const compliant = isWcagAA(ratios.textOnBackground)
  return { wcagCompliant: compliant, contrast: ratios }
}

export function applyTheme(templateId: string, palette: ColorPalette): MenuTheme {
  const template = MENU_TEMPLATES.find(t => t.id === templateId) ?? MENU_TEMPLATES[0]
  const accessibility = validateAccessibility(palette)
  return {
    id: template.base.id,
    name: template.base.name,
    colors: palette,
    fonts: template.base.fonts,
    layout: template.base.layout,
    wcagCompliant: accessibility.wcagCompliant,
    mobileOptimized: true,
  }
}

export function generateThemePreview(theme: MenuTheme, sampleItems: MenuItem[] = []): string {
  // Small SVG preview that varies by template to convey style differences visually
  const w = 360, h = 200
  const bg = theme.colors.background
  const primary = theme.colors.primary
  const secondary = theme.colors.secondary
  const accent = theme.colors.accent

  let body = ''
  switch (theme.id) {
    case 'classic':
      body = `
        <rect x='0' y='0' width='100%' height='56' fill='${primary}'/>
        <rect x='0' y='70' width='100%' height='2' fill='${secondary}'/>
        <rect x='16' y='86' width='328' height='28' fill='${secondary}' rx='4'/>
        <rect x='16' y='122' width='260' height='22' fill='${accent}' rx='4'/>
        <rect x='0' y='158' width='100%' height='2' fill='${secondary}'/>
      `
      break
    case 'minimal':
      body = `
        <rect x='0' y='0' width='100%' height='28' fill='${primary}'/>
        <rect x='16' y='56' width='200' height='10' fill='${secondary}' rx='2'/>
        <rect x='16' y='74' width='160' height='10' fill='${secondary}' rx='2'/>
        <rect x='16' y='102' width='240' height='6' fill='${accent}' rx='3'/>
        <rect x='16' y='120' width='180' height='6' fill='${accent}' rx='3'/>
      `
      break
    default: // modern
      body = `
        <rect x='0' y='0' width='100%' height='40' fill='${primary}'/>
        <rect x='16' y='64' width='152' height='96' fill='${secondary}' rx='8'/>
        <rect x='192' y='64' width='152' height='96' fill='${accent}' rx='8'/>
      `
  }

  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
      <rect width='100%' height='100%' fill='${bg}'/>
      ${body}
    </svg>
  `
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function getAvailableThemes(): Array<{ id: string; name: string }> {
  return MENU_TEMPLATES.map(t => ({ id: t.id, name: t.name }))
}


