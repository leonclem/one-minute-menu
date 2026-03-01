/**
 * Unit tests for notification service
 * Tests email sending for subscription confirmations, Creator Pack confirmations,
 * payment failures, and subscription cancellations
 *
 * Requirements: 5.5, 6.4, 7.5, 8.4
 */

import { notificationService } from '@/lib/notification-service'
import { createWorkerSupabaseClient } from '@/lib/supabase-worker'

// Mock Postmark email client
const mockSendEmail = jest.fn()
jest.mock('@/lib/email-client', () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
}))

// Mock Supabase client (worker-safe client used by notificationService)
jest.mock('@/lib/supabase-worker', () => ({
  createWorkerSupabaseClient: jest.fn(),
}))

describe('Notification Service', () => {
  const mockProfile = {
    email: 'user@example.com',
    restaurant_name: 'Test Restaurant',
  }

  let mockSupabaseClient: any

  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.POSTMARK_SERVER_TOKEN = 'test-token'
    process.env.FROM_EMAIL = 'noreply@gridmenu.ai'
    process.env.FROM_NAME = 'GridMenu'
    process.env.NEXT_PUBLIC_APP_URL = 'https://gridmenu.ai'

    mockSupabaseClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: mockProfile,
              error: null,
            })),
          })),
        })),
      })),
    }

    ;(createWorkerSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient)
    mockSendEmail.mockResolvedValue(true)
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('sendSubscriptionConfirmation', () => {
    it('should send subscription confirmation email for Grid Plus', async () => {
      await notificationService.sendSubscriptionConfirmation('user-123', 'grid_plus', 2999)

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          from: 'noreply@gridmenu.ai',
          fromName: 'GridMenu',
          subject: expect.stringContaining('Grid+'),
          text: expect.stringContaining('Grid+'),
          html: expect.stringContaining('Grid+'),
        })
      )
    })

    it('should send subscription confirmation email for Grid Plus Premium', async () => {
      await notificationService.sendSubscriptionConfirmation('user-123', 'grid_plus_premium', 4999)

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Grid+ Premium'),
          text: expect.stringContaining('Grid+ Premium'),
          html: expect.stringContaining('Grid+ Premium'),
        })
      )
    })

    it('should include correct amount in email', async () => {
      await notificationService.sendSubscriptionConfirmation('user-123', 'grid_plus', 2999)

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('29.99'),
          html: expect.stringContaining('29.99'),
        })
      )
    })

    it('should include manage subscription link', async () => {
      await notificationService.sendSubscriptionConfirmation('user-123', 'grid_plus', 2999)

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('https://gridmenu.ai/dashboard/settings'),
        })
      )
    })

    it('should handle user profile fetch error gracefully', async () => {
      mockSupabaseClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: new Error('User not found'),
            })),
          })),
        })),
      }))

      await expect(
        notificationService.sendSubscriptionConfirmation('user-123', 'grid_plus', 2999)
      ).resolves.not.toThrow()

      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('should handle email send error gracefully', async () => {
      mockSendEmail.mockRejectedValue(new Error('Email send error'))

      await expect(
        notificationService.sendSubscriptionConfirmation('user-123', 'grid_plus', 2999)
      ).resolves.not.toThrow()
    })
  })

  describe('sendCreatorPackConfirmation', () => {
    it('should send free Creator Pack confirmation email', async () => {
      await notificationService.sendCreatorPackConfirmation('user-123', true)

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('free Creator Pack'),
          text: expect.stringContaining('free Creator Pack'),
          html: expect.stringContaining('Free Creator Pack'),
        })
      )
    })

    it('should send paid Creator Pack confirmation email', async () => {
      await notificationService.sendCreatorPackConfirmation('user-123', false)

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Creator Pack'),
          text: expect.stringContaining('purchasing a Creator Pack'),
          html: expect.stringContaining('Creator Pack Confirmed'),
        })
      )
    })

    it('should include pack details in email', async () => {
      await notificationService.sendCreatorPackConfirmation('user-123', false)

      const call = mockSendEmail.mock.calls[0][0]
      expect(call.text).toContain('24 months')
      expect(call.text).toContain('7 days')
      expect(call.html).toContain('24 months')
      expect(call.html).toContain('7 days')
    })

    it('should include dashboard link', async () => {
      await notificationService.sendCreatorPackConfirmation('user-123', false)

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('https://gridmenu.ai/dashboard'),
        })
      )
    })

    it('should handle user profile fetch error gracefully', async () => {
      const errorMockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({
                data: null,
                error: new Error('User not found'),
              })),
            })),
          })),
        })),
      }
      ;(createWorkerSupabaseClient as jest.Mock).mockReturnValueOnce(errorMockClient)

      await expect(
        notificationService.sendCreatorPackConfirmation('user-123', false)
      ).resolves.not.toThrow()

      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('should handle email send error gracefully', async () => {
      mockSendEmail.mockRejectedValueOnce(new Error('Email send error'))

      await expect(
        notificationService.sendCreatorPackConfirmation('user-123', false)
      ).resolves.not.toThrow()
    })
  })

  describe('sendPaymentFailedNotification', () => {
    it('should send payment failed notification email', async () => {
      await notificationService.sendPaymentFailedNotification('user-123', 'Card declined')

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Payment failed'),
          text: expect.stringContaining('Card declined'),
          html: expect.stringContaining('Card declined'),
        })
      )
    })

    it('should include failure reason in email', async () => {
      const reason = 'Insufficient funds'
      await notificationService.sendPaymentFailedNotification('user-123', reason)

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(reason),
          html: expect.stringContaining(reason),
        })
      )
    })

    it('should include update payment method link', async () => {
      await notificationService.sendPaymentFailedNotification('user-123', 'Card declined')

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('https://gridmenu.ai/dashboard/settings'),
        })
      )
    })

    it('should handle user profile fetch error gracefully', async () => {
      const errorMockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({
                data: null,
                error: new Error('User not found'),
              })),
            })),
          })),
        })),
      }
      ;(createWorkerSupabaseClient as jest.Mock).mockReturnValueOnce(errorMockClient)

      await expect(
        notificationService.sendPaymentFailedNotification('user-123', 'Card declined')
      ).resolves.not.toThrow()

      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('should handle email send error gracefully', async () => {
      mockSendEmail.mockRejectedValueOnce(new Error('Email send error'))

      await expect(
        notificationService.sendPaymentFailedNotification('user-123', 'Card declined')
      ).resolves.not.toThrow()
    })
  })

  describe('sendSubscriptionCancelledNotification', () => {
    it('should send subscription cancelled notification email', async () => {
      const periodEnd = new Date('2024-12-31')
      await notificationService.sendSubscriptionCancelledNotification('user-123', periodEnd)

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('cancelled'),
          text: expect.stringContaining('cancelled'),
          html: expect.stringContaining('Subscription Cancelled'),
        })
      )
    })

    it('should include period end date in email', async () => {
      const periodEnd = new Date('2024-12-31')
      await notificationService.sendSubscriptionCancelledNotification('user-123', periodEnd)

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('December 31, 2024'),
          html: expect.stringContaining('December 31, 2024'),
        })
      )
    })

    it('should include resubscribe link', async () => {
      const periodEnd = new Date('2024-12-31')
      await notificationService.sendSubscriptionCancelledNotification('user-123', periodEnd)

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('https://gridmenu.ai/pricing'),
        })
      )
    })

    it('should handle user profile fetch error gracefully', async () => {
      const errorMockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({
                data: null,
                error: new Error('User not found'),
              })),
            })),
          })),
        })),
      }
      ;(createWorkerSupabaseClient as jest.Mock).mockReturnValueOnce(errorMockClient)

      const periodEnd = new Date('2024-12-31')
      await expect(
        notificationService.sendSubscriptionCancelledNotification('user-123', periodEnd)
      ).resolves.not.toThrow()

      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('should handle email send error gracefully', async () => {
      mockSendEmail.mockRejectedValueOnce(new Error('Email send error'))
      const periodEnd = new Date('2024-12-31')

      await expect(
        notificationService.sendSubscriptionCancelledNotification('user-123', periodEnd)
      ).resolves.not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should not throw errors when email sending fails', async () => {
      mockSendEmail.mockRejectedValue(new Error('Network error'))

      await expect(
        notificationService.sendSubscriptionConfirmation('user-123', 'grid_plus', 2999)
      ).resolves.not.toThrow()

      await expect(
        notificationService.sendCreatorPackConfirmation('user-123', false)
      ).resolves.not.toThrow()

      await expect(
        notificationService.sendPaymentFailedNotification('user-123', 'Card declined')
      ).resolves.not.toThrow()

      await expect(
        notificationService.sendSubscriptionCancelledNotification('user-123', new Date())
      ).resolves.not.toThrow()
    })

    it('should log errors but continue execution', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      mockSendEmail.mockRejectedValue(new Error('Email send error'))

      await notificationService.sendSubscriptionConfirmation('user-123', 'grid_plus', 2999)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[notification-service]'),
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })
})
