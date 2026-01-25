/** @jest-environment node */

/**
 * Unit tests for webhook event processing
 * 
 * Feature: stripe-payment-integration
 * Task: 3.10 Write unit tests for each event type
 * 
 * Tests specific event type processing:
 * - checkout.session.completed processing
 * - customer.subscription.* processing
 * - invoice.payment_* processing
 * 
 * Requirements: 4.3, 8.5, 15.6
 */

// Set up environment variables before any imports
process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_secret_key_for_testing'
process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_mock_grid_plus'
process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_mock_grid_plus_premium'
process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_mock_creator_pack'

// Mock dependencies BEFORE importing
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))
jest.mock('@/lib/purchase-logger')
jest.mock('@/lib/notification-service', () => ({
  notificationService: {
    sendSubscriptionConfirmation: jest.fn().mockResolvedValue(undefined),
    sendCreatorPackConfirmation: jest.fn().mockResolvedValue(undefined),
    sendPaymentFailedNotification: jest.fn().mockResolvedValue(undefined),
    sendSubscriptionCancelledNotification: jest.fn().mockResolvedValue(undefined),
  }
}))

import {
  processCheckoutCompleted,
  processSubscriptionCreated,
  processSubscriptionUpdated,
  processSubscriptionDeleted,
  processInvoicePaymentSucceeded,
  processInvoicePaymentFailed,
} from '@/lib/stripe-webhook-processor'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { purchaseLogger } from '@/lib/purchase-logger'
import Stripe from 'stripe'

const mockSupabase = {
  from: jest.fn(),
  auth: {
    admin: {
      createUser: jest.fn(),
      listUsers: jest.fn(),
    }
  }
}

const mockPurchaseLogger = {
  logPurchase: jest.fn(),
  grantCreatorPack: jest.fn(),
  fulfillSubscription: jest.fn(),
  fulfillCreatorPack: jest.fn(),
  cancelSubscription: jest.fn(),
  checkIdempotency: jest.fn(),
}

