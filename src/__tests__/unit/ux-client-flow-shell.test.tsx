import React from 'react'
import { render } from '@testing-library/react'

// Mock usePathname to simulate different steps
let mockPathname = '/menus/test-menu/upload'
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

import ClientFlowShell from '@/app/menus/[menuId]/ClientFlowShell'

describe('ClientFlowShell (single-page workflow shell)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPathname = '/menus/test-menu/upload'
    window.scrollTo = jest.fn()
  })

  it('derives current step from pathname and persists progress', () => {
    mockPathname = '/menus/demo-test-menu/extract'

    render(
      <ClientFlowShell menuId="demo-test-menu">
        <div>content</div>
      </ClientFlowShell>,
    )

    expect(mockSaveUXProgress).toHaveBeenCalledWith('demo-test-menu', 'extract')
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('falls back to upload step for unknown path segment', () => {
    mockPathname = '/menus/demo-test-menu/unknown-step'

    render(
      <ClientFlowShell menuId="demo-test-menu">
        <div>content</div>
      </ClientFlowShell>,
    )

    expect(mockSaveUXProgress).toHaveBeenCalledWith('demo-test-menu', 'upload')
  })
})


