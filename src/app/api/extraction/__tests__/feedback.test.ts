/**
 * Tests for POST /api/extraction/feedback endpoint
 * @jest-environment node
 */

import { POST } from '../feedback/route'
import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

jest.mock('@/lib/supabase-server')

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>

describe('POST /api/extraction/feedback', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn()
    }
    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase)
  })

  it('returns 400 for invalid JSON', async () => {
    const request = new NextRequest('http://localhost/api/extraction/feedback', { method: 'POST', body: 'not-json' as any })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('requires authentication', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('No auth') })
    const request = new NextRequest('http://localhost/api/extraction/feedback', { method: 'POST', body: JSON.stringify({ jobId: 'j1', feedbackType: 'excellent' }) })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('validates required fields', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const request = new NextRequest('http://localhost/api/extraction/feedback', { method: 'POST', body: JSON.stringify({}) })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('forbids if job not owned by user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }) })
        })
      })
    })
    const request = new NextRequest('http://localhost/api/extraction/feedback', { method: 'POST', body: JSON.stringify({ jobId: 'j1', feedbackType: 'excellent' }) })
    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('inserts feedback successfully', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const single = jest.fn().mockResolvedValue({ data: { id: 'j1', user_id: 'u1' }, error: null })
    const eq2 = jest.fn().mockReturnValue({ single })
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 })
    const select = jest.fn().mockReturnValue({ eq: eq1 })
    const insert = jest.fn().mockResolvedValue({ error: null })
    const from = jest.fn()
    ;(from as any)
      .mockReturnValueOnce({ select, eq: eq1 }) // for menu_extraction_jobs
      .mockReturnValueOnce({ insert }) // for extraction_feedback
    mockSupabase.from = from

    const request = new NextRequest('http://localhost/api/extraction/feedback', {
      method: 'POST',
      body: JSON.stringify({ jobId: 'j1', feedbackType: 'excellent', comment: 'Great' })
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(insert).toHaveBeenCalled()
  })
})


