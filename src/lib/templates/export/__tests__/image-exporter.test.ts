/**
 * Image Exporter Tests
 * 
 * Tests for PNG/JPG image export functionality including:
 * - Basic image generation
 * - PNG and JPG formats
 * - Custom dimensions
 * - Preset dimensions
 * - Performance validation
 * - Validation and error handling
 */

import {
  exportToImage,
  exportToImageWithPreset,
  validateImageExportOptions,
  getPresetDimensions,
  getOptimalFormat,
  calculateOptimalDimensions,
  createImageBlob,
  PRESET_DIMENSIONS,
  type ImageExportOptions
} from '../image-exporter'
import type { LayoutMenuData, LayoutPreset } from '../../types'
import { LAYOUT_PRESETS } from '../../presets'
import sharp from 'sharp'

// ============================================================================
// Test Data
// ============================================================================

const mockMenuData: LayoutMenuData = {
  metadata: {
    title: 'Test Restaurant Menu',
    currency: '$'
  },
  sections: [
    {
      name: 'Appetizers',
      items: [
        {
          name: 'Caesar Salad',
          price: 12.99,
          description: 'Fresh romaine lettuce with parmesan cheese and croutons',
          featured: false
        },
        {
          name: 'Garlic Bread',
          price: 6.99,
          description: 'Toasted bread with garlic butter',
          featured: false
        }
      ]
    },
    {
      name: 'Main Courses',
      items: [
        {
          name: 'Grilled Salmon',
          price: 24.99,
          description: 'Atlantic salmon with seasonal vegetables and lemon butter sauce',
          imageRef: 'https://example.com/salmon.jpg',
          featured: true
        },
        {
          name: 'Ribeye Steak',
          price: 32.99,
          description: '12oz ribeye with mashed potatoes and asparagus',
          imageRef: 'https://example.com/steak.jpg',
          featured: false
        }
      ]
    }
  ]
}

const mockPreset: LayoutPreset = LAYOUT_PRESETS['balanced']

// ============================================================================
// Basic Image Generation Tests
// ============================================================================

describe('exportToImage', () => {
  it('should generate valid PNG with default options', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'desktop')

    expect(result.imageBuffer).toBeInstanceOf(Buffer)
    expect(result.size).toBeGreaterThan(0)
    expect(result.width).toBeGreaterThan(0)
    expect(result.height).toBeGreaterThan(0)
    expect(result.format).toBe('png')
    expect(result.timestamp).toBeInstanceOf(Date)
    expect(result.duration).toBeGreaterThan(0)
  })

  it('should generate readable image', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'desktop')

    // Verify image is valid by loading with sharp
    const metadata = await sharp(result.imageBuffer).metadata()
    expect(metadata.width).toBe(result.width)
    expect(metadata.height).toBe(result.height)
    expect(metadata.format).toBe('png')
  })

  it('should generate image within 4 seconds', async () => {
    const startTime = Date.now()
    const result = await exportToImage(mockMenuData, mockPreset, 'desktop')
    const endTime = Date.now()

    const duration = endTime - startTime
    expect(duration).toBeLessThan(4000)
    expect(result.duration).toBeLessThan(4000)
  })

  it('should generate image with custom dimensions', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'desktop', {
      width: 800,
      height: 1200
    })

    expect(result.width).toBe(800)
    expect(result.height).toBe(1200)
  })
})

// ============================================================================
// Format Tests
// ============================================================================

describe('Image Formats', () => {
  it('should generate PNG image', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'desktop', {
      format: 'png'
    })

    expect(result.format).toBe('png')

    const metadata = await sharp(result.imageBuffer).metadata()
    expect(metadata.format).toBe('png')
  })

  it('should generate JPG image', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'desktop', {
      format: 'jpg'
    })

    expect(result.format).toBe('jpg')

    const metadata = await sharp(result.imageBuffer).metadata()
    expect(metadata.format).toBe('jpeg')
  })

  it('should apply quality setting for JPG', async () => {
    const highQuality = await exportToImage(mockMenuData, mockPreset, 'desktop', {
      format: 'jpg',
      quality: 95
    })

    const lowQuality = await exportToImage(mockMenuData, mockPreset, 'desktop', {
      format: 'jpg',
      quality: 50
    })

    // Higher quality should result in larger file size
    expect(highQuality.size).toBeGreaterThan(lowQuality.size)
  })
})

// ============================================================================
// Dimension Tests
// ============================================================================

