/**
 * HTML Export Module
 * 
 * Exports menu layouts as standalone HTML strings with inline styles.
 * Suitable for embedding in web pages, email templates, or saving as static files.
 * 
 * Features:
 * - Server-side React rendering with renderToString
 * - Inline Tailwind CSS styles for standalone rendering
 * - Responsive meta tags and viewport configuration
 * - Semantic HTML structure
 * - Accessibility-compliant markup
 */

import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import type { LayoutMenuData, LayoutPreset, OutputContext } from '../types'
import GridMenuLayout from '@/components/templates/GridMenuLayout'
import TextOnlyLayout from '@/components/templates/TextOnlyLayout'

// ============================================================================
// Export Options
// ============================================================================

export interface HTMLExportOptions {
  /** Include full HTML document structure (html, head, body tags) */
  includeDoctype?: boolean
  /** Include responsive meta tags */
  includeMetaTags?: boolean
  /** Include inline CSS styles */
  includeStyles?: boolean
  /** Custom CSS to inject */
  customCSS?: string
  /** Page title for HTML document */
  pageTitle?: string
  /** Optional theme color overrides */
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
}

export interface HTMLExportResult {
  /** Generated HTML string */
  html: string
  /** Size in bytes */
  size: number
  /** Generation timestamp */
  timestamp: Date
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Export menu layout as HTML string
 * 
 * @param data - Normalized menu data
 * @param preset - Selected layout preset
 * @param context - Output context (mobile, tablet, desktop, print)
 * @param options - Export configuration options
 * @returns HTML export result with generated HTML string
 */
export function exportToHTML(
  data: LayoutMenuData,
  preset: LayoutPreset,
  context: OutputContext,
  options: HTMLExportOptions = {}
): HTMLExportResult {
  const {
    includeDoctype = true,
    includeMetaTags = true,
    includeStyles = true,
    customCSS = '',
    pageTitle = data.metadata.title,
    themeColors
  } = options

  const startTime = Date.now()

  // Determine which layout component to use
  const isTextOnly = preset.id === 'text-only'

  // Render React component to HTML string
  const componentHTML = isTextOnly
    ? renderToString(
        createElement(TextOnlyLayout, {
          data,
          preset,
          className: 'max-w-4xl mx-auto p-6',
          themeColors
        })
      )
    : renderToString(
        createElement(GridMenuLayout, {
          data,
          preset,
          context,
          className: 'max-w-7xl mx-auto p-6',
          themeColors
        })
      )

  // Build complete HTML document
  let html = ''

  if (includeDoctype) {
    html += '<!DOCTYPE html>\n'
    html += '<html lang="en">\n'
    html += '<head>\n'

    if (includeMetaTags) {
      html += generateMetaTags(pageTitle, context)
    }

    if (includeStyles) {
      html += generateInlineStyles(customCSS, themeColors)
    }

    html += '</head>\n'
    html += '<body>\n'
  }

  html += componentHTML

  if (includeDoctype) {
    html += '\n</body>\n'
    html += '</html>'
  }

  const endTime = Date.now()
  const size = new Blob([html]).size

  console.log(`[HTMLExporter] Generated HTML in ${endTime - startTime}ms (${size} bytes)`)

  return {
    html,
    size,
    timestamp: new Date()
  }
}

// ============================================================================
// Partial Export Functions
// ============================================================================

/**
 * Export only the menu content without HTML document wrapper
 * Useful for embedding in existing pages
 */
export function exportToHTMLFragment(
  data: LayoutMenuData,
  preset: LayoutPreset,
  context: OutputContext,
  themeColors?: HTMLExportOptions['themeColors']
): string {
  const isTextOnly = preset.id === 'text-only'

  return isTextOnly
    ? renderToString(
        createElement(TextOnlyLayout, {
          data,
          preset,
          className: 'max-w-4xl mx-auto p-6',
          themeColors
        })
      )
    : renderToString(
        createElement(GridMenuLayout, {
          data,
          preset,
          context,
          className: 'max-w-7xl mx-auto p-6',
          themeColors
        })
      )
}

/**
 * Export with custom wrapper element
 */
export function exportToHTMLWithWrapper(
  data: LayoutMenuData,
  preset: LayoutPreset,
  context: OutputContext,
  wrapperTag: string = 'div',
  wrapperClass: string = '',
  themeColors?: HTMLExportOptions['themeColors']
): string {
  const fragment = exportToHTMLFragment(data, preset, context, themeColors)
  return `<${wrapperTag} class="${wrapperClass}">\n${fragment}\n</${wrapperTag}>`
}

// ============================================================================
// HTML Generation Helpers
// ============================================================================

/**
 * Generate meta tags for HTML document
 */
function generateMetaTags(title: string, context: OutputContext): string {
  const viewportContent = getViewportContent(context)

  return `
  <meta charset="UTF-8">
  <meta name="viewport" content="${viewportContent}">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHTML(title)}</title>
  <meta name="description" content="Menu for ${escapeHTML(title)}">
  <meta name="generator" content="Dynamic Menu Layout Engine">
`
}

/**
 * Generate inline CSS styles
 */
function generateInlineStyles(customCSS: string, themeColors?: HTMLExportOptions['themeColors']): string {
  const baseStyles = generateBaseStyles(themeColors)
  const tailwindStyles = generateTailwindStyles()

  return `
  <style>
    ${baseStyles}
    ${tailwindStyles}
    ${customCSS}
  </style>
`
}

/**
 * Generate base CSS reset and typography
 */
function generateBaseStyles(themeColors?: HTMLExportOptions['themeColors']): string {
  const bgColor = themeColors?.background || '#ffffff'
  const textColor = themeColors?.text || '#111827'

  return `
    /* Base Reset */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      color: ${textColor};
      background-color: ${bgColor};
    }

    img {
      max-width: 100%;
      height: auto;
      display: block;
    }

    /* Accessibility */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }

    /* Print Styles */
    @media print {
      body {
        background-color: white;
      }
      
      .menu-section {
        page-break-inside: avoid;
      }
      
      h2 {
        page-break-after: avoid;
      }
    }
  `
}

/**
 * Generate essential Tailwind utility classes
 * Only includes classes used by the layout components
 */
function generateTailwindStyles(): string {
  return `
    /* Layout */
    .max-w-4xl { max-width: 56rem; }
    .max-w-7xl { max-width: 80rem; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    
    /* Spacing */
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .p-6 { padding: 1.5rem; }
    .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .px-0 { padding-left: 0; padding-right: 0; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mb-7 { margin-bottom: 1.75rem; }
    .mb-8 { margin-bottom: 2rem; }
    .mb-10 { margin-bottom: 2.5rem; }
    .mt-1 { margin-top: 0.25rem; }
    .mt-2 { margin-top: 0.5rem; }
    
    /* Grid */
    .grid { display: grid; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    
    /* Flexbox */
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .flex-1 { flex: 1 1 0%; }
    .items-baseline { align-items: baseline; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .justify-center { justify-content: center; }
    .gap-1 { gap: 0.25rem; }
    .gap-4 { gap: 1rem; }
    
    /* Typography */
    .text-xs { font-size: 0.75rem; line-height: 1rem; }
    .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
    .text-base { font-size: 1rem; line-height: 1.5rem; }
    .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
    .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
    .text-2xl { font-size: 1.5rem; line-height: 2rem; }
    .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
    .text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .text-center { text-align: center; }
    .leading-tight { line-height: 1.25; }
    .leading-snug { line-height: 1.375; }
    .whitespace-nowrap { white-space: nowrap; }
    .line-clamp-2 {
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    
    /* Colors */
    .text-gray-600 { color: rgb(75 85 99); }
    .text-gray-700 { color: rgb(55 65 81); }
    .text-gray-800 { color: rgb(31 41 55); }
    .text-gray-900 { color: rgb(17 24 39); }
    .bg-gray-100 { background-color: rgb(243 244 246); }
    .bg-white { background-color: rgb(255 255 255); }
    .border-gray-200 { border-color: rgb(229 231 235); }
    
    /* Borders */
    .border-2 { border-width: 2px; }
    .border-b-2 { border-bottom-width: 2px; }
    .border-dotted { border-style: dotted; }
    .rounded-none { border-radius: 0; }
    .rounded-md { border-radius: 0.375rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    
    /* Positioning */
    .relative { position: relative; }
    .absolute { position: absolute; }
    .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
    .inset-x-0 { left: 0; right: 0; }
    .bottom-0 { bottom: 0; }
    
    /* Sizing */
    .w-full { width: 100%; }
    .h-full { height: 100%; }
    
    /* Display */
    .overflow-hidden { overflow: hidden; }
    .space-y-1 > * + * { margin-top: 0.25rem; }
    .space-y-3 > * + * { margin-top: 0.75rem; }
    
    /* Opacity */
    .opacity-70 { opacity: 0.7; }
    .opacity-80 { opacity: 0.8; }
    .opacity-90 { opacity: 0.9; }
    
    /* Object Fit */
    .object-cover { object-fit: cover; }
  `
}

/**
 * Get viewport meta content based on output context
 */
function getViewportContent(context: OutputContext): string {
  switch (context) {
    case 'mobile':
      return 'width=device-width, initial-scale=1.0, maximum-scale=5.0'
    case 'tablet':
      return 'width=device-width, initial-scale=1.0'
    case 'desktop':
      return 'width=device-width, initial-scale=1.0'
    case 'print':
      return 'width=device-width'
    default:
      return 'width=device-width, initial-scale=1.0'
  }
}

/**
 * Escape HTML special characters
 */
function escapeHTML(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }

