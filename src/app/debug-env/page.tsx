'use client'

export default function DebugEnvPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Environment Variables Debug</h1>
      <div className="space-y-2">
        <p>
          <strong>NEXT_PUBLIC_SUPABASE_URL:</strong>{' '}
          {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing'}
        </p>
        <p>
          <strong>Value:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL || 'undefined'}
        </p>
        <p>
          <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong>{' '}
          {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'}
        </p>
        <p>
          <strong>Value:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'eyJ...[hidden]' : 'undefined'}
        </p>
      </div>
    </div>
  )
}