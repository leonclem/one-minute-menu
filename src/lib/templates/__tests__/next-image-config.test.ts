/**
 * Unit tests for Next.js Image Configuration utilities
 */

import {
  getResponsiveSizes,
  getDevicePixelRatio,
  shouldPrioritizeImage,
  getLoadingStrategy,
  getOptimalQuality,
  generateInlineBlurDataURL,
  getPreferredFormat,
  getImagesToPreload
} from '../next-image-config'
import type { OutputContext } from '../types'

describe('Next.js Image Configuration', () => {
  describe('getResponsiveSizes', () => {
    it('should return correct sizes for mobile context', () => {
      const sizes2Col = getResponsiveSizes('mobile', 2)
      const sizes3Col = getResponsiveSizes('mobile', 3)

      expect(sizes2Col).toContain('50vw')
      expect(sizes3Col).toContain('33vw')
    })

    it('should return correct sizes for tablet context', () => {
      const sizes3Col = getResponsiveSizes('tablet', 3)
      const sizes4Col = getResponsiveSizes('tablet', 4)

      expect(sizes3Col).toContain('33vw')
      expect(sizes4Col).toContain('25vw')
    })

    it('should return correct sizes for desktop context', () => {
      const sizes4Col = getResponsiveSizes('desktop', 4)
      const sizes5Col = getResponsiveSizes('desktop', 5)
      const sizes6Col = getResponsiveSizes('desktop', 6)

      expect(sizes4Col).toContain('25vw')
      expect(sizes5Col).toContain('20vw')
      expect(sizes6Col).toContain('16vw')
    })

    it('should return fixed size for print context', () => {
      const sizes = getResponsiveSizes('print', 4)

      expect(sizes).toBe('300px')
    })
  })

  describe('getDevicePixelRatio', () => {
    it('should return 2 for mobile', () => {
      expect(getDevicePixelRatio('mobile')).toBe(2)
    })

    it('should return 2 for tablet', () => {
      expect(getDevicePixelRatio('tablet')).toBe(2)
    })

    it('should return 1.5 for desktop', () => {
      expect(getDevicePixelRatio('desktop')).toBe(1.5)
    })

    it('should return 1 for print', () => {
      expect(getDevicePixelRatio('print')).toBe(1)
    })
  })

  describe('shouldPrioritizeImage', () => {
    it('should always prioritize featured items', () => {
      expect(shouldPrioritizeImage(true, 10, 'mobile')).toBe(true)
      expect(shouldPrioritizeImage(true, 20, 'desktop')).toBe(true)
    })

    it('should prioritize first few items on mobile', () => {
      expect(shouldPrioritizeImage(false, 0, 'mobile')).toBe(true)
      expect(shouldPrioritizeImage(false, 3, 'mobile')).toBe(true)
      expect(shouldPrioritizeImage(false, 4, 'mobile')).toBe(false)
    })

    it('should prioritize first few items on tablet', () => {
      expect(shouldPrioritizeImage(false, 0, 'tablet')).toBe(true)
      expect(shouldPrioritizeImage(false, 5, 'tablet')).toBe(true)
      expect(shouldPrioritizeImage(false, 6, 'tablet')).toBe(false)
    })

    it('should prioritize first few items on desktop', () => {
      expect(shouldPrioritizeImage(false, 0, 'desktop')).toBe(true)
      expect(shouldPrioritizeImage(false, 7, 'desktop')).toBe(true)
      expect(shouldPrioritizeImage(false, 8, 'desktop')).toBe(false)
    })

    it('should not prioritize any items for print', () => {
      expect(shouldPrioritizeImage(false, 0, 'print')).toBe(false)
      expect(shouldPrioritizeImage(true, 0, 'print')).toBe(true) // Except featured
    })
  })

  describe('getLoadingStrategy', () => {
    it('should return eager for priority images', () => {
      expect(getLoadingStrategy(true)).toBe('eager')
    })

    it('should return lazy for non-priority images', () => {
      expect(getLoadingStrategy(false)).toBe('lazy')
    })
  })

  describe('getOptimalQuality', () => {
    it('should return lower quality for mobile', () => {
      const webpQuality = getOptimalQuality('mobile', 'webp')
      const jpegQuality = getOptimalQuality('mobile', 'jpeg')

      expect(webpQuality).toBe(80) // 75 + 5 webp bonus
      expect(jpegQuality).toBe(75)
    })

    it('should return medium quality for tablet', () => {
      const webpQuality = getOptimalQuality('tablet', 'webp')
      const jpegQuality = getOptimalQuality('tablet', 'jpeg')

      expect(webpQuality).toBe(85) // 80 + 5 webp bonus
      expect(jpegQuality).toBe(80)
    })

    it('should return higher quality for desktop', () => {
      const webpQuality = getOptimalQuality('desktop', 'webp')
      const jpegQuality = getOptimalQuality('desktop', 'jpeg')

      expect(webpQuality).toBe(90) // 85 + 5 webp bonus
      expect(jpegQuality).toBe(85)
    })

    it('should return highest quality for print', () => {
      const quality = getOptimalQuality('print', 'webp')

      expect(quality).toBe(95)
    })
  })

  describe('generateInlineBlurDataURL', () => {
    it('should generate valid data URL', () => {
      const dataURL = generateInlineBlurDataURL()

      expect(dataURL).toMatch(/^data:image\/svg\+xml;base64,/)
    })

    it('should accept custom color', () => {
      const dataURL = generateInlineBlurDataURL('#ff0000')

      expect(dataURL).toMatch(/^data:image\/svg\+xml;base64,/)
      // Decode and check if color is included
      const base64 = dataURL.split(',')[1]
      const decoded = Buffer.from(base64, 'base64').toString()
      expect(decoded).toContain('#ff0000')
    })

    it('should use default color if not provided', () => {
      const dataURL = generateInlineBlurDataURL()

      const base64 = dataURL.split(',')[1]
      const decoded = Buffer.from(base64, 'base64').toString()
      expect(decoded).toContain('#e5e7eb')
    })
  })

  describe('getPreferredFormat', () => {
    it('should return webp or jpeg', () => {
      const format = getPreferredFormat()

      expect(['webp', 'jpeg']).toContain(format)
    })
  })

  describe('getImagesToPreload', () => {
    const images = [
      { src: '/img1.jpg', featured: false },
      { src: '/img2.jpg', featured: true },
      { src: '/img3.jpg', featured: false },
      { src: '/img4.jpg', featured: true },
      { src: '/img5.jpg', featured: false },
      { src: '/img6.jpg', featured: false }
    ]

    it('should prioritize featured images', () => {
      const toPreload = getImagesToPreload(images, 'desktop', 2)

      expect(toPreload).toHaveLength(2)
      expect(toPreload).toContain('/img2.jpg')
      expect(toPreload).toContain('/img4.jpg')
    })

    it('should respect maxPreload limit', () => {
      const toPreload = getImagesToPreload(images, 'desktop', 3)

      expect(toPreload).toHaveLength(3)
    })

    it('should include non-featured images if needed', () => {
      const toPreload = getImagesToPreload(images, 'desktop', 4)

      expect(toPreload).toHaveLength(4)
      // Should have both featured images
      expect(toPreload).toContain('/img2.jpg')
      expect(toPreload).toContain('/img4.jpg')
    })

    it('should handle empty array', () => {
      const toPreload = getImagesToPreload([], 'desktop', 4)

      expect(toPreload).toHaveLength(0)
    })
  })
})