describe('Feature: stripe-payment-integration - Webhook Event Processing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mock for supabase chain
    const createMockChain = () => ({
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })

    mockSupabase.from.mockImplementation(() => createMockChain())
    
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    
    ;(purchaseLogger.logPurchase as jest.Mock) = mockPurchaseLogger.logPurchase
    ;(purchaseLogger.grantCreatorPack as jest.Mock) = mockPurchaseLogger.grantCreatorPack
    ;(purchaseLogger.fulfillSubscription as jest.Mock) = mockPurchaseLogger.fulfillSubscription
    ;(purchaseLogger.fulfillCreatorPack as jest.Mock) = mockPurchaseLogger.fulfillCreatorPack
    ;(purchaseLogger.cancelSubscription as jest.Mock) = mockPurchaseLogger.cancelSubscription
    ;(purchaseLogger.checkIdempotency as jest.Mock) = mockPurchaseLogger.checkIdempotency
    
    mockPurchaseLogger.logPurchase.mockResolvedValue(undefined)
    mockPurchaseLogger.grantCreatorPack.mockResolvedValue(undefined)
    mockPurchaseLogger.fulfillSubscription.mockResolvedValue(undefined)
    mockPurchaseLogger.fulfillCreatorPack.mockResolvedValue(undefined)
    mockPurchaseLogger.cancelSubscription.mockResolvedValue(undefined)
    mockPurchaseLogger.checkIdempotency.mockResolvedValue(false)
  })

  /**
   * Test checkout.session.completed processing
   * Requirements: 4.3
   */
  describe('checkout.session.completed processing', () => {
    it('should process subscription purchase (grid_plus)', async () => {
      // Setup
      const userId = 'user-123'
      const sessionId = 'cs_test_123'
      const customerId = 'cus_test_123'
      const subscriptionId = 'sub_test_123'
      const amountTotal = 999

      const profileChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      
      const purchaseAuditChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { code: 'PGRST116' } // Not processed yet
        }),
      }
      
      const quotaChain = {
        upsert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        if (table === 'purchase_audit') return purchaseAuditChain
        if (table === 'generation_quotas') return quotaChain
        return {}
      })

      const session: Stripe.Checkout.Session = {
        id: sessionId,
        object: 'checkout.session',
        amount_total: amountTotal,
        customer: customerId,
        subscription: subscriptionId,
        metadata: {
          user_id: userId,
          product_type: 'grid_plus',
        },
        cancel_url: 'https://example.com/cancel',
        created: Math.floor(Date.now() / 1000),
        currency: 'usd',
        livemode: false,
        mode: 'subscription',
        payment_status: 'paid',
        status: 'complete',
        success_url: 'https://example.com/success',
      } as Stripe.Checkout.Session

      // Act
      await processCheckoutCompleted(session, 'req-123')

      // Assert
      expect(mockPurchaseLogger.fulfillSubscription).toHaveBeenCalledWith(
        userId,
        'grid_plus',
        customerId,
        subscriptionId,
        sessionId,
        amountTotal,
        true // isTestMode
      )
    })

    it('should process subscription purchase (grid_plus_premium)', async () => {
      // Setup
      const userId = 'user-456'
      const sessionId = 'cs_test_456'
      const customerId = 'cus_test_456'
      const subscriptionId = 'sub_test_456'
      const amountTotal = 2999

      const profileChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      
      const purchaseAuditChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { code: 'PGRST116' }
        }),
      }
      
      const quotaChain = {
        upsert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        if (table === 'purchase_audit') return purchaseAuditChain
        if (table === 'generation_quotas') return quotaChain
        return {}
      })

      const session: Stripe.Checkout.Session = {
        id: sessionId,
        object: 'checkout.session',
        amount_total: amountTotal,
        customer: customerId,
        subscription: subscriptionId,
        metadata: {
          user_id: userId,
          product_type: 'grid_plus_premium',
        },
        cancel_url: 'https://example.com/cancel',
        created: Math.floor(Date.now() / 1000),
        currency: 'usd',
        livemode: false,
        mode: 'subscription',
        payment_status: 'paid',
        status: 'complete',
        success_url: 'https://example.com/success',
      } as Stripe.Checkout.Session

      // Act
      await processCheckoutCompleted(session, 'req-456')

      // Assert
      expect(mockPurchaseLogger.fulfillSubscription).toHaveBeenCalledWith(
        userId,
        'grid_plus_premium',
        customerId,
        subscriptionId,
        sessionId,
        amountTotal,
        true // isTestMode
      )
    })

    it('should process Creator Pack purchase', async () => {
      // Setup
      const userId = 'user-789'
      const sessionId = 'cs_test_789'
      const amountTotal = 4900

      const profileChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ data: null, error: null }),
      }

      const purchaseAuditChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { code: 'PGRST116' }
        }),
      }
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        if (table === 'purchase_audit') return purchaseAuditChain
        return {}
      })

      const session: Stripe.Checkout.Session = {
        id: sessionId,
        object: 'checkout.session',
        amount_total: amountTotal,
        customer: 'cus_test_789',
        subscription: null,
        metadata: {
          user_id: userId,
          product_type: 'creator_pack',
        },
        cancel_url: 'https://example.com/cancel',
        created: Math.floor(Date.now() / 1000),
        currency: 'usd',
        livemode: false,
        mode: 'payment',
        payment_status: 'paid',
        status: 'complete',
        success_url: 'https://example.com/success',
      } as Stripe.Checkout.Session

      // Act
      await processCheckoutCompleted(session, 'req-789')

      // Assert
      expect(mockPurchaseLogger.fulfillCreatorPack).toHaveBeenCalledWith(
        userId,
        sessionId,
        amountTotal,
        false, // isFree
        true  // isTestMode
      )
    })

    it('should delegate idempotency to the fulfillment layer', async () => {
      // Setup
      const userId = 'user-999'
      const sessionId = 'cs_test_999'

      const profileChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ data: null, error: null }),
      }

      const purchaseAuditChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: { id: 'audit-123' }, // Already processed
          error: null
        }),
      }
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        if (table === 'purchase_audit') return purchaseAuditChain
        return {}
      })

      const session: Stripe.Checkout.Session = {
        id: sessionId,
        object: 'checkout.session',
        amount_total: 999,
        customer: 'cus_test_999',
        subscription: 'sub_test_999',
        metadata: {
          user_id: userId,
          product_type: 'grid_plus',
        },
        cancel_url: 'https://example.com/cancel',
        created: Math.floor(Date.now() / 1000),
        currency: 'usd',
        livemode: false,
        mode: 'subscription',
        payment_status: 'paid',
        status: 'complete',
        success_url: 'https://example.com/success',
      } as Stripe.Checkout.Session

      // Act
      await processCheckoutCompleted(session, 'req-999')

      // Assert - processor always delegates; fulfillment layer handles idempotency
      expect(mockPurchaseLogger.fulfillSubscription).toHaveBeenCalled()
      expect(mockPurchaseLogger.fulfillCreatorPack).not.toHaveBeenCalled()
    })
  })

  /**
   * Test customer.subscription.created processing
   * Requirements: 8.5
   */
  describe('customer.subscription.created processing', () => {
    it('should store subscription ID in user profile', async () => {
      // Setup
      const customerId = 'cus_test_123'
      const subscriptionId = 'sub_test_123'
      const userId = 'user-123'
      const currentPeriodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60

      const profileChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: { id: userId }, 
          error: null 
        }),
        update: jest.fn().mockReturnThis(),
      }
      
      // Mock the update chain separately
      const updateChain = {
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      
      profileChain.update.mockReturnValue(updateChain)
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        return {}
      })

      const subscription: Stripe.Subscription = {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status: 'active',
        current_period_end: currentPeriodEnd,
        // Required fields
        created: Math.floor(Date.now() / 1000),
        currency: 'usd',
        items: {
          object: 'list',
          data: [],
          has_more: false,
          url: '/v1/subscription_items',
        },
        livemode: false,
        start_date: Math.floor(Date.now() / 1000),
      } as Stripe.Subscription

      // Act
      await processSubscriptionCreated(subscription, 'req-123')

      // Assert
      expect(profileChain.select).toHaveBeenCalledWith('id')
      expect(profileChain.eq).toHaveBeenCalledWith('stripe_customer_id', customerId)
      expect(updateChain.eq).toHaveBeenCalledWith('id', userId)
      
      const updateCall = profileChain.update.mock.calls[0][0]
      expect(updateCall.stripe_subscription_id).toBe(subscriptionId)
      expect(updateCall.subscription_status).toBe('active')
      expect(updateCall.subscription_period_end).toBeDefined()
    })

    it('should not throw if user not found (graceful handling for race conditions)', async () => {
      // Setup
      const customerId = 'cus_not_found'
      const subscriptionId = 'sub_test_456'

      const profileChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'User not found' }
        }),
      }
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        return {}
      })

      const subscription: Stripe.Subscription = {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        created: Math.floor(Date.now() / 1000),
        currency: 'usd',
        items: {
          object: 'list',
          data: [],
          has_more: false,
          url: '/v1/subscription_items',
        },
        livemode: false,
        start_date: Math.floor(Date.now() / 1000),
      } as Stripe.Subscription

      // Act & Assert
      await expect(
        processSubscriptionCreated(subscription, 'req-456')
      ).resolves.not.toThrow()
    })
  })

  /**
   * Test customer.subscription.updated processing
   * Requirements: 15.6
   */
  describe('customer.subscription.updated processing', () => {
    it('should update subscription status and period end', async () => {
      // Setup
      const customerId = 'cus_test_123'
      const subscriptionId = 'sub_test_123'
      const userId = 'user-123'
      const currentPeriodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60

      const profileChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: { id: userId }, 
          error: null 
        }),
        update: jest.fn().mockReturnThis(),
      }
      
      const updateChain = {
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      
      profileChain.update.mockReturnValue(updateChain)
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        return {}
      })

      const subscription: Stripe.Subscription = {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status: 'past_due',
        current_period_end: currentPeriodEnd,
        created: Math.floor(Date.now() / 1000),
        currency: 'usd',
        items: {
          object: 'list',
          data: [],
          has_more: false,
          url: '/v1/subscription_items',
        },
        livemode: false,
        start_date: Math.floor(Date.now() / 1000),
      } as Stripe.Subscription

      // Act
      await processSubscriptionUpdated(subscription, 'req-123')

      // Assert
      const updateCall = profileChain.update.mock.calls[0][0]
      expect(updateCall.subscription_status).toBe('past_due')
      expect(updateCall.subscription_period_end).toBeDefined()
      expect(updateChain.eq).toHaveBeenCalledWith('id', userId)
    })
  })

  /**
   * Test customer.subscription.deleted processing
   * Requirements: 8.5
   */
  describe('customer.subscription.deleted processing', () => {
    it('should mark subscription as canceled and log cancellation', async () => {
      // Setup
      const customerId = 'cus_test_123'
      const subscriptionId = 'sub_test_123'
      const userId = 'user-123'
      const currentPeriodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60

      const profileChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: { id: userId, plan: 'grid_plus' }, 
          error: null 
        }),
        update: jest.fn().mockReturnThis(),
      }
      
      const updateChain = {
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      
      profileChain.update.mockReturnValue(updateChain)
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        return {}
      })

      const subscription: Stripe.Subscription = {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status: 'canceled',
        current_period_end: currentPeriodEnd,
        cancellation_details: {
          reason: 'cancellation_requested',
        },
        created: Math.floor(Date.now() / 1000),
        currency: 'usd',
        items: {
          object: 'list',
          data: [],
          has_more: false,
          url: '/v1/subscription_items',
        },
        livemode: false,
        start_date: Math.floor(Date.now() / 1000),
      } as Stripe.Subscription

      // Act
      await processSubscriptionDeleted(subscription, 'req-123')

      // Assert
      const updateCall = profileChain.update.mock.calls[0][0]
      expect(updateCall.subscription_status).toBe('canceled')
      expect(updateCall.subscription_period_end).toBeDefined()
      
      expect(mockPurchaseLogger.cancelSubscription).toHaveBeenCalledWith(
        userId,
        subscriptionId,
        'cancellation_requested',
        expect.any(Date)
      )
    })
  })

  /**
   * Test invoice.payment_succeeded processing
   * Requirements: 8.5
   */
  describe('invoice.payment_succeeded processing', () => {
    it('should log successful recurring payment', async () => {
      // Setup
      const customerId = 'cus_test_123'
      const invoiceId = 'in_test_123'
      const subscriptionId = 'sub_test_123'
      const userId = 'user-123'
      const amountPaid = 999

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

      const invoice: Stripe.Invoice = {
        id: invoiceId,
        object: 'invoice',
        customer: customerId,
        subscription: subscriptionId,
        amount_paid: amountPaid,
        currency: 'usd',
        period_start: Math.floor(Date.now() / 1000),
        period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        // Required fields
        account_country: 'US',
        account_name: 'Test Account',
        amount_due: amountPaid,
        amount_remaining: 0,
        created: Math.floor(Date.now() / 1000),
        default_payment_method: null,
        livemode: false,
        paid: true,
        status: 'paid',
      } as Stripe.Invoice

      // Act
      await processInvoicePaymentSucceeded(invoice, 'req-123')

      // Assert
      expect(mockPurchaseLogger.logPurchase).toHaveBeenCalledWith({
        userId,
        transactionId: invoiceId,
        productId: subscriptionId,
        amountCents: amountPaid,
        currency: 'usd',
        status: 'success',
        metadata: expect.objectContaining({
          action: 'recurring_payment',
          invoice_id: invoiceId,
          subscription_id: subscriptionId,
        }),
      })
    })

    it('should not throw if user not found (graceful handling)', async () => {
      // Setup
      const customerId = 'cus_not_found'
      const invoiceId = 'in_test_456'

      const profileChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'User not found' }
        }),
      }
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        return {}
      })

      const invoice: Stripe.Invoice = {
        id: invoiceId,
        object: 'invoice',
        customer: customerId,
        subscription: 'sub_test_456',
        amount_paid: 999,
        currency: 'usd',
        account_country: 'US',
        account_name: 'Test Account',
        amount_due: 999,
        amount_remaining: 0,
        created: Math.floor(Date.now() / 1000),
        default_payment_method: null,
        livemode: false,
        paid: true,
        status: 'paid',
      } as Stripe.Invoice

      // Act & Assert - should not throw
      await expect(
        processInvoicePaymentSucceeded(invoice, 'req-456')
      ).resolves.not.toThrow()
      
      // Should not log purchase if user not found
      expect(mockPurchaseLogger.logPurchase).not.toHaveBeenCalled()
    })
  })

  /**
   * Test invoice.payment_failed processing
   * Requirements: 8.5
   */
  describe('invoice.payment_failed processing', () => {
    it('should update subscription status to past_due and log failure', async () => {
      // Setup
      const customerId = 'cus_test_123'
      const invoiceId = 'in_test_123'
      const subscriptionId = 'sub_test_123'
      const userId = 'user-123'
      const amountDue = 999

      const profileChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: { id: userId }, 
          error: null 
        }),
        update: jest.fn().mockReturnThis(),
      }
      
      const updateChain = {
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      
      profileChain.update.mockReturnValue(updateChain)
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        return {}
      })

      const invoice: Stripe.Invoice = {
        id: invoiceId,
        object: 'invoice',
        customer: customerId,
        subscription: subscriptionId,
        amount_due: amountDue,
        currency: 'usd',
        attempt_count: 2,
        next_payment_attempt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        // Required fields
        account_country: 'US',
        account_name: 'Test Account',
        amount_paid: 0,
        amount_remaining: amountDue,
        created: Math.floor(Date.now() / 1000),
        default_payment_method: null,
        livemode: false,
        paid: false,
        status: 'open',
      } as Stripe.Invoice

      // Act
      await processInvoicePaymentFailed(invoice, 'req-123')

      // Assert
      const updateCall = profileChain.update.mock.calls[0][0]
      expect(updateCall.subscription_status).toBe('past_due')
      
      expect(mockPurchaseLogger.logPurchase).toHaveBeenCalledWith({
        userId,
        transactionId: invoiceId,
        productId: subscriptionId,
        amountCents: amountDue,
        currency: 'usd',
        status: 'failed',
        metadata: expect.objectContaining({
          action: 'payment_failed',
          invoice_id: invoiceId,
          subscription_id: subscriptionId,
          attempt_count: 2,
        }),
      })
    })

    it('should not throw if user not found (graceful handling)', async () => {
      // Setup
      const customerId = 'cus_not_found'
      const invoiceId = 'in_test_456'

      const profileChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'User not found' }
        }),
      }
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        return {}
      })

      const invoice: Stripe.Invoice = {
        id: invoiceId,
        object: 'invoice',
        customer: customerId,
        subscription: 'sub_test_456',
        amount_due: 999,
        currency: 'usd',
        account_country: 'US',
        account_name: 'Test Account',
        amount_paid: 0,
        amount_remaining: 999,
        created: Math.floor(Date.now() / 1000),
        default_payment_method: null,
        livemode: false,
        paid: false,
        status: 'open',
      } as Stripe.Invoice

      // Act & Assert - should not throw
      await expect(
        processInvoicePaymentFailed(invoice, 'req-456')
      ).resolves.not.toThrow()
      
      // Should not log purchase if user not found
      expect(mockPurchaseLogger.logPurchase).not.toHaveBeenCalled()
    })
  })
})
