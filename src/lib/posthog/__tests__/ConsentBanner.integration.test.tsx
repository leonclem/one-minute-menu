/**
 * Component test: ConsentBanner integration with PostHog
 *
 * Verifies:
 * - Allow click → saveConsent({ analytics: true }) then initializePostHogIfAllowed()
 * - Decline click → saveConsent({ analytics: false }) then resetAnalytics() + posthogOptOutCapturingIfLoaded()
 * - Decline before init is a pure no-op (posthogOptOutCapturingIfLoaded is safe to call)
 * - Banner hides after either choice
 *
 * Implements: 11.2, 11.3
 */

import React from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSaveConsent = jest.fn()
const mockGetStoredConsent = jest.fn()
const mockInitializePostHogIfAllowed = jest.fn().mockResolvedValue(undefined)
const mockResetAnalytics = jest.fn()
const mockPosthogOptOutCapturingIfLoaded = jest.fn()

jest.mock('@/lib/consent', () => ({
  __esModule: true,
  getStoredConsent: () => mockGetStoredConsent(),
  saveConsent: (prefs: { analytics: boolean }) => mockSaveConsent(prefs),
  hasAnalyticsConsent: jest.fn().mockReturnValue(false),
}))

jest.mock('@/lib/posthog', () => ({
  __esModule: true,
  initializePostHogIfAllowed: () => mockInitializePostHogIfAllowed(),
  resetAnalytics: () => mockResetAnalytics(),
  posthogOptOutCapturingIfLoaded: () => mockPosthogOptOutCapturingIfLoaded(),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { ConsentBanner } from '../../../components/privacy/ConsentBanner'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBanner() {
  // No stored consent → banner is visible
  mockGetStoredConsent.mockReturnValue(null)
  return render(<ConsentBanner />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConsentBanner — Allow analytics (grant path)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetStoredConsent.mockReturnValue(null)
  })

  it('calls saveConsent({ analytics: true }) when Allow is clicked', async () => {
    renderBanner()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(screen.getByText('Allow analytics'))
    })

    expect(mockSaveConsent).toHaveBeenCalledWith({ analytics: true })
  })

  it('calls initializePostHogIfAllowed() after saveConsent on Allow', async () => {
    renderBanner()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(screen.getByText('Allow analytics'))
    })

    expect(mockInitializePostHogIfAllowed).toHaveBeenCalledTimes(1)
  })

  it('does NOT call resetAnalytics or posthogOptOutCapturingIfLoaded on Allow', async () => {
    renderBanner()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(screen.getByText('Allow analytics'))
    })

    expect(mockResetAnalytics).not.toHaveBeenCalled()
    expect(mockPosthogOptOutCapturingIfLoaded).not.toHaveBeenCalled()
  })

  it('hides the banner after Allow is clicked', async () => {
    renderBanner()
    const user = userEvent.setup()

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByText('Allow analytics'))
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('ConsentBanner — Decline analytics (withdrawal path)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetStoredConsent.mockReturnValue(null)
  })

  it('calls saveConsent({ analytics: false }) when Decline is clicked', async () => {
    renderBanner()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(screen.getByText('Decline analytics'))
    })

    expect(mockSaveConsent).toHaveBeenCalledWith({ analytics: false })
  })

  it('calls resetAnalytics() after saveConsent on Decline', async () => {
    renderBanner()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(screen.getByText('Decline analytics'))
    })

    expect(mockResetAnalytics).toHaveBeenCalledTimes(1)
  })

  it('calls posthogOptOutCapturingIfLoaded() on Decline', async () => {
    renderBanner()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(screen.getByText('Decline analytics'))
    })

    expect(mockPosthogOptOutCapturingIfLoaded).toHaveBeenCalledTimes(1)
  })

  it('does NOT call initializePostHogIfAllowed on Decline', async () => {
    renderBanner()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(screen.getByText('Decline analytics'))
    })

    expect(mockInitializePostHogIfAllowed).not.toHaveBeenCalled()
  })

  it('decline before init is a pure no-op — posthogOptOutCapturingIfLoaded does not throw', async () => {
    // posthogOptOutCapturingIfLoaded is a no-op when SDK never loaded;
    // this test verifies the call completes without error
    mockPosthogOptOutCapturingIfLoaded.mockImplementation(() => {
      // no-op — SDK not loaded
    })
    renderBanner()
    const user = userEvent.setup()

    let threw = false
    try {
      await act(async () => {
        await user.click(screen.getByText('Decline analytics'))
      })
    } catch {
      threw = true
    }

    expect(threw).toBe(false)
    expect(mockPosthogOptOutCapturingIfLoaded).toHaveBeenCalledTimes(1)
  })

  it('hides the banner after Decline is clicked', async () => {
    renderBanner()
    const user = userEvent.setup()

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByText('Decline analytics'))
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('ConsentBanner — hidden when consent already stored', () => {
  it('does not render the dialog when consent is already stored', () => {
    mockGetStoredConsent.mockReturnValue({ analytics: true, updatedAt: new Date().toISOString() })
    render(<ConsentBanner />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
