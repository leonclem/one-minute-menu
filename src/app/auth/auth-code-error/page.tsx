'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function AuthCodeError() {
  const searchParams = useSearchParams()
  const errorType = searchParams.get('type') || 'unknown'
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            There was a problem signing you in.
          </p>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Sign in Failed
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  {errorType === 'magiclink' && 'The magic link may have expired or been used already. Please try signing in again.'}
                  {errorType === 'missing_code' && 'No authentication code was provided in the URL.'}
                  {errorType === 'no_session' && 'Authentication succeeded but no session was created.'}
                  {errorType === 'exception' && 'An unexpected error occurred during authentication.'}
                  {errorType === 'unknown' && 'An unknown authentication error occurred.'}
                </p>
                <p className="mt-1 text-xs text-red-600">Error type: {errorType}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Link
            href="/auth/signin"
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Try signing in again
          </Link>
          
          <Link
            href="/auth/signup"
            className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Create new account
          </Link>
        </div>

        <div className="text-center">
          <Link href="/" className="text-blue-600 hover:text-blue-500 text-sm">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}