/**
 * Property-Based Tests for StorageClient
 * 
 * Tests universal properties that should hold across all inputs:
 * - Property 38: Deterministic Path Generation
 * - Property 11: Storage Path Structure
 * - Property 12: Signed URL Expiry
 * - Property 5: Idempotent Storage Upload
 */

import fc from 'fast-check';
import { StorageClient, generateStoragePath, getFileExtension } from '../storage-client';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

describe('StorageClient Property-Based Tests', () => {
  let mockSupabase: any;
  let storageClient: StorageClient;

  beforeEach(() => {
    jest.clearAllMocks();

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

    storageClient = new StorageClient({
      supabase_url: 'https://test.supabase.co',
      supabase_service_role_key: 'test-key',
      storage_bucket: 'export-files'
    });
  });

  // Feature: railway-workers, Property 38: Deterministic Path Generation
  describe('Property 38: Deterministic Path Generation', () => {
    it('should generate same path for same inputs (idempotency)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            exportType: fc.constantFrom('pdf' as const, 'image' as const),
            jobId: fc.uuid()
          }),
          async (input) => {
            // Generate path twice with same inputs
            const path1 = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId
            );
            const path2 = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId
            );

            // Paths should be identical
            expect(path1).toBe(path2);
            
            // Path should be deterministic - no random components
            expect(path1).not.toContain('random');
            expect(path1).not.toContain('timestamp');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different paths for different job IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            exportType: fc.constantFrom('pdf' as const, 'image' as const),
            jobId1: fc.uuid(),
            jobId2: fc.uuid()
          }).filter(r => r.jobId1 !== r.jobId2), // Ensure different job IDs
          async (input) => {
            const path1 = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId1
            );
            const path2 = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId2
            );

            // Different job IDs should produce different paths
            expect(path1).not.toBe(path2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: railway-workers, Property 11: Storage Path Structure
  describe('Property 11: Storage Path Structure', () => {
    it('should follow pattern {user_id}/exports/{type}/{job_id}.{ext}', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            exportType: fc.constantFrom('pdf' as const, 'image' as const),
            jobId: fc.uuid()
          }),
          async (input) => {
            const path = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId
            );

            // Path should start with user_id
            expect(path).toMatch(new RegExp(`^${input.userId}/`));

            // Path should contain /exports/
            expect(path).toContain('/exports/');

            // Path should contain export type
            expect(path).toContain(`/exports/${input.exportType}/`);

            // Path should end with job_id and correct extension
            const ext = getFileExtension(input.exportType);
            expect(path).toMatch(new RegExp(`${input.jobId}\\.${ext}$`));

            // Full pattern validation
            const expectedPattern = new RegExp(
              `^${input.userId}/exports/${input.exportType}/${input.jobId}\\.${ext}$`
            );
            expect(path).toMatch(expectedPattern);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should organize files by user ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            exportType: fc.constantFrom('pdf' as const, 'image' as const),
            jobId: fc.uuid()
          }),
          async (input) => {
            const path = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId
            );

            // Path should start with user_id
            expect(path.split('/')[0]).toBe(input.userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should organize files by export type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            exportType: fc.constantFrom('pdf' as const, 'image' as const),
            jobId: fc.uuid()
          }),
          async (input) => {
            const path = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId
            );

            // Path should contain export type in correct position
            const parts = path.split('/');
            expect(parts[2]).toBe(input.exportType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use correct file extension for export type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            exportType: fc.constantFrom('pdf' as const, 'image' as const),
            jobId: fc.uuid()
          }),
          async (input) => {
            const path = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId
            );

            // PDF exports should end with .pdf
            if (input.exportType === 'pdf') {
              expect(path).toMatch(/\.pdf$/);
            }

            // Image exports should end with .png
            if (input.exportType === 'image') {
              expect(path).toMatch(/\.png$/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: railway-workers, Property 12: Signed URL Expiry
  describe('Property 12: Signed URL Expiry', () => {
    it('should generate URLs with exactly 7-day expiry by default', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            exportType: fc.constantFrom('pdf' as const, 'image' as const),
            jobId: fc.uuid()
          }),
          async (input) => {
            const path = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId
            );

            mockSupabase.storage.createSignedUrl.mockResolvedValue({
              data: { signedUrl: `https://storage.supabase.co/signed/${path}` },
              error: null
            });

            await storageClient.generateSignedUrl(path);

            // Verify called with 7 days in seconds (604800)
            expect(mockSupabase.storage.createSignedUrl).toHaveBeenCalledWith(
              path,
              604800, // 7 days * 24 hours * 60 minutes * 60 seconds
              expect.any(Object)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect custom expiry times', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            exportType: fc.constantFrom('pdf' as const, 'image' as const),
            jobId: fc.uuid(),
            expirySeconds: fc.integer({ min: 60, max: 2592000 }) // 1 min to 30 days
          }),
          async (input) => {
            const path = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId
            );

            mockSupabase.storage.createSignedUrl.mockResolvedValue({
              data: { signedUrl: `https://storage.supabase.co/signed/${path}` },
              error: null
            });

            await storageClient.generateSignedUrl(path, input.expirySeconds);

            // Verify called with custom expiry
            expect(mockSupabase.storage.createSignedUrl).toHaveBeenCalledWith(
              path,
              input.expirySeconds,
              expect.any(Object)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set Content-Disposition header for all signed URLs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            exportType: fc.constantFrom('pdf' as const, 'image' as const),
            jobId: fc.uuid()
          }),
          async (input) => {
            const path = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId
            );

            mockSupabase.storage.createSignedUrl.mockResolvedValue({
              data: { signedUrl: `https://storage.supabase.co/signed/${path}` },
              error: null
            });

            await storageClient.generateSignedUrl(path);

            // Verify Content-Disposition header is set
            expect(mockSupabase.storage.createSignedUrl).toHaveBeenCalledWith(
              expect.any(String),
              expect.any(Number),
              expect.objectContaining({ download: true })
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: railway-workers, Property 5: Idempotent Storage Upload
  describe('Property 5: Idempotent Storage Upload', () => {
    it('should use upsert for all uploads (overwrite if exists)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            exportType: fc.constantFrom('pdf' as const, 'image' as const),
            jobId: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 1000 })
          }),
          async (input) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            const path = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId
            );
            const buffer = Buffer.from(input.content);
            const contentType = input.exportType === 'pdf' 
              ? 'application/pdf' 
              : 'image/png';

            mockSupabase.storage.upload.mockResolvedValue({
              data: { path },
              error: null
            });

            mockSupabase.storage.getPublicUrl.mockReturnValue({
              data: { publicUrl: `https://storage.supabase.co/${path}` }
            });

            await storageClient.upload(buffer, path, contentType);

            // Verify upsert is always true for idempotency
            expect(mockSupabase.storage.upload).toHaveBeenCalledWith(
              path,
              buffer,
              expect.objectContaining({ upsert: true })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce same result when uploading same job multiple times', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            exportType: fc.constantFrom('pdf' as const, 'image' as const),
            jobId: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 1000 })
          }),
          async (input) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            const path = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId
            );
            const buffer = Buffer.from(input.content);
            const contentType = input.exportType === 'pdf' 
              ? 'application/pdf' 
              : 'image/png';

            mockSupabase.storage.upload.mockResolvedValue({
              data: { path },
              error: null
            });

            mockSupabase.storage.getPublicUrl.mockReturnValue({
              data: { publicUrl: `https://storage.supabase.co/${path}` }
            });

            // Upload twice
            const url1 = await storageClient.upload(buffer, path, contentType);
            const url2 = await storageClient.upload(buffer, path, contentType);

            // URLs should be identical (same path)
            expect(url1).toBe(url2);
            
            // Both uploads should use same path
            expect(mockSupabase.storage.upload).toHaveBeenNthCalledWith(
              1,
              path,
              expect.any(Buffer),
              expect.any(Object)
            );
            expect(mockSupabase.storage.upload).toHaveBeenNthCalledWith(
              2,
              path,
              expect.any(Buffer),
              expect.any(Object)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not create partial or intermediate files', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            exportType: fc.constantFrom('pdf' as const, 'image' as const),
            jobId: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 1000 })
          }),
          async (input) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            const path = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId
            );
            const buffer = Buffer.from(input.content);
            const contentType = input.exportType === 'pdf' 
              ? 'application/pdf' 
              : 'image/png';

            mockSupabase.storage.upload.mockResolvedValue({
              data: { path },
              error: null
            });

            mockSupabase.storage.getPublicUrl.mockReturnValue({
              data: { publicUrl: `https://storage.supabase.co/${path}` }
            });

            await storageClient.upload(buffer, path, contentType);

            // Verify no temporary or partial paths used
            const uploadCalls = mockSupabase.storage.upload.mock.calls;
            expect(uploadCalls.length).toBe(1); // Only one upload call
            
            const uploadPath = uploadCalls[0][0];
            expect(uploadPath).not.toContain('.tmp');
            expect(uploadPath).not.toContain('.partial');
            expect(uploadPath).not.toContain('.temp');
            expect(uploadPath).toBe(path); // Exact path, no variations
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle re-processing same job cleanly (overwrite)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            exportType: fc.constantFrom('pdf' as const, 'image' as const),
            jobId: fc.uuid(),
            content1: fc.string({ minLength: 1, maxLength: 500 }),
            content2: fc.string({ minLength: 1, maxLength: 500 })
          }).filter(r => r.content1 !== r.content2), // Different content
          async (input) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            const path = generateStoragePath(
              input.userId,
              input.exportType,
              input.jobId
            );
            const contentType = input.exportType === 'pdf' 
              ? 'application/pdf' 
              : 'image/png';

            // First upload
            mockSupabase.storage.upload.mockResolvedValueOnce({
              data: { path },
              error: null
            });
            mockSupabase.storage.getPublicUrl.mockReturnValue({
              data: { publicUrl: `https://storage.supabase.co/${path}` }
            });

            const buffer1 = Buffer.from(input.content1);
            await storageClient.upload(buffer1, path, contentType);

            // Second upload (re-processing)
            mockSupabase.storage.upload.mockResolvedValueOnce({
              data: { path },
              error: null
            });

            const buffer2 = Buffer.from(input.content2);
            await storageClient.upload(buffer2, path, contentType);

            // Both uploads should use same path with upsert
            expect(mockSupabase.storage.upload).toHaveBeenCalledTimes(2);
            expect(mockSupabase.storage.upload).toHaveBeenNthCalledWith(
              1,
              path,
              buffer1,
              expect.objectContaining({ upsert: true })
            );
            expect(mockSupabase.storage.upload).toHaveBeenNthCalledWith(
              2,
              path,
              buffer2,
              expect.objectContaining({ upsert: true })
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
