import { render, screen, waitFor } from '@testing-library/react'
import OnboardingPage from '@/app/onboarding/page'

const mockFetch = (data: any, ok = true) => {
  // @ts-ignore
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue({ data }),
  })
}

describe('OnboardingPage', () => {
  it('shows correct skip link when no menus (skip -> create)', async () => {
    mockFetch([])
    render(<OnboardingPage />)

    await waitFor(() => expect(screen.getByText(/4 quick steps/i)).toBeInTheDocument())
    const skip = screen.getByText('Skip') as HTMLAnchorElement
    expect(skip.getAttribute('href')).toBe('/dashboard/menus/new')
  })

  it('shows progress bar width based on completion', async () => {
    mockFetch([{ id: 'm1', status: 'draft', items: [], updated_at: '2024-01-01T00:00:00Z' }])
    render(<OnboardingPage />)

    await waitFor(() => expect(screen.getByText(/4 quick steps/i)).toBeInTheDocument())

    const progress = screen.getByRole('progressbar') as HTMLElement
    expect(progress).toHaveAttribute('aria-valuenow', '25')
  })
})


