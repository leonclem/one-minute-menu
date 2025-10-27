/**
 * Next.js Image Configuration Helper
 * 
 * Provides configuration and utilities for Next.js Image component optimization
 */

import type { OutputContext } from './types'

// ============================================================================
// Image Loader Configuration
// ============================================================================

/**
 * Custom image loader for menu images
 * Supports WebP conversion and responsive sizing
 * 
 * @param src - Image source URL
 * @param width - Requested width
 * @param quality - Image quality (1-100)
 * @returns Optimized image URL
 */
export function menuImageLoader({
  src,
  width,
  quality
}: {
  src: string
  width: number
  quality?: number
}): string {
  // If using external image service (e.g., Cloudinary, Imgix)
  // you can customize the URL here
  
  // For local images, Next.js handles optimization automatically
  // This is a pass-through for demonstration
  
  const params = new URLSearchParams()
  params.set('url', src)
  params.set('w', width.toString())
  if (quality) {
    params.set('q', quality.toString())
  }

  // Return optimized image URL
  // In production, this would point to your image optimization service
  return `/api/images/optimize?${params.toString()}`
}

// ============================================================================
// Responsive Sizes Configuration
// ============================================================================

/**
 * Get responsive sizes attribute for different output contexts
 * Optimizes image loading based on viewport size
 * 
 * @param context - Output context
 * @param columns - Number of grid columns
 * @returns Sizes attribute string
 */
export function getResponsiveSizes(
  context: OutputContext,
  columns: number = 4
): string {
  switch (context) {
    case 'mobile':
      // Mobile: 2-3 columns, full width on small screens
      return columns === 2
        ? '(max-width: 640px) 50vw, 33vw'
        : '(max-width: 640px) 33vw, 25vw'
    
    case 'tablet':
      // Tablet: 3-4 columns
      return columns <= 3
        ? '(max-width: 1024px) 33vw, 25vw'
        : '(max-width: 1024px) 25vw, 20vw'
    
    case 'desktop':
      // Desktop: 4-6 columns
      if (columns <= 4) {
        return '(max-width: 1280px) 25vw, 20vw'
      } else if (columns === 5) {
        return '(max-width: 1280px) 20vw, 16vw'
      } else {
        return '(max-width: 1280px) 16vw, 14vw'
      }
    
    case 'print':
      // Print: Fixed size
      return '300px'
    
    default:
      return '25vw'
  }
}

/**
 * Get device pixel ratio multiplier for high-DPI displays
 * 
 * @param context - Output context
 * @returns DPR multiplier
 */
export function getDevicePixelRatio(context: OutputContext): number {
  switch (context) {
    case 'mobile':
      return 2 // Most mobile devices are 2x or 3x
    case 'tablet':
      return 2
    case 'desktop':
      return 1.5 // Many desktop displays are 1.5x or 2x
    case 'print':
      return 1 // Print doesn't need DPR
    default:
      return 1
  }
}

// ============================================================================
// Image Priority Configuration
// ============================================================================

/**
 * Determine if image should be loaded with priority
 * Priority images are loaded eagerly and preloaded
 * 
 * @param featured - Whether item is featured
 * @param index - Item index in grid
 * @param context - Output context
 * @returns True if should be priority loaded
 */
export function shouldPrioritizeImage(
  featured: boolean,
  index: number,
  context: OutputContext
): boolean {
  // Always prioritize featured items
  if (featured) {
    return true
  }

  // Prioritize first few items based on context
  switch (context) {
    case 'mobile':
      return index < 4 // First 2 rows (2 columns)
    case 'tablet':
      return index < 6 // First 2 rows (3 columns)
    case 'desktop':
      return index < 8 // First 2 rows (4 columns)
    case 'print':
      return false // No priority for print
    default:
      return index < 4
  }
}

// ============================================================================
// Loading Strategy
// ============================================================================

export type LoadingStrategy = 'eager' | 'lazy'

/**
 * Get loading strategy for image
 * 
 * @param priority - Whether image is priority
 * @returns Loading strategy
 */
export function getLoadingStrategy(priority: boolean): LoadingStrategy {
  return priority ? 'eager' : 'lazy'
}

