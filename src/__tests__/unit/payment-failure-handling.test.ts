/** @jest-environment node */

/**
 * Unit tests for new payment failure handling logic
 * 
 * Feature: stripe-payment-integration
 * 
 * Tests specific event type processing for failures:
 * - payment_intent.payment_failed
 * - charge.failed
 * - payment_intent.succeeded
 */

// Set up environment variables before any imports
process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock'

// Mock dependencies BEFORE importing
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))
jest.mock('@/lib/purchase-logger')
jest.mock('@/lib/notification-service', () => ({
  notificationService: {
    sendPaymentFailedNotification: jest.fn().mockResolvedValue(undefined),
  }
}))

import {
  processPaymentIntentSucceeded,
  processPaymentIntentFailed,
  processChargeFailed,
} from '@/lib/stripe-webhook-processor'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { purchaseLogger } from '@/lib/purchase-logger'
import { notificationService } from '@/lib/notification-service'
import Stripe from 'stripe'

const mockSupabase = {
  from: jest.fn(),
}

const mockPurchaseLogger = {
  logPurchase: jest.fn(),
}

describe('Payment Failure Handling Webhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    const createMockChain = () => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })

    mockSupabase.from.mockImplementation(() => createMockChain())
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(purchaseLogger.logPurchase as jest.Mock) = mockPurchaseLogger.logPurchase
    mockPurchaseLogger.logPurchase.mockResolvedValue('audit-123')
  })

  describe('processPaymentIntentFailed', () => {
    it('should log failure and notify user when customer exists', async () => {
      const customerId = 'cus_test_123'
      const userId = 'user-123'
      const piId = 'pi_test_123'
      const failureReason = 'Your card was declined.'

      const profileChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: { id: userId }, 
          error: null 
        }),
      }
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        return {}
      })

      const paymentIntent = {
        id: piId,
        object: 'payment_intent',
        customer: customerId,
        amount: 4900,
        currency: 'usd',
        livemode: false,
        last_payment_error: {
          message: failureReason,
          code: 'card_declined'
        },
        metadata: {
          product_type: 'creator_pack'
        }
      } as unknown as Stripe.PaymentIntent

      await processPaymentIntentFailed(paymentIntent, 'req-123')

      expect(mockPurchaseLogger.logPurchase).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        transactionId: piId,
        status: 'failed',
        metadata: expect.objectContaining({
          failure_reason: failureReason,
          action: 'payment_intent_failed'
        })
      }))

      expect(notificationService.sendPaymentFailedNotification).toHaveBeenCalledWith(userId, failureReason)
    })

    it('should not log or notify if user not found', async () => {
      const customerId = 'cus_unknown'
      
      const profileChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      }
      
      mockSupabase.from.mockImplementation(() => profileChain)

      const paymentIntent = {
        id: 'pi_test_failed',
        customer: customerId,
      } as unknown as Stripe.PaymentIntent

      await processPaymentIntentFailed(paymentIntent, 'req-456')

      expect(mockPurchaseLogger.logPurchase).not.toHaveBeenCalled()
      expect(notificationService.sendPaymentFailedNotification).not.toHaveBeenCalled()
    })
  })

  describe('processChargeFailed', () => {
    it('should log detailed charge failure', async () => {
      const customerId = 'cus_test_789'
      const userId = 'user-789'
      const chargeId = 'ch_test_789'
      const failureReason = 'Insufficient funds'

      const profileChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: { id: userId }, 
          error: null 
        }),
      }
      
      mockSupabase.from.mockImplementation(() => profileChain)

      const charge = {
        id: chargeId,
        object: 'charge',
        customer: customerId,
        amount: 999,
        currency: 'usd',
        livemode: false,
        failure_message: failureReason,
        failure_code: 'card_declined',
        payment_intent: 'pi_test_789',
        metadata: {
          product_type: 'grid_plus'
        }
      } as unknown as Stripe.Charge

      await processChargeFailed(charge, 'req-789')

      expect(mockPurchaseLogger.logPurchase).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        transactionId: chargeId,
        status: 'failed',
        metadata: expect.objectContaining({
          failure_reason: failureReason,
          action: 'charge_failed'
        })
      }))
    })
  })
})
