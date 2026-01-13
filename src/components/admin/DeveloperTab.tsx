'use client'

/**
 * Admin Developer Tab
 * 
 * Access to internal tools and developer utilities.
 * Only visible when NEXT_PUBLIC_LAYOUT_LAB_ENABLED is true.
 */

import { Card, CardHeader, CardTitle, CardContent, Button, Input, ConfirmDialog, useToast } from '@/components/ui'
import { useState } from 'react'

export function DeveloperTab() {
  const [userIdToDelete, setUserIdToDelete] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const { showToast } = useToast()

  const handleDeleteUser = async () => {
    if (!userIdToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/users/${userIdToDelete}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (response.ok) {
        showToast({
          type: 'success',
          title: 'User Deleted',
          description: result.message,
        })
        setUserIdToDelete('')
      } else {
        throw new Error(result.error || 'Failed to delete user')
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Deletion Failed',
        description: error.message,
      })
    } finally {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Developer Tools</h2>
        <p className="text-sm text-gray-600 mt-1">
          Internal utilities for testing and system validation.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* ... existing cards ... */}
        <Card 
          className="hover:border-primary-300 transition-colors cursor-pointer group" 
          onClick={() => window.location.href = '/dev/layout-lab'}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v1.244c0 .408-.114.807-.327 1.154L4.855 12.58a3.75 3.75 0 003.235 5.67h7.82a3.75 3.75 0 003.235-5.67l-4.568-7.078a1.996 1.996 0 01-.327-1.154V3.104c0-1.104-.896-2-2-2h-1c-1.104 0-2 .896-2 2z" />
                </svg>
              </span>
              Layout Lab
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Developer test harness for the V2 layout engine. Test various fixture menus 
              and validate layout behavior across different scenarios.
            </p>
            <div className="text-primary-600 text-sm font-medium group-hover:underline">
              Launch Lab →
            </div>
          </CardContent>
        </Card>

        <Card 
          className="hover:border-primary-300 transition-colors cursor-pointer group" 
          onClick={() => window.location.href = '/debug-env'}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </span>
              Environment Check
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Verify system environment variables and connection status to external services.
            </p>
            <div className="text-primary-600 text-sm font-medium group-hover:underline">
              Check Status →
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-100 bg-red-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <span className="p-2 bg-red-100 text-red-700 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </span>
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 mb-4">
              <strong>Delete User Altogether:</strong> Permanently removes a user, all their menus, images, and data. This action is irreversible.
            </p>
            <div className="space-y-3">
              <Input
                placeholder="Enter User UUID"
                value={userIdToDelete}
                onChange={(e) => setUserIdToDelete(e.target.value)}
                className="bg-white"
              />
              <Button
                variant="danger"
                className="w-full"
                disabled={!userIdToDelete || isDeleting}
                onClick={() => setShowConfirm(true)}
              >
                {isDeleting ? 'Deleting...' : 'Delete User Permanently'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleDeleteUser}
        title="Permanently Delete User?"
        description="This will delete the user account and ALL associated data (menus, images, analytics). This action cannot be undone."
        confirmText="Yes, delete everything"
        variant="danger"
      />
    </div>
  )
}