describe('Custom Dimensions', () => {
  it('should respect custom width and height', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'desktop', {
      width: 1920,
      height: 1080
    })

    expect(result.width).toBe(1920)
    expect(result.height).toBe(1080)
  })

  it('should apply pixel ratio correctly', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'desktop', {
      width: 800,
      height: 600,
      pixelRatio: 2
    })

    // Dimensions should be doubled
    expect(result.width).toBe(1600)
    expect(result.height).toBe(1200)
  })

  it('should handle small dimensions', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'mobile', {
      width: 400,
      height: 600
    })

    expect(result.width).toBe(400)
    expect(result.height).toBe(600)
  })

  it('should handle large dimensions', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'desktop', {
      width: 3840,
      height: 2160
    })

    expect(result.width).toBe(3840)
    expect(result.height).toBe(2160)
  })
})

// ============================================================================
// Preset Dimensions Tests
// ============================================================================

describe('Preset Dimensions', () => {
  it('should export with Instagram square dimensions', async () => {
    const result = await exportToImageWithPreset(
      mockMenuData,
      mockPreset,
      'mobile',
      'instagramSquare'
    )

    expect(result.width).toBe(PRESET_DIMENSIONS.instagramSquare.width)
    expect(result.height).toBe(PRESET_DIMENSIONS.instagramSquare.height)
  })

  it('should export with Instagram portrait dimensions', async () => {
    const result = await exportToImageWithPreset(
      mockMenuData,
      mockPreset,
      'mobile',
      'instagramPortrait'
    )

    expect(result.width).toBe(PRESET_DIMENSIONS.instagramPortrait.width)
    expect(result.height).toBe(PRESET_DIMENSIONS.instagramPortrait.height)
  })

  it('should export with Facebook post dimensions', async () => {
    const result = await exportToImageWithPreset(
      mockMenuData,
      mockPreset,
      'desktop',
      'facebookPost'
    )

    expect(result.width).toBe(PRESET_DIMENSIONS.facebookPost.width)
    expect(result.height).toBe(PRESET_DIMENSIONS.facebookPost.height)
  })

  it('should export with A4 portrait dimensions', async () => {
    const result = await exportToImageWithPreset(
      mockMenuData,
      mockPreset,
      'print',
      'a4Portrait'
    )

    expect(result.width).toBe(PRESET_DIMENSIONS.a4Portrait.width)
    expect(result.height).toBe(PRESET_DIMENSIONS.a4Portrait.height)
  })

  it('should export with HD dimensions', async () => {
    const result = await exportToImageWithPreset(
      mockMenuData,
      mockPreset,
      'desktop',
      'hd'
    )

    expect(result.width).toBe(PRESET_DIMENSIONS.hd.width)
    expect(result.height).toBe(PRESET_DIMENSIONS.hd.height)
  })
})

// ============================================================================
// Background Color Tests
// ============================================================================

describe('Background Color', () => {
  it('should apply custom background color', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'desktop', {
      backgroundColor: '#f0f0f0'
    })

    expect(result.imageBuffer).toBeTruthy()
    expect(result.size).toBeGreaterThan(0)
  })

  it('should use white background by default', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'desktop')

    expect(result.imageBuffer).toBeTruthy()
    expect(result.size).toBeGreaterThan(0)
  })
})

// ============================================================================
// Validation Tests
// ============================================================================

