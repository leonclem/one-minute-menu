// Image processing utilities for menu uploads
import exifr from 'exifr'

export interface ImageProcessingOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
  stripExif?: boolean
  autoRotate?: boolean
  autoDeskew?: boolean
  autoCrop?: boolean
}

export interface ProcessedImage {
  file: File
  dataUrl: string
  width: number
  height: number
  size: number
}

// Validate image file
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only JPEG and PNG images are allowed' }
  }

  // Check file size (8MB max)
  const maxSize = 8 * 1024 * 1024 // 8MB
  if (file.size > maxSize) {
    return { valid: false, error: 'Image must be smaller than 8MB' }
  }

  return { valid: true }
}

// Compress and process image
export async function processImage(
  file: File, 
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage> {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 0.8,
    format = 'jpeg',
    autoRotate = false,
    // Note: stripExif is achieved automatically by canvas re-encode
    // because metadata is not preserved when drawing to canvas
    stripExif = true,
    autoDeskew = false,
    autoCrop = false
  } = options

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    // Create object URL
    const objectUrl = URL.createObjectURL(file)

    img.onload = async () => {
      try {
        // Determine EXIF orientation if requested
        let orientation = 1
        if (autoRotate) {
          try {
            const exif = await exifr.parse(file as any, { pick: ['Orientation'] })
            const o = exif?.Orientation
            orientation = typeof o === 'number' ? o : 1
          } catch {
            orientation = 1
          }
        }

        const naturalWidth = img.width
        const naturalHeight = img.height

        const rotated = isOrientationRotated(orientation)

        // Effective dimensions before scaling (account for rotation swap)
        const effWidth = rotated ? naturalHeight : naturalWidth
        const effHeight = rotated ? naturalWidth : naturalHeight

        // Compute scale factor to fit bounds while preserving aspect
        const scale = Math.min(
          1,
          maxWidth / effWidth,
          maxHeight / effHeight
        )

        const drawWidth = Math.round(naturalWidth * scale)
        const drawHeight = Math.round(naturalHeight * scale)

        if (!ctx) {
          URL.revokeObjectURL(objectUrl)
          reject(new Error('Could not get canvas context'))
          return
        }

        // Set canvas size based on orientation
        canvas.width = rotated ? drawHeight : drawWidth
        canvas.height = rotated ? drawWidth : drawHeight
        applyExifOrientationTransform(ctx!, orientation, drawWidth, drawHeight)
        ctx!.drawImage(img, 0, 0, drawWidth, drawHeight)

        // Optional: deskew and crop on the oriented image
        let workCanvas: HTMLCanvasElement = canvas
        if (autoDeskew) {
          const angle = estimateDeskewAngle(workCanvas)
          // Only apply small corrections (avoid wild rotations)
          if (Math.abs(angle) > (0.5 * Math.PI) / 180) { // > 0.5°
            workCanvas = rotateCanvas(workCanvas, angle)
          }
        }
        if (autoCrop) {
          workCanvas = autoCropCanvas(workCanvas)
        }

        // Get data URL for preview (EXIF stripped by re-encode)
        const dataUrl = workCanvas.toDataURL(`image/${format}`, quality)

        // Convert to blob for upload
        workCanvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl) // Clean up
            
            if (!blob) {
              reject(new Error('Failed to process image'))
              return
            }

            const processedFile = new File([blob], file.name, {
              type: `image/${format}`,
              lastModified: Date.now()
            })

            resolve({
              file: processedFile,
              dataUrl,
              width: workCanvas.width,
              height: workCanvas.height,
              size: blob.size
            })
          },
          `image/${format}`,
          quality
        )
      } catch (error) {
        URL.revokeObjectURL(objectUrl)
        reject(error)
      }
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    
    img.src = objectUrl
  })
}

// EXIF helpers
export function isOrientationRotated(orientation: number): boolean {
  return orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8
}

export function applyExifOrientationTransform(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number
): void {
  switch (orientation) {
    case 2: // Horizontal flip
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
      break
    case 3: // 180° rotate
      ctx.translate(width, height)
      ctx.rotate(Math.PI)
      break
    case 4: // Vertical flip
      ctx.translate(0, height)
      ctx.scale(1, -1)
      break
    case 5: // Vertical flip + 90° right (transpose)
      // Canvas dimensions swapped by caller
      ctx.rotate(0.5 * Math.PI)
      ctx.scale(1, -1)
      break
    case 6: // 90° right
      // Canvas dimensions swapped by caller
      ctx.rotate(0.5 * Math.PI)
      ctx.translate(0, -height)
      break
    case 7: // Horizontal flip + 90° right (transverse)
      // Canvas dimensions swapped by caller
      ctx.rotate(0.5 * Math.PI)
      ctx.translate(width, -height)
      ctx.scale(-1, 1)
      break
    case 8: // 90° left
      // Canvas dimensions swapped by caller
      ctx.rotate(-0.5 * Math.PI)
      ctx.translate(-width, 0)
      break
    default:
      // 1: no-op
      break
  }
}

