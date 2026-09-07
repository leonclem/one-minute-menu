import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioAppBar } from './studio-app-bar'
import { StudioCreditsProvider, useStudioCredits } from './studio-credits-context'

let pathname = '/studio'

jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string }) => <img alt={props.alt} />,
}))

function renderAppBar(initialBalance: number, showCredits = true) {
  return render(
    <StudioCreditsProvider initialBalance={initialBalance}>
      <StudioAppBar showCredits={showCredits} />
    </StudioCreditsProvider>,
  )
}

function CreditSpendHarness() {
  const { setCreditBalance } = useStudioCredits()
  return (
    <>
      <StudioAppBar showCredits />
      <button type="button" onClick={() => setCreditBalance(7)}>
        spend
      </button>
    </>
  )
}

describe('StudioAppBar', () => {
  it('shows All dishes as text on the dish grid', () => {
    pathname = '/studio'
    renderAppBar(12)
    expect(screen.getByText('All dishes')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'All dishes' })).not.toBeInTheDocument()
    expect(screen.getByTestId('studio-shell-credits')).toHaveTextContent('12 credits')
  })

  it('links All dishes back to the grid from a dish page', () => {
    pathname = '/studio/dish-1'
    renderAppBar(3)
    expect(screen.getByRole('link', { name: 'All dishes' })).toHaveAttribute('href', '/studio')
  })

  it('updates the credits pill when a generation writes the new balance', () => {
    pathname = '/studio'
    render(
      <StudioCreditsProvider initialBalance={12}>
        <CreditSpendHarness />
      </StudioCreditsProvider>,
    )

    expect(screen.getByTestId('studio-shell-credits')).toHaveTextContent('12 credits')
    fireEvent.click(screen.getByRole('button', { name: 'spend' }))
    expect(screen.getByTestId('studio-shell-credits')).toHaveTextContent('7 credits')
  })
})
