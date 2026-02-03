import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MenuCard } from '@/components/dashboard/MenuCard'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}))

jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}))

describe('MenuCard', () => {
  const baseMenu: any = {
    id: 'menu-1',
    name: 'Test Menu',
    items: [],
    categories: [],
    version: 1,
    imageUrl: null,
    updatedAt: new Date(),
  }

  it('shows "Edit menu" by default', () => {
    render(<MenuCard menu={baseMenu} />)
    expect(screen.getByText('Edit menu')).toBeInTheDocument()
  })

  it('shows "View Menu" when edit locked', () => {
    render(<MenuCard menu={baseMenu} isEditLocked />)
    expect(screen.getByText('View Menu')).toBeInTheDocument()
  })
})

