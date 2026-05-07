import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import BatchPhotoModal from '../BatchPhotoModal'

const mockShowToast = jest.fn()

jest.mock('@/components/ui', () => ({
  useToast: () => ({ showToast: mockShowToast }),
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

jest.mock('@/lib/image-generation/use-image-generation-status', () => ({
  getImageGenerationJobLabel: (job?: { status?: string } | null) => {
    if (!job) return null
    if (job.status === 'processing') return 'Generating'
    if (job.status === 'completed') return 'Completed'
    if (job.status === 'failed') return 'Failed'
    return 'Queued'
  },
  useImageGenerationStatus: () => ({
    data: {
      latestByItem: {},
      activeCount: 1,
      hasActiveJobs: true,
      jobs: [],
      activeJobs: [],
      menuId: 'menu-1',
    },
  }),
}))

jest.mock('../photo-generation/AngleSelector', () => function AngleSelectorMock() {
  return <div>Angle selector</div>
})

jest.mock('../photo-generation/LightingSelector', () => function LightingSelectorMock() {
  return <div>Lighting selector</div>
})

jest.mock('../photo-generation/SettingReferenceSlot', () => function SettingReferenceSlotMock() {
  return <div>Setting reference</div>
})

describe('BatchPhotoModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input)

      if (url === '/api/batch-limits') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ maxBatchSize: 5 }),
        } as Response)
      }

      if (url === '/api/quota') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { quota: { remaining: 5, limit: 10 } },
          }),
        } as Response)
      }

      if (url === '/api/image-generation/batches') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              quota: { remaining: 4, limit: 10 },
              jobs: [{
                id: 'job-1',
                menuItemId: 'item-1',
                status: 'queued',
                createdAt: new Date().toISOString(),
              }],
            },
          }),
        } as Response)
      }

      return Promise.reject(new Error(`Unmocked fetch: ${url}`))
    }) as jest.Mock
  })

  afterEach(() => {
    // @ts-ignore
    global.fetch = undefined
  })

  it('switches to the submitted progress state after starting a batch', async () => {
    render(
      <BatchPhotoModal
        menuId="menu-1"
        items={[{ id: 'item-1', name: 'Burger' }]}
        onClose={jest.fn()}
      />
    )

    await userEvent.click(await screen.findByRole('button', { name: /Start Batch/i }))

    expect(await screen.findByText('Batch generation has started')).toBeInTheDocument()
    expect(screen.getByText(/generated in the background/i)).toBeInTheDocument()
    expect(screen.getByText('Job progress')).toBeInTheDocument()
    expect(screen.getByText('Burger')).toBeInTheDocument()
    expect(screen.getByText('Queued')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'success',
        title: 'Batch started',
      }))
    })
  })
})
