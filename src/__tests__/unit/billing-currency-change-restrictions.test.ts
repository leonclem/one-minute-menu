/**
 * Unit Tests for Billing Currency Change Restrictions
 * 
 * Feature: currency-support
 * Task: 16.1
 * 
 * Tests verify that billing currency changes are properly restricted
 * when users have active subscriptions.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import {
  canChangeBillingCurrency,
  setBillingCurrency,
  getBillingCurrency,
} from '@/lib/billing-currency-service';
import type { BillingCurrency } from '@/lib/currency-config';

// Import test helpers
const testHelpers = require('@/lib/billing-currency-service').__test__;

describe('Billing Currency Change Restrictions', () => {
  beforeEach(() => {
    // Clear mock data before each test
    testHelpers.clearMockData();
  });

  afterEach(() => {
    // Clean up after each test
    testHelpers.clearMockData();
  });

  describe('canChangeBillingCurrency', () => {
    it('should block currency change when user has active subscription', async () => {
      const userId = 'user-with-subscription';
      
      // Setup: User has active subscription
      testHelpers.setMockActiveSubscription(userId, true);
      testHelpers.setMockSubscriptionCurrency(userId, 'USD');

      // Test: Check if user can change billing currency
      const result = await canChangeBillingCurrency(userId);

      // Verify: Change is not allowed
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('cancel');
      expect(result.reason).toContain('subscription');
    });

    it('should allow currency change when user has no active subscription', async () => {
      const userId = 'user-without-subscription';
      
      // Setup: User has NO active subscription
      testHelpers.setMockActiveSubscription(userId, false);

      // Test: Check if user can change billing currency
      const result = await canChangeBillingCurrency(userId);

      // Verify: Change is allowed
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should provide clear error message explaining cancel/resubscribe process', async () => {
      const userId = 'user-with-subscription';
      
      // Setup: User has active subscription
      testHelpers.setMockActiveSubscription(userId, true);

      // Test: Check restriction reason
      const result = await canChangeBillingCurrency(userId);

      // Verify: Message explains the process
      expect(result.reason).toContain('cancel');
      expect(result.reason).toContain('current subscription');
      expect(result.reason).toContain('billing period');
    });

    it('should explain that subscription remains active until end of period', async () => {
      const userId = 'user-with-subscription';
      
      // Setup: User has active subscription
      testHelpers.setMockActiveSubscription(userId, true);

      // Test: Check restriction reason
      const result = await canChangeBillingCurrency(userId);

      // Verify: Message explains remaining time handling
      expect(result.reason).toContain('remain active');
      expect(result.reason).toContain('end of the current billing period');
    });
  });

  describe('setBillingCurrency with active subscription', () => {
    it('should allow setting currency when no active subscription', async () => {
      const userId = 'user-without-subscription';
      const newCurrency: BillingCurrency = 'GBP';
      
      // Setup: User has NO active subscription
      testHelpers.setMockActiveSubscription(userId, false);
      testHelpers.setMockAccountCurrency(userId, 'USD');

      // Test: Change billing currency
      await expect(
        setBillingCurrency(newCurrency, userId)
      ).resolves.not.toThrow();

      // Verify: Currency was changed
      const currentCurrency = await getBillingCurrency(userId);
      expect(currentCurrency).toBe(newCurrency);
    });

    it('should allow currency change for all supported currencies when no subscription', async () => {
      const userId = 'user-without-subscription';
      const supportedCurrencies: BillingCurrency[] = ['SGD', 'USD', 'GBP', 'AUD', 'EUR'];
      
      // Setup: User has NO active subscription
      testHelpers.setMockActiveSubscription(userId, false);

      // Test: Try changing to each supported currency
      for (const currency of supportedCurrencies) {
        await expect(
          setBillingCurrency(currency, userId)
        ).resolves.not.toThrow();

        const currentCurrency = await getBillingCurrency(userId);
        expect(currentCurrency).toBe(currency);
      }
    });
  });

  describe('Currency change after subscription cancellation', () => {
    it('should allow currency change after subscription is canceled', async () => {
      const userId = 'user-canceling-subscription';
      const originalCurrency: BillingCurrency = 'USD';
      const newCurrency: BillingCurrency = 'EUR';
      
      // Setup: User initially has active subscription
      testHelpers.setMockActiveSubscription(userId, true);
      testHelpers.setMockSubscriptionCurrency(userId, originalCurrency);

      // Verify: Cannot change while subscription is active
      let result = await canChangeBillingCurrency(userId);
      expect(result.allowed).toBe(false);

      // Simulate: User cancels subscription
      testHelpers.setMockActiveSubscription(userId, false);
      testHelpers.setMockSubscriptionCurrency(userId, null as any);

      // Test: Check if change is now allowed
      result = await canChangeBillingCurrency(userId);
      expect(result.allowed).toBe(true);

      // Test: Change currency
      await setBillingCurrency(newCurrency, userId);

      // Verify: Currency was changed
      const currentCurrency = await getBillingCurrency(userId);
      expect(currentCurrency).toBe(newCurrency);
    });

    it('should use new currency for next subscription after change', async () => {
      const userId = 'user-resubscribing';
      const oldCurrency: BillingCurrency = 'USD';
      const newCurrency: BillingCurrency = 'GBP';
      
      // Setup: User had subscription, then canceled
      testHelpers.setMockActiveSubscription(userId, false);
      testHelpers.setMockAccountCurrency(userId, oldCurrency);

      // Test: Change currency
      await setBillingCurrency(newCurrency, userId);

      // Verify: New currency is set
      const currentCurrency = await getBillingCurrency(userId);
      expect(currentCurrency).toBe(newCurrency);

      // Simulate: User subscribes again with new currency
      testHelpers.setMockActiveSubscription(userId, true);
      testHelpers.setMockSubscriptionCurrency(userId, newCurrency);

      // Verify: Subscription uses new currency
      const subscriptionCurrency = await getBillingCurrency(userId);
      expect(subscriptionCurrency).toBe(newCurrency);
    });
  });

  describe('Multiple currency change attempts', () => {
    it('should consistently block changes while subscription is active', async () => {
      const userId = 'user-with-subscription';
      
      // Setup: User has active subscription
      testHelpers.setMockActiveSubscription(userId, true);
      testHelpers.setMockSubscriptionCurrency(userId, 'USD');

      // Test: Multiple attempts to check change permission
      for (let i = 0; i < 5; i++) {
        const result = await canChangeBillingCurrency(userId);
        expect(result.allowed).toBe(false);
        expect(result.reason).toBeDefined();
      }
    });

    it('should allow multiple currency changes when no subscription', async () => {
      const userId = 'user-without-subscription';
      const currencies: BillingCurrency[] = ['USD', 'GBP', 'EUR', 'SGD', 'AUD'];
      
      // Setup: User has NO active subscription
      testHelpers.setMockActiveSubscription(userId, false);

      // Test: Change currency multiple times
      for (const currency of currencies) {
        const canChange = await canChangeBillingCurrency(userId);
        expect(canChange.allowed).toBe(true);

        await setBillingCurrency(currency, userId);
        const currentCurrency = await getBillingCurrency(userId);
        expect(currentCurrency).toBe(currency);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle user with no subscription history', async () => {
      const userId = 'new-user';
      
      // Test: Check if new user can change currency
      const result = await canChangeBillingCurrency(userId);

      // Verify: New user can change currency freely
      expect(result.allowed).toBe(true);
    });

    it('should validate currency codes even when change is allowed', async () => {
      const userId = 'user-without-subscription';
      
      // Setup: User has NO active subscription
      testHelpers.setMockActiveSubscription(userId, false);

      // Test: Try to set invalid currency
      await expect(
        setBillingCurrency('INVALID' as BillingCurrency, userId)
      ).rejects.toThrow(/Invalid billing currency/);
    });

    it('should provide consistent error messages across multiple checks', async () => {
      const userId = 'user-with-subscription';
      
      // Setup: User has active subscription
      testHelpers.setMockActiveSubscription(userId, true);

      // Test: Check error message multiple times
      const result1 = await canChangeBillingCurrency(userId);
      const result2 = await canChangeBillingCurrency(userId);
      const result3 = await canChangeBillingCurrency(userId);

      // Verify: Messages are consistent
      expect(result1.reason).toBe(result2.reason);
      expect(result2.reason).toBe(result3.reason);
    });
  });

  describe('Requirement validation', () => {
    it('should satisfy Requirement 4.1: Block change with active subscription', async () => {
      const userId = 'user-with-subscription';
      testHelpers.setMockActiveSubscription(userId, true);

      const result = await canChangeBillingCurrency(userId);
      expect(result.allowed).toBe(false);
    });

    it('should satisfy Requirement 4.2: Display clear error message', async () => {
      const userId = 'user-with-subscription';
      testHelpers.setMockActiveSubscription(userId, true);

      const result = await canChangeBillingCurrency(userId);
      expect(result.reason).toBeDefined();
      expect(result.reason!.length).toBeGreaterThan(20); // Meaningful message
    });

    it('should satisfy Requirement 4.3: Explain remaining time handling', async () => {
      const userId = 'user-with-subscription';
      testHelpers.setMockActiveSubscription(userId, true);

      const result = await canChangeBillingCurrency(userId);
      expect(result.reason).toContain('billing period');
    });

    it('should satisfy Requirement 4.4: Allow free changes without subscription', async () => {
      const userId = 'user-without-subscription';
      testHelpers.setMockActiveSubscription(userId, false);

      const result = await canChangeBillingCurrency(userId);
      expect(result.allowed).toBe(true);
    });

    it('should satisfy Requirement 4.5: Use new currency after change and resubscribe', async () => {
      const userId = 'user-resubscribing';
      const newCurrency: BillingCurrency = 'EUR';
      
      // Cancel subscription, change currency
      testHelpers.setMockActiveSubscription(userId, false);
      await setBillingCurrency(newCurrency, userId);
      
      // Resubscribe with new currency
      testHelpers.setMockActiveSubscription(userId, true);
      testHelpers.setMockSubscriptionCurrency(userId, newCurrency);

      const currency = await getBillingCurrency(userId);
      expect(currency).toBe(newCurrency);
    });
  });
});
