/**
 * Server-side Style Generator for Template Engine
 * 
 * Contains style generation logic that depends on server-side modules (e.g. texture utils using fs/http)
 */

import type { MenuTemplate, TemplateColorPalette, TemplateStyle } from './engine-types'
import { 
  getActivePalette, 
  getTemplateCSSString, 
  getDefaultCSS, 
  getElegantDarkFallback,
  generateStaticTemplateCSS,
  type StyleMode 
} from './style-generator'

/**
 * Generate CSS string for a template with styling (Async - supports both modes)
 */
export async function generateTemplateCSS(
  template?: MenuTemplate,
  paletteId?: string,
  mode: StyleMode = 'static',
  headers?: Record<string, string>
): Promise<string> {
  if (!template?.style) {
    return getDefaultCSS()
  }
  
  const palette = getActivePalette(template.style, paletteId)
  
  if (mode === 'inline') {
    // Handle textures based on mode
    let elegantDarkBg = ''
    
    if (palette.id === 'elegant-dark') {
      try {
        // Import texture utils which has server dependencies
        const { getElegantDarkBackground } = await import('./export/texture-utils')
        elegantDarkBg = await getElegantDarkBackground(headers)
      } catch (error) {
        console.warn('[ServerStyleGenerator] Could not load texture utility, using fallback')
        elegantDarkBg = getElegantDarkFallback()
      }
    }
    return getTemplateCSSString(template.style, palette, elegantDarkBg)
  } else {
    return generateStaticTemplateCSS(template, paletteId)
  }
}

