/**
 * Texture and Image Utilities for PDF Export
 * 
 * Handles conversion of texture images and menu item images to base64 for embedding in PDFs
 */

import fs from 'fs'
import path from 'path'
// Removed unused imports - now using fetch() API instead
import sharp from 'sharp'

/**
 * Convert texture image to base64 data URL
 * This allows the texture to be embedded in PDF exports where file:// URLs don't work
 * Uses a very short timeout (1s) since textures should fail fast and use CSS fallback
 */
export async function getTextureDataURL(textureName: string, headers?: Record<string, string>): Promise<string | null> {
  try {
    // Use a very short timeout for textures - they should be fast or fail to CSS fallback
    // Don't compress textures as they're already optimized and small
    return await fetchImageAsDataURL(`/textures/${textureName}`, headers, 1000, false)
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
export async function fetchImageAsDataURL(imageUrl: string, headers?: Record<string, string>, timeoutMs: number = 5000, compress: boolean = true): Promise<string | null> {
  try {
    // Case 1: Local file path (starts with /)
    if (imageUrl.startsWith('/')) {
      // Try FS first (works locally and if files are included in build)
      const imagePath = path.join(process.cwd(), 'public', imageUrl)
      if (fs.existsSync(imagePath)) {
        try {
          let imageBuffer: Buffer = fs.readFileSync(imagePath)
          const originalSize = imageBuffer.length
          
          // Compress image if requested
          if (compress) {
            try {
              const compressedBuffer = await compressImageBuffer(imageBuffer, 800, 80)
              imageBuffer = Buffer.from(compressedBuffer)
              console.log(`[TextureUtils] Compressed local image: ${imagePath} (${originalSize} -> ${imageBuffer.length} bytes, ${((1 - imageBuffer.length / originalSize) * 100).toFixed(1)}% reduction)`)
            } catch (error) {
              console.warn(`[TextureUtils] Compression failed for ${imagePath}, using original:`, error)
            }
          }
          
          const base64Image = imageBuffer.toString('base64')
          // Always use jpeg after compression
          const mimeType = compress ? 'image/jpeg' : (() => {
            const ext = path.extname(imagePath).toLowerCase()
            if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
            if (ext === '.webp') return 'image/webp'
            return 'image/png'
          })()
          
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
      // Construct absolute URL based on request headers or environment
      let baseUrl: string | undefined

      // Prefer deriving the base URL from incoming request headers when available.
      // This keeps behaviour consistent across environments without requiring config.
      const hostHeader = headers?.host || headers?.['x-forwarded-host']
      const protoHeader = headers?.['x-forwarded-proto']
      if (hostHeader) {
        const protocol = protoHeader || 'https'
        baseUrl = `${protocol}://${hostHeader}`
      }

      // Fall back to explicit app URL configuration if headers are not available.
      if (!baseUrl) {
        if (process.env.NEXT_PUBLIC_APP_URL) {
          baseUrl = process.env.NEXT_PUBLIC_APP_URL
        } else if (process.env.VERCEL_URL) {
          baseUrl = `https://${process.env.VERCEL_URL}`
        } else {
          baseUrl = 'http://localhost:3000'
        }
      }
      
      // Skip HTTP fallback for textures if we can't construct a valid URL
      // This prevents circular dependencies and timeouts in serverless environments
      if (!baseUrl || baseUrl === 'http://localhost:3000') {
        console.warn(`[TextureUtils] Cannot construct valid URL for ${imageUrl}, skipping HTTP fallback`)
        return null
      }
      
      const absoluteUrl = `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`
      console.log(`[TextureUtils] Fetching local image via HTTP: ${absoluteUrl}`)
      return await fetchRemoteImageAsDataURL(absoluteUrl, timeoutMs, headers, compress)
    }
    
    // Case 2: HTTP/HTTPS URLs
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // If it's an internal URL (our own app), add headers to bypass potential auth/middleware blocks
      const isInternal = imageUrl.includes(process.env.NEXT_PUBLIC_APP_URL || '') || 
                        imageUrl.includes(process.env.VERCEL_URL || '') ||
                        imageUrl.includes('localhost')
      
      if (isInternal) {
        console.log(`[TextureUtils] Fetching internal image with optimized settings: ${imageUrl}`)
        // Use the provided timeout for internal images
        return await fetchRemoteImageAsDataURL(imageUrl, timeoutMs, headers, compress)
      }
      
      return await fetchRemoteImageAsDataURL(imageUrl, timeoutMs, headers, compress)
    }
    
    console.warn(`[TextureUtils] Unsupported image URL format: ${imageUrl}`)
    return null
  } catch (error) {
    console.error(`[TextureUtils] Error fetching image ${imageUrl}:`, error)
    return null
  }
}

/**
 * Compress and resize image buffer for PDF embedding
 * Reduces file size dramatically while maintaining visual quality
 */
async function compressImageBuffer(buffer: Buffer, maxWidth: number = 800, quality: number = 80): Promise<Buffer> {
  try {
    const image = sharp(buffer as any)
    const metadata = await image.metadata()
    
    // Only resize if image is larger than maxWidth
    if (metadata.width && metadata.width > maxWidth) {
      const compressed = await image
        .resize(maxWidth, null, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer()
      return Buffer.from(compressed)
    }
    
    // Just compress without resizing
    const compressed = await image
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()
    return Buffer.from(compressed)
  } catch (error) {
    console.warn('[TextureUtils] Image compression failed, using original:', error)
    return buffer
  }
}

/**
 * Fetch remote image and convert to base64 with timeout
 * Uses fetch API for better SSL/TLS handling in serverless environments
 */
async function fetchRemoteImageAsDataURL(url: string, timeoutMs: number = 5000, headers?: Record<string, string>, compress: boolean = true, retryCount: number = 0): Promise<string | null> {
  const maxRetries = 2
  
  try {
    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    
    // Prepare fetch options with additional headers for better compatibility
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        ...(headers || {}),
        'User-Agent': 'Kiro-PDF-Exporter/1.0 (Node.js)',
        'Accept': 'image/*',
        'Cache-Control': 'no-cache',
        'Connection': 'close', // Prevent connection reuse issues in serverless
        'Accept-Encoding': 'identity' // Disable compression to avoid additional complexity
      },
      signal: controller.signal
    }
    
    if (retryCount === 0) {
      console.log(`[TextureUtils] Fetching image: ${url}`)
      // Log environment info for debugging
      if (process.env.VERCEL) {
        console.log(`[TextureUtils] Environment: Vercel (Node ${process.version})`)
      }
    } else {
      console.log(`[TextureUtils] Retrying image fetch (attempt ${retryCount + 1}): ${url}`)
    }
    
    // Use fetch API which handles SSL/TLS better in serverless environments
    const response = await fetch(url, fetchOptions)
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      console.warn(`[TextureUtils] Failed to fetch image: ${url} (status: ${response.status}, message: ${response.statusText})`)
      return null
    }
    
    const contentLength = response.headers.get('content-length')
    console.log(`[TextureUtils] Successfully fetched image: ${url} (${contentLength || 'unknown'} bytes)`)
    
    // Check content length limit
    const maxSize = 5 * 1024 * 1024 // 5MB limit
    if (contentLength && parseInt(contentLength) > maxSize) {
      console.warn(`[TextureUtils] Image too large: ${url} (${contentLength} bytes)`)
      return null
    }
    
    // Get image buffer
    const arrayBuffer = await response.arrayBuffer()
    let buffer = Buffer.from(arrayBuffer)
    const originalSize = buffer.length
    
    // Check actual size after download
    if (buffer.length > maxSize) {
      console.warn(`[TextureUtils] Image too large after download: ${url} (${buffer.length} bytes)`)
      return null
    }
    
    // Compress image if requested (for PDF embedding)
    if (compress) {
      try {
        const compressedBuffer = await compressImageBuffer(buffer, 800, 80)
        buffer = Buffer.from(compressedBuffer)
        console.log(`[TextureUtils] Compressed image: ${url} (${originalSize} -> ${buffer.length} bytes, ${((1 - buffer.length / originalSize) * 100).toFixed(1)}% reduction)`)
      } catch (error) {
        console.warn(`[TextureUtils] Compression failed for ${url}, using original:`, error)
      }
    }
    
    const base64Image = buffer.toString('base64')
    
    // Determine MIME type - always use jpeg after compression
    const contentType = response.headers.get('content-type')
    const mimeType = compress ? 'image/jpeg' : (contentType || 'image/png').split(';')[0].trim()
    
    console.log(`[TextureUtils] Converted image to base64: ${url} (${buffer.length} bytes, ${mimeType})`)
    return `data:${mimeType};base64,${base64Image}`
    
  } catch (error) {
    // Handle specific SSL/TLS errors with retry logic
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.warn(`[TextureUtils] Timeout fetching image: ${url}`)
      } else if (error.message.includes('EPROTO') || error.message.includes('SSL') || error.message.includes('TLS') || error.message.includes('handshake')) {
        console.error(`[TextureUtils] SSL/TLS error fetching image ${url} (attempt ${retryCount + 1}):`, error.message)
        
        // Retry with exponential backoff for SSL errors
        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
          console.log(`[TextureUtils] Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return fetchRemoteImageAsDataURL(url, timeoutMs, headers, compress, retryCount + 1)
        } else {
          console.error(`[TextureUtils] Max retries exceeded for SSL error on ${url}`)
        }
      } else {
        console.error(`[TextureUtils] Error fetching image ${url}:`, error)
      }
    } else {
      console.error(`[TextureUtils] Unknown error fetching image ${url}:`, error)
    }
    return null
  }
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
  const { concurrency = 3, timeout = 10000, maxImages = 20, headers } = options
  
  const convertedLayout = JSON.parse(JSON.stringify(layout)) // Deep clone
  
  // Collect all tiles with images
  const tilesWithImages: Array<{ tile: any; pageIndex: number; tileIndex: number }> = []
  
  convertedLayout.pages.forEach((page: any, pageIndex: number) => {
    page.tiles.forEach((tile: any, tileIndex: number) => {
      // Convert images for menu items
      if ((tile.type === 'ITEM' || tile.type === 'ITEM_TEXT_ONLY') && tile.imageUrl) {
        tilesWithImages.push({ tile, pageIndex, tileIndex })
      }
      // Convert logo images
      if (tile.type === 'LOGO' && tile.logoUrl) {
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
  
  let successCount = 0
  let failCount = 0
  let sslErrorCount = 0
  
  // Convert images in batches
  await processBatch(
    tilesWithImages,
    async ({ tile }) => {
      try {
        // Handle LOGO tiles with logoUrl
        if (tile.type === 'LOGO' && tile.logoUrl) {
          const dataURL = await fetchImageAsDataURL(tile.logoUrl, headers, timeout, true)
          if (dataURL) {
            tile.logoUrl = dataURL
            successCount++
          } else {
            console.warn(`[TextureUtils] Failed to convert logo for tile: ${tile.id}`)
            tile.logoUrl = null
            failCount++
          }
        }
        // Handle ITEM tiles with imageUrl
        else if (tile.imageUrl) {
          const dataURL = await fetchImageAsDataURL(tile.imageUrl, headers, timeout, true)
          if (dataURL) {
            tile.imageUrl = dataURL
            successCount++
          } else {
            console.warn(`[TextureUtils] Failed to convert image for tile: ${tile.name}`)
            tile.imageUrl = null
            failCount++
            
            // Check if this might be an SSL error by looking at recent logs
            // This is a heuristic - in a real implementation you'd want more sophisticated tracking
            if (failCount > tilesWithImages.length * 0.8) {
              sslErrorCount++
            }
          }
        }
      } catch (error) {
        console.error(`[TextureUtils] Error converting image for tile ${tile.name || tile.id}:`, error)
        if (tile.type === 'LOGO') {
          tile.logoUrl = null
        } else {
          tile.imageUrl = null
        }
        failCount++
      }
    },
    concurrency
  )
  
  console.log(`[TextureUtils] Image conversion complete: ${successCount} succeeded, ${failCount} failed`)
  
  // Log warning if high failure rate (likely SSL issues)
  if (failCount > 0 && successCount === 0 && tilesWithImages.length > 5) {
    console.warn(`[TextureUtils] High failure rate detected (${failCount}/${tilesWithImages.length}). This may indicate SSL/TLS connectivity issues in the serverless environment.`)
    console.warn(`[TextureUtils] Consider setting PDF_ENABLE_IMAGES=false to disable image conversion and use fallback icons.`)
  }
  
  return convertedLayout
}
