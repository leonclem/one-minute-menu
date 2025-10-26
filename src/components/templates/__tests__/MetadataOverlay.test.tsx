/**
 * MetadataOverlay Component Tests
 * 
 * Tests for metadata overlay rendering and contrast validation
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import MetadataOverlay from '../MetadataOverlay'
import { LAYOUT_PRESETS } from '@/lib/templates/presets'
import { contrastRatio } from '@/lib/color'

// Helper functions for testing
function calculateContrastRatio(color1: string, color2: string): number {
  try {
    // Validate hex colors before calculating
    const isValidHex = (hex: string) => /^#?[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(hex)
    if (!isValidHex(color1) || !isValidHex(color2)) {
      return 1
    }
    return contrastRatio(color1, color2)
  } catch {
    return 1
  }
}

function meetsWCAGAA(ratio: number, isLargeText: boolean): boolean {
  const threshold = isLargeText ? 3.0 : 4.5
  return ratio >= threshold
}

function meetsWCAGAAA(ratio: number, isLargeText: boolean): boolean {
  const threshold = isLargeText ? 4.5 : 7.0
  return ratio >= threshold
}

describe('MetadataOverlay', () => {
  const textSize = LAYOUT_PRESETS['balanced'].tileConfig.textSize

  describe('Rendering', () => {
    it('should render item name', () => {
      render(
        <MetadataOverlay
          name="Spring Rolls"
          price="$8.50"
          textSize={textSize}
        />
      )

      expect(screen.getByText('Spring Rolls')).toBeInTheDocument()
    })

    it('should render price', () => {
      render(
        <MetadataOverlay
          name="Spring Rolls"
          price="$8.50"
          textSize={textSize}
        />
      )

      expect(screen.getByText('$8.50')).toBeInTheDocument()
    })

    it('should render description when provided', () => {
      render(
        <MetadataOverlay
          name="Spring Rolls"
          price="$8.50"
          description="Crispy vegetable rolls"
          textSize={textSize}
        />
      )

      expect(screen.getByText('Crispy vegetable rolls')).toBeInTheDocument()
    })

    it('should not render description when not provided', () => {
      render(
        <MetadataOverlay
          name="Spring Rolls"
          price="$8.50"
          textSize={textSize}
        />
      )

      expect(screen.queryByText(/Crispy/)).not.toBeInTheDocument()
    })
  })

  describe('Text Sizing', () => {
    it('should apply correct text size classes', () => {
      const { container } = render(
        <MetadataOverlay
          name="Spring Rolls"
          price="$8.50"
          textSize={textSize}
        />
      )

      const nameElement = screen.getByText('Spring Rolls')
      expect(nameElement).toHaveClass(textSize.name)

      const priceElement = screen.getByText('$8.50')
      expect(priceElement).toHaveClass(textSize.price)
    })
  })

  describe('Theme Colors', () => {
    it('should apply custom text color', () => {
      const themeColors = {
        text: '#ff0000'
      }

      render(
        <MetadataOverlay
          name="Spring Rolls"
          price="$8.50"
          textSize={textSize}
          themeColors={themeColors}
        />
      )

      const nameElement = screen.getByText('Spring Rolls')
      expect(nameElement).toHaveStyle({ color: '#ff0000' })
    })

    it('should use default white text color when no theme provided', () => {
      render(
        <MetadataOverlay
          name="Spring Rolls"
          price="$8.50"
          textSize={textSize}
        />
      )

      const nameElement = screen.getByText('Spring Rolls')
      expect(nameElement).toHaveStyle({ color: '#ffffff' })
    })
  })

  describe('Gradient Background', () => {
    it('should have gradient background for legibility', () => {
      const { container } = render(
        <MetadataOverlay
          name="Spring Rolls"
          price="$8.50"
          textSize={textSize}
        />
      )

      const overlayDiv = container.querySelector('.absolute')
      expect(overlayDiv).toHaveStyle({
        background: expect.stringContaining('linear-gradient')
      })
    })
  })
})

describe('Contrast Ratio Calculations', () => {
  describe('calculateContrastRatio', () => {
    it('should calculate correct contrast ratio for black on white', () => {
      const ratio = calculateContrastRatio('#000000', '#ffffff')
      expect(ratio).toBeCloseTo(21, 0)
    })

    it('should calculate correct contrast ratio for white on black', () => {
      const ratio = calculateContrastRatio('#ffffff', '#000000')
      expect(ratio).toBeCloseTo(21, 0)
    })

    it('should calculate correct contrast ratio for same colors', () => {
      const ratio = calculateContrastRatio('#ffffff', '#ffffff')
      expect(ratio).toBe(1)
    })

    it('should handle invalid hex colors', () => {
      const ratio = calculateContrastRatio('invalid', '#ffffff')
      expect(ratio).toBe(1)
    })
  })

  describe('meetsWCAGAA', () => {
    it('should pass for high contrast normal text', () => {
      const ratio = calculateContrastRatio('#000000', '#ffffff')
      expect(meetsWCAGAA(ratio, false)).toBe(true)
    })

    it('should pass for medium contrast large text', () => {
      const ratio = 3.5
      expect(meetsWCAGAA(ratio, true)).toBe(true)
    })

    it('should fail for low contrast normal text', () => {
      const ratio = 3.0
      expect(meetsWCAGAA(ratio, false)).toBe(false)
    })

    it('should fail for low contrast large text', () => {
      const ratio = 2.5
      expect(meetsWCAGAA(ratio, true)).toBe(false)
    })
  })

  describe('meetsWCAGAAA', () => {
    it('should pass for very high contrast normal text', () => {
      const ratio = calculateContrastRatio('#000000', '#ffffff')
      expect(meetsWCAGAAA(ratio, false)).toBe(true)
    })

    it('should pass for high contrast large text', () => {
      const ratio = 5.0
      expect(meetsWCAGAAA(ratio, true)).toBe(true)
    })

    it('should fail for medium contrast normal text', () => {
      const ratio = 5.0
      expect(meetsWCAGAAA(ratio, false)).toBe(false)
    })

    it('should fail for low contrast large text', () => {
      const ratio = 3.0
      expect(meetsWCAGAAA(ratio, true)).toBe(false)
    })
  })
})
