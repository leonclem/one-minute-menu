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
    let texturedBackground = ''
    
    if (palette.id === 'elegant-dark') {
      try {
        // Import texture utils which has server dependencies
        const { getElegantDarkBackground } = await import('./export/texture-utils')
        texturedBackground = await getElegantDarkBackground(headers)
      } catch (error) {
        console.warn('[ServerStyleGenerator] Could not load elegant-dark texture utility, using fallback')
        texturedBackground = getElegantDarkFallback()
      }
    } else if (palette.id === 'midnight-gold') {
      try {
        // Import texture utils which has server dependencies
        const { getMidnightGoldBackground } = await import('./export/texture-utils')
        texturedBackground = await getMidnightGoldBackground(headers)
      } catch (error) {
        console.warn('[ServerStyleGenerator] Could not load midnight-gold texture utility, using fallback')
        texturedBackground = getMidnightGoldFallback()
      }
    }
    
    return getTemplateCSSString(template.style, palette, texturedBackground)
  } else {
    return generateStaticTemplateCSS(template, paletteId)
  }
}

/**
 * Fallback background for Midnight Gold if texture fails
 */
function getMidnightGoldFallback(): string {
  return `
    background-color: #1A1A1A;
    background-image: 
      linear-gradient(135deg, rgba(212, 175, 55, 0.04) 0%, transparent 30%, rgba(212, 175, 55, 0.02) 70%, transparent 100%),
      repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(212, 175, 55, 0.008) 3px, rgba(212, 175, 55, 0.008) 6px),
      repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255, 255, 255, 0.005) 3px, rgba(255, 255, 255, 0.005) 6px),
      radial-gradient(ellipse at 25% 25%, rgba(212, 175, 55, 0.015) 0%, transparent 60%),
      radial-gradient(ellipse at 75% 75%, rgba(212, 175, 55, 0.01) 0%, transparent 60%);
    background-size: 100% 100%, 12px 12px, 12px 12px, 100% 100%, 100% 100%;
  `
}

