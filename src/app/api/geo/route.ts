import { NextRequest, NextResponse } from 'next/server'
import {
  mapCountryToBillingCurrency,
  mapCountryToMenuCurrency,
} from '@/lib/geo-detection'

/**
 * GET /api/geo
 *
 * Returns the user's detected country and suggested currencies based on IP.
 * Uses Vercel's x-vercel-ip-country header when deployed on Vercel.
 * When running locally or when the header is unavailable, returns null.
 *
 * Used by demo flow and pricing page for geo-aware currency suggestions.
 */
export async function GET(request: NextRequest) {
  try {
    // Vercel sets this header on deployed environments (not in local dev)
    let countryCode = request.headers.get('x-vercel-ip-country')

    // Dev override: ?country=SG for local testing (e.g. when in Singapore but running on localhost)
    if ((!countryCode || countryCode.length !== 2) && process.env.NODE_ENV === 'development') {
      const url = new URL(request.url)
      const override = url.searchParams.get('country')
      if (override && override.length === 2) {
        countryCode = override.toUpperCase()
      }
    }

    if (!countryCode || countryCode.length !== 2) {
      return NextResponse.json({
        success: true,
        data: {
          countryCode: null,
          billingCurrency: null,
          menuCurrency: null,
          detected: false,
        },
      })
    }

    const upper = countryCode.toUpperCase()
    const billingCurrency = mapCountryToBillingCurrency(upper)
    const menuCurrency = mapCountryToMenuCurrency(upper)

    return NextResponse.json({
      success: true,
      data: {
        countryCode: upper,
        billingCurrency,
        menuCurrency,
        detected: true,
      },
    })
  } catch (error) {
    console.error('[Geo API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to detect location' },
      { status: 500 }
    )
  }
}
