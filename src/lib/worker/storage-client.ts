/**
 * Storage Client for Railway Workers
 * 
 * Handles file uploads to Supabase Storage with:
 * - Deterministic path generation
 * - Signed URL generation with 7-day expiry
 * - Circuit breaker for storage failures
 * - Old file cleanup
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface StorageClientConfig {
  supabase_url: string;
  supabase_service_role_key: string;
  storage_bucket: string;
}

export interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  isOpen: boolean;
}

export class StorageClient {
  private supabase: SupabaseClient;
  private bucket: string;
  private circuitBreaker: CircuitBreakerState;
  
  constructor(config: StorageClientConfig) {
    this.supabase = createClient(
      config.supabase_url,
      config.supabase_service_role_key,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    this.bucket = config.storage_bucket;
    this.circuitBreaker = {
      failureCount: 0,
      lastFailureTime: 0,
      isOpen: false
    };
  }

  /**
   * Upload a buffer to Supabase Storage with deterministic path
   * Implements circuit breaker pattern for resilience
   */
  async upload(
    buffer: Buffer,
    path: string,
    contentType: string
  ): Promise<string> {
    // Check circuit breaker
    if (this.circuitBreaker.isOpen) {
      const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      const cooldownMs = 60000; // 1 minute cooldown
      
      if (timeSinceFailure < cooldownMs) {
        throw new Error('Storage circuit breaker is open');
      } else {
        // Try to close circuit
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failureCount = 0;
      }
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .upload(path, buffer, {
          contentType,
          upsert: true // Idempotent: overwrite if exists
        });

      if (error) {
        throw error;
      }

      // Success - reset failure count
      this.circuitBreaker.failureCount = 0;

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(this.bucket)
        .getPublicUrl(path);

      return urlData.publicUrl;
    } catch (error) {
      this.circuitBreaker.failureCount++;
      this.circuitBreaker.lastFailureTime = Date.now();

      // Open circuit after 3 consecutive failures
      if (this.circuitBreaker.failureCount >= 3) {
        this.circuitBreaker.isOpen = true;
      }

      throw error;
    }
  }

  /**
   * Download a file from storage.
   * Returns null if the object does not exist.
   */
  async download(path: string): Promise<Uint8Array | null> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .download(path);

    if (error) {
      const statusCode = (error as any)?.statusCode;
      const message = String((error as any)?.message || '');
      if (statusCode === 404 || message.toLowerCase().includes('not found')) {
        return null;
      }
      throw error;
    }

    if (!data) {
      return null;
    }

    // supabase-js returns a Blob in Node runtimes (Next.js route handlers included).
    const arrayBuffer = await (data as any).arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  /**
   * Generate a signed URL with 7-day expiry and Content-Disposition header
   */
  async generateSignedUrl(
    path: string,
    expiresIn: number = 604800, // 7 days in seconds
    filename?: string
  ): Promise<string> {
    const safeFilename = filename
      ? filename
          .replace(/[\\\/]/g, '-') // prevent path traversal / invalid chars
          .replace(/[\r\n"]/g, '') // avoid header injection
          .trim()
          .slice(0, 160)
      : undefined

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresIn, {
        // If filename is provided, Supabase sets Content-Disposition with that filename.
        // Otherwise just force attachment download.
        download: safeFilename || true
      });

    if (error) {
      throw error;
    }

    if (!data?.signedUrl) {
      throw new Error('Failed to generate signed URL');
    }

    let signedUrl = data.signedUrl;

    // IMPORTANT: URL Translation for Local Development
    // If we're running in Docker, Supabase returns a URL pointing to 'host.docker.internal'.
    // We need to translate this back to 'localhost' so the link works in the user's browser.
    const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (publicUrl) {
      try {
        const publicUrlObj = new URL(publicUrl);
        const signedUrlObj = new URL(signedUrl);

        // If Supabase generated an internal Docker host, translate host + protocol.
        if (
          signedUrlObj.hostname === 'host.docker.internal' ||
          signedUrlObj.hostname === 'localhost' ||
          signedUrlObj.hostname === '127.0.0.1'
        ) {
          signedUrlObj.host = publicUrlObj.host;
        }

        // Always align protocol with public URL (prevents "insecure download" blocks in HTTPS contexts).
        signedUrlObj.protocol = publicUrlObj.protocol;

        signedUrl = signedUrlObj.toString();
      } catch (e) {
        console.error('[StorageClient] Failed to normalize signed URL:', e);
      }
    }

    return signedUrl;
  }

  /**
   * Delete a single file from storage
   * Used by file cleanup service to delete individual files
   */
  async deleteFile(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([path]);

    if (error) {
      throw error;
    }
  }

  /**
   * Delete files older than specified date
   * Returns count of files deleted
   */
  async deleteOldFiles(olderThan: Date): Promise<number> {
    try {
      // List all files in bucket
      const { data: files, error: listError } = await this.supabase.storage
        .from(this.bucket)
        .list('', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'asc' }
        });

      if (listError) {
        throw listError;
      }

      if (!files || files.length === 0) {
        return 0;
      }

      // Filter files older than threshold
      const oldFiles = files.filter(file => {
        if (!file.created_at) return false;
        const fileDate = new Date(file.created_at);
        return fileDate < olderThan;
      });

      if (oldFiles.length === 0) {
        return 0;
      }

      // Delete old files
      const filePaths = oldFiles.map(f => f.name);
      const { error: deleteError } = await this.supabase.storage
        .from(this.bucket)
        .remove(filePaths);

      if (deleteError) {
        throw deleteError;
      }

      return oldFiles.length;
    } catch (error) {
      console.error('Error deleting old files:', error);
      throw error;
    }
  }

  /**
   * List files in storage (for health checks)
   */
  async list(path: string, options?: { limit?: number }): Promise<any[]> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .list(path, {
        limit: options?.limit || 10
      });

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Check if circuit breaker is open
   */
  isCircuitBreakerOpen(): boolean {
    return this.circuitBreaker.isOpen;
  }

  /**
   * Get circuit breaker state for monitoring
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }
}

/**
 * Generate deterministic storage path
 * Format: {user_id}/exports/{type}/{job_id}.{ext}
 */
export function generateStoragePath(
  userId: string,
  exportType: 'pdf' | 'image',
  jobId: string
): string {
  const ext = getFileExtension(exportType);
  return `${userId}/exports/${exportType}/${jobId}.${ext}`;
}

/**
 * Get file extension based on export type
 */
export function getFileExtension(exportType: 'pdf' | 'image'): string {
  switch (exportType) {
    case 'pdf':
      return 'pdf';
    case 'image':
      return 'png';
    default:
      throw new Error(`Unknown export type: ${exportType}`);
  }
}
