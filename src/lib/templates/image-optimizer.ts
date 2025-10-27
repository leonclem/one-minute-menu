/**
 * Image Optimization Utilities
 * 
 * Provides utilities for optimizing menu item images including:
 * - WebP conversion
 * - Progressive loading
 * - Responsive image generation
 * - Blur placeholder generation
 */

import sharp from 'sharp'

// ============================================================================
// Types
// ============================================================================

export interface ImageOptimizationOptions {
  /** Target width in pixels */
  width?: number
  /** Target height in pixels */
  height?: number
  /** Output format (webp, jpeg, png) */
  format?: 'webp' | 'jpeg' | 'png'
  /** Quality (1-100) */
  quality?: number
  /** Generate blur placeholder */
  generateBlur?: boolean
}

export interface OptimizedImage {
  /** Optimized image buffer */
  buffer: Buffer
  /** Image format */
  format: string
  /** Image width */
  width: number
  /** Image height */
  height: number
  /** Blur placeholder data URL (if requested) */
  blurDataURL?: string
}

export interface ResponsiveImageSet {
  /** Original/largest size */
  original: OptimizedImage
  /** Medium size (50% of original) */
  medium?: OptimizedImage
  /** Small size (25% of original) */
  small?: OptimizedImage
  /** Thumbnail (10% of original, max 100px) */
  thumbnail?: OptimizedImage
}

// ============================================================================
// Image Optimization
// ============================================================================

/**
 * Optimize a single image
 * 
 * @param input - Image buffer or file path
 * @param options - Optimization options
 * @returns Optimized image data
 */
export async function optimizeImage(
  input: Buffer | string,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImage> {
  const {
    width,
    height,
    format = 'webp',
    quality = 85,
    generateBlur = false
  } = options

  // Create sharp instance
  let pipeline = sharp(input)

  // Get original metadata
  const metadata = await pipeline.metadata()
  const originalWidth = metadata.width || 800
  const originalHeight = metadata.height || 600

  // Resize if dimensions specified
  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit: 'cover',
      position: 'center'
    })
  }

  // Convert to target format
  switch (format) {
    case 'webp':
      pipeline = pipeline.webp({ quality, effort: 4 })
      break
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, progressive: true })
      break
    case 'png':
      pipeline = pipeline.png({ quality, progressive: true })
      break
  }

  // Generate optimized image
  const buffer = await pipeline.toBuffer()
  const info = await sharp(buffer).metadata()

  const result: OptimizedImage = {
    buffer,
    format,
    width: info.width || width || originalWidth,
    height: info.height || height || originalHeight
  }

  // Generate blur placeholder if requested
  if (generateBlur) {
    result.blurDataURL = await generateBlurPlaceholder(input)
  }

  return result
}

/**
 * Generate responsive image set with multiple sizes
 * 
 * @param input - Image buffer or file path
 * @param options - Base optimization options
 * @returns Set of responsive images
 */
export async function generateResponsiveImages(
  input: Buffer | string,
  options: ImageOptimizationOptions = {}
): Promise<ResponsiveImageSet> {
  // Get original dimensions
  const metadata = await sharp(input).metadata()
  const originalWidth = metadata.width || 800
  const originalHeight = metadata.height || 600

  // Generate original/large size
  const original = await optimizeImage(input, {
    ...options,
    generateBlur: true
  })

  // Generate medium size (50%)
  const mediumWidth = Math.round(originalWidth * 0.5)
  const mediumHeight = Math.round(originalHeight * 0.5)
  const medium = await optimizeImage(input, {
    ...options,
    width: mediumWidth,
    height: mediumHeight,
    generateBlur: false
  })

  // Generate small size (25%)
  const smallWidth = Math.round(originalWidth * 0.25)
  const smallHeight = Math.round(originalHeight * 0.25)
  const small = await optimizeImage(input, {
    ...options,
    width: smallWidth,
    height: smallHeight,
    generateBlur: false
  })

  // Generate thumbnail (max 100px)
  const thumbnailSize = Math.min(100, originalWidth, originalHeight)
  const thumbnail = await optimizeImage(input, {
    ...options,
    width: thumbnailSize,
    height: thumbnailSize,
    generateBlur: false
  })

  return {
    original,
    medium,
    small,
    thumbnail
  }
}

/**
 * Generate blur placeholder data URL
 * Creates a tiny 10x10 blurred version for progressive loading
 * 
 * @param input - Image buffer or file path
 * @returns Base64 data URL
 */
