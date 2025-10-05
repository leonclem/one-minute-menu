'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

interface ReportAbusePageProps {
  params: {
    menuId: string
  }
}

/**
 * Report abuse or brand impersonation page
 * Accessible from public menus
 */
export default function ReportAbusePage({ params }: ReportAbusePageProps) {
  const router = useRouter()
  const [reason, setReason] = useState<string>('brand_impersonation')
  const [description, setDescription] = useState<string>('')
  const [reporterEmail, setReporterEmail] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitted, setSubmitted] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (description.length < 10) {
      setError('Please provide a detailed description (at least 10 characters)')
      return
    }
    
    setSubmitting(true)
    setError(null)
    
    try {
      const response = await fetch('/api/report-abuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuId: params.menuId,
          reason,
          description,
          reporterEmail: reporterEmail || undefined,
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSubmitted(true)
      } else {
        setError(result.error || 'Failed to submit report')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }
  
  if (submitted) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            <div className="mx-auto h-12 w-12 text-green-500 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-secondary-900 mb-2">
              Report Submitted
            </h2>
            <p className="text-secondary-600 mb-6">
              Thank you for your report. We will review it and take appropriate action.
            </p>
            <Button
              variant="primary"
              onClick={() => router.back()}
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-secondary-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Report Abuse or Impersonation</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Reason for Report
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border border-secondary-300 rounded-md px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  required
                >
                  <option value="brand_impersonation">Brand Impersonation</option>
                  <option value="inappropriate_content">Inappropriate Content</option>
                  <option value="spam">Spam</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-secondary-300 rounded-md px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  rows={6}
                  placeholder="Please provide details about why you're reporting this menu..."
                  required
                  minLength={10}
                />
                <p className="text-xs text-secondary-500 mt-1">
                  Minimum 10 characters
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Your Email (Optional)
                </label>
                <Input
                  type="email"
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  placeholder="your@email.com"
                />
                <p className="text-xs text-secondary-500 mt-1">
                  Provide your email if you'd like us to follow up with you
                </p>
              </div>
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={submitting}
                >
                  Submit Report
                </Button>
              </div>
            </form>
            
            <div className="mt-6 p-4 bg-secondary-50 rounded-md">
              <p className="text-xs text-secondary-600">
                <strong>Privacy Notice:</strong> Your report will be reviewed by our team. 
                We take all reports seriously and will investigate promptly. False reports 
                may result in action being taken against the reporter.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
