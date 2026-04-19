'use client'

import { useState, useEffect } from 'react'
import { UXButton } from '@/components/ux'
import { useToast } from '@/components/ui'

interface FeatureFlagStatus {
  id: string
  enabled: boolean
  updated_at: string
}

export function RegistrationGatingSettings() {
  const [flagStatus, setFlagStatus] = useState<FeatureFlagStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const { showToast } = useToast()

  const fetchFlagStatus = async () => {
    try {
      const res = await fetch('/api/admin/feature-flags/require-admin-approval')
      const data = await res.json()
      if (data.success) {
        setFlagStatus(data.data)
      } else {
        showToast({
          type: 'error',
          title: 'Error',
          description: data.error || 'Failed to fetch registration gating status',
        })
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        description: 'Failed to fetch registration gating status',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFlagStatus()
  }, [])

  const handleToggle = async () => {
    if (!flagStatus) return

    setUpdating(true)
    try {
      const res = await fetch('/api/admin/feature-flags/require-admin-approval', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !flagStatus.enabled }),
      })

      const data = await res.json()
      if (data.success) {
        setFlagStatus(data.data)
        showToast({
          type: 'success',
          title: 'Updated',
          description: `Admin approval is now ${data.data.enabled ? 'enabled' : 'disabled'}`,
        })
      } else {
        showToast({
          type: 'error',
          title: 'Update Failed',
          description: data.error || 'Failed to update setting',
        })
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        description: 'Failed to update registration gating',
      })
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    )
  }

  if (!flagStatus) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-red-500">Failed to load settings</div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Registration Gating
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Controls whether new registrants require admin approval to access GridMenu.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Status:</span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                flagStatus.enabled
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {flagStatus.enabled ? '🔒 Approval Required' : '✓ Auto-Approved'}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Last updated: {new Date(flagStatus.updated_at).toLocaleString()}
            </div>
          </div>
        </div>
        <UXButton
          onClick={handleToggle}
          loading={updating}
          variant={flagStatus.enabled ? 'outline' : 'primary'}
          className={flagStatus.enabled ? 'text-green-600 border-green-200' : ''}
        >
          {flagStatus.enabled ? 'Disable Approval' : 'Enable Approval'}
        </UXButton>
      </div>
    </div>
  )
}
