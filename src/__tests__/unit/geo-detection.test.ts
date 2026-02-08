/**
 * Unit Tests: Geo-Detection Service
 * 
 * Tests country mapping, detection failure handling, caching behavior,
 * and confidence levels.
 * 
 * **Validates: Requirements 1.1, 1.2, 5.2, 12.1, 12.2, 12.3**
 */

import {
  mapCountryToBillingCurrency,
  mapCountryToMenuCurrency,
  suggestCurrencies,
  detectLocation,
  type GeoLocation,
} from '@/lib/geo-detection';

// Mock localStorage for Node.js environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Set up global localStorage mock
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Geo-Detection Service', () => {
  describe('Country to Billing Currency Mapping', () => {
    it('should map SG to SGD', () => {
      expect(mapCountryToBillingCurrency('SG')).toBe('SGD');
    });

    it('should map US to USD', () => {
      expect(mapCountryToBillingCurrency('US')).toBe('USD');
    });

    it('should map GB to GBP', () => {
      expect(mapCountryToBillingCurrency('GB')).toBe('GBP');
    });

    it('should map AU to AUD', () => {
      expect(mapCountryToBillingCurrency('AU')).toBe('AUD');
    });

    it('should map Eurozone countries to EUR', () => {
      const eurozoneCountries = [
        'AT', 'BE', 'DE', 'ES', 'FI', 'FR', 'IE', 'IT', 'NL', 'PT',
        'GR', 'CY', 'EE', 'LV', 'LT', 'LU', 'MT', 'SK', 'SI',
      ];

      eurozoneCountries.forEach((country) => {
        expect(mapCountryToBillingCurrency(country)).toBe('EUR');
      });
    });

    it('should map unmapped countries to USD', () => {
      const unmappedCountries = ['XX', 'ZZ', 'QQ', 'BR', 'MX'];

      unmappedCountries.forEach((country) => {
        expect(mapCountryToBillingCurrency(country)).toBe('USD');
      });
    });

    it('should handle lowercase country codes', () => {
      expect(mapCountryToBillingCurrency('sg')).toBe('SGD');
      expect(mapCountryToBillingCurrency('us')).toBe('USD');
      expect(mapCountryToBillingCurrency('gb')).toBe('GBP');
    });
  });

  describe('Country to Menu Currency Mapping', () => {
    it('should map SG to SGD', () => {
      expect(mapCountryToMenuCurrency('SG')).toBe('SGD');
    });

    it('should map US to USD', () => {
      expect(mapCountryToMenuCurrency('US')).toBe('USD');
    });

    it('should map GB to GBP', () => {
      expect(mapCountryToMenuCurrency('GB')).toBe('GBP');
    });

    it('should map AU to AUD', () => {
      expect(mapCountryToMenuCurrency('AU')).toBe('AUD');
    });

    it('should map MY to MYR', () => {
      expect(mapCountryToMenuCurrency('MY')).toBe('MYR');
    });

    it('should map TH to THB', () => {
      expect(mapCountryToMenuCurrency('TH')).toBe('THB');
    });

    it('should map ID to IDR', () => {
      expect(mapCountryToMenuCurrency('ID')).toBe('IDR');
    });

    it('should map JP to JPY', () => {
      expect(mapCountryToMenuCurrency('JP')).toBe('JPY');
    });

    it('should map KR to KRW', () => {
      expect(mapCountryToMenuCurrency('KR')).toBe('KRW');
    });

    it('should map Eurozone countries to EUR', () => {
      const eurozoneCountries = [
        'AT', 'BE', 'DE', 'ES', 'FI', 'FR', 'IE', 'IT', 'NL', 'PT',
      ];

      eurozoneCountries.forEach((country) => {
        expect(mapCountryToMenuCurrency(country)).toBe('EUR');
      });
    });

    it('should map unmapped countries to USD', () => {
      const unmappedCountries = ['XX', 'ZZ', 'QQ'];

      unmappedCountries.forEach((country) => {
        expect(mapCountryToMenuCurrency(country)).toBe('USD');
      });
    });
  });

  describe('Currency Suggestion', () => {
    it('should suggest SGD for Singapore with high confidence', () => {
      const location: GeoLocation = {
        country: 'Singapore',
        countryCode: 'SG',
        detected: true,
      };

      const suggestion = suggestCurrencies(location);

      expect(suggestion.billingCurrency).toBe('SGD');
      expect(suggestion.menuCurrency).toBe('SGD');
      expect(suggestion.confidence).toBe('high');
    });

    it('should suggest USD for United States with high confidence', () => {
      const location: GeoLocation = {
        country: 'United States',
        countryCode: 'US',
        detected: true,
      };

      const suggestion = suggestCurrencies(location);

      expect(suggestion.billingCurrency).toBe('USD');
      expect(suggestion.menuCurrency).toBe('USD');
      expect(suggestion.confidence).toBe('high');
    });

    it('should suggest GBP for United Kingdom with high confidence', () => {
      const location: GeoLocation = {
        country: 'United Kingdom',
        countryCode: 'GB',
        detected: true,
      };

      const suggestion = suggestCurrencies(location);

      expect(suggestion.billingCurrency).toBe('GBP');
      expect(suggestion.menuCurrency).toBe('GBP');
      expect(suggestion.confidence).toBe('high');
    });

    it('should suggest AUD for Australia with high confidence', () => {
      const location: GeoLocation = {
        country: 'Australia',
        countryCode: 'AU',
        detected: true,
      };

      const suggestion = suggestCurrencies(location);

      expect(suggestion.billingCurrency).toBe('AUD');
      expect(suggestion.menuCurrency).toBe('AUD');
      expect(suggestion.confidence).toBe('high');
    });

    it('should suggest EUR for Eurozone countries with medium confidence', () => {
      const location: GeoLocation = {
        country: 'Germany',
        countryCode: 'DE',
        detected: true,
      };

      const suggestion = suggestCurrencies(location);

      expect(suggestion.billingCurrency).toBe('EUR');
      expect(suggestion.menuCurrency).toBe('EUR');
      expect(suggestion.confidence).toBe('medium');
    });

    it('should suggest USD for Canada with medium confidence', () => {
      const location: GeoLocation = {
        country: 'Canada',
        countryCode: 'CA',
        detected: true,
      };

      const suggestion = suggestCurrencies(location);

      expect(suggestion.billingCurrency).toBe('USD');
      expect(suggestion.menuCurrency).toBe('CAD');
      expect(suggestion.confidence).toBe('medium');
    });

    it('should suggest USD for Malaysia with medium confidence', () => {
      const location: GeoLocation = {
        country: 'Malaysia',
        countryCode: 'MY',
        detected: true,
      };

      const suggestion = suggestCurrencies(location);

      expect(suggestion.billingCurrency).toBe('USD');
      expect(suggestion.menuCurrency).toBe('MYR');
      expect(suggestion.confidence).toBe('medium');
    });

    it('should suggest USD for Thailand with medium confidence', () => {
      const location: GeoLocation = {
        country: 'Thailand',
        countryCode: 'TH',
        detected: true,
      };

      const suggestion = suggestCurrencies(location);

      expect(suggestion.billingCurrency).toBe('USD');
      expect(suggestion.menuCurrency).toBe('THB');
      expect(suggestion.confidence).toBe('medium');
    });

    it('should default to USD with low confidence for detection failure', () => {
      const location: GeoLocation = {
        country: 'Unknown',
        countryCode: '',
        detected: false,
      };

      const suggestion = suggestCurrencies(location);

      expect(suggestion.billingCurrency).toBe('USD');
      expect(suggestion.menuCurrency).toBe('USD');
      expect(suggestion.confidence).toBe('low');
    });

    it('should default to USD with low confidence for unmapped country', () => {
      const location: GeoLocation = {
        country: 'Unknown Country',
        countryCode: 'XX',
        detected: true,
      };

      const suggestion = suggestCurrencies(location);

      expect(suggestion.billingCurrency).toBe('USD');
      expect(suggestion.menuCurrency).toBe('USD');
      expect(suggestion.confidence).toBe('low');
    });

    it('should default to USD with low confidence when countryCode is empty', () => {
      const location: GeoLocation = {
        country: 'Unknown',
        countryCode: '',
        detected: true,
      };

      const suggestion = suggestCurrencies(location);

      expect(suggestion.billingCurrency).toBe('USD');
      expect(suggestion.menuCurrency).toBe('USD');
      expect(suggestion.confidence).toBe('low');
    });
  });

  describe('Detection Failure Handling', () => {
    it('should handle detection failure gracefully', async () => {
      // Clear cache first to ensure fresh detection
      localStorage.clear();

      const location = await detectLocation();

      // In Node.js environment without Vercel headers and without navigator.language,
      // should return undetected location
      // Note: The actual behavior depends on whether navigator is available in test environment
      expect(location).toBeDefined();
      expect(location.country).toBeDefined();
      expect(location.countryCode).toBeDefined();
      expect(typeof location.detected).toBe('boolean');
    });

    it('should suggest USD when detection fails', () => {
      const failedLocation: GeoLocation = {
        country: 'Unknown',
        countryCode: '',
        detected: false,
      };

      const suggestion = suggestCurrencies(failedLocation);

      expect(suggestion.billingCurrency).toBe('USD');
      expect(suggestion.menuCurrency).toBe('USD');
      expect(suggestion.confidence).toBe('low');
    });
  });

  describe('Caching Behavior', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear();
    });

    it('should cache detection results in localStorage', async () => {
      const location = await detectLocation();

      // Check if result was cached
      const cached = localStorage.getItem('gridmenu_geo_detection');
      expect(cached).toBeTruthy();

      if (cached) {
        const parsed = JSON.parse(cached);
        expect(parsed.location).toEqual(location);
        expect(parsed.timestamp).toBeDefined();
      }
    });

    it('should use cached result on subsequent calls', async () => {
      // First call
      const location1 = await detectLocation();

      // Second call should use cache
      const location2 = await detectLocation();

      expect(location1).toEqual(location2);
    });

    it('should handle cache read errors gracefully', async () => {
      // Set invalid JSON in cache
      localStorage.setItem('gridmenu_geo_detection', 'invalid json');

      // Should not throw and should detect normally
      const location = await detectLocation();
      expect(location).toBeDefined();
    });
  });

  describe('Confidence Levels', () => {
    it('should return high confidence for direct billing currency mappings', () => {
      const highConfidenceCountries = ['SG', 'US', 'GB', 'AU'];

      highConfidenceCountries.forEach((countryCode) => {
        const location: GeoLocation = {
          country: countryCode,
          countryCode,
          detected: true,
        };

        const suggestion = suggestCurrencies(location);
        expect(suggestion.confidence).toBe('high');
      });
    });

    it('should return medium confidence for Eurozone countries', () => {
      const location: GeoLocation = {
        country: 'Germany',
        countryCode: 'DE',
        detected: true,
      };

      const suggestion = suggestCurrencies(location);
      expect(suggestion.confidence).toBe('medium');
    });

    it('should return medium confidence for nearby regions', () => {
      const mediumConfidenceCountries = ['CA', 'NZ', 'MY', 'TH', 'ID'];

      mediumConfidenceCountries.forEach((countryCode) => {
        const location: GeoLocation = {
          country: countryCode,
          countryCode,
          detected: true,
        };

        const suggestion = suggestCurrencies(location);
        expect(suggestion.confidence).toBe('medium');
      });
    });

    it('should return low confidence for unmapped countries', () => {
      const location: GeoLocation = {
        country: 'Unknown',
        countryCode: 'XX',
        detected: true,
      };

      const suggestion = suggestCurrencies(location);
      expect(suggestion.confidence).toBe('low');
    });

    it('should return low confidence for detection failures', () => {
      const location: GeoLocation = {
        country: 'Unknown',
        countryCode: '',
        detected: false,
      };

      const suggestion = suggestCurrencies(location);
      expect(suggestion.confidence).toBe('low');
    });
  });
});
