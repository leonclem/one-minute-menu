import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioAppBar } from './studio-app-bar'

let pathname = '/studio'

jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string }) => <img alt={props.alt} />,
}))

describe('StudioAppBar', () => {
  it('shows All dishes as text on the dish grid', () => {
    pathname = '/studio'
    render(<StudioAppBar creditBalance={12} showCredits />)
    expect(screen.getByText('All dishes')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'All dishes' })).not.toBeInTheDocument()
    expect(screen.getByTestId('studio-shell-credits')).toHaveTextContent('12 credits')
  })

  it('links All dishes back to the grid from a dish page', () => {
    pathname = '/studio/dish-1'
    render(<StudioAppBar creditBalance={3} showCredits />)
    expect(screen.getByRole('link', { name: 'All dishes' })).toHaveAttribute('href', '/studio')
  })
})
