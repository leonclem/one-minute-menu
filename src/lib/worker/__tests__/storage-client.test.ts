/**
 * Unit tests for StorageClient
 */

import { StorageClient, generateStoragePath, getFileExtension } from '../storage-client';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

describe('StorageClient', () => {
  let mockSupabase: any;
  let storageClient: StorageClient;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Supabase client
    mockSupabase = {
      storage: {
        from: jest.fn().mockReturnThis(),
        upload: jest.fn(),
        getPublicUrl: jest.fn(),
        createSignedUrl: jest.fn(),
        list: jest.fn(),
        remove: jest.fn()
      }
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Create storage client
    storageClient = new StorageClient({
      supabase_url: 'https://test.supabase.co',
      supabase_service_role_key: 'test-key',
      storage_bucket: 'export-files'
    });
  });

  describe('upload', () => {
    it('should upload buffer to storage with deterministic path', async () => {
      const buffer = Buffer.from('test content');
      const path = 'user-123/exports/pdf/job-456.pdf';
      const contentType = 'application/pdf';

      mockSupabase.storage.upload.mockResolvedValue({
        data: { path },
        error: null
      });

      mockSupabase.storage.getPublicUrl.mockReturnValue({
        data: { publicUrl: `https://storage.supabase.co/${path}` }
      });

      const url = await storageClient.upload(buffer, path, contentType);

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('export-files');
      expect(mockSupabase.storage.upload).toHaveBeenCalledWith(
        path,
        buffer,
        {
          contentType,
          upsert: true
        }
      );
      expect(url).toBe(`https://storage.supabase.co/${path}`);
    });

    it('should throw error on upload failure', async () => {
      const buffer = Buffer.from('test content');
      const path = 'user-123/exports/pdf/job-456.pdf';

      mockSupabase.storage.upload.mockResolvedValue({
        data: null,
        error: new Error('Upload failed')
      });

      await expect(
        storageClient.upload(buffer, path, 'application/pdf')
      ).rejects.toThrow('Upload failed');
    });

    it('should reset failure count on successful upload', async () => {
      const buffer = Buffer.from('test content');
      const path = 'user-123/exports/pdf/job-456.pdf';

      mockSupabase.storage.upload.mockResolvedValue({
        data: { path },
        error: null
      });

      mockSupabase.storage.getPublicUrl.mockReturnValue({
        data: { publicUrl: `https://storage.supabase.co/${path}` }
      });

      await storageClient.upload(buffer, path, 'application/pdf');

      const state = storageClient.getCircuitBreakerState();
      expect(state.failureCount).toBe(0);
      expect(state.isOpen).toBe(false);
    });

    it('should increment failure count on upload error', async () => {
      const buffer = Buffer.from('test content');
      const path = 'user-123/exports/pdf/job-456.pdf';

      mockSupabase.storage.upload.mockResolvedValue({
        data: null,
        error: new Error('Upload failed')
      });

      await expect(
        storageClient.upload(buffer, path, 'application/pdf')
      ).rejects.toThrow();

      const state = storageClient.getCircuitBreakerState();
      expect(state.failureCount).toBe(1);
    });

    it('should open circuit breaker after 3 consecutive failures', async () => {
      const buffer = Buffer.from('test content');
      const path = 'user-123/exports/pdf/job-456.pdf';

      mockSupabase.storage.upload.mockResolvedValue({
        data: null,
        error: new Error('Upload failed')
      });

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        await expect(
          storageClient.upload(buffer, path, 'application/pdf')
        ).rejects.toThrow();
      }

      const state = storageClient.getCircuitBreakerState();
      expect(state.failureCount).toBe(3);
      expect(state.isOpen).toBe(true);
    });

    it('should reject uploads when circuit breaker is open', async () => {
      const buffer = Buffer.from('test content');
      const path = 'user-123/exports/pdf/job-456.pdf';

      mockSupabase.storage.upload.mockResolvedValue({
        data: null,
        error: new Error('Upload failed')
      });

      // Open circuit breaker
      for (let i = 0; i < 3; i++) {
        await expect(
          storageClient.upload(buffer, path, 'application/pdf')
        ).rejects.toThrow();
      }

      // Next upload should fail immediately
      await expect(
        storageClient.upload(buffer, path, 'application/pdf')
      ).rejects.toThrow('Storage circuit breaker is open');
    });

    it('should use upsert for idempotent uploads', async () => {
      const buffer = Buffer.from('test content');
      const path = 'user-123/exports/pdf/job-456.pdf';

      mockSupabase.storage.upload.mockResolvedValue({
        data: { path },
        error: null
      });

      mockSupabase.storage.getPublicUrl.mockReturnValue({
        data: { publicUrl: `https://storage.supabase.co/${path}` }
      });

      await storageClient.upload(buffer, path, 'application/pdf');

      expect(mockSupabase.storage.upload).toHaveBeenCalledWith(
        path,
        buffer,
        expect.objectContaining({ upsert: true })
      );
    });
  });

  describe('generateSignedUrl', () => {
    it('should generate signed URL with 7-day expiry', async () => {
      const path = 'user-123/exports/pdf/job-456.pdf';
      const signedUrl = 'https://storage.supabase.co/signed-url';

      mockSupabase.storage.createSignedUrl.mockResolvedValue({
        data: { signedUrl },
        error: null
      });

      const url = await storageClient.generateSignedUrl(path);

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('export-files');
      expect(mockSupabase.storage.createSignedUrl).toHaveBeenCalledWith(
        path,
        604800, // 7 days in seconds
        { download: true }
      );
      expect(url).toBe(signedUrl);
    });

    it('should accept custom expiry time', async () => {
      const path = 'user-123/exports/pdf/job-456.pdf';
      const customExpiry = 3600; // 1 hour

      mockSupabase.storage.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://storage.supabase.co/signed-url' },
        error: null
      });

      await storageClient.generateSignedUrl(path, customExpiry);

      expect(mockSupabase.storage.createSignedUrl).toHaveBeenCalledWith(
        path,
        customExpiry,
        { download: true }
      );
    });

    it('should throw error if signed URL generation fails', async () => {
      const path = 'user-123/exports/pdf/job-456.pdf';

      mockSupabase.storage.createSignedUrl.mockResolvedValue({
        data: null,
        error: new Error('Failed to generate URL')
      });

      await expect(
        storageClient.generateSignedUrl(path)
      ).rejects.toThrow('Failed to generate URL');
    });

    it('should throw error if signedUrl is missing', async () => {
      const path = 'user-123/exports/pdf/job-456.pdf';

      mockSupabase.storage.createSignedUrl.mockResolvedValue({
        data: {},
        error: null
      });

      await expect(
        storageClient.generateSignedUrl(path)
      ).rejects.toThrow('Failed to generate signed URL');
    });

    it('should set Content-Disposition header for downloads', async () => {
      const path = 'user-123/exports/pdf/job-456.pdf';

      mockSupabase.storage.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://storage.supabase.co/signed-url' },
        error: null
      });

      await storageClient.generateSignedUrl(path);

      expect(mockSupabase.storage.createSignedUrl).toHaveBeenCalledWith(
        path,
        expect.any(Number),
        expect.objectContaining({ download: true })
      );
    });
  });

  describe('deleteOldFiles', () => {
    it('should delete files older than specified date', async () => {
      const olderThan = new Date('2024-01-01');
      const oldFiles = [
        { name: 'old-file-1.pdf', created_at: '2023-12-01' },
        { name: 'old-file-2.pdf', created_at: '2023-11-01' }
      ];
      const newFiles = [
        { name: 'new-file-1.pdf', created_at: '2024-02-01' }
      ];

      mockSupabase.storage.list.mockResolvedValue({
        data: [...oldFiles, ...newFiles],
        error: null
      });

      mockSupabase.storage.remove.mockResolvedValue({
        data: null,
        error: null
      });

      const count = await storageClient.deleteOldFiles(olderThan);

      expect(count).toBe(2);
      expect(mockSupabase.storage.remove).toHaveBeenCalledWith([
        'old-file-1.pdf',
        'old-file-2.pdf'
      ]);
    });

    it('should return 0 if no old files found', async () => {
      const olderThan = new Date('2024-01-01');
      const newFiles = [
        { name: 'new-file-1.pdf', created_at: '2024-02-01' }
      ];

      mockSupabase.storage.list.mockResolvedValue({
        data: newFiles,
        error: null
      });

      const count = await storageClient.deleteOldFiles(olderThan);

      expect(count).toBe(0);
      expect(mockSupabase.storage.remove).not.toHaveBeenCalled();
    });

    it('should return 0 if no files exist', async () => {
      const olderThan = new Date('2024-01-01');

      mockSupabase.storage.list.mockResolvedValue({
        data: [],
        error: null
      });

      const count = await storageClient.deleteOldFiles(olderThan);

      expect(count).toBe(0);
      expect(mockSupabase.storage.remove).not.toHaveBeenCalled();
    });

    it('should throw error on list failure', async () => {
      const olderThan = new Date('2024-01-01');

      mockSupabase.storage.list.mockResolvedValue({
        data: null,
        error: new Error('List failed')
      });

      await expect(
        storageClient.deleteOldFiles(olderThan)
      ).rejects.toThrow('List failed');
    });

    it('should throw error on delete failure', async () => {
      const olderThan = new Date('2024-01-01');
      const oldFiles = [
        { name: 'old-file-1.pdf', created_at: '2023-12-01' }
      ];

      mockSupabase.storage.list.mockResolvedValue({
        data: oldFiles,
        error: null
      });

      mockSupabase.storage.remove.mockResolvedValue({
        data: null,
        error: new Error('Delete failed')
      });

      await expect(
        storageClient.deleteOldFiles(olderThan)
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('circuit breaker', () => {
    it('should report circuit breaker state', () => {
      const state = storageClient.getCircuitBreakerState();

      expect(state).toEqual({
        failureCount: 0,
        lastFailureTime: 0,
        isOpen: false
      });
    });

    it('should check if circuit breaker is open', () => {
      expect(storageClient.isCircuitBreakerOpen()).toBe(false);
    });
  });
});

describe('generateStoragePath', () => {
  it('should generate deterministic path for PDF export', () => {
    const path = generateStoragePath('user-123', 'pdf', 'job-456');
    expect(path).toBe('user-123/exports/pdf/job-456.pdf');
  });

  it('should generate deterministic path for image export', () => {
    const path = generateStoragePath('user-123', 'image', 'job-456');
    expect(path).toBe('user-123/exports/image/job-456.png');
  });

  it('should use same path for same inputs (idempotency)', () => {
    const path1 = generateStoragePath('user-123', 'pdf', 'job-456');
    const path2 = generateStoragePath('user-123', 'pdf', 'job-456');
    expect(path1).toBe(path2);
  });

  it('should generate different paths for different job IDs', () => {
    const path1 = generateStoragePath('user-123', 'pdf', 'job-456');
    const path2 = generateStoragePath('user-123', 'pdf', 'job-789');
    expect(path1).not.toBe(path2);
  });

  it('should organize files by user ID', () => {
    const path = generateStoragePath('user-123', 'pdf', 'job-456');
    expect(path).toMatch(/^user-123\//);
  });

  it('should organize files by export type', () => {
    const pdfPath = generateStoragePath('user-123', 'pdf', 'job-456');
    const imagePath = generateStoragePath('user-123', 'image', 'job-456');
    
    expect(pdfPath).toContain('/exports/pdf/');
    expect(imagePath).toContain('/exports/image/');
  });
});

describe('getFileExtension', () => {
  it('should return pdf for PDF export', () => {
    expect(getFileExtension('pdf')).toBe('pdf');
  });

  it('should return png for image export', () => {
    expect(getFileExtension('image')).toBe('png');
  });

  it('should throw error for unknown export type', () => {
    expect(() => getFileExtension('unknown' as any)).toThrow('Unknown export type');
  });
});
