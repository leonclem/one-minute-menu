// Image processing utilities for menu uploads

export interface ImageProcessingOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
  stripExif?: boolean
  autoRotate?: boolean
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
    format = 'jpeg'
  } = options

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    // Create object URL
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      try {
        let { width, height } = img

        // Calculate new dimensions maintaining aspect ratio
        const aspectRatio = width / height
        if (width > maxWidth) {
          width = maxWidth
          height = width / aspectRatio
        }
        if (height > maxHeight) {
          height = maxHeight
          width = height * aspectRatio
        }

        // Set canvas dimensions
        canvas.width = width
        canvas.height = height

        if (!ctx) {
          URL.revokeObjectURL(objectUrl)
          reject(new Error('Could not get canvas context'))
          return
        }

        // Draw image to canvas
        ctx.drawImage(img, 0, 0, width, height)

        // Get data URL for preview
        const dataUrl = canvas.toDataURL(`image/${format}`, quality)

        // Convert to blob for upload
        canvas.toBlob(
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
              width,
              height,
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

// Simplified image processing - EXIF rotation removed for now
// Can be added back in Phase 2 if needed

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
    format: 'jpeg'
  })
  
  return processed.dataUrl
}