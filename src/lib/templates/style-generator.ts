/**
 * Style Generator for Template Engine
 * 
 * Isomorphic module that generates CSS for templates.
 * Supports two modes:
 * - 'static': Uses direct URL references (fast, for client/preview)
 * - 'inline': Embeds assets as base64 (for standalone PDF/HTML export)
 */

import type { MenuTemplate, TemplateColorPalette, TemplateStyle } from './engine-types'

export type StyleMode = 'static' | 'inline'

/**
 * Get the active color palette based on paletteId or use default
 */
export function getActivePalette(style: TemplateStyle, paletteId?: string): TemplateColorPalette {
  if (!paletteId) return style.colors
  const alternate = style.alternatePalettes?.find(p => p.id === paletteId)
  return alternate || style.colors
}

/**
 * Generate CSS string for a template (Synchronous - static mode only)
 * Safe for use in React components (Client Side)
 */
export function generateStaticTemplateCSS(
  template?: MenuTemplate,
  paletteId?: string
): string {
  if (!template?.style) {
    return getDefaultCSS()
  }
  
  const palette = getActivePalette(template.style, paletteId)
  
  let elegantDarkBg = ''
  if (palette.id === 'elegant-dark') {
    // Static URL reference (fast, sync)
    elegantDarkBg = `
      background-color: #0b0d11;
      background-image: url('/textures/dark-paper.png');
      background-size: cover;
      background-repeat: no-repeat;
      background-position: center;
    `
  }
  
  return getTemplateCSSString(template.style, palette, elegantDarkBg)
}

/**
 * Get default CSS when no template is provided
 */
