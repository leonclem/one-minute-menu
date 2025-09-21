'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function DebugAuthPage() {
  const [status, setStatus] = useState<string>('Checking...')
  const [user, setUser] = useState<any>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    checkSupabaseConnection()
  }, [])

  const checkSupabaseConnection = async () => {
    try {
      // Test basic connection
      const { data, error } = await supabase.auth.getSession()
      
      if (error) {
        setError(`Session error: ${error.message}`)
        setStatus('Connection failed')
      } else {
        setStatus('Connected to Supabase')
        setUser(data.session?.user || null)
      }
    } catch (err) {
      setError(`Connection error: ${err}`)
      setStatus('Connection failed')
    }
  }

  const testSignUp = async () => {
    setStatus('Testing sign up...')
    setError('')
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: 'test@example.com',
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      })

      if (error) {
        setError(`Sign up error: ${error.message}`)
        setStatus('Sign up failed')
      } else {
        setStatus('Magic link sent! Check your email.')
      }
    } catch (err) {
      setError(`Sign up exception: ${err}`)
      setStatus('Sign up failed')
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Supabase Auth Debug</h1>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Connection Status</h2>
        <p><strong>Status:</strong> {status}</p>
        {error && (
          <p style={{ color: 'red' }}><strong>Error:</strong> {error}</p>
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Environment Variables</h2>
        <p><strong>Supabase URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</p>
        <p><strong>Supabase Anon Key:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</p>
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <p><strong>URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Current User</h2>
        {user ? (
          <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
            {JSON.stringify(user, null, 2)}
          </pre>
        ) : (
          <p>No user session found</p>
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={testSignUp}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#3B82F6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Magic Link (test@example.com)
        </button>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Instructions</h2>
        <ol>
          <li>Make sure your Supabase project is configured correctly</li>
          <li>Add <code>http://localhost:3000/auth/callback</code> to your Supabase redirect URLs</li>
          <li>Set Site URL to <code>http://localhost:3000</code></li>
          <li>Check that your environment variables are correct</li>
        </ol>
      </div>
    </div>
  )
}