/**
 * Texture and Image Utilities for PDF Export
 * 
 * Handles conversion of texture images and menu item images to base64 for embedding in PDFs
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

/**
 * Convert texture image to base64 data URL
 * This allows the texture to be embedded in PDF exports where file:// URLs don't work
 */
export function getTextureDataURL(textureName: string): string | null {
  try {
    const texturePath = path.join(process.cwd(), 'public', 'textures', textureName)
    
    // Check if file exists
    if (!fs.existsSync(texturePath)) {
      console.warn(`[TextureUtils] Texture not found: ${texturePath}`)
      return null
    }
    
    // Read file and convert to base64
    const imageBuffer = fs.readFileSync(texturePath)
    const base64Image = imageBuffer.toString('base64')
    
    // Determine MIME type from extension
    const ext = path.extname(textureName).toLowerCase()
    const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    
    return `data:${mimeType};base64,${base64Image}`
  } catch (error) {
    console.error(`[TextureUtils] Error loading texture ${textureName}:`, error)
    return null
  }
}

/**
 * Get CSS background for elegant dark template
 * Uses base64-encoded texture for PDF export compatibility
 */
export function getElegantDarkBackground(): string {
  const textureDataURL = getTextureDataURL('dark-paper.png')
  
  if (textureDataURL) {
    return `
      background-color: #0b0d11;
      background-image: url('${textureDataURL}');
      background-size: cover;
      background-repeat: no-repeat;
      background-position: center;
    `
  }
  
  // Fallback to CSS-generated texture if image not available
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

/**
 * Fetch image from URL and convert to base64 data URL
 * Supports both HTTP/HTTPS URLs and local file paths (via FS or HTTP fallback)
 */
export async function fetchImageAsDataURL(imageUrl: string): Promise<string | null> {
  try {
    // Case 1: Local file path (starts with /)
    if (imageUrl.startsWith('/')) {
      // Try FS first (works locally and if files are included in build)
      const imagePath = path.join(process.cwd(), 'public', imageUrl)
      if (fs.existsSync(imagePath)) {
        try {
          const imageBuffer = fs.readFileSync(imagePath)
          const base64Image = imageBuffer.toString('base64')
          const ext = path.extname(imagePath).toLowerCase()
          const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
          return `data:${mimeType};base64,${base64Image}`
        } catch (e) {
          console.warn(`[TextureUtils] Failed to read local file ${imagePath}, trying fallback...`)
        }
      }
      
      // Fallback: Try to fetch via HTTP (essential for Vercel where public files aren't always in FS)
      // Construct absolute URL
      let baseUrl = 'http://localhost:3000'
      if (process.env.NEXT_PUBLIC_APP_URL) {
        baseUrl = process.env.NEXT_PUBLIC_APP_URL
      } else if (process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`
      }
      
      const absoluteUrl = `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`
      console.log(`[TextureUtils] Fetching local image via HTTP: ${absoluteUrl}`)
      return await fetchRemoteImageAsDataURL(absoluteUrl)
    }
    
    // Case 2: HTTP/HTTPS URLs
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return await fetchRemoteImageAsDataURL(imageUrl)
    }
    
    console.warn(`[TextureUtils] Unsupported image URL format: ${imageUrl}`)
    return null
  } catch (error) {
    console.error(`[TextureUtils] Error fetching image ${imageUrl}:`, error)
    return null
  }
}

/**
 * Fetch remote image and convert to base64 with timeout
 */
async function fetchRemoteImageAsDataURL(url: string, timeoutMs: number = 5000): Promise<string | null> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https://') ? https : http
    
    // Set timeout
    const timeout = setTimeout(() => {
      console.warn(`[TextureUtils] Timeout fetching image: ${url}`)
      resolve(null)
    }, timeoutMs)
    
    const request = protocol.get(url, (response) => {
      clearTimeout(timeout)
      
      if (response.statusCode !== 200) {
        console.warn(`[TextureUtils] Failed to fetch image: ${url} (status: ${response.statusCode})`)
        resolve(null)
        return
      }
      
      const chunks: Buffer[] = []
      let totalSize = 0
      const maxSize = 5 * 1024 * 1024 // 5MB limit
      
      response.on('data', (chunk) => {
        totalSize += chunk.length
        if (totalSize > maxSize) {
          console.warn(`[TextureUtils] Image too large: ${url} (${totalSize} bytes)`)
          response.destroy()
          resolve(null)
          return
        }
        chunks.push(chunk)
      })
      
      response.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const base64Image = buffer.toString('base64')
        
        // Determine MIME type from content-type header or URL extension
        const contentType = response.headers['content-type'] || 'image/png'
        const mimeType = contentType.split(';')[0].trim()
        
        resolve(`data:${mimeType};base64,${base64Image}`)
      })
      
      response.on('error', (error) => {
        clearTimeout(timeout)
        console.error(`[TextureUtils] Error downloading image ${url}:`, error)
        resolve(null)
      })
    })
    
    request.on('error', (error) => {
      clearTimeout(timeout)
      console.error(`[TextureUtils] Error fetching image ${url}:`, error)
      resolve(null)
    })
    
    request.setTimeout(timeoutMs, () => {
      request.destroy()
      console.warn(`[TextureUtils] Request timeout for image: ${url}`)
      resolve(null)
    })
  })
}

/**
 * Process items in batches with concurrency limit
 */
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 3
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)
  }
  
  return results
}

/**
 * Convert all image URLs in a layout to base64 data URLs
 * This ensures images display correctly in PDF exports
 * 
 * @param layout - The layout instance with image URLs
 * @param options - Conversion options
 * @returns Layout with images converted to base64
 */
export async function convertLayoutImagesToDataURLs(
  layout: any,
  options: {
    concurrency?: number
    timeout?: number
    maxImages?: number
  } = {}
): Promise<any> {
  const { concurrency = 3, timeout = 5000, maxImages = 20 } = options
  
  const convertedLayout = JSON.parse(JSON.stringify(layout)) // Deep clone
  
  // Collect all tiles with images
  const tilesWithImages: Array<{ tile: any; pageIndex: number; tileIndex: number }> = []
  
  convertedLayout.pages.forEach((page: any, pageIndex: number) => {
    page.tiles.forEach((tile: any, tileIndex: number) => {
      if ((tile.type === 'ITEM' || tile.type === 'ITEM_TEXT_ONLY') && tile.imageUrl) {
        tilesWithImages.push({ tile, pageIndex, tileIndex })
      }
    })
  })
  
  // Limit number of images to convert
  if (tilesWithImages.length > maxImages) {
    console.warn(`[TextureUtils] Too many images (${tilesWithImages.length}), limiting to ${maxImages}`)
    tilesWithImages.splice(maxImages)
  }
  
  console.log(`[TextureUtils] Converting ${tilesWithImages.length} images with concurrency ${concurrency}`)
  
  // Convert images in batches
  await processBatch(
    tilesWithImages,
    async ({ tile }) => {
      try {
        const dataURL = await fetchImageAsDataURL(tile.imageUrl)
        if (dataURL) {
          tile.imageUrl = dataURL
        } else {
          console.warn(`[TextureUtils] Failed to convert image for tile: ${tile.name}`)
          tile.imageUrl = null
        }
      } catch (error) {
        console.error(`[TextureUtils] Error converting image for tile ${tile.name}:`, error)
        tile.imageUrl = null
      }
    },
    concurrency
  )
  
  return convertedLayout
}
