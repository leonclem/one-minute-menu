import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useStudioBetaAccess } from '../use-studio-beta-access'
import { resolveStudioAccessMode } from '@/lib/product-mode'

jest.mock('@/lib/product-mode', () => ({
  resolveStudioAccessMode: jest.fn(),
}))

const mockResolveStudioAccessMode = resolveStudioAccessMode as jest.MockedFunction<
  typeof resolveStudioAccessMode
>

type ProbeProps = {
  isAdmin?: boolean
  enabled?: boolean
}

function Probe({ isAdmin = false, enabled = true }: ProbeProps) {
  const state = useStudioBetaAccess(isAdmin, enabled)
  return (
    <output data-testid="state">
      {`${state.known}:${state.hasAccess}`}
    </output>
  )
}

describe('useStudioBetaAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockResolveStudioAccessMode.mockReturnValue('beta')
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = undefined as typeof global.fetch
  })

  it('fetches beta entitlement for a signed-in non-admin and updates the result', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, granted: true }),
    })

    render(<Probe isAdmin={false} enabled />)

    expect(screen.getByTestId('state')).toHaveTextContent('false:false')
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('true:true'))
    expect(global.fetch).toHaveBeenCalledWith('/api/studio/access', { cache: 'no-store' })
  })

  it('does not fetch outside beta mode or for admins', async () => {
    mockResolveStudioAccessMode.mockReturnValue('open')
    const { rerender } = render(<Probe isAdmin={false} enabled />)

    expect(screen.getByTestId('state')).toHaveTextContent('true:false')
    expect(global.fetch).not.toHaveBeenCalled()

    mockResolveStudioAccessMode.mockReturnValue('beta')
    rerender(<Probe isAdmin enabled />)

    expect(screen.getByTestId('state')).toHaveTextContent('true:false')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fails closed when the entitlement request fails', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('network failure'))

    render(<Probe enabled />)

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('true:false'))
  })
})
