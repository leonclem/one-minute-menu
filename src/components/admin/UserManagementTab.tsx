'use client'

import { useState, useEffect } from 'react'
import { UXButton } from '@/components/ux'

interface ManagedUser {
  id: string
  email: string
  plan: string
  role: string
  isApproved: boolean
  approvedAt: string | null
  createdAt: string
  restaurantName: string | null
}

export function UserManagementTab() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.success) {
        setUsers(data.data)
      } else {
        setError(data.error || 'Failed to fetch users')
      }
    } catch (err) {
      setError('An error occurred while fetching users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleApprove = async (userId: string) => {
    setApproving(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'PATCH',
      })
      const data = await res.json()
      if (data.success) {
        setUsers(users.map(u => u.id === userId ? { ...u, isApproved: true, approvedAt: new Date().toISOString() } : u))
      } else {
        alert(data.error || 'Failed to approve user')
      }
    } catch (err) {
      alert('An error occurred while approving the user')
    } finally {
      setApproving(null)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading users...</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>

  const pendingUsers = users.filter(u => !u.isApproved && u.role !== 'admin')
  const approvedUsers = users.filter(u => u.isApproved || u.role === 'admin')

  return (
    <div className="space-y-8">
      {/* Pending Approvals */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Pending Approvals ({pendingUsers.length})
          </h2>
          <button 
            onClick={fetchUsers}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Refresh
          </button>
        </div>
        
        {pendingUsers.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
            No pending approvals.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restaurant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.email}</div>
                      <div className="text-xs text-gray-500">{user.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.restaurantName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <UXButton
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(user.id)}
                        loading={approving === user.id}
                      >
                        Approve
                      </UXButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Approved Users */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          All Users ({approvedUsers.length})
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan / Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approved On</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {approvedUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.email}</div>
                    <div className="text-xs text-gray-500">{user.restaurantName || user.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : user.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.role === 'admin' ? 'Always Approved' : user.approvedAt ? new Date(user.approvedAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
