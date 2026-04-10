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

/** Main V2 templates shown on template page and in Layout Lab. Order: 6 col A3 portrait (default), 4 col portrait, 3 col portrait, 2 col portrait, 1 col tall, 5 col landscape. */
export const V2_TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: '6-column-portrait-a3', name: '6 column · A3 (portrait)', description: 'A3 Portrait · High-density 6-column grid' },
  { id: '4-column-portrait', name: '4 column (portrait)', description: 'A4 Portrait · Photo-forward 4-column grid' },
  { id: '3-column-portrait', name: '3 column (portrait)', description: 'A4 Portrait · 3-column balanced grid' },
  { id: '2-column-portrait', name: '2 column (portrait)', description: 'A4 Portrait · Elegant 2-column text-focused layout' },
  { id: '1-column-tall', name: '1 column (tall)', description: 'Half A4 · Narrow single-column for tent cards' },
  { id: '5-column-landscape', name: '5 column (landscape)', description: 'A4 Landscape · 5-column wide-format layout' },
]

/** Extra V2 templates only in Layout Lab (dev/testing). Empty after consolidating to display-named templates. */
export const V2_TEMPLATE_OPTIONS_EXTRA: TemplateOption[] = []
