'use client'

import { useState, useEffect } from 'react'

interface UserMenu {
  id: string
  name: string
  slug: string
  status: 'draft' | 'published'
  currentVersion: number
  createdAt: string
  updatedAt: string
}

interface UserMenusPanelProps {
  userId: string
  userEmail: string
  onClose: () => void
}

export function UserMenusPanel({ userId, userEmail, onClose }: UserMenusPanelProps) {
  const [menus, setMenus] = useState<UserMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMenus = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/users/${userId}/menus`)
        const data = await res.json()
        if (data.success) {
          setMenus(data.data)
        } else {
          setError(data.error || 'Failed to fetch menus')
        }
      } catch {
        setError('An error occurred while fetching menus')
      } finally {
        setLoading(false)
      }
    }

    fetchMenus()
  }, [userId])

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/40"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Menus</h2>
            <p className="mt-0.5 text-sm text-gray-500 truncate max-w-xs">{userEmail}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close panel"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {loading && (
            <p className="py-8 text-center text-sm text-gray-500">Loading menus…</p>
          )}

          {error && (
            <p className="py-8 text-center text-sm text-red-500">{error}</p>
          )}

          {!loading && !error && menus.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">
              This user has no menus yet.
            </p>
          )}

          {!loading && !error && menus.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {menus.map((menu) => (
                <li key={menu.id} className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{menu.name}</p>
                      <p className="mt-0.5 text-xs text-gray-400">/{menu.slug}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                            menu.status === 'published'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {menu.status}
                        </span>
                        <span>v{menu.currentVersion}</span>
                        <span>·</span>
                        <span>Updated {new Date(menu.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <a
                      href={`/admin/users/${userId}/menus/${menu.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Preview
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
