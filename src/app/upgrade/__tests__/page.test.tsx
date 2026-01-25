/**
 * Upgrade Page Component Tests
 * 
 * Tests for the upgrade page redirect logic
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import UpgradePage from '../page'

// Mock next/navigation
const mockRouter = {
  replace: jest.fn(),
}

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

describe('UpgradePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render redirecting message', () => {
    render(<UpgradePage />)
    expect(screen.getByText('Redirecting...')).toBeInTheDocument()
    expect(screen.getByText('Taking you to our pricing page.')).toBeInTheDocument()
  })

  it('should redirect to pricing page on mount', () => {
    render(<UpgradePage />)
    expect(mockRouter.replace).toHaveBeenCalledWith('/pricing')
  })
})
