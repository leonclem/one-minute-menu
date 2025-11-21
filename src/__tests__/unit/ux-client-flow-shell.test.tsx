import React from 'react'
import { render } from '@testing-library/react'

// Mock UXProgressSteps so we can assert props without rendering the full component
const mockUXProgressSteps = jest.fn(() => null)
jest.mock('@/components/ux', () => {
  const actual = jest.requireActual('@/components/ux')
  return {
    ...actual,
    UXProgressSteps: (props: any) => {
      mockUXProgressSteps(props)
      return null
    },
  }
})

// Mock usePathname to simulate different steps
let mockPathname = '/ux/menus/test-menu/upload'
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

// Mock saveUXProgress so we can assert progress persistence
const mockSaveUXProgress = jest.fn()
jest.mock('@/lib/ux-progress', () => {
  const actual = jest.requireActual('@/lib/ux-progress')
  return {
    ...actual,
    saveUXProgress: (...args: any[]) => mockSaveUXProgress(...args),
  }
})

import ClientFlowShell from '@/app/ux/menus/[menuId]/ClientFlowShell'

describe('ClientFlowShell (single-page workflow shell)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPathname = '/ux/menus/test-menu/upload'
    window.scrollTo = jest.fn()
  })

  it('derives current step from pathname and renders UXProgressSteps', () => {
    mockPathname = '/ux/menus/test-menu/extract'

    render(
      <ClientFlowShell menuId="test-menu">
        <div>content</div>
      </ClientFlowShell>,
    )

    expect(mockUXProgressSteps).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: 'extract',
        menuId: 'test-menu',
      }),
    )
    expect(mockSaveUXProgress).toHaveBeenCalledWith('test-menu', 'extract')
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('falls back to upload step for unknown path segment', () => {
    mockPathname = '/ux/menus/test-menu/unknown-step'

    render(
      <ClientFlowShell menuId="test-menu">
        <div>content</div>
      </ClientFlowShell>,
    )

    expect(mockUXProgressSteps).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStep: 'upload',
      }),
    )
    expect(mockSaveUXProgress).toHaveBeenCalledWith('test-menu', 'upload')
  })
})