describe('validateImageExportOptions', () => {
  it('should validate valid options', () => {
    const options: ImageExportOptions = {
      format: 'png',
      width: 1200,
      height: 1600,
      quality: 90,
      backgroundColor: '#ffffff',
      pixelRatio: 2
    }

    const validation = validateImageExportOptions(options)

    expect(validation.valid).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })

  it('should reject invalid format', () => {
    const options: any = {
      format: 'invalid'
    }

    const validation = validateImageExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
  })

  it('should reject width below minimum', () => {
    const options: ImageExportOptions = {
      width: 50
    }

    const validation = validateImageExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Width must be between 100 and 10000 pixels')
  })

  it('should reject width above maximum', () => {
    const options: ImageExportOptions = {
      width: 15000
    }

    const validation = validateImageExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Width must be between 100 and 10000 pixels')
  })

  it('should reject height below minimum', () => {
    const options: ImageExportOptions = {
      height: 50
    }

    const validation = validateImageExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Height must be between 100 and 10000 pixels')
  })

  it('should reject height above maximum', () => {
    const options: ImageExportOptions = {
      height: 15000
    }

    const validation = validateImageExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Height must be between 100 and 10000 pixels')
  })

  it('should reject invalid quality', () => {
    const options: ImageExportOptions = {
      quality: 150
    }

    const validation = validateImageExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Quality must be between 1 and 100')
  })

  it('should reject invalid pixel ratio', () => {
    const options: ImageExportOptions = {
      pixelRatio: 5
    }

    const validation = validateImageExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Pixel ratio must be between 1 and 4')
  })

  it('should reject invalid background color', () => {
    const options: ImageExportOptions = {
      backgroundColor: 'invalid-color'
    }

    const validation = validateImageExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Background color must be a valid hex color (e.g., #ffffff)')
  })

  it('should reject excessively large custom CSS', () => {
    const options: ImageExportOptions = {
      customCSS: 'a'.repeat(100001)
    }

    const validation = validateImageExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Custom CSS exceeds maximum size (100KB)')
  })
})

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('getPresetDimensions', () => {
    it('should return correct dimensions for Instagram square', () => {
      const dimensions = getPresetDimensions('instagramSquare')

      expect(dimensions.width).toBe(1080)
      expect(dimensions.height).toBe(1080)
    })

    it('should return correct dimensions for A4 portrait', () => {
      const dimensions = getPresetDimensions('a4Portrait')

      expect(dimensions.width).toBe(2480)
      expect(dimensions.height).toBe(3508)
    })
  })

  describe('createImageBlob', () => {
    it('should create PNG blob with correct type', async () => {
      const result = await exportToImage(mockMenuData, mockPreset, 'desktop', {
        format: 'png'
      })
      const blob = createImageBlob(result.imageBuffer, 'png')

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/png')
    })

    it('should create JPG blob with correct type', async () => {
      const result = await exportToImage(mockMenuData, mockPreset, 'desktop', {
        format: 'jpg'
      })
      const blob = createImageBlob(result.imageBuffer, 'jpg')

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/jpeg')
    })

    it('should create blob with correct size', async () => {
      const result = await exportToImage(mockMenuData, mockPreset, 'desktop')
      const blob = createImageBlob(result.imageBuffer, result.format)

      expect(blob.size).toBe(result.size)
    })
  })

  describe('getOptimalFormat', () => {
    it('should recommend JPG for image-heavy menus', () => {
      const imageHeavyMenu: LayoutMenuData = {
        metadata: { title: 'Test', currency: '$' },
        sections: [
          {
            name: 'Section',
            items: [
              { name: 'Item 1', price: 10, imageRef: 'https://example.com/1.jpg', featured: false },
              { name: 'Item 2', price: 10, imageRef: 'https://example.com/2.jpg', featured: false },
              { name: 'Item 3', price: 10, imageRef: 'https://example.com/3.jpg', featured: false }
            ]
          }
        ]
      }

      const format = getOptimalFormat(imageHeavyMenu, mockPreset)
      expect(format).toBe('jpg')
    })

    it('should recommend PNG for text-heavy menus', () => {
      const textHeavyMenu: LayoutMenuData = {
        metadata: { title: 'Test', currency: '$' },
        sections: [
          {
            name: 'Section',
            items: [
              { name: 'Item 1', price: 10, featured: false },
              { name: 'Item 2', price: 10, featured: false },
              { name: 'Item 3', price: 10, featured: false }
            ]
          }
        ]
      }

      const format = getOptimalFormat(textHeavyMenu, mockPreset)
      expect(format).toBe('png')
    })
  })

  describe('calculateOptimalDimensions', () => {
    it('should calculate dimensions for mobile context', () => {
      const dimensions = calculateOptimalDimensions(mockMenuData, mockPreset, 'mobile')

      expect(dimensions.width).toBe(640)
      expect(dimensions.height).toBeGreaterThan(0)
    })

    it('should calculate dimensions for desktop context', () => {
      const dimensions = calculateOptimalDimensions(mockMenuData, mockPreset, 'desktop')

      expect(dimensions.width).toBe(1920)
      expect(dimensions.height).toBeGreaterThan(0)
    })

    it('should calculate dimensions for print context', () => {
      const dimensions = calculateOptimalDimensions(mockMenuData, mockPreset, 'print')

      expect(dimensions.width).toBe(2480)
      expect(dimensions.height).toBeGreaterThan(0)
    })

    it('should scale height based on content', () => {
      const smallMenu: LayoutMenuData = {
        metadata: { title: 'Small', currency: '$' },
        sections: [
          {
            name: 'Section',
            items: [{ name: 'Item', price: 10, featured: false }]
          }
        ]
      }

      const largeMenu: LayoutMenuData = {
        metadata: { title: 'Large', currency: '$' },
        sections: Array.from({ length: 10 }, (_, i) => ({
          name: `Section ${i}`,
          items: Array.from({ length: 10 }, (_, j) => ({
            name: `Item ${j}`,
            price: 10,
            featured: false
          }))
        }))
      }

      const smallDimensions = calculateOptimalDimensions(smallMenu, mockPreset, 'desktop')
      const largeDimensions = calculateOptimalDimensions(largeMenu, mockPreset, 'desktop')

      expect(largeDimensions.height).toBeGreaterThan(smallDimensions.height)
    })
  })
})

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should handle large menus within time limit', async () => {
    // Create a menu with 100 items
    const largeMenu: LayoutMenuData = {
      metadata: {
        title: 'Large Menu',
        currency: '$'
      },
      sections: Array.from({ length: 10 }, (_, sectionIndex) => ({
        name: `Section ${sectionIndex + 1}`,
        items: Array.from({ length: 10 }, (_, itemIndex) => ({
          name: `Item ${itemIndex + 1}`,
          price: 10 + itemIndex,
          description: 'Test description for the menu item',
          featured: false
        }))
      }))
    }

    const startTime = Date.now()
    const result = await exportToImage(largeMenu, mockPreset, 'desktop')
    const endTime = Date.now()

    const duration = endTime - startTime
    expect(duration).toBeLessThan(4000) // Should complete within 4 seconds
    expect(result.imageBuffer).toBeTruthy()
  })

  it('should report accurate duration metrics', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'desktop')

    expect(result.duration).toBeGreaterThan(0)
    expect(result.duration).toBeLessThan(4000)
  })
})

