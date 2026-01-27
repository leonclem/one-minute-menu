'use client'

import { useState, useEffect } from 'react'
import { UXButton } from '@/components/ux'
import { getPlanFriendlyName, copyToClipboard } from '@/lib/utils'
import { useToast, ConfirmDialog } from '@/components/ui'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showToast } = useToast()

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

  const handleUpdatePlan = async (userId: string, newPlan: string) => {
    if (!confirm(`Are you sure you want to change this user's plan to ${newPlan}?`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      })
      const data = await res.json()
      if (data.success) {
        setUsers(users.map(u => u.id === userId ? { ...u, plan: newPlan } : u))
        showToast({
          type: 'success',
          title: 'Plan Updated',
          description: `User plan successfully changed to ${getPlanFriendlyName(newPlan)}.`,
        })
      } else {
        showToast({
          type: 'error',
          title: 'Update Failed',
          description: data.error || 'Failed to update plan',
        })
        fetchUsers()
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        description: 'An error occurred while updating the plan',
      })
      fetchUsers()
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (response.ok) {
        showToast({
          type: 'success',
          title: 'User Deleted',
          description: result.message,
        })
        setUsers(users.filter(u => u.id !== userToDelete.id))
      } else {
        throw new Error(result.error || 'Failed to delete user')
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Deletion Failed',
        description: err.message,
      })
    } finally {
      setIsDeleting(false)
      setUserToDelete(null)
    }
  }

  const handleCopyId = async (userId: string) => {
    const success = await copyToClipboard(userId)
    if (success) {
      showToast({
        type: 'success',
        title: 'ID Copied',
        description: 'User ID copied to clipboard',
      })
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading users...</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.restaurantName && u.restaurantName.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const pendingUsers = filteredUsers.filter(u => !u.isApproved && u.role !== 'admin')
  const approvedUsers = filteredUsers.filter(u => u.isApproved || u.role === 'admin')

  return (
    <div className="space-y-8">
      {/* Search and Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder="Search by email or restaurant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-500">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

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
                      <div 
                        className="text-sm font-medium text-gray-900 cursor-pointer hover:text-primary-600"
                        onClick={() => handleCopyId(user.id)}
                        title="Click to copy User ID"
                      >
                        {user.email}
                      </div>
                      <div className="text-xs text-gray-500">{user.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.restaurantName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <UXButton
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(user.id)}
                        loading={approving === user.id}
                      >
                        Approve
                      </UXButton>
                      <UXButton
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => setUserToDelete(user)}
                      >
                        Delete
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {approvedUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div 
                      className="text-sm font-medium text-gray-900 cursor-pointer hover:text-primary-600"
                      onClick={() => handleCopyId(user.id)}
                      title="Click to copy User ID"
                    >
                      {user.email}
                    </div>
                    <div className="text-xs text-gray-500">{user.restaurantName || user.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.role === 'admin' ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        Admin
                      </span>
                    ) : (
                      <select
                        className="text-xs border-gray-300 rounded-full py-1 px-3 bg-white font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                        value={user.plan}
                        onChange={(e) => handleUpdatePlan(user.id, e.target.value)}
                      >
                        <option value="free">Free</option>
                        <option value="grid_plus">Grid+</option>
                        <option value="grid_plus_premium">Grid+ Premium</option>
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.role === 'admin' ? 'Always Approved' : user.approvedAt ? new Date(user.approvedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {user.role !== 'admin' && (
                      <UXButton
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => setUserToDelete(user)}
                      >
                        Delete
                      </UXButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={!!userToDelete}
        onCancel={() => setUserToDelete(null)}
        onConfirm={handleDeleteUser}
        title="Permanently Delete User?"
        description={`This will delete the account for ${userToDelete?.email} and ALL associated data (menus, images, analytics). This action is irreversible.`}
        confirmText={isDeleting ? 'Deleting...' : 'Yes, delete everything'}
        variant="danger"
      />
    </div>
  )
}
