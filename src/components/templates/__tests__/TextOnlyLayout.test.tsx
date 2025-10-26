/**
 * TextOnlyLayout Component Tests
 * 
 * Tests for text-only menu layout rendering
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import TextOnlyLayout from '../TextOnlyLayout'
import type { LayoutMenuData } from '@/lib/templates/types'
import { LAYOUT_PRESETS } from '@/lib/templates/presets'

describe('TextOnlyLayout', () => {
  const mockMenuData: LayoutMenuData = {
    metadata: {
      title: 'Classic Menu',
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
            featured: false
          }
        ]
      }
    ]
  }

  describe('Rendering', () => {
    it('should render menu title', () => {
      render(
        <TextOnlyLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['text-only']}
        />
      )

      expect(screen.getByText('Classic Menu')).toBeInTheDocument()
    })

    it('should render all sections', () => {
      render(
        <TextOnlyLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['text-only']}
        />
      )

      expect(screen.getByText('Appetizers')).toBeInTheDocument()
      expect(screen.getByText('Main Courses')).toBeInTheDocument()
    })

    it('should render all menu items', () => {
      render(
        <TextOnlyLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['text-only']}
        />
      )

      expect(screen.getByText('Spring Rolls')).toBeInTheDocument()
      expect(screen.getByText('Garlic Bread')).toBeInTheDocument()
      expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument()
    })

    it('should render prices', () => {
      render(
        <TextOnlyLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['text-only']}
        />
      )

      expect(screen.getByText('$8.50')).toBeInTheDocument()
      expect(screen.getByText('$6.00')).toBeInTheDocument()
      expect(screen.getByText('$15.50')).toBeInTheDocument()
    })

    it('should render descriptions when provided', () => {
      render(
        <TextOnlyLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['text-only']}
        />
      )

      expect(screen.getByText('Crispy vegetable rolls')).toBeInTheDocument()
      expect(screen.getByText('Creamy pasta with bacon')).toBeInTheDocument()
    })
  })

  describe('Leader Dots', () => {
    it('should not show leader dots by default', () => {
      const { container } = render(
        <TextOnlyLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['text-only']}
        />
      )

      const dottedBorders = container.querySelectorAll('.border-dotted')
      expect(dottedBorders.length).toBe(0)
    })

    it('should show leader dots when enabled', () => {
      const { container } = render(
        <TextOnlyLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['text-only']}
          showLeaderDots={true}
        />
      )

      const dottedBorders = container.querySelectorAll('.border-dotted')
      expect(dottedBorders.length).toBeGreaterThan(0)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TextOnlyLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['text-only']}
        />
      )

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Classic Menu')
    })

    it('should have semantic heading hierarchy', () => {
      render(
        <TextOnlyLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['text-only']}
        />
      )

      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent('Classic Menu')

      const h2Elements = screen.getAllByRole('heading', { level: 2 })
      expect(h2Elements).toHaveLength(2)

      const h3Elements = screen.getAllByRole('heading', { level: 3 })
      expect(h3Elements.length).toBeGreaterThan(0)
    })

    it('should have list structure', () => {
      render(
        <TextOnlyLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['text-only']}
        />
      )

      const lists = screen.getAllByRole('list')
      expect(lists.length).toBeGreaterThan(0)

      const listItems = screen.getAllByRole('listitem')
      expect(listItems.length).toBe(3) // Total items across all sections
    })
  })

  describe('Theme Colors', () => {
    it('should apply custom theme colors', () => {
      const themeColors = {
        text: '#000000',
        accent: '#666666'
      }

      render(
        <TextOnlyLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['text-only']}
          themeColors={themeColors}
        />
      )

      const title = screen.getByText('Classic Menu')
      expect(title).toHaveStyle({ color: '#000000' })
    })
  })

  describe('Section Spacing', () => {
    it('should apply section spacing from preset', () => {
      const { container } = render(
        <TextOnlyLayout
          data={mockMenuData}
          preset={LAYOUT_PRESETS['text-only']}
        />
      )

      const sections = container.querySelectorAll('.menu-section')
      sections.forEach(section => {
        expect(section).toHaveClass(LAYOUT_PRESETS['text-only'].gridConfig.sectionSpacing)
      })
    })
  })
})
