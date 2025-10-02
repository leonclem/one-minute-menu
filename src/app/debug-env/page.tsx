export default function DebugEnvPage() {
  // Server-side check at build time
  const buildTimeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const buildTimeKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Environment Variables Debug</h1>
      <p className="text-sm text-gray-500 mb-4">Build time: {new Date().toISOString()}</p>

      <div className="space-y-4">
        <div className="border p-4 rounded">
          <h2 className="font-bold mb-2">Server-Side (Build Time)</h2>
          <p>
            <strong>NEXT_PUBLIC_SUPABASE_URL:</strong>{' '}
            {buildTimeUrl ? 'Set' : 'Missing'}
          </p>
          <p>
            <strong>Value:</strong> {buildTimeUrl || 'undefined'}
          </p>
          <p>
            <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong>{' '}
            {buildTimeKey ? 'Set' : 'Missing'}
          </p>
          <p>
            <strong>Value:</strong> {buildTimeKey ? buildTimeKey.substring(0, 20) + '...' : 'undefined'}
          </p>
        </div>
      </div>
    </div>
  )
}