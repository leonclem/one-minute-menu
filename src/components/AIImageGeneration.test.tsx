import { render, screen, fireEvent } from '@testing-library/react'
import AIImageGeneration from '@/components/AIImageGeneration'
import { ToastProvider } from '@/components/ui'

const menuItem = { id: 'item1', name: 'Pasta', description: 'Delicious pasta', price: 10, available: true, order: 1, imageSource: 'none' } as any

describe('AIImageGeneration - Advanced options', () => {
  beforeEach(() => {
    // Mock fetch for variations and generation/job polling
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/variations')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { variations: [] } }) } as any)
      }
      if (url.includes('/api/generate-image')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { images: [] } }) } as any)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any)
    }) as any
  })

  it('toggles Advanced section and shows fields', () => {
    render(
      <ToastProvider>
        <AIImageGeneration
          menuItem={menuItem}
          menuId="menu1"
          onImageGenerated={jest.fn()}
          onCancel={jest.fn()}
        />
      </ToastProvider>
    )

    const toggle = screen.getByText('Advanced options (optional)')
    fireEvent.click(toggle)

    // Fields present
    expect(screen.getByText('Exclude from image (negative prompt)')).toBeInTheDocument()
    expect(screen.getByText('Additional details')).toBeInTheDocument()
  })
})