// Estimate skew angle using a simple high-contrast edge projection approach.
// This is intentionally lightweight for client-side; it looks for dominant
// near-horizontal text/edges and returns a small correction angle in radians.
function estimateDeskewAngle(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  // Downsample aggressively for speed
  const step = Math.max(1, Math.floor(Math.min(width, height) / 256))

  // Compute a simple gradient along x for horizontal edge strength
  // For small angles around 0, the horizontal projection will tilt; we
  // evaluate a few candidate angles and pick the max response.
  const candidateDeg = [-2, -1, -0.5, 0, 0.5, 1, 2]
  let bestAngle = 0
  let bestScore = -Infinity

  for (const deg of candidateDeg) {
    const theta = (deg * Math.PI) / 180
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    let score = 0

    // Sample along scanlines after a virtual rotation transform
    for (let y = 0; y < height; y += step) {
      let prevLuma = 0
      for (let x = 0; x < width; x += step) {
        // Map (x,y) back by -theta (approximate rotation sampling)
        const xr = Math.round(cos * x + sin * y)
        const yr = Math.round(-sin * x + cos * y)
        if (xr < 0 || xr >= width || yr < 0 || yr >= height) continue
        const idx = (yr * width + xr) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]
        const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0
        if (x > 0) {
          score += Math.abs(luma - prevLuma)
        }
        prevLuma = luma
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestAngle = theta
    }
  }
  return bestAngle
}

// Rotate an entire canvas by angle (radians), expanding bounds to fit
function rotateCanvas(src: HTMLCanvasElement, angleRad: number): HTMLCanvasElement {
  const s = Math.sin(angleRad)
  const c = Math.cos(angleRad)
  const w = src.width
  const h = src.height
  const newW = Math.ceil(Math.abs(w * c) + Math.abs(h * s))
  const newH = Math.ceil(Math.abs(w * s) + Math.abs(h * c))
  const dst = document.createElement('canvas')
  dst.width = newW
  dst.height = newH
  const ctx = dst.getContext('2d')!
  ctx.translate(newW / 2, newH / 2)
  ctx.rotate(angleRad)
  ctx.drawImage(src, -w / 2, -h / 2)
  return dst
}

// Auto-crop transparent/near-white borders to focus content
function autoCropCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext('2d')
  if (!ctx) return src
  const { width, height } = src
  const img = ctx.getImageData(0, 0, width, height)
  const data = img.data

  const isBackground = (idx: number) => {
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    const a = data[idx + 3]
    // Treat near-white or transparent as background
    return a < 10 || (r > 245 && g > 245 && b > 245)
  }

  let top = 0, bottom = height - 1, left = 0, right = width - 1

  // Scan from each edge inward until non-background
  scanTop: for (; top < height; top++) {
    for (let x = 0; x < width; x++) {
      const idx = (top * width + x) * 4
      if (!isBackground(idx)) break scanTop
    }
  }

  scanBottom: for (; bottom >= top; bottom--) {
    for (let x = 0; x < width; x++) {
      const idx = (bottom * width + x) * 4
      if (!isBackground(idx)) break scanBottom
    }
  }

  scanLeft: for (; left < width; left++) {
    for (let y = top; y <= bottom; y++) {
      const idx = (y * width + left) * 4
      if (!isBackground(idx)) break scanLeft
    }
  }

  scanRight: for (; right >= left; right--) {
    for (let y = top; y <= bottom; y++) {
      const idx = (y * width + right) * 4
      if (!isBackground(idx)) break scanRight
    }
  }

  // If crop bounds are degenerate, return original
  if (right - left < 10 || bottom - top < 10) return src

  const dst = document.createElement('canvas')
  dst.width = right - left + 1
  dst.height = bottom - top + 1
  const dctx = dst.getContext('2d')!
  dctx.drawImage(src, left, top, dst.width, dst.height, 0, 0, dst.width, dst.height)
  return dst
}

// Generate unique filename
export function generateImageFilename(userId: string, originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg'
  
  return `${userId}/${timestamp}-${random}.${extension}`
}

// Create image thumbnail
export async function createThumbnail(
  file: File, 
  size: number = 200
): Promise<string> {
  const processed = await processImage(file, {
    maxWidth: size,
    maxHeight: size,
    quality: 0.7,
    format: 'jpeg',
    autoRotate: true,
    stripExif: true
  })
  
  return processed.dataUrl
}

// Manual fallback: rotate image by 90-degree steps (client-side), stripping EXIF
export async function rotateImageQuarterTurns(
  file: File,
  quarterTurns: number
): Promise<ProcessedImage> {
  const turns = ((quarterTurns % 4) + 4) % 4
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      try {
        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error('Could not get canvas context'))
          return
        }

        const w = img.width
        const h = img.height

        if (turns % 2 === 0) {
          canvas.width = w
          canvas.height = h
        } else {
          canvas.width = h
          canvas.height = w
        }

        switch (turns) {
          case 0:
            // no-op
            break
          case 1: // 90° right
            ctx.rotate(0.5 * Math.PI)
            ctx.translate(0, -h)
            break
          case 2: // 180°
            ctx.translate(w, h)
            ctx.rotate(Math.PI)
            break
          case 3: // 90° left
            ctx.rotate(-0.5 * Math.PI)
            ctx.translate(-w, 0)
            break
        }

        ctx.drawImage(img, 0, 0)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url)
            if (!blob) {
              reject(new Error('Failed to rotate image'))
              return
            }
            const rotated = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            resolve({
              file: rotated,
              dataUrl,
              width: canvas.width,
              height: canvas.height,
              size: blob.size,
            })
          },
          'image/jpeg',
          0.9
        )
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for rotation'))
    }

    img.src = url
  })
}

// Read EXIF Orientation (1-8). Returns 1 if missing/unreadable.
export async function getExifOrientation(file: File): Promise<number> {
  try {
    const exif = await exifr.parse(file as any, { pick: ['Orientation'] })
    const o = exif?.Orientation
    return typeof o === 'number' ? o : 1
  } catch {
    return 1
  }
}