  return text.replace(/[&<>"']/g, char => htmlEscapes[char])
}

// ============================================================================
// Validation and Error Handling
// ============================================================================

/**
 * Validate HTML export options
 */
export function validateHTMLExportOptions(options: HTMLExportOptions): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validate custom CSS if provided
  if (options.customCSS) {
    if (options.customCSS.includes('<script')) {
      errors.push('Custom CSS cannot contain script tags')
    }
    if (options.customCSS.length > 100000) {
      errors.push('Custom CSS exceeds maximum size (100KB)')
    }
  }

  // Validate page title
  if (options.pageTitle && options.pageTitle.length > 200) {
    errors.push('Page title exceeds maximum length (200 characters)')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// ============================================================================
// Export Utilities
// ============================================================================

/**
 * Save HTML to file (Node.js environment only)
 */
export async function saveHTMLToFile(
  html: string,
  filepath: string
): Promise<void> {
  if (typeof window !== 'undefined') {
    throw new Error('saveHTMLToFile can only be used in Node.js environment')
  }

  const fs = await import('fs/promises')
  await fs.writeFile(filepath, html, 'utf-8')
}

/**
 * Create downloadable HTML blob (browser environment only)
 */
export function createHTMLBlob(html: string): Blob {
  return new Blob([html], { type: 'text/html;charset=utf-8' })
}

/**
 * Generate data URL for HTML content
 */
export function createHTMLDataURL(html: string): string {
  const encoded = encodeURIComponent(html)
  return `data:text/html;charset=utf-8,${encoded}`
}
