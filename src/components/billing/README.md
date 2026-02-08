# Billing Currency Components

This directory contains components for managing billing currency in the GridMenu platform.

## Components

### BillingCurrencyChangeValidator

A comprehensive component that handles billing currency changes with proper validation and user guidance.

**Features:**
- Validates whether user can change billing currency based on subscription status
- Displays clear error messages when changes are blocked
- Explains the cancel/resubscribe process
- Shows information about remaining subscription time
- Allows free currency changes when no active subscription exists

**Requirements:** 4.1, 4.2, 4.3, 4.4, 4.5

**Usage:**

```tsx
import BillingCurrencyChangeValidator from '@/components/billing/BillingCurrencyChangeValidator'

export default function AccountSettingsPage() {
  const userId = 'user-123' // Get from auth context
  
  return (
    <div>
      <h1>Account Settings</h1>
      
      <section>
        <h2>Billing Currency</h2>
        <p>Choose the currency you use to pay GridMenu subscription fees.</p>
        
        <BillingCurrencyChangeValidator
          userId={userId}
          onCurrencyChanged={(newCurrency) => {
            console.log('Currency changed to:', newCurrency)
            // Optionally refresh pricing or other UI elements
          }}
        />
      </section>
    </div>
  )
}
```

**Props:**

- `userId` (required): The user's ID
- `onCurrencyChanged` (optional): Callback function called when currency is successfully changed
- `className` (optional): Additional CSS classes for styling

**Behavior:**

1. **With Active Subscription:**
   - Currency selector is disabled
   - Yellow warning box explains why change is blocked
   - Provides step-by-step instructions for changing currency:
     1. Cancel current subscription
     2. Wait for subscription to end (remains active until end of billing period)
     3. Change billing currency
     4. Subscribe again with new currency

2. **Without Active Subscription:**
   - Currency selector is enabled
   - User can freely change between supported currencies (SGD, USD, GBP, AUD, EUR)
   - Blue info box explains billing currency purpose
   - Save button becomes active when a different currency is selected
   - Success message shown after successful change

**Error Handling:**

- Displays validation errors if invalid currency is selected
- Shows error messages if save operation fails
- Provides clear feedback for all error states

### RenewalCurrencyDisplay

Displays the currency that will be used for subscription renewals.

**Usage:**

```tsx
import RenewalCurrencyDisplay from '@/components/billing/RenewalCurrencyDisplay'

export default function BillingPage() {
  const userId = 'user-123'
  
  return (
    <div>
      <h1>Billing Information</h1>
      <RenewalCurrencyDisplay userId={userId} />
    </div>
  )
}
```

## Testing

Unit tests are located in `src/__tests__/unit/billing-currency-change-restrictions.test.ts`

Run tests with:
```bash
npm test -- src/__tests__/unit/billing-currency-change-restrictions.test.ts
```

## Related Files

- `src/lib/billing-currency-service.ts` - Service layer for billing currency operations
- `src/lib/currency-config.ts` - Currency configuration and metadata
- `src/lib/stripe-config.ts` - Stripe integration for multi-currency pricing
