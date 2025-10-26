/**
 * MenuTile Component Tests
 * 
 * Tests for individual menu item tiles including mixed media handling
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import MenuTile from '../MenuTile'
import type { LayoutItem } from '@/lib/templates/types'
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

      const article = screen.getByRole('article')
      expect(article).toHaveAttribute('aria-label')
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

  describe('Mixed Media Handling', () => {
    describe('Fallback Styles', () => {
      it('should render color fallback for generic items', () => {
        const genericItem: LayoutItem = {
          name: 'House Special',
          price: 12.0,
          description: 'Chef recommendation',
          featured: false
        }

        render(
          <MenuTile
            item={genericItem}
            preset={LAYOUT_PRESETS['balanced']}
            context="desktop"
            currency="USD"
          />
        )

        expect(screen.getByText('House Special')).toBeInTheDocument()
        expect(screen.getByText('$12.00')).toBeInTheDocument()
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
      })

      it('should render icon fallback for food items with keywords', () => {
        const burgerItem: LayoutItem = {
          name: 'Classic Burger',
          price: 10.0,
          featured: false
        }

        render(
          <MenuTile
            item={burgerItem}
            preset={LAYOUT_PRESETS['balanced']}
            context="desktop"
            currency="USD"
          />
        )

        expect(screen.getByText('Classic Burger')).toBeInTheDocument()
        expect(screen.getByText('$10.00')).toBeInTheDocument()
      })

      it('should render icon fallback for coffee items', () => {
        const coffeeItem: LayoutItem = {
          name: 'Espresso',
          price: 3.5,
          featured: false
        }

        render(
          <MenuTile
            item={coffeeItem}
            preset={LAYOUT_PRESETS['balanced']}
            context="desktop"
            currency="USD"
          />
        )

        expect(screen.getByText('Espresso')).toBeInTheDocument()
        expect(screen.getByText('$3.50')).toBeInTheDocument()
      })

      it('should render icon fallback for pizza items', () => {
        const pizzaItem: LayoutItem = {
          name: 'Margherita Pizza',
          price: 14.0,
          featured: false
        }

        render(
          <MenuTile
            item={pizzaItem}
            preset={LAYOUT_PRESETS['balanced']}
            context="desktop"
            currency="USD"
          />
        )

        expect(screen.getByText('Margherita Pizza')).toBeInTheDocument()
        expect(screen.getByText('$14.00')).toBeInTheDocument()
      })

      it('should render text-only fallback for items with long descriptions', () => {
        const itemWithLongDesc: LayoutItem = {
          name: 'Seasonal Dish',
          price: 18.0,
          description: 'A carefully crafted seasonal dish featuring locally sourced ingredients and traditional cooking methods',
          featured: false
        }

        render(
          <MenuTile
            item={itemWithLongDesc}
            preset={LAYOUT_PRESETS['balanced']}
            context="desktop"
            currency="USD"
          />
        )

        expect(screen.getByText('Seasonal Dish')).toBeInTheDocument()
        expect(screen.getByText('$18.00')).toBeInTheDocument()
        expect(screen.getByText(/carefully crafted seasonal dish/i)).toBeInTheDocument()
      })
    })

    describe('Visual Balance', () => {
      it('should maintain consistent grid dimensions for items with and without images', () => {
        const { container: containerWithImage } = render(
          <MenuTile
            item={mockItemWithImage}
            preset={LAYOUT_PRESETS['balanced']}
            context="desktop"
            currency="USD"
          />
        )

        const { container: containerWithoutImage } = render(
          <MenuTile
            item={mockItemWithoutImage}
            preset={LAYOUT_PRESETS['balanced']}
            context="desktop"
            currency="USD"
          />
        )

        const tileWithImage = containerWithImage.querySelector('.menu-tile')
        const tileWithoutImage = containerWithoutImage.querySelector('.menu-tile')

        // Both should render with the same tile class
        expect(tileWithImage).toHaveClass('menu-tile')
        expect(tileWithoutImage).toHaveClass('menu-tile')
        expect(tileWithImage).toBeInTheDocument()
        expect(tileWithoutImage).toBeInTheDocument()
      })

      it('should apply consistent styling across mixed media items', () => {
        const items: LayoutItem[] = [
          mockItemWithImage,
          mockItemWithoutImage,
          { name: 'Coffee', price: 3.0, featured: false },
          { name: 'Burger', price: 12.0, imageRef: 'https://example.com/burger.jpg', featured: false }
        ]

        items.forEach(item => {
          const { container } = render(
            <MenuTile
              item={item}
              preset={LAYOUT_PRESETS['balanced']}
              context="desktop"
              currency="USD"
            />
          )

          const tile = container.querySelector('.menu-tile')
          expect(tile).toHaveClass('menu-tile')
          expect(tile).toHaveClass('rounded-lg') // From balanced preset
        })
      })
    })

    describe('Image Ratio Scenarios', () => {
      it('should handle 0% image ratio (all text-only)', () => {
        const textOnlyItems: LayoutItem[] = [
          { name: 'Item 1', price: 5.0, featured: false },
          { name: 'Item 2', price: 6.0, featured: false },
          { name: 'Item 3', price: 7.0, featured: false }
        ]

        textOnlyItems.forEach(item => {
          render(
            <MenuTile
              item={item}
              preset={LAYOUT_PRESETS['balanced']}
              context="desktop"
              currency="USD"
            />
          )

          expect(screen.getByText(item.name)).toBeInTheDocument()
          expect(screen.queryByRole('img')).not.toBeInTheDocument()
        })
      })

      it('should handle 50% image ratio (mixed)', () => {
        const mixedItems: LayoutItem[] = [
          { name: 'With Image 1', price: 10.0, imageRef: 'https://example.com/1.jpg', featured: false },
          { name: 'Without Image 1', price: 8.0, featured: false },
          { name: 'With Image 2', price: 12.0, imageRef: 'https://example.com/2.jpg', featured: false },
          { name: 'Without Image 2', price: 9.0, featured: false }
        ]

        mixedItems.forEach(item => {
          const { container } = render(
            <MenuTile
              item={item}
              preset={LAYOUT_PRESETS['balanced']}
              context="desktop"
              currency="USD"
            />
          )

          expect(screen.getByText(item.name)).toBeInTheDocument()
          
          const tile = container.querySelector('.menu-tile')
          expect(tile).toBeInTheDocument()
        })
      })

      it('should handle 100% image ratio (all images)', () => {
        const imageItems: LayoutItem[] = [
          { name: 'Image Item 1', price: 10.0, imageRef: 'https://example.com/1.jpg', featured: false },
          { name: 'Image Item 2', price: 12.0, imageRef: 'https://example.com/2.jpg', featured: false },
          { name: 'Image Item 3', price: 14.0, imageRef: 'https://example.com/3.jpg', featured: false }
        ]

        imageItems.forEach(item => {
          render(
            <MenuTile
              item={item}
              preset={LAYOUT_PRESETS['balanced']}
              context="desktop"
              currency="USD"
            />
          )

          expect(screen.getByText(item.name)).toBeInTheDocument()
          expect(screen.getByAltText(item.name)).toBeInTheDocument()
        })
      })
    })

    describe('Theme Color Integration', () => {
      it('should apply theme colors to fallback tiles', () => {
        const themeColors = {
          primary: '#ff0000',
          secondary: '#00ff00',
          accent: '#0000ff',
          background: '#f0f0f0',
          text: '#333333'
        }

        const { container } = render(
          <MenuTile
            item={mockItemWithoutImage}
            preset={LAYOUT_PRESETS['balanced']}
            context="desktop"
            currency="USD"
            themeColors={themeColors}
          />
        )

        const tile = container.querySelector('.menu-tile')
        expect(tile).toBeInTheDocument()
      })
    })

    describe('No Broken Layouts', () => {
      it('should not produce broken layouts with missing images', () => {
        const itemsWithMissingImages: LayoutItem[] = [
          { name: 'Item 1', price: 5.0, imageRef: undefined, featured: false },
          { name: 'Item 2', price: 6.0, imageRef: '', featured: false },
          { name: 'Item 3', price: 7.0, featured: false }
        ]

        itemsWithMissingImages.forEach(item => {
          const { container } = render(
            <MenuTile
              item={item}
              preset={LAYOUT_PRESETS['balanced']}
              context="desktop"
              currency="USD"
            />
          )

          const tile = container.querySelector('.menu-tile')
          expect(tile).toBeInTheDocument()
          expect(screen.getByText(item.name)).toBeInTheDocument()
        })
      })

      it('should maintain visual balance with partial image coverage', () => {
        const partialImageItems: LayoutItem[] = [
          { name: 'Has Image', price: 10.0, imageRef: 'https://example.com/img.jpg', featured: false },
          { name: 'No Image 1', price: 8.0, featured: false },
          { name: 'No Image 2', price: 9.0, featured: false },
          { name: 'Has Image 2', price: 11.0, imageRef: 'https://example.com/img2.jpg', featured: false }
        ]

        partialImageItems.forEach(item => {
          const { container } = render(
            <MenuTile
              item={item}
              preset={LAYOUT_PRESETS['balanced']}
              context="desktop"
              currency="USD"
            />
          )

          const tile = container.querySelector('.menu-tile')
          expect(tile).toHaveClass('menu-tile')
          expect(tile).toBeInTheDocument()
        })
      })
    })
  })
})
