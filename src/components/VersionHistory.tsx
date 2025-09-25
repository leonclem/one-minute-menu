'use client'

import { useState, useEffect } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent, ConfirmDialog } from '@/components/ui'
import { formatDistanceToNow } from 'date-fns'

interface Version {
  id: string
  version: number
  created_at: Date
  published_at: Date | null
  menu_data: any
}

interface VersionHistoryProps {
  menuId: string
  currentVersion: number
  onRevert: (versionId: string) => Promise<void>
  onClose: () => void
}

export default function VersionHistory({ 
  menuId, 
  currentVersion, 
  onRevert, 
  onClose 
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [reverting, setReverting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ open: boolean; versionId: string | null }>({ open: false, versionId: null })

  useEffect(() => {
    fetchVersions()
  }, [menuId])

  const fetchVersions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/menus/${menuId}/versions`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch versions')
      }

      setVersions(result.data.map((v: any) => ({
        ...v,
        created_at: new Date(v.created_at),
        published_at: v.published_at ? new Date(v.published_at) : null
      })))
    } catch (error) {
      console.error('Error fetching versions:', error)
      setError(error instanceof Error ? error.message : 'Failed to load versions')
    } finally {
      setLoading(false)
    }
  }

  const handleRevert = async (versionId: string) => {
    setConfirm({ open: true, versionId })
  }

  const getItemCount = (menuData: any) => {
    return menuData?.items?.length || 0
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
          <CardHeader>
            <CardTitle>Version History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Version History</CardTitle>
          <button
            onClick={onClose}
            className="text-secondary-400 hover:text-secondary-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </CardHeader>
        
        <CardContent className="overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {versions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-secondary-600">No version history available</p>
              <p className="text-sm text-secondary-500 mt-1">
                Versions are created when you publish your menu
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className={`border rounded-lg p-4 ${
                    version.version === currentVersion
                      ? 'border-primary-200 bg-primary-50'
                      : 'border-secondary-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-secondary-900">
                          Version {version.version}
                        </h3>
                        {version.version === currentVersion && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                            Current
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-secondary-600 mt-1">
                        {version.published_at ? 'Published version' : 'Draft version'}
                      </p>
                      
                      <div className="flex items-center space-x-4 mt-2 text-xs text-secondary-500">
                        <span>
                          {formatDistanceToNow(version.published_at || version.created_at, { addSuffix: true })}
                        </span>
                        <span>
                          {getItemCount(version.menu_data)} items
                        </span>
                      </div>
                    </div>

                    {version.version !== currentVersion && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevert(version.id)}
                        loading={reverting === version.id}
                        disabled={reverting !== null}
                      >
                        {reverting === version.id ? 'Reverting...' : 'Revert'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-secondary-200">
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirm.open}
        title="Revert to this version?"
        description="This will create a new version with the reverted content."
        confirmText="Revert"
        onCancel={() => setConfirm({ open: false, versionId: null })}
        onConfirm={async () => {
          if (!confirm.versionId) return
          try {
            setReverting(confirm.versionId)
            await onRevert(confirm.versionId)
            onClose()
          } catch (error) {
            console.error('Error reverting:', error)
            setError(error instanceof Error ? error.message : 'Failed to revert')
          } finally {
            setReverting(null)
            setConfirm({ open: false, versionId: null })
          }
        }}
      />
    </div>
  )
}