// ============================================================================
// Quality Configuration
// ============================================================================

/**
 * Get optimal image quality based on context and format
 * 
 * @param context - Output context
 * @param format - Image format
 * @returns Quality value (1-100)
 */
export function getOptimalQuality(
  context: OutputContext,
  format: 'webp' | 'jpeg' | 'png' = 'webp'
): number {
  // WebP can use lower quality with same visual result
  const webpBonus = format === 'webp' ? 5 : 0

  switch (context) {
    case 'mobile':
      // Lower quality for mobile to save bandwidth
      return 75 + webpBonus
    case 'tablet':
      return 80 + webpBonus
    case 'desktop':
      return 85 + webpBonus
    case 'print':
      // Higher quality for print
      return 95
    default:
      return 85
  }
}

// ============================================================================
// Blur Placeholder Configuration
// ============================================================================

/**
 * Generate inline blur data URL for progressive loading
 * Creates a minimal SVG placeholder
 * 
 * @param color - Base color (hex)
 * @returns Data URL
 */
export function generateInlineBlurDataURL(color: string = '#e5e7eb'): string {
  const svg = `
    <svg width="10" height="10" xmlns="http://www.w3.org/2000/svg">
      <rect width="10" height="10" fill="${color}"/>
      <rect width="10" height="10" fill="url(#gradient)" opacity="0.3"/>
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:#000000;stop-opacity:0.1" />
        </linearGradient>
      </defs>
    </svg>
  `.trim().replace(/\s+/g, ' ')

  // Convert to base64
  if (typeof window === 'undefined') {
    // Server-side
    const base64 = Buffer.from(svg).toString('base64')
    return `data:image/svg+xml;base64,${base64}`
  } else {
    // Client-side
    const base64 = btoa(svg)
    return `data:image/svg+xml;base64,${base64}`
  }
}

// ============================================================================
// Format Detection
// ============================================================================

/**
 * Check if browser supports WebP
 * 
 * @returns True if WebP is supported
 */
export function supportsWebP(): boolean {
  if (typeof window === 'undefined') {
    // Server-side: assume support (Next.js will handle fallback)
    return true
  }

  // Client-side: check canvas support
  const canvas = document.createElement('canvas')
  if (canvas.getContext && canvas.getContext('2d')) {
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
  }

  return false
}

/**
 * Get preferred image format based on browser support
 * 
 * @returns Preferred format
 */
export function getPreferredFormat(): 'webp' | 'jpeg' {
  return supportsWebP() ? 'webp' : 'jpeg'
}

// ============================================================================
// Preload Configuration
// ============================================================================

/**
 * Generate preload link for critical images
 * 
 * @param src - Image source
 * @param sizes - Sizes attribute
 * @returns Preload link HTML
 */
export function generatePreloadLink(src: string, sizes: string): string {
  return `<link rel="preload" as="image" href="${src}" imagesizes="${sizes}" />`
}

/**
 * Get images that should be preloaded
 * 
 * @param images - Array of image sources
 * @param context - Output context
 * @param maxPreload - Maximum number to preload
 * @returns Array of images to preload
 */
export function getImagesToPreload(
  images: Array<{ src: string; featured: boolean }>,
  context: OutputContext,
  maxPreload: number = 4
): string[] {
  // Sort by featured first, then by order
  const sorted = [...images].sort((a, b) => {
    if (a.featured && !b.featured) return -1
    if (!a.featured && b.featured) return 1
    return 0
  })

  // Take first N images
  return sorted.slice(0, maxPreload).map(img => img.src)
}

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Track image loading performance
 * 
 * @param src - Image source
 * @param startTime - Load start time
 * @param endTime - Load end time
 */
export function trackImageLoadTime(
  src: string,
  startTime: number,
  endTime: number
): void {
  const duration = endTime - startTime

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Image Load] ${src}: ${duration}ms`)
  }

  // Send to analytics in production
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'image_load', {
      event_category: 'performance',
      event_label: src,
      value: Math.round(duration)
    })
  }
}

// ============================================================================
// Type Declarations
// ============================================================================

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}
