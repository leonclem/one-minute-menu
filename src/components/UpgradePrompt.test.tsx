import { render, screen } from '@testing-library/react'
import { UpgradePrompt } from '@/components/ui'

describe('UpgradePrompt', () => {
  it('renders message and CTA', () => {
    render(
      <UpgradePrompt message="You hit the free plan limit" cta="Upgrade now" href="/upgrade" />
    )
    expect(screen.getByText('Upgrade required')).toBeInTheDocument()
    expect(screen.getByText('You hit the free plan limit')).toBeInTheDocument()
    expect(screen.getByText('Upgrade now')).toBeInTheDocument()
  })
})


