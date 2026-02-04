import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

/**
 * Direct Supabase client for Worker environments.
 * Bypasses all Next.js/browser dependencies like cookies.
 */
export const createWorkerSupabaseClient = () => {
  const isDocker = isRunningInDocker()

  /**
   * IMPORTANT:
   * - In Docker, `localhost` points to the container, so we need an internal/gateway URL.
   * - On the host (dev server / API routes), `host.docker.internal` typically does NOT resolve.
   *
   * This helper is used by BOTH:
   * - the Docker worker (needs internal URL)
   * - server-side API routes that need service-role access (should use public/host URL)
   */
  const supabaseUrl = resolveSupabaseUrl({ isDocker })
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('[supabase-worker] Supabase credentials missing')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

function resolveSupabaseUrl({ isDocker }: { isDocker: boolean }): string | undefined {
  // Prefer explicit worker-only/internal variables if provided.
  const internal =
    process.env.SUPABASE_INTERNAL_URL ||
    process.env.WORKER_SUPABASE_URL

  const publicUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL

  const selected = (isDocker ? (internal || process.env.SUPABASE_URL || publicUrl) : publicUrl) || undefined
  if (!selected) return undefined

  // If we are running inside Docker and the selected URL is localhost, rewrite to host gateway.
  if (isDocker) {
    return rewriteLocalhostToGateway(selected)
  }

  return selected
}

function rewriteLocalhostToGateway(inputUrl: string): string {
  try {
    const url = new URL(inputUrl)
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return inputUrl
    }
    url.hostname = process.env.WORKER_HOST_GATEWAY || 'host.docker.internal'
    return url.toString()
  } catch {
    return inputUrl
  }
}

function isRunningInDocker(): boolean {
  if (process.env.RUNNING_IN_DOCKER === 'true') return true
  try {
    // Commonly present in Docker containers.
    if (fs.existsSync('/.dockerenv')) return true
  } catch {
    // ignore
  }
  try {
    // Fallback heuristic for some container runtimes.
    const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8')
    return /docker|containerd|kubepods/i.test(cgroup)
  } catch {
    return false
  }
}
