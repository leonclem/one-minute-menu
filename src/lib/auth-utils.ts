/**
 * Authentication and Authorization Utilities
 * 
 * Provides helper functions for checking user roles and permissions
 * Requirements: 8.1, 8.2, 8.3
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export interface AuthUser {
  id: string
  email: string
  role: 'user' | 'admin'
}

/**
 * Check if the current user is an admin
 * @returns Promise<boolean> - true if user is admin, false otherwise
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = createServerSupabaseClient()
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return false
    }
    
    // Query the profiles table to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      return false
    }
    
    return profile.role === 'admin'
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e && typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
      throw e
    }
    if (process.env.NODE_ENV === 'development') {
      console.error('Supabase connection failed in isAdmin (dev mode):', e)
      return true // Allow access in dev if Supabase is down
    }
    return false
  }
}

/**
 * Require admin access - redirects to dashboard if not admin
 * @param redirectUrl - URL to redirect to if not admin (default: /dashboard)
 * @throws Redirects to the specified URL if user is not admin
 */
export async function requireAdmin(redirectUrl: string = '/dashboard'): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  let user;
  let error;
  
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
    error = result.error
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e && typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
      throw e
    }
    if (process.env.NODE_ENV === 'development') {
      console.warn('Supabase connection failed in requireAdmin. Bypassing auth in development mode.')
      return;
    }
    throw e;
  }
  
  if (error || !user) {
    redirect('/auth/signin')
  }
  
  // Query the profiles table to check role
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile || profile.role !== 'admin') {
      redirect(redirectUrl)
    }
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e && typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
      throw e
    }
    if (process.env.NODE_ENV === 'development') {
      console.warn('Supabase profile check failed. Bypassing in development mode.')
      return;
    }
    throw e;
  }
}

/**
 * Get the current authenticated user with role information
 * @returns Promise<AuthUser | null> - User with role or null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = createServerSupabaseClient()
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }
    
    // Query the profiles table to get role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      return null
    }
    
    return {
      id: user.id,
      email: user.email || '',
      role: profile.role as 'user' | 'admin'
    }
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e && typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
      throw e
    }
    if (process.env.NODE_ENV === 'development') {
      console.warn('Supabase connection failed in getCurrentUser (dev mode).')
      return null
    }
    return null
  }
}
