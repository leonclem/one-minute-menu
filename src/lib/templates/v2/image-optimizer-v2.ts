/**
 * V2 Image Optimizer
 * 
 * Handles pre-fetching and compression of images for V2 PDF exports.
 * This significantly reduces PDF file size and improves generation reliability
 * by avoiding network requests during Puppeteer rendering.
 */

import { fetchImageAsDataURL } from '../export/texture-utils'
import type { LayoutDocumentV2, ItemContentV2, LogoContentV2 } from './engine-types-v2'
import { logger } from '../../logger'

/**
 * Options for image optimization
 */
export interface ImageOptimizationOptions {
  /** Maximum width for images in pixels */
  maxWidth?: number
  /** JPEG quality (0-100) */
  quality?: number
  /** Maximum number of images to optimize */
  maxImages?: number
  /** Concurrency for fetching images */
  concurrency?: number
  /** Timeout for fetching each image */
  timeout?: number
  /** Request headers for internal fetches */
  headers?: Record<string, string>
}

/**
 * Optimize all images in a LayoutDocumentV2 by converting them to compressed base64 data URLs.
 * 
 * @param document - The V2 layout document to optimize
 * @param options - Optimization settings
 * @returns A new document with optimized images
 */
export async function optimizeLayoutDocumentImages(
  document: LayoutDocumentV2,
  options: ImageOptimizationOptions = {}
): Promise<LayoutDocumentV2> {
  const {
    maxWidth = 800,
    quality = 80,
    // Default to no cap. If a caller wants to protect a serverless runtime,
    // it must explicitly pass maxImages (e.g. 50) in that environment.
    maxImages = Number.POSITIVE_INFINITY,
    concurrency = 3,
    // Default per-image timeout. Serverless routes can override to a lower value.
    timeout = 60000,
    headers
  } = options

  // Deep clone the document to avoid side effects
  const optimizedDoc = JSON.parse(JSON.stringify(document)) as LayoutDocumentV2
  
  // Collect all image locations
  const imageTasks: Array<{
    type: 'ITEM' | 'LOGO'
    url: string
    update: (dataURL: string) => void
  }> = []

  optimizedDoc.pages.forEach(page => {
    page.tiles.forEach(tile => {
      // Handle item images
      if (tile.type === 'ITEM_CARD' || tile.type === 'ITEM_TEXT_ROW') {
        const content = tile.content as ItemContentV2
        if (content.imageUrl && content.showImage) {
          imageTasks.push({
            type: 'ITEM',
            url: content.imageUrl,
            update: (dataURL) => { content.imageUrl = dataURL }
          })
        }
      }
      
      // Handle logo images
      if (tile.type === 'LOGO') {
        const content = tile.content as LogoContentV2
        if (content.imageUrl) {
          imageTasks.push({
            type: 'LOGO',
            url: content.imageUrl,
            update: (dataURL) => { content.imageUrl = dataURL }
          })
        }
      }
    })
  })

  if (imageTasks.length === 0) {
    return optimizedDoc
  }

  // Limit number of images
  const tasksToProcess = imageTasks.slice(0, maxImages)
  if (imageTasks.length > maxImages) {
    logger.warn(`[ImageOptimizerV2] Too many images (${imageTasks.length}), limiting to ${maxImages}`)
  }

  logger.info(`[ImageOptimizerV2] Optimizing ${tasksToProcess.length} images...`)

  // Process in batches
  for (let i = 0; i < tasksToProcess.length; i += concurrency) {
    const batch = tasksToProcess.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async (task) => {
        try {
          // fetchImageAsDataURL handles compression internally using sharp
          // Pass preserveTransparency=true for logos
          const dataURL = await fetchImageAsDataURL(
            task.url, 
            headers, 
            timeout, 
            true, 
            task.type === 'LOGO'
          )
          if (dataURL) {
            task.update(dataURL)
          }
        } catch (error) {
          logger.error(`[ImageOptimizerV2] Failed to optimize image ${task.url}:`, error)
        }
      })
    )
  }

  return optimizedDoc
}
