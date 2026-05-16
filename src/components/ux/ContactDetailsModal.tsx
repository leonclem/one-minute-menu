'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { UXCard, UXButton, UXInput } from './index'
import { useToast } from '@/components/ui'
import type { Menu, VenueInfo } from '@/types'

interface ContactDetailsModalProps {
  menuId: string
  initialVenueInfo?: VenueInfo
  onSuccess: (updatedMenu: Menu) => void
  onClose: () => void
}

export function ContactDetailsModal({ menuId, initialVenueInfo, onSuccess, onClose }: ContactDetailsModalProps) {
  const [address, setAddress] = useState(initialVenueInfo?.address ?? '')
  const [phone, setPhone] = useState(initialVenueInfo?.phone ?? '')
  const [email, setEmail] = useState(initialVenueInfo?.email ?? '')
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  const handleSave = async () => {
    setSaving(true)
    try {
      const venueInfo: VenueInfo = {
        ...initialVenueInfo,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      }

      const response = await fetch(`/api/menus/${menuId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueInfo }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to save contact details')
      }

      const result = await response.json()
      const updatedMenu = result.data as Menu
      showToast({ type: 'success', title: 'Contact details saved' })
      onSuccess(updatedMenu)
      onClose()
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to save',
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const hasChanges =
    address.trim() !== (initialVenueInfo?.address ?? '') ||
    phone.trim() !== (initialVenueInfo?.phone ?? '') ||
    email.trim() !== (initialVenueInfo?.email ?? '')

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-md">
          <UXCard>
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-ux-border/60">
              <h3 className="text-sm font-semibold text-ux-text">Contact details</h3>
              <button
                type="button"
                className="h-7 w-7 flex items-center justify-center rounded-full text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-primary transition-colors"
                onClick={() => !saving && onClose()}
                aria-label="Close"
                disabled={saving}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-xs text-ux-text-secondary">
                These details can appear on your menu. Fill in as many as you like.
              </p>

              <div>
                <label className="block text-sm font-medium text-ux-text mb-2">Address</label>
                <textarea
                  className="w-full px-3 py-2 border border-ux-border rounded-lg text-ux-text bg-ux-background focus:outline-none focus:ring-2 focus:ring-ux-primary resize-none text-sm"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Restaurant St, Food City"
                />
              </div>

              <UXInput
                label="Phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />

              <UXInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@restaurant.com"
              />

              <p className="text-xs text-ux-text-secondary">
                To add social media links, visit the Settings page (link at top of page).
              </p>

              <div className="flex gap-2 justify-end pt-1">
                <UXButton variant="outline" size="sm" onClick={onClose} disabled={saving}>
                  Cancel
                </UXButton>
                <UXButton
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  loading={saving}
                  disabled={!hasChanges}
                >
                  Save
                </UXButton>
              </div>
            </div>
          </UXCard>
        </div>
      </div>
    </div>,
    document.body
  )
}
