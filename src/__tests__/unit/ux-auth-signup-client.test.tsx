import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}))

// Mock next/link to avoid Next.js runtime in tests
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

import SignUpClient from '@/app/auth/signup/signup-client'

describe('SignUpClient UX auth page', () => {
  it('renders heading and email input', () => {
    render(<SignUpClient />)

    expect(
      screen.getByRole('heading', { name: /get started free/i }),
    ).toBeInTheDocument()

    const emailInput = screen.getByLabelText(/email address/i)
    expect(emailInput).toBeInTheDocument()
  })

  it('shows validation error when submitting empty form', async () => {
    render(<SignUpClient />)

    const button = screen.getByRole('button', { name: /send magic link/i })
    fireEvent.click(button)

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
  })

  it('calls supabase signInWithOtp when form is valid', async () => {
    const { supabase } = jest.requireMock('@/lib/supabase') as {
      supabase: { auth: { signInWithOtp: jest.Mock } }
    }
    supabase.auth.signInWithOtp.mockResolvedValueOnce({ error: null })

    render(<SignUpClient />)

    const emailInput = screen.getByLabelText(/email address/i)
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

    const button = screen.getByRole('button', { name: /send magic link/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        }),
      )
    })
  })
})