// ============================================================================
// Different Presets Tests
// ============================================================================

describe('Different Presets', () => {
  it('should generate image with dense-catalog preset', async () => {
    const result = await exportToImage(mockMenuData, LAYOUT_PRESETS['dense-catalog'], 'desktop')

    expect(result.imageBuffer).toBeTruthy()
    expect(result.size).toBeGreaterThan(0)
  })

  it('should generate image with image-forward preset', async () => {
    const result = await exportToImage(mockMenuData, LAYOUT_PRESETS['image-forward'], 'desktop')

    expect(result.imageBuffer).toBeTruthy()
    expect(result.size).toBeGreaterThan(0)
  })

  it('should generate image with feature-band preset', async () => {
    const result = await exportToImage(mockMenuData, LAYOUT_PRESETS['feature-band'], 'desktop')

    expect(result.imageBuffer).toBeTruthy()
    expect(result.size).toBeGreaterThan(0)
  })

  it('should generate image with text-only preset', async () => {
    const result = await exportToImage(mockMenuData, LAYOUT_PRESETS['text-only'], 'desktop')

    expect(result.imageBuffer).toBeTruthy()
    expect(result.size).toBeGreaterThan(0)
  })
})

// ============================================================================
// Different Output Contexts Tests
// ============================================================================

describe('Output Contexts', () => {
  it('should generate image for mobile context', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'mobile')

    expect(result.imageBuffer).toBeTruthy()
    expect(result.size).toBeGreaterThan(0)
  })

  it('should generate image for tablet context', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'tablet')

    expect(result.imageBuffer).toBeTruthy()
    expect(result.size).toBeGreaterThan(0)
  })

  it('should generate image for desktop context', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'desktop')

    expect(result.imageBuffer).toBeTruthy()
    expect(result.size).toBeGreaterThan(0)
  })

  it('should generate image for print context', async () => {
    const result = await exportToImage(mockMenuData, mockPreset, 'print')

    expect(result.imageBuffer).toBeTruthy()
    expect(result.size).toBeGreaterThan(0)
  })
})

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  it('should throw error for invalid options', async () => {
    const invalidOptions: any = {
      format: 'invalid',
      width: -100
    }

    await expect(
      exportToImage(mockMenuData, mockPreset, 'desktop', invalidOptions)
    ).rejects.toThrow()
  })

  it('should handle validation errors gracefully', async () => {
    const invalidOptions: ImageExportOptions = {
      width: 50000
    }

    await expect(
      exportToImage(mockMenuData, mockPreset, 'desktop', invalidOptions)
    ).rejects.toThrow('Invalid image export options')
  })
})
