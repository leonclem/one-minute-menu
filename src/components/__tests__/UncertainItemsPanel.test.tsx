/**
 * Tests for UncertainItemsPanel Component
 * 
 * Verifies:
 * - Display of uncertain items with reasons and confidence scores
 * - Action buttons: add to menu, mark as superfluous, needs retake
 * - Category suggestion dropdown functionality
 * - Feedback submission for system errors
 * - Prioritization and expansion/collapse behavior
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { UncertainItemsPanel, ItemResolution } from '../UncertainItemsPanel'
import { UncertainItem, Category } from '@/lib/extraction/schema-stage1'

// ============================================================================
// Mock Data
// ============================================================================

const mockCategories: Category[] = [
  {
    name: 'Appetizers',
    items: [],
    confidence: 1.0
  },
  {
    name: 'Main Courses',
    items: [],
    subcategories: [
      {
        name: 'Steaks',
        items: [],
        confidence: 0.9
      }
    ],
    confidence: 0.95
  },
  {
    name: 'Desserts',
    items: [],
    confidence: 1.0
  }
]

const mockUncertainItems: UncertainItem[] = [
  {
    text: 'Grilled Salmon',
    reason: 'Price partially obscured by shadow',
    confidence: 0.45,
    suggestedCategory: 'Main Courses',
    suggestedPrice: 24.99
  },
  {
    text: 'Chef Special',
    reason: 'Text is blurry and difficult to read',
    confidence: 0.25
  },
  {
    text: 'Seasonal Soup',
    reason: 'Price not visible in image',
    confidence: 0.6,
    suggestedCategory: 'Appetizers'
  }
]

// ============================================================================
// Tests
// ============================================================================

describe('UncertainItemsPanel', () => {
  const mockOnResolve = jest.fn()
  const mockOnDismiss = jest.fn()
  const mockOnSubmitFeedback = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ==========================================================================
  // Display Tests
  // ==========================================================================

  describe('Display', () => {
    it('should render all uncertain items', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('Grilled Salmon')).toBeInTheDocument()
      expect(screen.getByText('Chef Special')).toBeInTheDocument()
      expect(screen.getByText('Seasonal Soup')).toBeInTheDocument()
    })

    it('should display item count in header', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('3 Items Need Review')).toBeInTheDocument()
    })

    it('should display singular "Item" for single uncertain item', () => {
      render(
        <UncertainItemsPanel
          items={[mockUncertainItems[0]]}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('1 Item Need Review')).toBeInTheDocument()
    })

    it('should display confidence scores', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('45%')).toBeInTheDocument()
      expect(screen.getByText('25%')).toBeInTheDocument()
      expect(screen.getByText('60%')).toBeInTheDocument()
    })

    it('should display reasons for uncertainty', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('Price partially obscured by shadow')).toBeInTheDocument()
      expect(screen.getByText('Text is blurry and difficult to read')).toBeInTheDocument()
      expect(screen.getByText('Price not visible in image')).toBeInTheDocument()
    })

    it('should display suggested category when available', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('Suggested: Main Courses')).toBeInTheDocument()
      expect(screen.getByText('Suggested: Appetizers')).toBeInTheDocument()
    })

    it('should display suggested price when available', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('Price: $24.99')).toBeInTheDocument()
    })

    it('should show success message when no uncertain items', () => {
      render(
        <UncertainItemsPanel
          items={[]}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText(/No uncertain items - all items extracted successfully!/)).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Expand/Collapse Tests
  // ==========================================================================

  describe('Expand/Collapse', () => {
    it('should expand first item by default', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      // First item should show action buttons (expanded)
      const addButtons = screen.getAllByText('Add to Menu')
      expect(addButtons.length).toBeGreaterThan(0)
    })

    it('should toggle item expansion on click', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      // Get all expand/collapse buttons
      const expandButtons = screen.getAllByTitle(/Collapse|Expand/)
      
      // Click to collapse first item
      fireEvent.click(expandButtons[0])
      
      // Action buttons should be hidden
      expect(screen.queryByText('Add to Menu')).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Add to Menu Tests
  // ==========================================================================

  describe('Add to Menu', () => {
    it('should show edit form when "Add to Menu" is clicked', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      const addButton = screen.getAllByText('Add to Menu')[0]
      fireEvent.click(addButton)

      expect(screen.getByLabelText('Item Name *')).toBeInTheDocument()
      expect(screen.getByLabelText('Price *')).toBeInTheDocument()
      expect(screen.getByLabelText('Category *')).toBeInTheDocument()
    })

    it('should pre-fill form with suggested values', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      const addButton = screen.getAllByText('Add to Menu')[0]
      fireEvent.click(addButton)

      const nameInput = screen.getByLabelText('Item Name *') as HTMLInputElement
      const priceInput = screen.getByLabelText('Price *') as HTMLInputElement
      const categorySelect = screen.getByLabelText('Category *') as HTMLSelectElement

      expect(nameInput.value).toBe('Grilled Salmon')
      expect(priceInput.value).toBe('24.99')
      expect(categorySelect.value).toBe('Main Courses')
    })

    it('should populate category dropdown with all categories', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      const addButton = screen.getAllByText('Add to Menu')[0]
      fireEvent.click(addButton)

      const categorySelect = screen.getByLabelText('Category *') as HTMLSelectElement
      const options = Array.from(categorySelect.options).map(opt => opt.value)

      expect(options).toContain('Appetizers')
      expect(options).toContain('Main Courses')
      expect(options).toContain('Main Courses > Steaks')
      expect(options).toContain('Desserts')
    })

    it('should call onResolve with correct data when form is submitted', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      const addButton = screen.getAllByText('Add to Menu')[0]
      fireEvent.click(addButton)

      const nameInput = screen.getByLabelText('Item Name *') as HTMLInputElement
      const priceInput = screen.getByLabelText('Price *') as HTMLInputElement
      const descriptionInput = screen.getByLabelText('Description (optional)') as HTMLTextAreaElement
      const categorySelect = screen.getByLabelText('Category *') as HTMLSelectElement

      fireEvent.change(nameInput, { target: { value: 'Fresh Salmon' } })
      fireEvent.change(priceInput, { target: { value: '26.50' } })
      fireEvent.change(descriptionInput, { target: { value: 'Grilled to perfection' } })
      fireEvent.change(categorySelect, { target: { value: 'Main Courses > Steaks' } })

      const submitButton = screen.getByText('Add to Menu', { selector: 'button' })
      fireEvent.click(submitButton)

      expect(mockOnResolve).toHaveBeenCalledWith(0, {
        action: 'add_to_menu',
        category: 'Main Courses > Steaks',
        correctedData: {
          name: 'Fresh Salmon',
          price: 26.50,
          description: 'Grilled to perfection'
        }
      })
    })

    it('should validate price before submitting', () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation()

      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      const addButton = screen.getAllByText('Add to Menu')[0]
      fireEvent.click(addButton)

      const priceInput = screen.getByLabelText('Price *') as HTMLInputElement
      fireEvent.change(priceInput, { target: { value: 'invalid' } })

      const submitButton = screen.getByText('Add to Menu', { selector: 'button' })
      fireEvent.click(submitButton)

      expect(alertSpy).toHaveBeenCalledWith('Please enter a valid price')
      expect(mockOnResolve).not.toHaveBeenCalled()

      alertSpy.mockRestore()
    })

    it('should cancel edit form when Cancel is clicked', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      const addButton = screen.getAllByText('Add to Menu')[0]
      fireEvent.click(addButton)

      expect(screen.getByLabelText('Item Name *')).toBeInTheDocument()

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      expect(screen.queryByLabelText('Item Name *')).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Mark Superfluous Tests
  // ==========================================================================

  describe('Mark Superfluous', () => {
    it('should call onResolve with mark_superfluous action', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      const markButton = screen.getAllByText('Mark Superfluous')[0]
      fireEvent.click(markButton)

      expect(mockOnResolve).toHaveBeenCalledWith(0, {
        action: 'mark_superfluous'
      })

      confirmSpy.mockRestore()
    })

    it('should not call onResolve if user cancels confirmation', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)

      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      const markButton = screen.getAllByText('Mark Superfluous')[0]
      fireEvent.click(markButton)

      expect(mockOnResolve).not.toHaveBeenCalled()

      confirmSpy.mockRestore()
    })
  })

  // ==========================================================================
  // Needs Retake Tests
  // ==========================================================================

  describe('Needs Retake', () => {
    it('should call onResolve with needs_retake action', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      const retakeButton = screen.getAllByText('Needs Retake')[0]
      fireEvent.click(retakeButton)

      expect(mockOnResolve).toHaveBeenCalledWith(0, {
        action: 'needs_retake'
      })

      confirmSpy.mockRestore()
    })

    it('should not call onResolve if user cancels confirmation', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)

      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      const retakeButton = screen.getAllByText('Needs Retake')[0]
      fireEvent.click(retakeButton)

      expect(mockOnResolve).not.toHaveBeenCalled()

      confirmSpy.mockRestore()
    })
  })

  // ==========================================================================
  // Feedback Submission Tests
  // ==========================================================================

  describe('Feedback Submission', () => {
    it('should show feedback form when "Submit Feedback" is clicked', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
          onSubmitFeedback={mockOnSubmitFeedback}
        />
      )

      const feedbackButton = screen.getAllByText('Submit Feedback')[0]
      fireEvent.click(feedbackButton)

      expect(screen.getByLabelText('Issue Type')).toBeInTheDocument()
      expect(screen.getByLabelText('Feedback *')).toBeInTheDocument()
    })

    it('should not show feedback button if onSubmitFeedback is not provided', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.queryByText('Submit Feedback')).not.toBeInTheDocument()
    })

    it('should call onSubmitFeedback with correct data', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
          onSubmitFeedback={mockOnSubmitFeedback}
        />
      )

      const feedbackButton = screen.getAllByText('Submit Feedback')[0]
      fireEvent.click(feedbackButton)

      const feedbackTypeSelect = screen.getByLabelText('Issue Type') as HTMLSelectElement
      const feedbackTextarea = screen.getByLabelText('Feedback *') as HTMLTextAreaElement

      fireEvent.change(feedbackTypeSelect, { target: { value: 'menu_unclear' } })
      fireEvent.change(feedbackTextarea, { target: { value: 'The image was too dark to read prices' } })

      const submitButton = screen.getByText('Submit Feedback', { selector: 'button' })
      fireEvent.click(submitButton)

      expect(mockOnSubmitFeedback).toHaveBeenCalledWith(
        0,
        'The image was too dark to read prices',
        'menu_unclear'
      )
    })

    it('should validate feedback text before submitting', () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation()

      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
          onSubmitFeedback={mockOnSubmitFeedback}
        />
      )

      const feedbackButton = screen.getAllByText('Submit Feedback')[0]
      fireEvent.click(feedbackButton)

      const submitButton = screen.getByText('Submit Feedback', { selector: 'button' })
      fireEvent.click(submitButton)

      expect(alertSpy).toHaveBeenCalledWith('Please enter feedback')
      expect(mockOnSubmitFeedback).not.toHaveBeenCalled()

      alertSpy.mockRestore()
    })

    it('should cancel feedback form when Cancel is clicked', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
          onSubmitFeedback={mockOnSubmitFeedback}
        />
      )

      const feedbackButton = screen.getAllByText('Submit Feedback')[0]
      fireEvent.click(feedbackButton)

      expect(screen.getByLabelText('Feedback *')).toBeInTheDocument()

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      expect(screen.queryByLabelText('Feedback *')).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Readonly Mode Tests
  // ==========================================================================

  describe('Readonly Mode', () => {
    it('should not show action buttons in readonly mode', () => {
      render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
          readonly={true}
        />
      )

      expect(screen.queryByText('Add to Menu')).not.toBeInTheDocument()
      expect(screen.queryByText('Mark Superfluous')).not.toBeInTheDocument()
      expect(screen.queryByText('Needs Retake')).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Confidence Color Coding Tests
  // ==========================================================================

  describe('Confidence Color Coding', () => {
    it('should apply correct color classes based on confidence', () => {
      const { container } = render(
        <UncertainItemsPanel
          items={mockUncertainItems}
          categories={mockCategories}
          onResolve={mockOnResolve}
          onDismiss={mockOnDismiss}
        />
      )

      // High confidence (>0.5): yellow
      const highConfItem = container.querySelector('.bg-yellow-50')
      expect(highConfItem).toBeInTheDocument()

      // Medium confidence (0.3-0.5): orange
      const medConfItem = container.querySelector('.bg-orange-50')
      expect(medConfItem).toBeInTheDocument()

      // Low confidence (<0.3): red
      const lowConfItem = container.querySelector('.bg-red-50')
      expect(lowConfItem).toBeInTheDocument()
    })
  })
})
