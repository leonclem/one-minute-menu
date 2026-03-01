'use client'

import { useState } from 'react'
import { UXCard, UXButton } from '@/components/ux'
import { ConfirmDialog } from '@/components/ui'
import type { BillingCurrency } from '@/lib/currency-config'
import { getCurrencyMetadata } from '@/lib/currency-config'

interface BillingSettingsProps {
  userId: string
  initialBillingCurrency: BillingCurrency
  initialCanChangeBilling: boolean
  initialBillingChangeReason?: string
}

export function BillingSettings({ userId, initialBillingCurrency, initialCanChangeBilling, initialBillingChangeReason }: BillingSettingsProps) {
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  // Billing currency state — seeded from server
  const [billingCurrency] = useState<BillingCurrency>(initialBillingCurrency)
  const [canChangeBilling] = useState(initialCanChangeBilling)
  const [billingChangeReason] = useState(initialBillingChangeReason)

  async function handleManageSubscription() {
    setPortalLoading(true)
    setPortalError(null)
    try {
      const res = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: '/dashboard/settings' }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'NO_CUSTOMER_ID') {
          setPortalError('No active subscription found. Complete a purchase to manage billing here.')
        } else {
          setPortalError(data.error || 'Something went wrong. Please try again.')
        }
        return
      }
      window.location.href = data.url
    } catch {
      setPortalError('Could not connect to billing. Please try again.')
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <UXCard>
      <div className="p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-ux-text">Subscription & Billing</h2>
          <p className="text-sm text-ux-text-secondary mt-1">
            Manage your subscription, update your payment method, or view invoices via the Stripe billing portal.
          </p>
        </div>

        {portalError && (
          <p className="text-red-500 text-sm">{portalError}</p>
        )}

        <UXButton
          variant="primary"
          onClick={handleManageSubscription}
          disabled={portalLoading}
        >
          {portalLoading ? 'Opening portal…' : 'Manage Subscription'}
        </UXButton>

        {/* Billing currency lock notice — only shown when locked */}
        {!canChangeBilling && (
          <div className="pt-4 border-t border-ux-border">
            <h3 className="text-base font-semibold text-ux-text">Billing Currency</h3>
            <p className="text-sm text-ux-text-secondary mt-1">How you pay GridMenu for your subscription</p>
            <div className="mt-3 p-4 bg-ux-background-secondary rounded-md border border-ux-border">
              <p className="text-sm text-ux-text">
                {billingChangeReason ?? 'You must cancel your current subscription before changing billing currency. Your subscription will remain active until the end of the current billing period.'}
              </p>
              <p className="text-sm text-ux-text-secondary mt-2">
                Current billing currency: <strong>{getCurrencyMetadata(billingCurrency).symbol} {billingCurrency}</strong>
              </p>
            </div>
          </div>
        )}
      </div>
    </UXCard>
  )
}