export function getDefaultCSS(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    html {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    
    body {
      margin: 0;
      padding: 0;
      background: #f9fafb;
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
      width: 100%;
      height: 100%;
    }
    
    .layout-renderer {
      min-height: 100vh;
      width: 100%;
      color: #1a1a1a;
    }
    
    .grid {
      display: grid;
      width: 100%;
    }
    
    .page {
      position: relative;
      z-index: 1;
    }
    
    .tile {
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      background: white;
      overflow: hidden;
      box-sizing: border-box;
    }
    
    .tile-menu-item { border: none; }
    
    .menu-item-card {
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      overflow: hidden;
      background: white;
      height: 100%;
    }
    
    .tile-title {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .tile-section-header {
      display: flex;
      align-items: center;
      padding: 1rem;
      background: #f9fafb;
    }
    
    .tile-logo, .tile-qr {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .logo-placeholder, .qr-placeholder {
      border: 2px dashed #d1d5db;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
    }
    
    .logo-placeholder { width: 100px; height: 100px; }
    .qr-placeholder { width: 150px; height: 150px; }
    
    .tile-text-block { padding: 1rem; }
    .tile-decoration { border: none; }
    .decoration-placeholder { width: 100%; height: 100%; min-height: 100px; }
    .tile-spacer { border: none; }
    
    .text-left { text-align: left; }
    .text-centre { text-align: center; }
    .text-right { text-align: right; }
    
    @media print {
      html, body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  `
}

/**
 * Internal function to construct CSS string
 */
export function getTemplateCSSString(
  style: TemplateStyle, 
  palette: TemplateColorPalette, 
  elegantDarkBg: string
): string {
  return `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@400;700&family=Cormorant+Garamond:wght@400;600;700&family=Source+Sans+Pro:wght@400;600;700&family=Inter:wght@400;600;700&family=Nanum+Myeongjo:wght@400;700&family=Habibi&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    html {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    
    body {
      margin: 0;
      padding: 0;
      background: ${style.pageBackground || palette.background};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
      width: 100%;
      height: 100%;
    }
    
    .layout-renderer {
      position: relative;
      font-family: ${style.fonts.body};
      ${palette.id === 'elegant-dark' ? elegantDarkBg : `
      background-color: ${palette.background};
      background: ${style.pageBackground || palette.background};
      `}
      color: ${palette.text};
      min-height: 100vh;
      width: 100%;
      overflow: hidden;
    }
    
    .page {
      position: relative;
      z-index: 1;
    }
    
    ${palette.id === 'elegant-dark' ? `
    .layout-renderer::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(circle at 50% 30%, rgba(255,255,255,0.06), transparent 60%),
                  radial-gradient(circle at 50% 120%, rgba(0,0,0,0.65), transparent 40%);
      mix-blend-mode: soft-light;
      z-index: 0;
    }
    ` : ''}
    
    .grid {
      display: grid;
      width: 100%;
    }
    
    .tile {
      border-radius: ${style.itemCard.borderRadius};
      overflow: hidden;
      box-sizing: border-box;
      position: relative;
    }
    
    .tile-menu-item {
      background: ${style.itemCard.imagePosition === 'circle' ? 'transparent' : palette.cardBackground};
      border-radius: ${style.itemCard.imagePosition === 'circle' ? '0' : style.itemCard.borderRadius};
      box-shadow: ${style.itemCard.imagePosition === 'circle' ? 'none' : style.itemCard.shadow};
      overflow: visible;
      max-width: ${style.itemCard.imagePosition === 'circle' ? '260px' : 'none'};
      margin: ${style.itemCard.imagePosition === 'circle' ? '0 auto' : '0'};
    }
    
    .menu-item-card {
      background: ${style.itemCard.imagePosition === 'circle' ? 'transparent' : (style.itemCard.imagePosition === 'none' ? 'transparent' : palette.cardBackground)};
      border-radius: ${style.itemCard.imagePosition === 'circle' ? '0' : style.itemCard.borderRadius};
      overflow: visible;
      height: 100%;
      display: ${style.itemCard.imagePosition === 'circle' ? 'flex' : 'block'};
      flex-direction: ${style.itemCard.imagePosition === 'circle' ? 'column' : 'row'};
      align-items: ${style.itemCard.imagePosition === 'circle' ? 'center' : 'stretch'};
      padding: ${style.itemCard.imagePosition === 'circle' ? '0' : (style.itemCard.imagePosition === 'none' ? '0.75rem 0' : '0')};
      border-bottom: ${style.itemCard.imagePosition === 'none' ? `1px solid ${palette.accent}20` : 'none'};
    }
    
    .menu-item-image {
      ${style.itemCard.imagePosition === 'circle' ? `
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0;
        margin-bottom: 12px;
        height: 75px;
        flex-shrink: 0;
      ` : ''}
    }
    
    .menu-item-image-fallback {
      ${style.itemCard.imagePosition === 'circle' ? `
        width: 75px !important;
        height: 75px !important;
        border-radius: 50% !important;
        border: 2px solid ${palette.accent} !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25) !important;
      ` : ''}
    }
    
    .menu-item-image img, .item-image {
      ${style.itemCard.imagePosition === 'circle' ? `
        width: 75px !important;
        height: 75px !important;
        border-radius: 50% !important;
        border: 2px solid ${palette.accent} !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25) !important;
        object-fit: cover !important;
      ` : `
        width: 100% !important;
        height: 150px !important;
        object-fit: cover !important;
        border-radius: ${style.itemCard.imageBorderRadius || '0'} !important;
      `}
    }
    
    .menu-item-content {
      padding: ${style.itemCard.imagePosition === 'circle' ? '0' : (style.itemCard.imagePosition === 'none' ? '0' : '1rem')};
      text-align: ${style.itemCard.imagePosition === 'circle' ? 'center' : 'left'};
      width: 100%;
      display: ${style.itemCard.imagePosition === 'circle' ? 'flex' : (style.itemCard.imagePosition === 'none' ? 'block' : 'block')};
      flex-direction: ${style.itemCard.imagePosition === 'circle' ? 'column' : 'row'};
      align-items: ${style.itemCard.imagePosition === 'circle' ? 'center' : 'flex-start'};
    }
    
    ${style.itemCard.imagePosition === 'none' ? `
    .menu-item-content {
      display: block;
    }
    
    .menu-item-content > div {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 1rem;
      min-height: 1.5rem;
    }
    
    .item-name {
      flex: 1;
      min-width: 0;
      word-break: break-word;
    }
    
    .item-price {
      flex-shrink: 0;
      white-space: nowrap;
      margin-left: auto;
    }
    
    ${style.itemCard.showLeaderDots ? `
    .menu-item-content > div::after {
      content: '';
      flex: 0 1 auto;
      min-width: 2rem;
      border-bottom: 1px dotted ${palette.text}40;
      margin: 0 0.5rem 0.25rem;
      order: 1;
    }
    
    .item-name {
      order: 0;
    }
    
    .item-price {
      order: 2;
    }
    ` : ''}
    ` : ''}
    
    ${style.itemCard.imagePosition === 'circle' ? `
    .menu-item-name, .item-name {
      font-family: 'Nanum Myeongjo', 'Habibi', 'Times New Roman', serif !important;
      font-size: 9.5px !important;
      font-weight: 400 !important;
      color: #f8f5f0 !important;
      margin: 0 0 3px 0 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.05em !important;
      height: 28px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      line-height: 1.3 !important;
      overflow: hidden !important;
    }
    
    .menu-item-price, .item-price {
      font-family: 'Lato', system-ui, sans-serif !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      color: #c8a562 !important;
      display: block !important;
      margin-bottom: 4px !important;
      height: 16px !important;
      line-height: 16px !important;
    }
    
    .menu-item-description {
      font-family: 'Lato', system-ui, sans-serif !important;
      font-size: 8px !important;
      font-weight: 400 !important;
      color: #d4d2ce !important;
      margin: 0 !important;
      padding-bottom: 0 !important;
      line-height: 1.35 !important;
      text-transform: lowercase !important;
    }
    ` : `
    .menu-item-name, .item-name {
      font-family: ${style.fonts.heading} !important;
      font-size: 1rem !important;
      font-weight: 600 !important;
      color: ${palette.text} !important;
      margin: 0 !important;
      flex-shrink: 0 !important;
    }
    
    .menu-item-price, .item-price {
      font-family: ${style.fonts.body} !important;
      font-size: 1rem !important;
      font-weight: 700 !important;
      color: ${palette.price} !important;
      flex-shrink: 0 !important;
      white-space: nowrap !important;
    }
    
    .menu-item-description {
      font-family: ${style.fonts.body} !important;
      font-size: 0.875rem !important;
      color: ${palette.text} !important;
      opacity: 0.7 !important;
      margin: 0.25rem 0 0 0 !important;
      line-height: 1.5 !important;
    }
    `}
    
    .menu-item-image-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${palette.accent}15;
    }
    
    .tile-title {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      position: relative;
    }
    
    .tile-title h1, .menu-title {
      font-family: ${style.fonts.heading} !important;
      font-size: 36px !important;
      font-weight: 600 !important;
      color: ${palette.heading} !important;
      letter-spacing: 0.08em !important;
      text-transform: uppercase !important;
      margin: 0 0 0.5rem 0 !important;
      ${palette.id === 'elegant-dark' || palette.id === 'elegant-light' || palette.id === 'elegant-warm' ? `
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 -1px 1px rgba(255, 255, 255, 0.1) !important;
      ` : ''}
    }
    
    ${palette.id === 'elegant-dark' || palette.id === 'elegant-light' || palette.id === 'elegant-warm' ? `
    .tile-title::after {
      content: '';
      display: block;
      width: 180px;
      height: 1px;
      background: linear-gradient(to right, 
        transparent 0%, 
        ${palette.accent}40 20%, 
        ${palette.accent} 45%, 
        ${palette.accent} 55%, 
        ${palette.accent}40 80%, 
        transparent 100%);
      position: relative;
      margin-top: 0.25rem;
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.1);
    }
    
    .tile-title::before {
      content: '◆';
      display: block;
      position: absolute;
      bottom: 0.15rem;
      color: ${palette.accent};
      font-size: 10px;
      opacity: 0.9;
      z-index: 1;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 -1px 0 rgba(255, 255, 255, 0.15);
    }
    ` : ''}
    
    .tile-section-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1.5rem 1rem;
      border-bottom: none;
      position: relative;
    }
    
    .tile-section-header h2 {
      font-family: ${style.fonts.heading} !important;
      font-size: 36px !important;
      font-weight: 400 !important;
      color: ${palette.heading} !important;
      text-transform: uppercase !important;
      letter-spacing: 0.05em !important;
      margin: 0 0 0.5rem 0 !important;
      ${palette.id === 'elegant-dark' || palette.id === 'elegant-light' || palette.id === 'elegant-warm' ? `
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 -1px 1px rgba(255, 255, 255, 0.1) !important;
      ` : ''}
    }
    
    ${palette.id === 'elegant-dark' || palette.id === 'elegant-light' || palette.id === 'elegant-warm' ? `
    .tile-section-header::after {
      content: '';
      display: block;
      width: 180px;
      height: 1px;
      background: linear-gradient(to right, 
        transparent 0%, 
        ${palette.accent}40 20%, 
        ${palette.accent} 45%, 
        ${palette.accent} 55%, 
        ${palette.accent}40 80%, 
        transparent 100%);
      position: relative;
      margin-top: 0.25rem;
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.1);
    }
    
    .tile-section-header::before {
      content: '◆';
      display: block;
      position: absolute;
      bottom: 0.15rem;
      color: ${palette.accent};
      font-size: 10px;
      opacity: 0.9;
      z-index: 1;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 -1px 0 rgba(255, 255, 255, 0.15);
    }
    ` : ''}
    
    .tile-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem 0.5rem 0.4rem;
    }
    
    .logo-placeholder {
      width: 60px;
      height: 60px;
      border: none;
      border-radius: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .logo-placeholder img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    
    .tile-text-block {
      padding: 1rem;
    }
    
    .tile-text-block p {
      font-family: ${style.fonts.body};
      font-size: 0.875rem;
      color: ${palette.text};
      opacity: 0.8;
    }
    
    .tile-qr {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .qr-placeholder {
      width: 100px;
      height: 100px;
      border: 2px dashed ${palette.accent};
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${palette.accent};
      font-family: ${style.fonts.body};
      font-size: 0.75rem;
    }
    
    .tile-decoration {
      background: ${palette.accent}10;
      border-radius: 0.5rem;
    }
    
    .tile-spacer {
      border-radius: 0.5rem;
    }
    
    .leader-dots {
      flex: 1;
      border-bottom: 1px dotted ${palette.text}40;
      margin: 0 0.5rem 0.25rem;
    }
    
    .text-left { text-align: left; }
    .text-centre { text-align: center; }
    .text-right { text-align: right; }
    
    @media print {
      html, body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  `
}

/**
 * Fallback background for Elegant Dark if texture fails
 */
export function getElegantDarkFallback(): string {
  return `
    background-color: #0b0d11;
    background-image: 
      repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px),
      repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px),
      radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.02) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 70%, rgba(0,0,0,0.03) 0%, transparent 50%);
    background-size: 100% 100%, 100% 100%, 100% 100%, 100% 100%;
  `
}
