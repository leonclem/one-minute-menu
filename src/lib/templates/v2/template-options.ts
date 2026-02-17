/**
 * Shared V2 template options for template page and Layout Lab.
 * Single source of truth for display names, descriptions, and order.
 */

export interface TemplateOption {
  id: string
  name: string
  description: string
}

/** Main V2 templates shown on template page and first in Layout Lab. Order: 4 col portrait, 3 col portrait, 2 col portrait, 1 col tall, 4 col landscape. */
export const V2_TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: 'classic-cards-v2', name: '4 column (portrait)', description: 'Photo-forward 4-column grid' },
  { id: 'three-column-modern-v2', name: '3 column (portrait)', description: 'A4 Portrait · 3-column balanced grid' },
  { id: 'italian-v2', name: '2 column (portrait)', description: 'Elegant 2-column text-focused layout' },
  { id: 'half-a4-tall-v2', name: '1 column (tall)', description: 'Half A4 · Narrow single-column for tent cards' },
  { id: 'classic-cards-v2-landscape', name: '4 column (landscape)', description: 'A4 Landscape · 4-column wide-format layout' }
]

/** Extra V2 templates only in Layout Lab (dev/testing). */
export const V2_TEMPLATE_OPTIONS_EXTRA: TemplateOption[] = [
  { id: 'two-column-classic-v2', name: 'Two Column Classic', description: 'A4 Portrait · 2-column with wider cards' },
  { id: 'valentines-v2', name: "Valentine's Day", description: 'A4 Portrait · Themed with ornament dividers' },
  { id: 'lunar-new-year-v2', name: 'Lunar New Year', description: 'A4 Portrait · Themed with gold accents' }
]
