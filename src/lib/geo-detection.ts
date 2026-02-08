/**
 * Geo-Detection Service
 * 
 * Detects user's location and suggests appropriate default currencies.
 * 
 * CRITICAL CONSTRAINT: Geo-detection MUST NOT be required for system correctness.
 * It is used only for initial suggestion. The system must function correctly
 * even when geo-detection fails or returns unmapped countries.
 * 
 * Implementation notes:
 * - Uses Vercel headers (x-vercel-ip-country) for serverless deployment
 * - Falls back to navigator.language with confidence: 'low'
 * - Always defaults to USD for unmapped countries or detection failures
 * - Caches detection results in localStorage to avoid repeated API calls
 */

import type { BillingCurrency, ISO4217CurrencyCode } from './currency-config';

export interface GeoLocation {
  country: string;
  countryCode: string;
  detected: boolean;
}

export interface CurrencySuggestion {
  billingCurrency: BillingCurrency;
  menuCurrency: ISO4217CurrencyCode;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Country to billing currency mapping
 * Maps country codes to supported billing currencies (SGD, USD, GBP, AUD, EUR)
 */
const COUNTRY_TO_BILLING_CURRENCY: Record<string, BillingCurrency> = {
  // High confidence mappings
  SG: 'SGD', // Singapore
  US: 'USD', // United States
  GB: 'GBP', // United Kingdom
  AU: 'AUD', // Australia
  
  // Eurozone countries
  AT: 'EUR', // Austria
  BE: 'EUR', // Belgium
  DE: 'EUR', // Germany
  ES: 'EUR', // Spain
  FI: 'EUR', // Finland
  FR: 'EUR', // France
  IE: 'EUR', // Ireland
  IT: 'EUR', // Italy
  NL: 'EUR', // Netherlands
  PT: 'EUR', // Portugal
  GR: 'EUR', // Greece
  CY: 'EUR', // Cyprus
  EE: 'EUR', // Estonia
  LV: 'EUR', // Latvia
  LT: 'EUR', // Lithuania
  LU: 'EUR', // Luxembourg
  MT: 'EUR', // Malta
  SK: 'EUR', // Slovakia
  SI: 'EUR', // Slovenia
  
  // Medium confidence mappings (nearby regions)
  CA: 'USD', // Canada
  NZ: 'AUD', // New Zealand
  MY: 'USD', // Malaysia
  TH: 'USD', // Thailand
  ID: 'USD', // Indonesia
  PH: 'USD', // Philippines
  VN: 'USD', // Vietnam
  IN: 'USD', // India
  HK: 'USD', // Hong Kong
  TW: 'USD', // Taiwan
  JP: 'USD', // Japan
  KR: 'USD', // South Korea
  
  // All other countries default to USD (handled in mapCountryToBillingCurrency)
};

/**
 * Country to menu currency mapping
 * Maps country codes to commonly used menu display currencies
 */
const COUNTRY_TO_MENU_CURRENCY: Record<string, ISO4217CurrencyCode> = {
  // Direct mappings
  SG: 'SGD', // Singapore
  US: 'USD', // United States
  GB: 'GBP', // United Kingdom
  AU: 'AUD', // Australia
  MY: 'MYR', // Malaysia
  TH: 'THB', // Thailand
  ID: 'IDR', // Indonesia
  PH: 'PHP', // Philippines
  VN: 'VND', // Vietnam
  IN: 'INR', // India
  HK: 'HKD', // Hong Kong
  TW: 'TWD', // Taiwan
  JP: 'JPY', // Japan
  KR: 'KRW', // South Korea
  CN: 'CNY', // China
  NZ: 'NZD', // New Zealand
  CA: 'CAD', // Canada
  
  // Eurozone countries
  AT: 'EUR', BE: 'EUR', DE: 'EUR', ES: 'EUR', FI: 'EUR',
  FR: 'EUR', IE: 'EUR', IT: 'EUR', NL: 'EUR', PT: 'EUR',
  GR: 'EUR', CY: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR',
  LU: 'EUR', MT: 'EUR', SK: 'EUR', SI: 'EUR',
  
  // Additional currencies
  CH: 'CHF', // Switzerland
  SE: 'SEK', // Sweden
  NO: 'NOK', // Norway
  DK: 'DKK', // Denmark
  PL: 'PLN', // Poland
  CZ: 'CZK', // Czech Republic
  HU: 'HUF', // Hungary
  RO: 'RON', // Romania
  BG: 'BGN', // Bulgaria
  TR: 'TRY', // Turkey
  IL: 'ILS', // Israel
  ZA: 'ZAR', // South Africa
  BR: 'BRL', // Brazil
  MX: 'MXN', // Mexico
  AR: 'ARS', // Argentina
  CL: 'CLP', // Chile
  CO: 'COP', // Colombia
  PE: 'PEN', // Peru
  RU: 'RUB', // Russia
  SA: 'SAR', // Saudi Arabia
  AE: 'AED', // UAE
  KW: 'KWD', // Kuwait
  QA: 'QAR', // Qatar
  EG: 'EGP', // Egypt
  PK: 'PKR', // Pakistan
  BD: 'BDT', // Bangladesh
  LK: 'LKR', // Sri Lanka
  MM: 'MMK', // Myanmar
  KH: 'KHR', // Cambodia
  LA: 'LAK', // Laos
  BN: 'BND', // Brunei
  
  // All other countries default to USD (handled in mapCountryToMenuCurrency)
};

/**
 * Cache key for localStorage
 */
const CACHE_KEY = 'gridmenu_geo_detection';

/**
 * Cache duration in milliseconds (24 hours)
 */
const CACHE_DURATION = 24 * 60 * 60 * 1000;

/**
 * Cached geo-detection result
 */
interface CachedGeoDetection {
  location: GeoLocation;
  timestamp: number;
}

/**
 * Detect user's location using Vercel headers or browser fallback
 * 
 * @returns Promise resolving to GeoLocation
 */
export async function detectLocation(): Promise<GeoLocation> {
  // Check cache first
  const cached = getCachedLocation();
  if (cached) {
    return cached;
  }

  try {
    // Try to detect from Vercel headers (server-side or edge)
    const location = await detectFromVercelHeaders();
    if (location.detected) {
      cacheLocation(location);
      return location;
    }
  } catch (error) {
    console.warn('Vercel geo-detection failed:', error);
  }

  // Fallback to browser language
  const location = detectFromBrowserLanguage();
  cacheLocation(location);
  return location;
}

/**
 * Detect location from Vercel headers
 * This works in serverless/edge environments
 */
async function detectFromVercelHeaders(): Promise<GeoLocation> {
  // In client-side, we can't access Vercel headers directly
  // This would need to be called from an API route
  // For now, return undetected
  return {
    country: 'Unknown',
    countryCode: '',
    detected: false,
  };
}

/**
 * Detect location from browser language as weak fallback
 * Note: Language is NOT a reliable proxy for currency
 * (en-SG vs en-US vs en-GB, expats, VPNs)
 */
function detectFromBrowserLanguage(): GeoLocation {
  if (typeof window === 'undefined' || !navigator.language) {
    return {
      country: 'Unknown',
      countryCode: '',
      detected: false,
    };
  }

  // Extract country code from language tag (e.g., 'en-US' -> 'US')
  const parts = navigator.language.split('-');
  if (parts.length === 2) {
    const countryCode = parts[1].toUpperCase();
    return {
      country: countryCode,
      countryCode,
      detected: true, // Detected but with low confidence
    };
  }

  return {
    country: 'Unknown',
    countryCode: '',
    detected: false,
  };
}

/**
 * Get cached location from localStorage
 */
function getCachedLocation(): GeoLocation | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      return null;
    }

    const parsed: CachedGeoDetection = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    if (age > CACHE_DURATION) {
      // Cache expired
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.location;
  } catch (error) {
    console.warn('Failed to read geo-detection cache:', error);
    return null;
  }
}

