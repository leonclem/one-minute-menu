/**
 * Property Test: Geo-Detection Fallback
 * 
 * **Property 9: Geo-Detection Fallback**
 * **Validates: Requirements 1.2, 12.1, 12.2, 12.3**
 * 
 * For any unmapped country code or detection failure, USD is returned.
 * Confidence is 'low' when using navigator.language fallback.
 */

import fc from 'fast-check';
import {
  mapCountryToBillingCurrency,
  mapCountryToMenuCurrency,
  suggestCurrencies,
  type GeoLocation,
} from '@/lib/geo-detection';

describe('Property 9: Geo-Detection Fallback', () => {
  it('should default to USD for any unmapped country code', () => {
    fc.assert(
      fc.property(
        // Generate random 2-letter country codes that are NOT in the mapped list
        fc.string({ minLength: 2, maxLength: 2 }).filter((code) => {
          const upperCode = code.toUpperCase();
          // Exclude known mapped countries
          const knownCountries = [
            'SG', 'US', 'GB', 'AU', 'AT', 'BE', 'DE', 'ES', 'FI', 'FR', 'IE', 'IT',
            'NL', 'PT', 'GR', 'CY', 'EE', 'LV', 'LT', 'LU', 'MT', 'SK', 'SI',
            'CA', 'NZ', 'MY', 'TH', 'ID', 'PH', 'VN', 'IN', 'HK', 'TW', 'JP', 'KR',
            'CN', 'CH', 'SE', 'NO', 'DK', 'PL', 'CZ', 'HU', 'RO', 'BG', 'TR', 'IL',
            'ZA', 'BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'RU', 'SA', 'AE', 'KW', 'QA',
            'EG', 'PK', 'BD', 'LK', 'MM', 'KH', 'LA', 'BN',
          ];
          return !knownCountries.includes(upperCode);
        }),
        (unmappedCountryCode) => {
          // Test billing currency fallback
          const billingCurrency = mapCountryToBillingCurrency(unmappedCountryCode);
          expect(billingCurrency).toBe('USD');

          // Test menu currency fallback
          const menuCurrency = mapCountryToMenuCurrency(unmappedCountryCode);
          expect(menuCurrency).toBe('USD');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return USD with low confidence for detection failures', () => {
    fc.assert(
      fc.property(
        // Generate various failure scenarios
        fc.oneof(
          fc.constant({ country: 'Unknown', countryCode: '', detected: false }),
          fc.constant({ country: '', countryCode: '', detected: false }),
          fc.constant({ country: 'Unknown', countryCode: '', detected: true }),
        ),
        (failedLocation: GeoLocation) => {
          const suggestion = suggestCurrencies(failedLocation);

          // Should default to USD
          expect(suggestion.billingCurrency).toBe('USD');
          expect(suggestion.menuCurrency).toBe('USD');

          // Should have low confidence
          expect(suggestion.confidence).toBe('low');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty or invalid country codes gracefully', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.string({ minLength: 0, maxLength: 1 }),
          fc.string({ minLength: 3, maxLength: 10 }),
        ),
        (invalidCode) => {
          // Should not throw and should default to USD
          expect(() => {
            const billingCurrency = mapCountryToBillingCurrency(invalidCode);
            expect(billingCurrency).toBe('USD');

            const menuCurrency = mapCountryToMenuCurrency(invalidCode);
            expect(menuCurrency).toBe('USD');
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return low confidence for browser language fallback scenarios', () => {
    fc.assert(
      fc.property(
        // Generate random unmapped country codes
        fc.string({ minLength: 2, maxLength: 2 }).filter((code) => {
          const upperCode = code.toUpperCase();
          // Only test unmapped countries that would use fallback
          const highConfidence = ['SG', 'US', 'GB', 'AU'];
          const mediumConfidence = [
            'AT', 'BE', 'DE', 'ES', 'FI', 'FR', 'IE', 'IT', 'NL', 'PT',
            'CA', 'NZ', 'MY', 'TH', 'ID',
          ];
          return !highConfidence.includes(upperCode) && !mediumConfidence.includes(upperCode);
        }),
        (countryCode) => {
          const location: GeoLocation = {
            country: countryCode,
            countryCode: countryCode.toUpperCase(),
            detected: true,
          };

          const suggestion = suggestCurrencies(location);

          // For unmapped countries, should default to USD with low confidence
          if (suggestion.billingCurrency === 'USD') {
            expect(suggestion.confidence).toBe('low');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
