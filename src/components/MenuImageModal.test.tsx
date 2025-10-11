import { render, screen, fireEvent } from '@testing-library/react'
import { MenuImageModal } from '@/components/MenuImageModal'

describe('MenuImageModal', () => {
  const mockOnClose = jest.fn()
  const defaultProps = {
    imageUrl: 'https://example.com/food-image.jpg',
    itemName: 'Delicious Pasta',
    isOpen: true,
    onClose: mockOnClose
  }

  beforeEach(() => {
    mockOnClose.mockClear()
  })

  it('renders modal when isOpen is true', () => {
    render(<MenuImageModal {...defaultProps} />)
    
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Delicious Pasta')).toBeInTheDocument()
    expect(screen.getByAltText('Delicious Pasta')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    render(<MenuImageModal {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    render(<MenuImageModal {...defaultProps} />)
    
    const closeButton = screen.getByLabelText('Close image preview')
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking outside the image', () => {
    render(<MenuImageModal {...defaultProps} />)
    
    const backdrop = screen.getByRole('dialog')
    fireEvent.click(backdrop)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when clicking on the image itself', () => {
    render(<MenuImageModal {...defaultProps} />)
    
    const image = screen.getByAltText('Delicious Pasta')
    fireEvent.click(image)
    
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('closes when Escape key is pressed', () => {
    render(<MenuImageModal {...defaultProps} />)
    
    fireEvent.keyDown(document, { key: 'Escape' })
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('has proper accessibility attributes', () => {
    render(<MenuImageModal {...defaultProps} />)
    
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
    expect(dialog).toHaveAttribute('aria-describedby', 'modal-description')
    
    expect(screen.getByText('Delicious Pasta')).toHaveAttribute('id', 'modal-title')
  })

  it('renders image with correct src', () => {
    render(<MenuImageModal {...defaultProps} />)
    
    const image = screen.getByAltText('Delicious Pasta') as HTMLImageElement
    expect(image.src).toContain('food-image.jpg')
  })

  it('supports WebP images with picture element', () => {
    const webpProps = {
      ...defaultProps,
      imageUrl: 'https://example.com/food-image.webp'
    }
    
    const { container } = render(<MenuImageModal {...webpProps} />)
    
    const picture = container.querySelector('picture')
    expect(picture).toBeInTheDocument()
    
    const source = container.querySelector('source[type="image/webp"]')
    expect(source).toBeInTheDocument()
  })
})
