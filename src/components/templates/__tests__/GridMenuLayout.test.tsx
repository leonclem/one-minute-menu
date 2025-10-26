/**
 * GridMenuLayout Component Tests
 * 
 * Tests for the main grid layout component
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import GridMenuLayout from '../GridMenuLayout'
import type { LayoutMenuData, LayoutPreset } from '@/lib/templates/types'
import { LAYOUT_PRESETS } from '@/lib/templates/presets'

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { fill, priority, sizes, ...restProps } = props
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...restProps} />
  }
}))

describe('GridMenuLayout', () => {
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
            featured: true
          }
        ]
      }
    ]
  }

  describe('Rendering', () => {
    it('should render menu title', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      expect(screen.getByText('Test Restaurant Menu')).toBeInTheDocument()
    })

    it('should render all sections', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      expect(screen.getByText('Appetizers')).toBeInTheDocument()
      expect(screen.getByText('Main Courses')).toBeInTheDocument()
    })

    it('should render all menu items', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      expect(screen.getByText('Spring Rolls')).toBeInTheDocument()
      expect(screen.getByText('Garlic Bread')).toBeInTheDocument()
      expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument()
    })

    it('should apply correct grid columns for mobile context', () => {
      const { container } = render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="mobile"
        />
      )

      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveStyle({
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
      })
    })

    it('should apply correct grid columns for desktop context', () => {
      const { container } = render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveStyle({
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))'
      })
    })
  })

  describe('Preset Application', () => {
    it('should apply dense catalog preset correctly', () => {
      const { container } = render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['dense-catalog']}
          context="desktop"
        />
      )

      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('gap-2')
    })

    it('should apply image forward preset correctly', () => {
      const { container } = render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['image-forward']}
          context="desktop"
        />
      )

      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('gap-4')
    })

    it('should apply feature band preset correctly', () => {
      const { container } = render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['feature-band']}
          context="desktop"
        />
      )

      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('gap-6')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Test Restaurant Menu menu')
    })

    it('should have semantic section elements', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      const sections = screen.getAllByRole('region')
      expect(sections.length).toBeGreaterThan(0)
    })

    it('should have proper heading hierarchy', () => {
      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
        />
      )

      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent('Test Restaurant Menu')

      const h2Elements = screen.getAllByRole('heading', { level: 2 })
      expect(h2Elements).toHaveLength(2)
    })
  })

  describe('Theme Colors', () => {
    it('should apply custom theme colors', () => {
      const themeColors = {
        primary: '#ff0000',
        secondary: '#00ff00',
        accent: '#0000ff',
        background: '#ffffff',
        text: '#000000'
      }

      render(
        <GridMenuLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          themeColors={themeColors}
        />
      )

      // Component should render without errors
      expect(screen.getByText('Test Restaurant Menu')).toBeInTheDocument()
    })
  })
})
