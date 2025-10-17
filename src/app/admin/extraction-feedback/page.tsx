import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * Admin page: List recent extraction feedback for review
 */
export default async function AdminExtractionFeedbackPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/auth/signin')
  }

  // TODO: Replace with real admin role check when role metadata exists
  // if (user.app_metadata?.role !== 'admin') redirect('/dashboard')

  const { data, error: queryError } = await supabase
    .from('extraction_feedback')
    .select('id, job_id, user_id, feedback_type, item_id, correction_made, comment, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (queryError) {
    return (
      <div className="min-h-screen bg-secondary-50">
        <div className="container-mobile py-8">
          <h1 className="text-2xl font-bold text-secondary-900">Extraction Feedback</h1>
          <p className="mt-4 text-red-600">Failed to load feedback.</p>
        </div>
      </div>
    )
  }

  const feedback = data || []

  return (
    <div className="min-h-screen bg-secondary-50">
      <header className="bg-white shadow-sm">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-secondary-900">Extraction Feedback</h1>
            <a href="/dashboard" className="text-sm text-secondary-500 hover:text-secondary-700">Back to Dashboard</a>
          </div>
        </div>
      </header>

      <main className="container-mobile py-8">
        <div className="bg-white border border-secondary-200 rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-200 text-sm">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-secondary-700">When</th>
                  <th className="px-4 py-2 text-left font-medium text-secondary-700">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-secondary-700">Job</th>
                  <th className="px-4 py-2 text-left font-medium text-secondary-700">User</th>
                  <th className="px-4 py-2 text-left font-medium text-secondary-700">Item</th>
                  <th className="px-4 py-2 text-left font-medium text-secondary-700">Correction</th>
                  <th className="px-4 py-2 text-left font-medium text-secondary-700">Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {feedback.map((f) => (
                  <tr key={f.id} className="hover:bg-secondary-50/50">
                    <td className="px-4 py-2 text-secondary-600">{new Date(f.created_at as string).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border"
                        data-type={f.feedback_type}
                      >
                        {f.feedback_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-secondary-700">{f.job_id}</td>
                    <td className="px-4 py-2 font-mono text-xs text-secondary-700">{f.user_id}</td>
                    <td className="px-4 py-2 text-secondary-700">{f.item_id || '-'}</td>
                    <td className="px-4 py-2 text-secondary-700 max-w-[24rem] truncate" title={f.correction_made || ''}>{f.correction_made || '-'}</td>
                    <td className="px-4 py-2 text-secondary-700 max-w-[24rem] truncate" title={f.comment || ''}>{f.comment || '-'}</td>
                  </tr>
                ))}
                {feedback.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-secondary-500">No feedback yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}