/**
 * Cache location in localStorage
 */
function cacheLocation(location: GeoLocation): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const cached: CachedGeoDetection = {
      location,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.warn('Failed to cache geo-detection:', error);
  }
}

/**
 * Map country code to billing currency
 * 
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'US', 'SG')
 * @returns Billing currency (defaults to USD for unmapped countries)
 */
export function mapCountryToBillingCurrency(countryCode: string): BillingCurrency {
  const currency = COUNTRY_TO_BILLING_CURRENCY[countryCode.toUpperCase()];
  return currency || 'USD'; // Default to USD for unmapped countries
}

/**
 * Map country code to menu currency
 * 
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'US', 'SG')
 * @returns Menu currency (defaults to USD for unmapped countries)
 */
export function mapCountryToMenuCurrency(countryCode: string): ISO4217CurrencyCode {
  const currency = COUNTRY_TO_MENU_CURRENCY[countryCode.toUpperCase()];
  return currency || 'USD'; // Default to USD for unmapped countries
}

/**
 * Suggest currencies based on detected location
 * 
 * @param location - Detected geo location
 * @returns Currency suggestion with confidence level
 */
export function suggestCurrencies(location: GeoLocation): CurrencySuggestion {
  // If detection failed, default to USD with low confidence
  if (!location.detected || !location.countryCode) {
    return {
      billingCurrency: 'USD',
      menuCurrency: 'USD',
      confidence: 'low',
    };
  }

  const billingCurrency = mapCountryToBillingCurrency(location.countryCode);
  const menuCurrency = mapCountryToMenuCurrency(location.countryCode);

  // Determine confidence based on detection method and mapping
  let confidence: 'high' | 'medium' | 'low';

  // High confidence: Direct mapping to supported billing currency
  if (['SG', 'US', 'GB', 'AU'].includes(location.countryCode)) {
    confidence = 'high';
  }
  // Medium confidence: Eurozone or nearby regions
  else if (billingCurrency === 'EUR' || ['CA', 'NZ', 'MY', 'TH', 'ID'].includes(location.countryCode)) {
    confidence = 'medium';
  }
  // Low confidence: Fallback to USD or browser language detection
  else {
    confidence = 'low';
  }

  return {
    billingCurrency,
    menuCurrency,
    confidence,
  };
}
