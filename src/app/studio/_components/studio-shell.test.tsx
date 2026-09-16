import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioShell } from './studio-shell'

jest.mock('next/navigation', () => ({
  usePathname: () => '/studio',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string }) => <img alt={props.alt} />,
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))

jest.mock('./studio-signup-beacon', () => ({
  StudioSignupBeacon: () => null,
}))

describe('StudioShell', () => {
  it('uses the shared GridMenu footer with blog and social links', () => {
    render(
      <StudioShell creditBalance={10} showCredits userEmail="chef@example.com">
        <div>studio content</div>
      </StudioShell>,
    )

    expect(screen.getByRole('link', { name: /^blog$/i })).toHaveAttribute('href', '/blog')
    expect(screen.getByRole('link', { name: /gridmenu on tiktok/i })).toHaveAttribute(
      'href',
      'https://www.tiktok.com/@gridmenu',
    )
    expect(screen.getByRole('contentinfo')).toHaveAttribute('data-brand-chrome', 'studio')
  })
})
