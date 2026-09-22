/**
 * Deletes idle unclaimed guest Studio users and their storage objects.
 */

import { createWorkerSupabaseClient } from '@/lib/supabase-worker'
import { STUDIO_STORAGE_BUCKET } from '@/lib/studio/storage-paths'

export interface GuestSessionCleanupConfig {
  intervalMs?: number
  idleHours?: number
  magicLinkGraceDays?: number
  runImmediately?: boolean
  logger?: {
    info: (message: string, meta?: any) => void
    warn: (message: string, meta?: any) => void
    error: (message: string, meta?: any) => void
  }
}

export class GuestSessionCleanup {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private config: Required<Omit<GuestSessionCleanupConfig, 'logger'>> & {
    logger: NonNullable<GuestSessionCleanupConfig['logger']>
  }

  constructor(config: GuestSessionCleanupConfig = {}) {
    this.config = {
      intervalMs: config.intervalMs ?? 60 * 60 * 1000,
      idleHours: config.idleHours ?? 48,
      magicLinkGraceDays: config.magicLinkGraceDays ?? 7,
      runImmediately: config.runImmediately ?? true,
      logger: config.logger ?? {
        info: (msg, meta) => console.log(`[GuestSessionCleanup] ${msg}`, meta || ''),
        warn: (msg, meta) => console.warn(`[GuestSessionCleanup] ${msg}`, meta || ''),
        error: (msg, meta) => console.error(`[GuestSessionCleanup] ${msg}`, meta || ''),
      },
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.config.logger.warn('Guest session cleanup already running, ignoring start request')
      return
    }
    this.isRunning = true
    this.config.logger.info('Starting guest session cleanup service', {
      intervalMs: this.config.intervalMs,
      idleHours: this.config.idleHours,
      magicLinkGraceDays: this.config.magicLinkGraceDays,
    })
    if (this.config.runImmediately) {
      await this.runCleanup()
    }
    this.intervalId = setInterval(() => {
      void this.runCleanup()
    }, this.config.intervalMs)
  }

  stop(): void {
    if (!this.isRunning) {
      this.config.logger.warn('Guest session cleanup not running, ignoring stop request')
      return
    }
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    this.config.logger.info('Guest session cleanup service stopped')
  }

  isActive(): boolean {
    return this.isRunning
  }

  async runCleanup(): Promise<{ deleted: number; failed: number }> {
    const admin = createWorkerSupabaseClient()
    const { data, error } = await admin.rpc('studio_list_expired_guest_user_ids', {
      p_idle_hours: this.config.idleHours,
      p_magic_link_grace_days: this.config.magicLinkGraceDays,
    })
    if (error) {
      this.config.logger.error('Failed to list expired guest users', { error: error.message })
      return { deleted: 0, failed: 0 }
    }

    const userIds = ((data as { user_id?: string }[] | null) ?? [])
      .map((row) => row.user_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)

    let deleted = 0
    let failed = 0
    for (const userId of userIds) {
      try {
        await this.deleteGuestUser(userId)
        deleted += 1
      } catch (err) {
        failed += 1
        this.config.logger.warn('Failed to delete expired guest user', {
          userId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    if (deleted > 0 || failed > 0) {
      this.config.logger.info('Guest session cleanup cycle complete', { deleted, failed })
    }
    return { deleted, failed }
  }

  private async deleteGuestUser(userId: string): Promise<void> {
    const admin = createWorkerSupabaseClient()
    const { data: images, error: listError } = await admin
      .from('studio_images')
      .select('storage_path')
      .eq('user_id', userId)
    if (listError) {
      throw new Error(`Failed to list guest images: ${listError.message}`)
    }

    const paths = (images ?? [])
      .map((row) => row.storage_path)
      .filter((path): path is string => typeof path === 'string' && path.startsWith(`${userId}/`))
    if (paths.length > 0) {
      const { error: storageError } = await admin.storage.from(STUDIO_STORAGE_BUCKET).remove(paths)
      if (storageError) {
        this.config.logger.warn('Guest storage delete failed; continuing with user delete', {
          userId,
          error: storageError.message,
        })
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) {
      throw new Error(deleteError.message)
    }
  }
}
