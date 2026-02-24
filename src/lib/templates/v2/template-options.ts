/**
 * Shared V2 template options for template page and Layout Lab.
 * Single source of truth for display names, descriptions, and order.
 * Template IDs match YAML filenames (without .yaml) in src/lib/templates/v2/templates/.
 */

export interface TemplateOption {
  id: string
  name: string
  description: string
}

/** Main V2 templates shown on template page and in Layout Lab. Order: 4 col portrait, 3 col portrait, 2 col portrait, 1 col tall, 4 col landscape. */
export const V2_TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: '4-column-portrait', name: '4 column (portrait)', description: 'Photo-forward 4-column grid' },
  { id: '3-column-portrait', name: '3 column (portrait)', description: 'A4 Portrait · 3-column balanced grid' },
  { id: '2-column-portrait', name: '2 column (portrait)', description: 'Elegant 2-column text-focused layout' },
  { id: '1-column-tall', name: '1 column (tall)', description: 'Half A4 · Narrow single-column for tent cards' },
  { id: '4-column-landscape', name: '4 column (landscape)', description: 'A4 Landscape · 4-column wide-format layout' }
]

/** Extra V2 templates only in Layout Lab (dev/testing). Empty after consolidating to display-named templates. */
export const V2_TEMPLATE_OPTIONS_EXTRA: TemplateOption[] = []
