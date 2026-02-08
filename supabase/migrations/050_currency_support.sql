-- ============================================================================
-- Currency Support Migration
-- ============================================================================
-- This migration adds currency support for two independent domains:
-- 1. Platform Billing Currency (Domain A) - How restaurateurs pay GridMenu
-- 2. Menu Display Currency (Domain B) - What customers see on menus
--
-- These domains are completely decoupled to support scenarios where a
-- restaurateur pays in one currency while displaying menu prices in another.
-- ============================================================================

-- ============================================================================
-- 1. Add Currency Columns to Profiles Table
-- ============================================================================

-- Add billing currency column (Domain A)
-- Restricted to 5 supported billing currencies: SGD, USD, GBP, AUD, EUR
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS billing_currency VARCHAR(3) DEFAULT 'USD';

-- Add menu currency column (Domain B)
-- Supports any valid ISO 4217 3-letter currency code
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS menu_currency VARCHAR(3) DEFAULT 'USD';

-- Add timestamp columns to track when currencies were last changed
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS billing_currency_updated_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS menu_currency_updated_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- 2. Add Constraints
-- ============================================================================

-- Billing currency must be one of the 5 supported currencies
-- This constraint enforces Domain A restrictions at the database level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_billing_currency'
  ) THEN
    ALTER TABLE profiles 
      ADD CONSTRAINT check_billing_currency 
        CHECK (billing_currency IN ('SGD', 'USD', 'GBP', 'AUD', 'EUR'));
  END IF;
END $$;

-- Menu currency validation is handled at the service layer
-- (ISO 4217 validation requires checking 3 uppercase letters)

-- ============================================================================
-- 3. Create Indexes for Currency Queries
-- ============================================================================

-- Index for billing currency queries (e.g., analytics, reporting)
CREATE INDEX IF NOT EXISTS idx_profiles_billing_currency 
  ON profiles(billing_currency);

-- Index for menu currency queries (e.g., analytics, reporting)
CREATE INDEX IF NOT EXISTS idx_profiles_menu_currency 
  ON profiles(menu_currency);

-- ============================================================================
-- 4. Add Column Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN profiles.billing_currency IS 
  'Currency used for Stripe subscription billing (Domain A). Must be one of: SGD, USD, GBP, AUD, EUR. This determines how the restaurateur pays GridMenu.';

COMMENT ON COLUMN profiles.menu_currency IS 
  'Currency displayed on customer-facing menus (Domain B). Any valid ISO 4217 3-letter code. This determines what currency symbol customers see on menus.';

COMMENT ON COLUMN profiles.billing_currency_updated_at IS 
  'Timestamp of last explicit billing currency change by user. NULL means never changed (using default).';

COMMENT ON COLUMN profiles.menu_currency_updated_at IS 
  'Timestamp of last explicit menu currency change by user. NULL means never changed (using default).';

-- ============================================================================
-- 5. Migration Verification
-- ============================================================================

-- Verify columns were added successfully
DO $$
BEGIN
  -- Check billing_currency column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'billing_currency'
  ) THEN
    RAISE EXCEPTION 'Migration failed: billing_currency column not created';
  END IF;

  -- Check menu_currency column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'menu_currency'
  ) THEN
    RAISE EXCEPTION 'Migration failed: menu_currency column not created';
  END IF;

  -- Check billing_currency_updated_at column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'billing_currency_updated_at'
  ) THEN
    RAISE EXCEPTION 'Migration failed: billing_currency_updated_at column not created';
  END IF;

  -- Check menu_currency_updated_at column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'menu_currency_updated_at'
  ) THEN
    RAISE EXCEPTION 'Migration failed: menu_currency_updated_at column not created';
  END IF;

  -- Check constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_billing_currency'
  ) THEN
    RAISE EXCEPTION 'Migration failed: check_billing_currency constraint not created';
  END IF;

  RAISE NOTICE 'Currency support migration completed successfully';
END $$;
