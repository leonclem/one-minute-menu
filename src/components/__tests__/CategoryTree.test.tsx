/**
 * CategoryTree Component Tests
 * 
 * Tests for hierarchical menu display with inline editing and reordering
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CategoryTree } from '../CategoryTree'
import { Category } from '@/lib/extraction/schema-stage1'

describe('CategoryTree', () => {
  const mockCategories: Category[] = [
    {
      name: 'Appetizers',
      confidence: 0.95,
      items: [
        {
          name: 'Spring Rolls',
          price: 8.5,
          description: 'Crispy vegetable rolls',
          confidence: 0.9
        },
        {
          name: 'Garlic Bread',
          price: 6.0,
          confidence: 0.85
        }
      ]
    },
    {
      name: 'Main Courses',
      confidence: 0.88,
      items: [
        {
          name: 'Pasta Carbonara',
          price: 15.5,
          description: 'Creamy pasta with bacon',
          confidence: 0.92
        }
      ],
      subcategories: [
        {
          name: 'Steaks',
          confidence: 0.75,
          items: [
            {
              name: 'Ribeye Steak',
              price: 35.0,
              description: '300g premium beef',
              confidence: 0.55
            }
          ]
        }
      ]
    }
  ]

  describe('Rendering', () => {
    it('should render all categories', () => {
      render(<CategoryTree categories={mockCategories} />)
      
      expect(screen.getByText('Appetizers')).toBeInTheDocument()
      expect(screen.getByText('Main Courses')).toBeInTheDocument()
    })

    it('should display item counts for each category', () => {
      render(<CategoryTree categories={mockCategories} />)
      
      expect(screen.getByText('2 items')).toBeInTheDocument()
      expect(screen.getByText(/1 item • 1 subcategories/)).toBeInTheDocument()
    })

    it('should render empty state when no categories provided', () => {
      render(<CategoryTree categories={[]} />)
      
      expect(screen.getByText('No categories to display')).toBeInTheDocument()
    })

    it('should display confidence scores with correct colors', () => {
      render(<CategoryTree categories={mockCategories} />)
      
      // Expand categories to see items
      fireEvent.click(screen.getByText('Appetizers'))
      
      const highConfidence = screen.getByText('90%')
      expect(highConfidence).toHaveClass('text-green-600')
      
      const mediumConfidence = screen.getByText('85%')
      expect(mediumConfidence).toHaveClass('text-green-600')
    })
  })

  describe('Expand/Collapse', () => {
    it('should expand category when clicked', () => {
      render(<CategoryTree categories={mockCategories} />)
      
      // Items should not be visible initially
      expect(screen.queryByText('Spring Rolls')).not.toBeInTheDocument()
      
      // Click to expand
      fireEvent.click(screen.getByText('Appetizers'))
      
      // Items should now be visible
      expect(screen.getByText('Spring Rolls')).toBeInTheDocument()
      expect(screen.getByText('Garlic Bread')).toBeInTheDocument()
    })

    it('should collapse category when clicked again', () => {
      render(<CategoryTree categories={mockCategories} />)
      
      // Expand
      fireEvent.click(screen.getByText('Appetizers'))
      expect(screen.getByText('Spring Rolls')).toBeInTheDocument()
      
      // Collapse
      fireEvent.click(screen.getByText('Appetizers'))
      expect(screen.queryByText('Spring Rolls')).not.toBeInTheDocument()
    })

    it('should handle nested subcategories', () => {
      render(<CategoryTree categories={mockCategories} />)
      
      // Expand main category
      fireEvent.click(screen.getByText('Main Courses'))
      expect(screen.getByText('Steaks')).toBeInTheDocument()
      
      // Subcategory items should not be visible yet
      expect(screen.queryByText('Ribeye Steak')).not.toBeInTheDocument()
      
      // Expand subcategory
      fireEvent.click(screen.getByText('Steaks'))
      expect(screen.getByText('Ribeye Steak')).toBeInTheDocument()
    })
  })

  describe('Inline Editing', () => {
    it('should allow editing category name', async () => {
      const onEditCategory = jest.fn()
      render(
        <CategoryTree 
          categories={mockCategories} 
          onEditCategory={onEditCategory}
        />
      )
      
      // Hover and click edit button (need to expand first to see edit button)
      const categoryName = screen.getByText('Appetizers')
      fireEvent.mouseEnter(categoryName.parentElement!)
      
      const editButtons = screen.getAllByTitle('Edit')
      fireEvent.click(editButtons[0])
      
      // Input should appear
      const input = screen.getByDisplayValue('Appetizers')
      expect(input).toBeInTheDocument()
      
      // Change value
      fireEvent.change(input, { target: { value: 'Starters' } })
      
      // Save
      fireEvent.click(screen.getByTitle('Save'))
      
      await waitFor(() => {
        expect(onEditCategory).toHaveBeenCalledWith([0], { name: 'Starters' })
      })
    })

    it('should allow editing item name', async () => {
      const onEditItem = jest.fn()
      render(
        <CategoryTree 
          categories={mockCategories} 
          onEditItem={onEditItem}
        />
      )
      
      // Expand category
      fireEvent.click(screen.getByText('Appetizers'))
      
      // Find all edit buttons (they exist in DOM even if hidden)
      const editButtons = screen.getAllByTitle('Edit')
      // Click the first edit button that's for an item (after category edit buttons)
      fireEvent.click(editButtons[1]) // Skip category edit button
      
      // Input should appear
      const input = screen.getByDisplayValue('Spring Rolls')
      
      // Change value
      fireEvent.change(input, { target: { value: 'Veggie Rolls' } })
      
      // Save
      fireEvent.click(screen.getByTitle('Save'))
      
      await waitFor(() => {
        expect(onEditItem).toHaveBeenCalledWith([0], 0, { name: 'Veggie Rolls' })
      })
    })

    it('should allow editing item price', async () => {
      const onEditItem = jest.fn()
      render(
        <CategoryTree 
          categories={mockCategories} 
          onEditItem={onEditItem}
        />
      )
      
      // Expand category
      fireEvent.click(screen.getByText('Appetizers'))
      
      // Find price field
      const priceElement = screen.getByText('8.5')
      fireEvent.mouseEnter(priceElement.parentElement!)
      
      const editButtons = screen.getAllByTitle('Edit')
      // Find the edit button for price (should be after name and description)
      const priceEditButton = editButtons.find(btn => {
        const parent = btn.closest('.flex')
        return parent?.textContent?.includes('8.5')
      })
      
      if (priceEditButton) {
        fireEvent.click(priceEditButton)
        
        const input = screen.getByDisplayValue('8.5') as HTMLInputElement
        expect(input.type).toBe('number')
        
        fireEvent.change(input, { target: { value: '9.5' } })
        fireEvent.click(screen.getByTitle('Save'))
        
        await waitFor(() => {
          expect(onEditItem).toHaveBeenCalledWith([0], 0, { price: 9.5 })
        })
      }
    })

    it('should cancel editing on Escape key', () => {
      const onEditItem = jest.fn()
      render(
        <CategoryTree 
          categories={mockCategories} 
          onEditItem={onEditItem}
        />
      )
      
      // Expand category
      fireEvent.click(screen.getByText('Appetizers'))
      
      // Start editing
      const editButtons = screen.getAllByTitle('Edit')
      fireEvent.click(editButtons[1]) // Skip category edit button
      
      const input = screen.getByDisplayValue('Spring Rolls')
      fireEvent.change(input, { target: { value: 'Changed' } })
      
      // Press Escape
      fireEvent.keyDown(input, { key: 'Escape' })
      
      // Should not save
      expect(onEditItem).not.toHaveBeenCalled()
      expect(screen.queryByDisplayValue('Changed')).not.toBeInTheDocument()
    })

    it('should save editing on Enter key', async () => {
      const onEditItem = jest.fn()
      render(
        <CategoryTree 
          categories={mockCategories} 
          onEditItem={onEditItem}
        />
      )
      
      // Expand category
      fireEvent.click(screen.getByText('Appetizers'))
      
      // Start editing
      const editButtons = screen.getAllByTitle('Edit')
      fireEvent.click(editButtons[1]) // Skip category edit button
      
      const input = screen.getByDisplayValue('Spring Rolls')
      fireEvent.change(input, { target: { value: 'New Name' } })
      
      // Press Enter
      fireEvent.keyDown(input, { key: 'Enter' })
      
      await waitFor(() => {
        expect(onEditItem).toHaveBeenCalledWith([0], 0, { name: 'New Name' })
      })
    })

    it('should not show edit buttons in readonly mode', () => {
      render(<CategoryTree categories={mockCategories} readonly={true} />)
      
      // Expand category
      fireEvent.click(screen.getByText('Appetizers'))
      
      // Edit buttons should not be present
      expect(screen.queryByTitle('Edit')).not.toBeInTheDocument()
    })
  })

  describe('Reordering', () => {
    it('should move item up', () => {
      const onReorder = jest.fn()
      render(
        <CategoryTree 
          categories={mockCategories} 
          onReorder={onReorder}
        />
      )
      
      // Expand category
      fireEvent.click(screen.getByText('Appetizers'))
      
      // Find move up button for second item
      const moveUpButtons = screen.getAllByTitle('Move up')
      fireEvent.click(moveUpButtons[1]) // Second item's move up button
      
      expect(onReorder).toHaveBeenCalled()
      const newCategories = onReorder.mock.calls[0][0]
      
      // Items should be swapped
      expect(newCategories[0].items[0].name).toBe('Garlic Bread')
      expect(newCategories[0].items[1].name).toBe('Spring Rolls')
    })

    it('should move item down', () => {
      const onReorder = jest.fn()
      render(
        <CategoryTree 
          categories={mockCategories} 
          onReorder={onReorder}
        />
      )
      
      // Expand category
      fireEvent.click(screen.getByText('Appetizers'))
      
      // Find move down button for first item
      const moveDownButtons = screen.getAllByTitle('Move down')
      fireEvent.click(moveDownButtons[0])
      
      expect(onReorder).toHaveBeenCalled()
      const newCategories = onReorder.mock.calls[0][0]
      
      // Items should be swapped
      expect(newCategories[0].items[0].name).toBe('Garlic Bread')
      expect(newCategories[0].items[1].name).toBe('Spring Rolls')
    })

    it('should disable move up for first item', () => {
      render(
        <CategoryTree 
          categories={mockCategories} 
          onReorder={jest.fn()}
        />
      )
      
      // Expand category
      fireEvent.click(screen.getByText('Appetizers'))
      
      const moveUpButtons = screen.getAllByTitle('Move up')
      expect(moveUpButtons[0]).toBeDisabled()
    })

    it('should disable move down for last item', () => {
      render(
        <CategoryTree 
          categories={mockCategories} 
          onReorder={jest.fn()}
        />
      )
      
      // Expand category
      fireEvent.click(screen.getByText('Appetizers'))
      
      const moveDownButtons = screen.getAllByTitle('Move down')
      expect(moveDownButtons[1]).toBeDisabled() // Last item
    })

    it('should not show reorder buttons in readonly mode', () => {
      render(<CategoryTree categories={mockCategories} readonly={true} />)
      
      // Expand category
      fireEvent.click(screen.getByText('Appetizers'))
      
      // Reorder buttons should not be present
      expect(screen.queryByTitle('Move up')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Move down')).not.toBeInTheDocument()
    })
  })

  describe('Confidence Score Display', () => {
    it('should show green color for high confidence (>0.8)', () => {
      render(<CategoryTree categories={mockCategories} />)
      
      fireEvent.click(screen.getByText('Appetizers'))
      
      const highConfidence = screen.getByText('90%')
      expect(highConfidence).toHaveClass('text-green-600')
    })

    it('should show yellow color for medium confidence (0.6-0.8)', () => {
      render(<CategoryTree categories={mockCategories} />)
      
      fireEvent.click(screen.getByText('Main Courses'))
      fireEvent.click(screen.getByText('Steaks'))
      
      const mediumConfidence = screen.getByText('75%')
      expect(mediumConfidence).toHaveClass('text-yellow-600')
    })

    it('should show red color for low confidence (<0.6)', () => {
      render(<CategoryTree categories={mockCategories} />)
      
      fireEvent.click(screen.getByText('Main Courses'))
      fireEvent.click(screen.getByText('Steaks'))
      
      const lowConfidence = screen.getByText('55%')
      expect(lowConfidence).toHaveClass('text-red-600')
    })

    it('should apply background color based on confidence', () => {
      render(<CategoryTree categories={mockCategories} />)
      
      fireEvent.click(screen.getByText('Main Courses'))
      fireEvent.click(screen.getByText('Steaks'))
      
      // Find the low confidence item container
      const ribeye = screen.getByText('Ribeye Steak')
      const container = ribeye.closest('.p-3')
      
      expect(container).toHaveClass('bg-red-50', 'border-red-200')
    })
  })

  describe('Description Handling', () => {
    it('should display item descriptions when present', () => {
      render(<CategoryTree categories={mockCategories} />)
      
      fireEvent.click(screen.getByText('Appetizers'))
      
      expect(screen.getByText('Crispy vegetable rolls')).toBeInTheDocument()
    })

    it('should allow editing descriptions', async () => {
      const onEditItem = jest.fn()
      render(
        <CategoryTree 
          categories={mockCategories} 
          onEditItem={onEditItem}
        />
      )
      
      fireEvent.click(screen.getByText('Appetizers'))
      
      const description = screen.getByText('Crispy vegetable rolls')
      fireEvent.mouseEnter(description.parentElement!)
      
      const editButtons = screen.getAllByTitle('Edit')
      // Find the edit button for description
      const descEditButton = editButtons.find(btn => {
        const parent = btn.closest('.mb-1')
        return parent?.textContent?.includes('Crispy vegetable rolls')
      })
      
      if (descEditButton) {
        fireEvent.click(descEditButton)
        
        const input = screen.getByDisplayValue('Crispy vegetable rolls')
        fireEvent.change(input, { target: { value: 'Fresh spring rolls' } })
        fireEvent.click(screen.getByTitle('Save'))
        
        await waitFor(() => {
          expect(onEditItem).toHaveBeenCalledWith([0], 0, { description: 'Fresh spring rolls' })
        })
      }
    })
  })
})
