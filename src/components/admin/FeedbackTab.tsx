'use client'

/**
 * Feedback Tab
 * 
 * User feedback on extraction quality
 * Allows filtering and analysis
 */

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

interface Feedback {
  id: string
  job_id: string
  user_id: string
  feedback_type: string
  item_id: string | null
  correction_made: string | null
  comment: string | null
  created_at: string
}

export function FeedbackTab() {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchFeedback()
  }, [])

  async function fetchFeedback() {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/extraction/feedback')
      if (!res.ok) throw new Error('Failed to fetch feedback')

      const data = await res.json()
      setFeedback(data.feedback || [])
    } catch (err) {
      console.error('Error fetching feedback:', err)
      setError(err instanceof Error ? err.message : 'Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading feedback...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchFeedback}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  // Filter feedback
  const filteredFeedback = filter === 'all' 
    ? feedback 
    : feedback.filter(f => f.feedback_type === filter)

  // Count by type
  const typeCounts = feedback.reduce((acc, f) => {
    acc[f.feedback_type] = (acc[f.feedback_type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{feedback.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              System Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {typeCounts['system_error'] || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Menu Unclear
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {typeCounts['menu_unclear'] || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Excellent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {typeCounts['excellent'] || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Feedback List</CardTitle>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Types</option>
              <option value="system_error">System Errors</option>
              <option value="menu_unclear">Menu Unclear</option>
              <option value="excellent">Excellent</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredFeedback.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No feedback found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">When</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Type</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Job ID</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Item</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Correction</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Comment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredFeedback.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                        {new Date(f.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            f.feedback_type === 'system_error'
                              ? 'bg-red-100 text-red-800'
                              : f.feedback_type === 'menu_unclear'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {f.feedback_type}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-700">
                        {f.job_id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-2 text-gray-700">{f.item_id || '-'}</td>
                      <td className="px-4 py-2 text-gray-700 max-w-xs truncate" title={f.correction_made || ''}>
                        {f.correction_made || '-'}
                      </td>
                      <td className="px-4 py-2 text-gray-700 max-w-xs truncate" title={f.comment || ''}>
                        {f.comment || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Link to Full Page */}
      <Card className="bg-gray-50">
        <CardContent className="py-4">
          <p className="text-sm text-gray-600">
            For more detailed feedback analysis, visit the{' '}
            <a href="/admin/extraction-feedback" className="text-primary-600 hover:text-primary-700 underline">
              full feedback page
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
