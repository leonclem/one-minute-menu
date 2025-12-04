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
export async function getTextureDataURL(textureName: string, headers?: Record<string, string>): Promise<string | null> {
  try {
    return await fetchImageAsDataURL(`/textures/${textureName}`, headers)
  } catch (error) {
    console.error(`[TextureUtils] Error loading texture ${textureName}:`, error)
    return null
  }
}

/**
 * Get CSS background for elegant dark template
 * Uses base64-encoded texture for PDF export compatibility
 */
export async function getElegantDarkBackground(headers?: Record<string, string>): Promise<string> {
  const textureDataURL = await getTextureDataURL('dark-paper.png', headers)
  
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
export async function fetchImageAsDataURL(imageUrl: string, headers?: Record<string, string>): Promise<string | null> {
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
          // Handle webp and other formats
          let mimeType = 'image/png'
          if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
          else if (ext === '.webp') mimeType = 'image/webp'
          
          return `data:${mimeType};base64,${base64Image}`
        } catch (e) {
          console.warn(`[TextureUtils] Failed to read local file ${imagePath}, trying fallback...`)
        }
      } else {
        // Debug logging for Vercel file system
        if (process.env.NODE_ENV === 'production') {
          console.warn(`[TextureUtils] File not found at ${imagePath}. CWD: ${process.cwd()}`)
          // Uncomment to inspect directory structure in logs if needed
          // try {
          //   console.log('[TextureUtils] CWD contents:', fs.readdirSync(process.cwd()).slice(0, 10))
          // } catch (e) {}
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
      return await fetchRemoteImageAsDataURL(absoluteUrl, 3000, headers)
    }
    
    // Case 2: HTTP/HTTPS URLs
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // If it's an internal URL (our own app), add headers to bypass potential auth/middleware blocks
      const isInternal = imageUrl.includes(process.env.NEXT_PUBLIC_APP_URL || '') || 
                        imageUrl.includes(process.env.VERCEL_URL || '') ||
                        imageUrl.includes('localhost')
      
      if (isInternal) {
        console.log(`[TextureUtils] Fetching internal image with optimized settings: ${imageUrl}`)
        // Use shorter timeout for internal images to fail fast
        return await fetchRemoteImageAsDataURL(imageUrl, 3000, headers)
      }
      
      return await fetchRemoteImageAsDataURL(imageUrl, 5000, headers)
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
async function fetchRemoteImageAsDataURL(url: string, timeoutMs: number = 5000, headers?: Record<string, string>): Promise<string | null> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https://') ? https : http
    const urlObj = new URL(url)
    
    const options = {
      method: 'GET',
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      headers: {
        ...(headers || {}),
        'User-Agent': 'Kiro-PDF-Exporter/1.0 (Node.js)'
      }
    }

    // Set timeout
    const timeout = setTimeout(() => {
      console.warn(`[TextureUtils] Timeout fetching image: ${url}`)
      resolve(null)
    }, timeoutMs)
    
    const request = protocol.request(options, (response) => {
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
    
    request.end()
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
    headers?: Record<string, string>
  } = {}
): Promise<any> {
  const { concurrency = 3, timeout = 5000, maxImages = 20, headers } = options
  
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
        const dataURL = await fetchImageAsDataURL(tile.imageUrl, headers)
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
