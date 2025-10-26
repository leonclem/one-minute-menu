/**
 * MenuTile Component Tests
 * 
 * Tests for individual menu item tiles
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import MenuTile from '../MenuTile'
import type { LayoutItem } from '@/lib/templates/types'
import { LAYOUT_PRESETS } from '@/lib/templates/presets'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { describe } from 'node:test'

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { fill, priority, sizes, ...restProps } = props
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...restProps} />
  }
}))

describe('MenuTile', () => {
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

  describe('Rendering with Image', () => {
    it('should render item name', () => {
      render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      expect(screen.getByText('Spring Rolls')).toBeInTheDocument()
    })

    it('should render formatted price', () => {
      render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      expect(screen.getByText('$8.50')).toBeInTheDocument()
    })

    it('should render description', () => {
      render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      expect(screen.getByText('Crispy vegetable rolls')).toBeInTheDocument()
    })

    it('should render image with correct src', () => {
      render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      const image = screen.getByAltText('Spring Rolls')
      expect(image).toHaveAttribute('src', 'https://example.com/spring-rolls.jpg')
    })
  })

  describe('Rendering without Image', () => {
    it('should render fallback for items without images', () => {
      render(
        <MenuTile
          item={mockItemWithoutImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      expect(screen.getByText('Garlic Bread')).toBeInTheDocument()
      expect(screen.getByText('$6.00')).toBeInTheDocument()
    })

    it('should not render image element for items without imageRef', () => {
      render(
        <MenuTile
          item={mockItemWithoutImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
  })

  describe('Currency Formatting', () => {
    it('should format USD currency correctly', () => {
      render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      expect(screen.getByText('$8.50')).toBeInTheDocument()
    })

    it('should format EUR currency correctly', () => {
      render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="EUR"
        />
      )

      expect(screen.getByText('8.50€')).toBeInTheDocument()
    })

    it('should format GBP currency correctly', () => {
      render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="GBP"
        />
      )

      expect(screen.getByText('£8.50')).toBeInTheDocument()
    })
  })

  describe('Metadata Modes', () => {
    it('should render overlay mode for image-forward preset', () => {
      render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['image-forward']}
          context="desktop"
          currency="USD"
        />
      )

      // Overlay mode should render metadata over the image
      expect(screen.getByText('Spring Rolls')).toBeInTheDocument()
    })

    it('should render adjacent mode for text-only preset', () => {
      render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['text-only']}
          context="desktop"
          currency="USD"
        />
      )

      // Adjacent mode should render metadata separately
      expect(screen.getByText('Spring Rolls')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA label', () => {
      render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      const article = screen.getByRole('listitem')
      expect(article).toHaveAttribute('aria-label', 'Spring Rolls, $8.50')
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
  })

  describe('Aspect Ratio', () => {
    it('should render tile with balanced preset', () => {
      const { container } = render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['balanced']}
          context="desktop"
          currency="USD"
        />
      )

      const tile = container.querySelector('.menu-tile')
      expect(tile).toBeInTheDocument()
      expect(tile).toHaveClass('menu-tile')
    })

    it('should render tile with image-forward preset', () => {
      const { container } = render(
        <MenuTile
          item={mockItemWithImage}
          preset={LAYOUT_PRESETS['image-forward']}
          context="desktop"
          currency="USD"
        />
      )

      const tile = container.querySelector('.menu-tile')
      expect(tile).toBeInTheDocument()
      expect(tile).toHaveClass('menu-tile')
    })
  })
})
