/**
 * Property-Based Test for Subscription Currency Immutability
 * 
 * Feature: currency-support
 * Task: 15.2
 * Property 5: Subscription Currency Immutability
 * 
 * Validates: Requirements 3.4, 3.5
 * 
 * This test verifies that for any subscription, the currency remains constant
 * across renewals and that account preference changes don't affect subscription currency.
 */

import fc from 'fast-check';
import {
  getBillingCurrency,
  setBillingCurrency,
  getRenewalCurrency,
} from '@/lib/billing-currency-service';
import type { BillingCurrency } from '@/lib/currency-config';
import { SUPPORTED_BILLING_CURRENCIES } from '@/lib/currency-config';

// Import test helpers
const testHelpers = require('@/lib/billing-currency-service').__test__;

describe('Property-Based Tests: Subscription Currency Immutability', () => {
  beforeEach(() => {
    // Clear mock data before each test
    testHelpers.clearMockData();
  });

  afterEach(() => {
    // Clean up after each test
    testHelpers.clearMockData();
  });

  // Feature: currency-support, Property 5: Subscription Currency Immutability
  // Validates: Requirements 3.4, 3.5
  describe('Property 5: Subscription Currency Immutability', () => {
    it('should maintain subscription currency across multiple renewals', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random user ID
          fc.uuid(),
          // Generate random subscription currency (one of the 5 supported)
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES),
          // Generate number of simulated renewals (1-10)
          fc.integer({ min: 1, max: 10 }),
          async (userId, subscriptionCurrency, renewalCount) => {
            // Setup: User has an active subscription with a specific currency
            testHelpers.setMockSubscriptionCurrency(userId, subscriptionCurrency);

            // Property: For any number of renewals, subscription currency remains constant
            for (let i = 0; i < renewalCount; i++) {
              const billingCurrency = await getBillingCurrency(userId);
              
              // Verify: Billing currency matches subscription currency
              expect(billingCurrency).toBe(subscriptionCurrency);
              
              // Verify: Renewal currency matches subscription currency
              const renewalInfo = await getRenewalCurrency(userId);
              expect(renewalInfo.currency).toBe(subscriptionCurrency);
              expect(renewalInfo.isSubscriptionCurrency).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not allow account preference changes to affect subscription currency', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random user ID
          fc.uuid(),
          // Generate random subscription currency
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES),
          // Generate array of different account preference currencies to try
          fc.array(
            fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES),
            { minLength: 1, maxLength: 5 }
          ),
          async (userId, subscriptionCurrency, accountPreferences) => {
            // Setup: User has an active subscription with a specific currency
            testHelpers.setMockSubscriptionCurrency(userId, subscriptionCurrency);

            // Property: Changing account preference should not affect subscription currency
            for (const newPreference of accountPreferences) {
              // Change account preference
              await setBillingCurrency(newPreference, userId);
              
              // Verify: getBillingCurrency still returns subscription currency (highest priority)
              const billingCurrency = await getBillingCurrency(userId);
              expect(billingCurrency).toBe(subscriptionCurrency);
              
              // Verify: Renewal currency is still subscription currency
              const renewalInfo = await getRenewalCurrency(userId);
              expect(renewalInfo.currency).toBe(subscriptionCurrency);
              expect(renewalInfo.isSubscriptionCurrency).toBe(true);
              
              // Verify: Message indicates subscription currency is immutable
              expect(renewalInfo.message).toContain('cannot be changed');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain subscription currency even when different from account preference', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random user ID
          fc.uuid(),
          // Generate subscription currency
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES),
          // Generate different account preference currency
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES),
          async (userId, subscriptionCurrency, accountPreference) => {
            // Filter out cases where they're the same (we want to test different currencies)
            fc.pre(subscriptionCurrency !== accountPreference);

            // Setup: User has subscription in one currency and account preference in another
            testHelpers.setMockSubscriptionCurrency(userId, subscriptionCurrency);
            testHelpers.setMockAccountCurrency(userId, accountPreference);

            // Property: Subscription currency takes precedence over account preference
            const billingCurrency = await getBillingCurrency(userId);
            expect(billingCurrency).toBe(subscriptionCurrency);
            expect(billingCurrency).not.toBe(accountPreference);
            
            // Verify: Renewal currency is subscription currency, not account preference
            const renewalInfo = await getRenewalCurrency(userId);
            expect(renewalInfo.currency).toBe(subscriptionCurrency);
            expect(renewalInfo.currency).not.toBe(accountPreference);
            expect(renewalInfo.isSubscriptionCurrency).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve subscription currency across all supported billing currencies', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random user ID
          fc.uuid(),
          // Test all supported billing currencies
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES),
          async (userId, currency) => {
            // Setup: User has subscription in the given currency
            testHelpers.setMockSubscriptionCurrency(userId, currency);

            // Property: Subscription currency is preserved for all supported currencies
            const billingCurrency = await getBillingCurrency(userId);
            expect(billingCurrency).toBe(currency);
            
            const renewalInfo = await getRenewalCurrency(userId);
            expect(renewalInfo.currency).toBe(currency);
            expect(renewalInfo.isSubscriptionCurrency).toBe(true);
            
            // Verify: Message contains the correct currency
            expect(renewalInfo.message).toContain(currency);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should indicate subscription currency cannot be changed in renewal info', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random user ID
          fc.uuid(),
          // Generate random subscription currency
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES),
          async (userId, subscriptionCurrency) => {
            // Setup: User has an active subscription
            testHelpers.setMockSubscriptionCurrency(userId, subscriptionCurrency);

            // Property: Renewal info should clearly indicate currency is immutable
            const renewalInfo = await getRenewalCurrency(userId);
            
            expect(renewalInfo.isSubscriptionCurrency).toBe(true);
            expect(renewalInfo.message).toContain('cannot be changed');
            expect(renewalInfo.message).toContain('active');
            expect(renewalInfo.currency).toBe(subscriptionCurrency);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use account preference when no subscription exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random user ID
          fc.uuid(),
          // Generate random account preference currency
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES),
          async (userId, accountPreference) => {
            // Setup: User has NO subscription, only account preference
            testHelpers.setMockAccountCurrency(userId, accountPreference);
            // Explicitly ensure no subscription currency
            testHelpers.setMockSubscriptionCurrency(userId, null as any);

            // Property: Without subscription, account preference is used
            const billingCurrency = await getBillingCurrency(userId);
            expect(billingCurrency).toBe(accountPreference);
            
            const renewalInfo = await getRenewalCurrency(userId);
            expect(renewalInfo.currency).toBe(accountPreference);
            expect(renewalInfo.isSubscriptionCurrency).toBe(false);
            
            // Verify: Message indicates currency can be changed
            expect(renewalInfo.message).toContain('can change');
            expect(renewalInfo.message).not.toContain('cannot be changed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain immutability across mixed currency scenarios', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random user ID
          fc.uuid(),
          // Generate subscription currency
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES),
          // Generate sequence of account preference changes
          fc.array(
            fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES),
            { minLength: 2, maxLength: 5 }
          ),
          async (userId, subscriptionCurrency, preferenceSequence) => {
            // Setup: User has active subscription
            testHelpers.setMockSubscriptionCurrency(userId, subscriptionCurrency);

            // Property: Subscription currency remains constant despite multiple preference changes
            for (const newPreference of preferenceSequence) {
              // Update account preference
              await setBillingCurrency(newPreference, userId);
              
              // Verify: Subscription currency is still immutable
              const billingCurrency = await getBillingCurrency(userId);
              expect(billingCurrency).toBe(subscriptionCurrency);
              
              // Verify: Renewal currency hasn't changed
              const renewalInfo = await getRenewalCurrency(userId);
              expect(renewalInfo.currency).toBe(subscriptionCurrency);
              expect(renewalInfo.isSubscriptionCurrency).toBe(true);
            }
            
            // Final verification: After all changes, subscription currency is still original
            const finalBillingCurrency = await getBillingCurrency(userId);
            expect(finalBillingCurrency).toBe(subscriptionCurrency);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
