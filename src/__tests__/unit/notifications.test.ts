import sgMail from '@sendgrid/mail'
import { sendAdminNewUserAlert } from '@/lib/notifications'
import { User } from '@/types'

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
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
      aiImageGenerations: 20,
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

  it('should return false if SENDGRID_API_KEY is missing', async () => {
    delete process.env.SENDGRID_API_KEY
    
    const result = await sendAdminNewUserAlert(mockUser)
    
    expect(result).toBe(false)
    expect(sgMail.send).not.toHaveBeenCalled()
  })

  it('should return true if email is sent successfully', async () => {
    process.env.SENDGRID_API_KEY = 'test-api-key'
    ;(sgMail.send as jest.Mock).mockResolvedValue([{ statusCode: 202 }, {}])
    
    const result = await sendAdminNewUserAlert(mockUser)
    
    expect(result).toBe(true)
    expect(sgMail.send).toHaveBeenCalledWith(expect.objectContaining({
      to: expect.any(String),
      subject: expect.stringContaining(mockUser.email),
    }))
  })

  it('should return false if email sending fails', async () => {
    process.env.SENDGRID_API_KEY = 'test-api-key'
    ;(sgMail.send as jest.Mock).mockRejectedValue(new Error('SendGrid error'))
    
    const result = await sendAdminNewUserAlert(mockUser)
    
    expect(result).toBe(false)
    expect(sgMail.send).toHaveBeenCalled()
  })
})
