import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}))

jest.mock('next/link', () => {
  const MockLink = ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>

  MockLink.displayName = 'MockLink'

  return MockLink
})

import SignInClient from '@/app/(marketing)/auth/signin/signin-client'
import SignInPage from '@/app/(marketing)/auth/signin/page'

describe('SignInClient', () => {
  it('renders the email form and studio-styled links', () => {
    render(<SignInClient />)

    expect(
      screen.getByRole('heading', { name: /sign in with email/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByText(/why magic links/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up free/i })).toHaveAttribute(
      'href',
      '/register',
    )
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('shows validation error when submitting empty form', async () => {
    render(<SignInClient />)

    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }))

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
  })

  it('calls supabase signInWithOtp when form is valid', async () => {
    const { supabase } = jest.requireMock('@/lib/supabase') as {
      supabase: { auth: { signInWithOtp: jest.Mock } }
    }
    supabase.auth.signInWithOtp.mockResolvedValueOnce({ error: null })

    render(<SignInClient />)

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }))

    await waitFor(() => {
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        }),
      )
    })
  })
})

describe('SignInPage', () => {
  it('uses the studio food-bleed heading instead of the old overlay page', () => {
    const { container } = render(<SignInPage />)

    expect(container.querySelector('.ux-food-bleed')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /welcome back/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/sign in to open photo studio/i)).toBeInTheDocument()
    expect(container.querySelector('.ux-implementation')).not.toBeInTheDocument()
  })
})
