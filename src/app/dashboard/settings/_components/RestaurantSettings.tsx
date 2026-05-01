'use client'

import { useState } from 'react'
import { UXCard, UXButton, UXInput } from '@/components/ux'
import { ESTABLISHMENT_TYPES, CUISINES, type VenueInfo } from '@/types'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface RestaurantSettingsProps {
  userId: string
  initialRestaurantName?: string
  initialEstablishmentType?: string
  initialPrimaryCuisine?: string
  initialUsername?: string
  initialDefaultVenueInfo?: VenueInfo
}

export function RestaurantSettings({
  userId,
  initialRestaurantName,
  initialEstablishmentType,
  initialPrimaryCuisine,
  initialUsername,
  initialDefaultVenueInfo,
}: RestaurantSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [restaurantName, setRestaurantName] = useState(initialRestaurantName || '')
  const [establishmentType, setEstablishmentType] = useState(initialEstablishmentType || '')
  const [primaryCuisine, setPrimaryCuisine] = useState(initialPrimaryCuisine || '')
  const [username, setUsername] = useState(initialUsername || '')
  
  // Venue info fields
  const [address, setAddress] = useState(initialDefaultVenueInfo?.address || '')
  const [email, setEmail] = useState(initialDefaultVenueInfo?.email || '')
  const [phone, setPhone] = useState(initialDefaultVenueInfo?.phone || '')
  const [instagram, setInstagram] = useState(initialDefaultVenueInfo?.socialMedia?.instagram || '')
  const [facebook, setFacebook] = useState(initialDefaultVenueInfo?.socialMedia?.facebook || '')
  const [x, setX] = useState(initialDefaultVenueInfo?.socialMedia?.x || '')
  const [tiktok, setTiktok] = useState(initialDefaultVenueInfo?.socialMedia?.tiktok || '')
  const [website, setWebsite] = useState(initialDefaultVenueInfo?.socialMedia?.website || '')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [applyingToMenus, setApplyingToMenus] = useState(false)
  const [applyMenusSuccess, setApplyMenusSuccess] = useState(false)

  const hasChanges = 
    restaurantName !== (initialRestaurantName || '') ||
    establishmentType !== (initialEstablishmentType || '') ||
    primaryCuisine !== (initialPrimaryCuisine || '') ||
    username !== (initialUsername || '') ||
    address !== (initialDefaultVenueInfo?.address || '') ||
    email !== (initialDefaultVenueInfo?.email || '') ||
    phone !== (initialDefaultVenueInfo?.phone || '') ||
    instagram !== (initialDefaultVenueInfo?.socialMedia?.instagram || '') ||
    facebook !== (initialDefaultVenueInfo?.socialMedia?.facebook || '') ||
    x !== (initialDefaultVenueInfo?.socialMedia?.x || '') ||
    tiktok !== (initialDefaultVenueInfo?.socialMedia?.tiktok || '') ||
    website !== (initialDefaultVenueInfo?.socialMedia?.website || '')

  const handleSave = async () => {
    if (!restaurantName.trim()) {
      setError('Restaurant name is required')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const venueInfo: VenueInfo = {
        address: address.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        socialMedia: {
          instagram: instagram.trim() || undefined,
          facebook: facebook.trim() || undefined,
          x: x.trim() || undefined,
          tiktok: tiktok.trim() || undefined,
          website: website.trim() || undefined,
        }
      }

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: restaurantName.trim(),
          establishmentType: establishmentType || undefined,
          primaryCuisine: primaryCuisine || undefined,
          username: username.trim() || undefined,
          defaultVenueInfo: venueInfo,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update restaurant details')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update restaurant details')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyToAllMenus = async () => {
    if (!confirm('This will update all your existing menus with these contact and social media details. Continue?')) {
      return
    }

    setApplyingToMenus(true)
    setError(null)
    setApplyMenusSuccess(false)

    try {
      const venueInfo: VenueInfo = {
        address: address.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        socialMedia: {
          instagram: instagram.trim() || undefined,
          facebook: facebook.trim() || undefined,
          x: x.trim() || undefined,
          tiktok: tiktok.trim() || undefined,
          website: website.trim() || undefined,
        }
      }

      const response = await fetch('/api/menus/bulk-update-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueInfo }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update menus')
      }

      setApplyMenusSuccess(true)
      setTimeout(() => setApplyMenusSuccess(false), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update menus')
    } finally {
      setApplyingToMenus(false)
    }
  }

  return (
    <UXCard>
      <div className="p-6 space-y-6">
        {/* Header with collapse toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left group"
        >
          <div>
            <h2 className="text-xl font-semibold text-ux-text">Restaurant Details</h2>
            <p className="mt-1 text-sm text-ux-text-secondary">
              Default information used when creating new menus
            </p>
          </div>
          <div className="text-ux-text-secondary group-hover:text-ux-text transition-colors">
            {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </div>
        </button>

        {/* Collapsible content */}
        {isExpanded && (
          <>
            <div className="space-y-4 pt-2">
              <UXInput
                label="Restaurant Name"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="e.g. The Golden Grill"
                required
              />

              <div className="space-y-1">
                <label className="block text-sm font-medium text-ux-text">
                  Establishment Type
                </label>
                <select
                  className="input-ux w-full"
                  value={establishmentType}
                  onChange={(e) => setEstablishmentType(e.target.value)}
                >
                  <option value="">Select a type...</option>
                  {ESTABLISHMENT_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-ux-text">
                  Primary Cuisine
                </label>
                <select
                  className="input-ux w-full"
                  value={primaryCuisine}
                  onChange={(e) => setPrimaryCuisine(e.target.value)}
                >
                  <option value="">Select a cuisine...</option>
                  {CUISINES.map((cuisine) => (
                    <option key={cuisine.id} value={cuisine.id}>
                      {cuisine.label}
                    </option>
                  ))}
                </select>
              </div>

              <UXInput
                label="Username (optional)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. golden-grill"
                helperText="Your public profile will be at gridmenu.com/u/your-username"
              />

              {/* Divider */}
              <div className="border-t border-ux-border pt-4">
                <h3 className="text-sm font-semibold text-ux-text mb-3">
                  Contact & Location (Optional)
                </h3>
                <p className="text-xs text-ux-text-secondary mb-4">
                  These details will be used as defaults when creating new menus
                </p>
                
                <div className="space-y-4">
                  <UXInput
                    label="Address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Restaurant St, City"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <UXInput
                      label="Email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="hello@restaurant.com"
                    />

                    <UXInput
                      label="Phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="border-t border-ux-border pt-4">
                <h3 className="text-sm font-semibold text-ux-text mb-3">
                  Social Media (Optional)
                </h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <UXInput
                      label="Instagram"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      placeholder="@restaurant"
                    />

                    <UXInput
                      label="Facebook"
                      value={facebook}
                      onChange={(e) => setFacebook(e.target.value)}
                      placeholder="@restaurant"
                    />

                    <UXInput
                      label="X (Twitter)"
                      value={x}
                      onChange={(e) => setX(e.target.value)}
                      placeholder="@restaurant"
                    />

                    <UXInput
                      label="TikTok"
                      value={tiktok}
                      onChange={(e) => setTiktok(e.target.value)}
                      placeholder="@restaurant"
                    />
                  </div>

                  <UXInput
                    label="Website"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://restaurant.com"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-ux-error/10 border border-ux-error/20 rounded-lg">
                <p className="text-sm text-ux-error">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400">
                  Restaurant details updated successfully!
                </p>
              </div>
            )}

            {applyMenusSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400">
                  Contact details applied to all existing menus!
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <UXButton
                variant="outline"
                onClick={handleApplyToAllMenus}
                loading={applyingToMenus}
                disabled={loading || applyingToMenus}
              >
                Apply to All Existing Menus
              </UXButton>
              <UXButton
                variant="primary"
                onClick={handleSave}
                loading={loading}
                disabled={!hasChanges || loading || applyingToMenus}
              >
                Save Changes
              </UXButton>
            </div>
          </>
        )}
      </div>
    </UXCard>
  )
}
