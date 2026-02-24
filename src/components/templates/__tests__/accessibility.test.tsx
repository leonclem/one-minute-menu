/**
 * Accessibility Tests for Template System
 * 
 * Comprehensive accessibility testing using axe-core and jest-axe
 * Tests contrast ratios, keyboard navigation, screen reader compatibility,
 * and semantic HTML validation.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import userEvent from '@testing-library/user-event'
import GridMenuLayout from '../GridMenuLayout'
import MenuTile from '../MenuTile'
import MetadataOverlay from '../MetadataOverlay'
import TextOnlyLayout from '../TextOnlyLayout'
import type { LayoutMenuData, LayoutItem } from '@/lib/templates/types'
import { LAYOUT_PRESETS } from '@/lib/templates/presets'
import {
  validateLayoutContrast,
  validateOverlayContrast,
  validateFallbackContrast,
  meetsWCAGAA,
  batchValidateContrast
} from '@/lib/templates/contrast-validator'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { fill, priority, sizes, ...restProps } = props
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...restProps} />
  }
}))

// ============================================================================
// Test Data
// ============================================================================

const mockMenuData: LayoutMenuData = {
  metadata: {
    title: 'Test Restaurant Menu',
    currency: 'USD'
  },
  sections: [
    {
      name: 'Appetizers',
      items: [
        {
          name: 'Spring Rolls',
          price: 8.5,
          description: 'Crispy vegetable rolls',
          imageRef: 'https://example.com/spring-rolls.jpg',
          featured: false
        },
        {
          name: 'Garlic Bread',
          price: 6.0,
          description: 'Fresh baked bread',
          featured: false
        }
      ]
    },
    {
      name: 'Main Courses',
      items: [
        {
          name: 'Pasta Carbonara',
          price: 15.5,
          description: 'Creamy pasta with bacon',
          imageRef: 'https://example.com/pasta.jpg',
          featured: true
        }
      ]
    }
  ]
}

const mockItemWithImage: LayoutItem = {
  name: 'Spring Rolls',
  price: 8.5,
  description: 'Crispy vegetable rolls',
  imageRef: 'https://example.com/spring-rolls.jpg',
  featured: false
}

const mockItemWithoutImage: LayoutItem = {
  name: 'Garlic Bread',
  price: 6.0,
  description: 'Fresh baked bread',
  featured: false
}

// ============================================================================
// Automated Accessibility Tests with axe-core
// ============================================================================

describe('Accessibility - Automated axe-core Tests', () => {
  // axe-core can be slow on complex layouts; avoid timeout and "Axe is already running" cascades
  jest.setTimeout(15000)

  describe('GridMenuLayout', () => {
    it('should have no accessibility violations with balanced preset', async () => {
      const { container } = render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with dense catalog preset', async () => {
      const { container } = render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['dense-catalog']}
          context="mobile"
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with image forward preset', async () => {
      const { container } = render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['image-forward']}
          context="tablet"
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with feature band preset', async () => {
      const { container } = render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['feature-band']}
          context="desktop"
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('MenuTile', () => {
    it('should have no accessibility violations with image', async () => {
      const { container } = render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations without image', async () => {
      const { container } = render(
        <MenuTile
          item={mockItemWithoutImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('MetadataOverlay', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <MetadataOverlay
          name="Spring Rolls"
          price="$8.50"
          description="Crispy vegetable rolls"
          textSize={LAYOUT_PRESETS['balanced'].tileConfig.textSize}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('TextOnlyLayout', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <TextOnlyLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['text-only']}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})

// ============================================================================
// Contrast Ratio Tests
// ============================================================================

describe('Accessibility - Contrast Ratios (WCAG AA)', () => {
  describe('Automated Contrast Validation', () => {
    it('should validate all color combinations for balanced preset', () => {
      const report = validateLayoutContrast(LAYOUT_PRESETS['balanced'])
      
      expect(report.overlayContrast.isValid).toBe(true)
      expect(report.fallbackContrast.isValid).toBe(true)
      // Filler contrast may have warnings but should still be validated
      expect(report.fillerContrast.ratio).toBeGreaterThan(0)
    })

    it('should validate all color combinations for dense catalog preset', () => {
      const report = validateLayoutContrast(LAYOUT_PRESETS['dense-catalog'])
      
      expect(report.overlayContrast.isValid).toBe(true)
      expect(report.fallbackContrast.isValid).toBe(true)
      // Filler contrast may have warnings but should still be validated
      expect(report.fillerContrast.ratio).toBeGreaterThan(0)
    })

    it('should validate all color combinations for image forward preset', () => {
      const report = validateLayoutContrast(LAYOUT_PRESETS['image-forward'])
      
      expect(report.overlayContrast.isValid).toBe(true)
      expect(report.fallbackContrast.isValid).toBe(true)
      // Filler contrast may have warnings but should still be validated
      expect(report.fillerContrast.ratio).toBeGreaterThan(0)
    })

    it('should validate overlay contrast meets WCAG AA', () => {
      const result = validateOverlayContrast()
      
      expect(result.isValid).toBe(true)
      expect(result.ratio).toBeGreaterThanOrEqual(4.5)
      expect(result.recommendation).toBeUndefined()
    })

    it('should validate fallback tile contrast meets WCAG AA', () => {
      const result = validateFallbackContrast(
        '#111827', // text
        '#e5e7eb', // background
        'text-base', // fontSize
        true // isBold
      )
      
      expect(result.isValid).toBe(true)
      expect(result.ratio).toBeGreaterThanOrEqual(4.5)
    })
  })

  describe('Batch Contrast Validation', () => {
    it('should validate multiple color combinations', () => {
      const combinations = [
        {
          text: '#111827',
          background: '#ffffff',
          fontSize: 'text-base',
          isBold: false,
          label: 'Dark text on white'
        },
        {
          text: '#ffffff',
          background: '#111827',
          fontSize: 'text-base',
          isBold: false,
          label: 'White text on dark'
        },
        {
          text: '#111827',
          background: '#e5e7eb',
          fontSize: 'text-lg',
          isBold: true,
          label: 'Dark text on light gray'
        }
      ]

      const results = batchValidateContrast(combinations)
      
      results.forEach(result => {
        expect(result.isValid).toBe(true)
        expect(result.ratio).toBeGreaterThanOrEqual(result.minimumRequired)
      })
    })
  })

  describe('Theme Color Contrast', () => {
    it('should validate custom theme colors meet WCAG AA', () => {
      const themeColors = {
        primary: '#1e40af',
        secondary: '#e5e7eb',
        accent: '#3b82f6',
        background: '#ffffff',
        text: '#111827'
      }

      const report = validateLayoutContrast(
        LAYOUT_PRESETS['balanced'],
        themeColors
      )
      
      expect(report.warnings).toHaveLength(0)
    })

    it('should detect non-compliant theme colors', () => {
      const badThemeColors = {
        primary: '#ffff00',
        secondary: '#ffffff',
        accent: '#cccccc',
        background: '#ffffff',
        text: '#cccccc' // Low contrast
      }

      const report = validateLayoutContrast(
        LAYOUT_PRESETS['balanced'],
        badThemeColors
      )
      
      // Should have warnings for low contrast
      expect(report.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('Metadata Overlay Contrast', () => {
    it('should validate white text on dark gradient', () => {
      const isValid = meetsWCAGAA(
        '#ffffff',
        'rgba(0, 0, 0, 0.8)',
        'text-base',
        false
      )
      
      expect(isValid).toBe(true)
    })

    it('should validate overlay with various background images', () => {
      // Simulate different image background colors
      const darkBackgrounds = [
        '#000000', // Very dark
        '#333333', // Dark
        '#666666', // Medium dark
      ]

      darkBackgrounds.forEach(bg => {
        const isValid = meetsWCAGAA(
          '#ffffff',
          bg,
          'text-base',
          false
        )
        
        // White text should have good contrast on dark backgrounds
        expect(isValid).toBe(true)
      })
    })
  })
})

// ============================================================================
// Keyboard Navigation Tests
// ============================================================================

describe('Accessibility - Keyboard Navigation', () => {
  describe('GridMenuLayout Navigation', () => {
    it('should have logical tab order', async () => {
      const user = userEvent.setup()
      
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      // Tab through skip links
      await user.tab()
      expect(screen.getByText(/Skip to Appetizers/i)).toHaveFocus()

      await user.tab()
      expect(screen.getByText(/Skip to Main Courses/i)).toHaveFocus()
    })

    it('should have focus indicators on tiles', async () => {
      const user = userEvent.setup()
      
      const { container } = render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      // Find first menu tile
      const tiles = container.querySelectorAll('.menu-tile')
      expect(tiles.length).toBeGreaterThan(0)

      // Tiles should be focusable
      const firstTile = tiles[0] as HTMLElement
      expect(firstTile).toHaveAttribute('tabIndex', '0')
    })

    it('should support skip links for section navigation', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      // Skip links should be present
      expect(screen.getByText(/Skip to Appetizers/i)).toBeInTheDocument()
      expect(screen.getByText(/Skip to Main Courses/i)).toBeInTheDocument()

      // Skip links should have proper href
      const skipLink = screen.getByText(/Skip to Appetizers/i)
      expect(skipLink).toHaveAttribute('href', '#section-0')
    })
  })

  describe('MenuTile Keyboard Interaction', () => {
    it('should be keyboard accessible', async () => {
      const user = userEvent.setup()
      
      render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      // When rendered standalone, MenuTile is an article, not a listitem
      const tile = screen.getByRole('article')
      
      // Should be focusable
      await user.tab()
      expect(tile).toHaveFocus()
    })

    it('should have visible focus indicator', () => {
      const { container } = render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      const tile = container.querySelector('.menu-tile')
      expect(tile).toHaveClass('focus-within:ring-2')
      expect(tile).toHaveClass('focus-within:ring-blue-500')
    })
  })
})

// ============================================================================
// Screen Reader Compatibility Tests
// ============================================================================

describe('Accessibility - Screen Reader Support', () => {
  describe('Semantic HTML Structure', () => {
    it('should use proper heading hierarchy', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      // H1 for menu title
      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent('Test Restaurant Menu')

      // H2 for section headers
      const h2Elements = screen.getAllByRole('heading', { level: 2 })
      expect(h2Elements).toHaveLength(2)
      expect(h2Elements[0]).toHaveTextContent('Appetizers')
      expect(h2Elements[1]).toHaveTextContent('Main Courses')
    })

    it('should use semantic section elements', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      // Main element for menu
      expect(screen.getByRole('main')).toBeInTheDocument()

      // Section elements for menu sections
      const sections = screen.getAllByRole('region')
      expect(sections.length).toBeGreaterThan(0)
    })

    it('should use list structure for menu items', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      // List elements for menu items
      const lists = screen.getAllByRole('list')
      expect(lists.length).toBeGreaterThan(0)

      // List items for individual menu items
      const listItems = screen.getAllByRole('listitem')
      expect(listItems.length).toBeGreaterThan(0)
    })
  })

  describe('ARIA Labels and Attributes', () => {
    it('should have descriptive ARIA labels on main element', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      const main = screen.getByRole('main')
      expect(main).toHaveAttribute('aria-label', 'Test Restaurant Menu menu')
    })

    it('should have ARIA labels on menu tiles', () => {
      render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      // When rendered standalone, MenuTile is an article, not a listitem
      const tile = screen.getByRole('article')
      expect(tile).toHaveAttribute('aria-label')
      expect(tile.getAttribute('aria-label')).toContain('Spring Rolls')
      expect(tile.getAttribute('aria-label')).toContain('$8.50')
    })

    it('should have alt text for images', () => {
      render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      const image = screen.getByAltText('Spring Rolls')
      expect(image).toBeInTheDocument()
    })

    it('should have aria-hidden on decorative filler tiles', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      // Filler tiles should be hidden from screen readers
      const fillerTiles = screen.queryAllByRole('presentation')
      fillerTiles.forEach(tile => {
        expect(tile).toHaveAttribute('aria-hidden', 'true')
      })
    })
  })

  describe('Live Region Announcements', () => {
    it('should announce layout changes', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      // Should have live region for announcements
      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
    })

    it('should announce section changes', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      const liveRegion = screen.getByRole('status')
      expect(liveRegion.textContent).toContain('Menu loaded')
      expect(liveRegion.textContent).toContain('2 sections')
      expect(liveRegion.textContent).toContain('3 items')
    })
  })

  describe('Navigation Landmarks', () => {
    it('should have navigation landmark for skip links', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      const nav = screen.getByRole('navigation', { name: /Menu sections/i })
      expect(nav).toBeInTheDocument()
    })

    it('should have proper section labeling', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      const sections = screen.getAllByRole('region')
      sections.forEach(section => {
        expect(section).toHaveAttribute('aria-labelledby')
      })
    })
  })
})

// ============================================================================
// Color and Visual Information Tests
// ============================================================================

describe('Accessibility - Color and Visual Information', () => {
  it('should not rely solely on color to convey information', () => {
    render(
      <GridMenuLayout
        data={mockMenuData}
        preset={LAYOUT_PRESETS['balanced']}
        context="desktop"
      />
    )

    // Featured items should have text indication, not just color
    const featuredItem = screen.getByText('Pasta Carbonara')
    expect(featuredItem).toBeInTheDocument()
    
    // Price information should be in text, not just color
    const prices = screen.getAllByText(/\$\d+\.\d{2}/)
    expect(prices.length).toBeGreaterThan(0)
  })

  it('should maintain information hierarchy without color', () => {
    render(
      <GridMenuLayout
        data={mockMenuData}
        preset={LAYOUT_PRESETS['balanced']}
        context="desktop"
      />
    )

    // Section headers should be distinguishable by size/weight, not just color
    const sectionHeaders = screen.getAllByRole('heading', { level: 2 })
    sectionHeaders.forEach(header => {
      expect(header).toHaveClass('text-2xl')
      expect(header).toHaveClass('font-semibold')
    })
  })
})

// ============================================================================
// Responsive Accessibility Tests
// ============================================================================

describe('Accessibility - Responsive Contexts', () => {
  // Run all four context checks in one test so axe runs sequentially and avoids
  // "Axe is already running" when multiple axe() calls overlap (jest-axe/axe-core).
  it('should maintain accessibility on mobile, tablet, desktop and print', async () => {
    const contexts = ['mobile', 'tablet', 'desktop', 'print'] as const

    for (const context of contexts) {
      const { container, unmount } = render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context={context}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
      unmount()
    }
  }, 20000)
})