export async function generateBlurPlaceholder(
  input: Buffer | string
): Promise<string> {
  // Create tiny 10x10 blurred version
  const buffer = await sharp(input)
    .resize(10, 10, { fit: 'cover' })
    .blur(2)
    .webp({ quality: 20 })
    .toBuffer()

  // Convert to base64 data URL
  const base64 = buffer.toString('base64')
  return `data:image/webp;base64,${base64}`
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Optimize multiple images in parallel
 * 
 * @param inputs - Array of image buffers or file paths
 * @param options - Optimization options
 * @param concurrency - Maximum concurrent operations (default: 5)
 * @returns Array of optimized images
 */
export async function optimizeImageBatch(
  inputs: Array<Buffer | string>,
  options: ImageOptimizationOptions = {},
  concurrency: number = 5
): Promise<OptimizedImage[]> {
  const results: OptimizedImage[] = []
  
  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < inputs.length; i += concurrency) {
    const batch = inputs.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(input => optimizeImage(input, options))
    )
    results.push(...batchResults)
  }

  return results
}

// ============================================================================
// Format Conversion
// ============================================================================

/**
 * Convert image to WebP format
 * WebP provides better compression than JPEG/PNG
 * 
 * @param input - Image buffer or file path
 * @param quality - Quality (1-100, default: 85)
 * @returns WebP image buffer
 */
export async function convertToWebP(
  input: Buffer | string,
  quality: number = 85
): Promise<Buffer> {
  return sharp(input)
    .webp({ quality, effort: 4 })
    .toBuffer()
}

/**
 * Check if image format is supported by Next.js Image
 * 
 * @param format - Image format
 * @returns True if supported
 */
export function isSupportedFormat(format: string): boolean {
  const supported = ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'svg']
  return supported.includes(format.toLowerCase())
}

// ============================================================================
// Image Analysis
// ============================================================================

/**
 * Get image metadata
 * 
 * @param input - Image buffer or file path
 * @returns Image metadata
 */
export async function getImageMetadata(input: Buffer | string) {
  const metadata = await sharp(input).metadata()
  
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: metadata.size,
    hasAlpha: metadata.hasAlpha,
    orientation: metadata.orientation,
    aspectRatio: metadata.width && metadata.height 
      ? metadata.width / metadata.height 
      : undefined
  }
}

/**
 * Calculate optimal dimensions for target aspect ratio
 * 
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 * @param targetAspectRatio - Target aspect ratio (e.g., '16/9', '4/3', '1/1')
 * @returns Optimal width and height
 */
export function calculateOptimalDimensions(
  originalWidth: number,
  originalHeight: number,
  targetAspectRatio: string
): { width: number; height: number } {
  // Parse aspect ratio
  const [widthRatio, heightRatio] = targetAspectRatio.split('/').map(Number)
  const targetRatio = widthRatio / heightRatio

  const originalRatio = originalWidth / originalHeight

  let width: number
  let height: number

  if (originalRatio > targetRatio) {
    // Original is wider - constrain by height
    height = originalHeight
    width = Math.round(height * targetRatio)
  } else {
    // Original is taller - constrain by width
    width = originalWidth
    height = Math.round(width / targetRatio)
  }

  return { width, height }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate image file
 * Checks format, size, and dimensions
 * 
 * @param input - Image buffer or file path
 * @param options - Validation options
 * @returns Validation result
 */
export async function validateImage(
  input: Buffer | string,
  options: {
    maxWidth?: number
    maxHeight?: number
    maxFileSize?: number // in bytes
    allowedFormats?: string[]
  } = {}
): Promise<{
  valid: boolean
  errors: string[]
  metadata?: any
}> {
  const errors: string[] = []

  try {
    const metadata = await getImageMetadata(input)

    // Check format
    if (options.allowedFormats && metadata.format) {
      if (!options.allowedFormats.includes(metadata.format)) {
        errors.push(`Format ${metadata.format} not allowed. Allowed: ${options.allowedFormats.join(', ')}`)
      }
    }

    // Check dimensions
    if (options.maxWidth && metadata.width && metadata.width > options.maxWidth) {
      errors.push(`Width ${metadata.width}px exceeds maximum ${options.maxWidth}px`)
    }

    if (options.maxHeight && metadata.height && metadata.height > options.maxHeight) {
      errors.push(`Height ${metadata.height}px exceeds maximum ${options.maxHeight}px`)
    }

    // Check file size
    if (options.maxFileSize && metadata.size && metadata.size > options.maxFileSize) {
      const sizeMB = (metadata.size / 1024 / 1024).toFixed(2)
      const maxSizeMB = (options.maxFileSize / 1024 / 1024).toFixed(2)
      errors.push(`File size ${sizeMB}MB exceeds maximum ${maxSizeMB}MB`)
    }

    return {
      valid: errors.length === 0,
      errors,
      metadata
    }
  } catch (error) {
    errors.push(`Failed to read image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return {
      valid: false,
      errors
    }
  }
}
