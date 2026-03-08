import { sendAdminNewUserAlert } from '@/lib/notifications'
import { User } from '@/types'

// Mock Postmark email client
const mockSendEmail = jest.fn()
jest.mock('@/lib/email-client', () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
}))

describe('Notifications: sendAdminNewUserAlert', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'newuser@example.com',
    plan: 'free',
    limits: {
      menus: 1,
      menuItems: 40,
      monthlyUploads: 5,
      aiImageGenerations: 50,
    },
    createdAt: new Date(),
    role: 'user',
    isApproved: false,
    adminNotified: false,
  }

  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('should return false if POSTMARK_SERVER_TOKEN is missing', async () => {
    delete process.env.POSTMARK_SERVER_TOKEN
    mockSendEmail.mockResolvedValue(false)
    
    const result = await sendAdminNewUserAlert(mockUser)
    
    expect(result).toBe(false)
  })

  it('should return true if email is sent successfully', async () => {
    process.env.POSTMARK_SERVER_TOKEN = 'test-token'
    mockSendEmail.mockResolvedValue(true)
    
    const result = await sendAdminNewUserAlert(mockUser)
    
    expect(result).toBe(true)
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: expect.any(String),
      subject: expect.stringContaining(mockUser.email),
    }))
  })

  it('should return false if email sending fails', async () => {
    process.env.POSTMARK_SERVER_TOKEN = 'test-token'
    mockSendEmail.mockResolvedValue(false)
    
    const result = await sendAdminNewUserAlert(mockUser)
    
    expect(result).toBe(false)
    expect(mockSendEmail).toHaveBeenCalled()
  })
})
