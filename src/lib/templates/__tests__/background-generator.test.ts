/**
 * Unit tests for Background Generator Service
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock nano-banana client BEFORE importing BackgroundGenerator
jest.mock('../../nano-banana', () => ({
  getNanoBananaClient: jest.fn(() => ({
    generateImage: jest.fn().mockResolvedValue({
      images: ['base64-image-data'],
      metadata: {
        processingTime: 1000,
        modelVersion: 'test-model',
        safetyFilterApplied: false
      }
    })
  })),
  NanoBananaError: class NanoBananaError extends Error {
    code: string
    constructor(message: string, code: string) {
      super(message)
      this.code = code
    }
  },
  createGenerationError: jest.fn((error: any) => ({
    code: error.code,
    message: error.message,
    suggestions: [],
    retryable: false
  }))
}))

// Import after mocking
import { BackgroundGenerator } from '../background-generator'

describe('BackgroundGenerator', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>
  let mockNanoBanana: any
  let generator: BackgroundGenerator

  beforeEach(() => {
    // Create mock nano-banana client
    mockNanoBanana = {
      generateImage: jest.fn().mockResolvedValue({
        images: ['base64-image-data'],
        metadata: {
          processingTime: 1000,
          modelVersion: 'test-model',
          safetyFilterApplied: false
        }
      })
    }

    // Create mock Supabase client
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  single: jest.fn()
                }))
              }))
            }))
          }))
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn()
        }))
      })),
      storage: {
        from: jest.fn(() => ({
          list: jest.fn(),
          upload: jest.fn(),
          createSignedUrl: jest.fn(),
          getPublicUrl: jest.fn()
        }))
      }
    } as any

    generator = new BackgroundGenerator(mockSupabase, mockNanoBanana)
  })

  describe('buildBackgroundPrompt', () => {
    it('should construct prompt with template ID', () => {
      const params = {
        userId: 'user-123',
        menuId: 'menu-456',
        templateId: 'kraft-sports',
        referenceImage: '/templates/kraft-sports-ref.jpg'
      }

      // Access private method via type assertion for testing
      const prompt = (generator as any).buildBackgroundPrompt(params)

      expect(prompt).toContain('kraft-sports')
      expect(prompt).toContain('professional menu background')
    })

    it('should include brand colors in prompt when provided', () => {
      const params = {
        userId: 'user-123',
        menuId: 'menu-456',
        templateId: 'minimal-bistro',
        referenceImage: '/templates/minimal-bistro-ref.jpg',
        brandColors: ['#FF5733', '#33FF57', '#3357FF']
      }

      const prompt = (generator as any).buildBackgroundPrompt(params)

      expect(prompt).toContain('#FF5733')
      expect(prompt).toContain('#33FF57')
      expect(prompt).toContain('#3357FF')
      expect(prompt).toContain('brand colors')
    })

    it('should include reference image context', () => {
      const params = {
        userId: 'user-123',
        menuId: 'menu-456',
        templateId: 'kraft-sports',
        referenceImage: '/templates/kraft-sports-ref.jpg'
      }

      const prompt = (generator as any).buildBackgroundPrompt(params)

      expect(prompt).toContain('reference style')
      expect(prompt).toContain('/templates/kraft-sports-ref.jpg')
    })

    it('should include requirements to avoid text and logos', () => {
      const params = {
        userId: 'user-123',
        menuId: 'menu-456',
        templateId: 'kraft-sports',
        referenceImage: '/templates/kraft-sports-ref.jpg'
      }

      const prompt = (generator as any).buildBackgroundPrompt(params)

      expect(prompt).toContain('Avoid any text')
      expect(prompt).toContain('logos')
    })
  })

  describe('getFallbackBackground', () => {
    it('should return fallback with first brand color', async () => {
      const brandColors = ['#FF5733', '#33FF57']
      const fallback = await generator.getFallbackBackground('kraft-sports', brandColors)

      // Decode the URL-encoded data URL
      const decoded = decodeURIComponent(fallback)
      expect(decoded).toContain('#FF5733')
      expect(decoded).toContain('svg')
    })

    it('should return default color when no brand colors provided', async () => {
      const fallback = await generator.getFallbackBackground('kraft-sports')

      // Decode the URL-encoded data URL
      const decoded = decodeURIComponent(fallback)
      expect(decoded).toContain('#F3F4F6')
      expect(decoded).toContain('svg')
    })

    it('should return valid SVG data URL', async () => {
      const fallback = await generator.getFallbackBackground('kraft-sports', ['#FF5733'])

      expect(fallback).toMatch(/^data:image\/svg\+xml,/)
      // Decode the URL-encoded data URL
      const decoded = decodeURIComponent(fallback)
      expect(decoded).toContain('<svg')
      expect(decoded).toContain('</svg>')
    })
  })

  describe('computeContentHash', () => {
    it('should generate consistent hash for same inputs', () => {
      const params1 = {
        userId: 'user-123',
        menuId: 'menu-456',
        templateId: 'kraft-sports',
        referenceImage: '/ref.jpg',
        brandColors: ['#FF5733', '#33FF57']
      }

      const params2 = {
        userId: 'user-789', // Different user
        menuId: 'menu-999', // Different menu
        templateId: 'kraft-sports',
        referenceImage: '/ref.jpg',
        brandColors: ['#FF5733', '#33FF57']
      }

      const hash1 = (generator as any).computeContentHash(params1)
      const hash2 = (generator as any).computeContentHash(params2)

      // Hash should be same despite different userId/menuId (for deduplication)
      expect(hash1).toBe(hash2)
    })

    it('should generate different hash for different template IDs', () => {
      const params1 = {
        userId: 'user-123',
        menuId: 'menu-456',
        templateId: 'kraft-sports',
        referenceImage: '/ref.jpg',
        brandColors: ['#FF5733']
      }

      const params2 = {
        userId: 'user-123',
        menuId: 'menu-456',
        templateId: 'minimal-bistro',
        referenceImage: '/ref.jpg',
        brandColors: ['#FF5733']
      }

      const hash1 = (generator as any).computeContentHash(params1)
      const hash2 = (generator as any).computeContentHash(params2)

      expect(hash1).not.toBe(hash2)
    })

    it('should generate different hash for different brand colors', () => {
      const params1 = {
        userId: 'user-123',
        menuId: 'menu-456',
        templateId: 'kraft-sports',
        referenceImage: '/ref.jpg',
        brandColors: ['#FF5733']
      }

      const params2 = {
        userId: 'user-123',
        menuId: 'menu-456',
        templateId: 'kraft-sports',
        referenceImage: '/ref.jpg',
        brandColors: ['#33FF57']
      }

      const hash1 = (generator as any).computeContentHash(params1)
      const hash2 = (generator as any).computeContentHash(params2)

      expect(hash1).not.toBe(hash2)
    })

    it('should sort brand colors for consistent hashing', () => {
      const params1 = {
        userId: 'user-123',
        menuId: 'menu-456',
        templateId: 'kraft-sports',
        referenceImage: '/ref.jpg',
        brandColors: ['#FF5733', '#33FF57', '#3357FF']
      }

      const params2 = {
        userId: 'user-123',
        menuId: 'menu-456',
        templateId: 'kraft-sports',
        referenceImage: '/ref.jpg',
        brandColors: ['#3357FF', '#FF5733', '#33FF57'] // Different order
      }

      const hash1 = (generator as any).computeContentHash(params1)
      const hash2 = (generator as any).computeContentHash(params2)

      // Hash should be same despite different order
      expect(hash1).toBe(hash2)
    })
  })

  describe('queueGeneration', () => {
    it('should return existing job if cached background exists', async () => {
      const existingJob = {
        id: 'job-123',
        user_id: 'user-123',
        menu_id: 'menu-456',
        template_id: 'kraft-sports',
        content_hash: 'abc123',
        status: 'ready',
        result_url: 'https://example.com/bg.webp',
        created_at: new Date().toISOString()
      }

      // Mock Supabase to return existing job
      const mockSingle = jest.fn() as any
      mockSingle.mockResolvedValue({ data: existingJob, error: null })
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  single: mockSingle
                }))
              }))
            }))
          }))
        }))
      })) as any

      const params = {
        userId: 'user-123',
        menuId: 'menu-456',
        templateId: 'kraft-sports',
        referenceImage: '/ref.jpg',
        brandColors: ['#FF5733']
      }

      const result = await generator.queueGeneration(params)

      expect(result.id).toBe('job-123')
      expect(result.status).toBe('ready')
      expect(result.resultUrl).toBe('https://example.com/bg.webp')
    })

    it('should create new job if no cached background exists', async () => {
      const newJob = {
        id: 'job-456',
        user_id: 'user-123',
        menu_id: 'menu-456',
        template_id: 'kraft-sports',
        content_hash: 'def456',
        status: 'queued',
        created_at: new Date().toISOString()
      }

      // Mock Supabase to return no existing job, then create new one
      const mockSelectSingle = jest.fn() as any
      mockSelectSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })
      
      const mockInsertSingle = jest.fn() as any
      mockInsertSingle.mockResolvedValue({ data: newJob, error: null })
      
      const mockSelect = jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                single: mockSelectSingle
              }))
            }))
          }))
        }))
      }))

      const mockInsert = jest.fn(() => ({
        select: jest.fn(() => ({
          single: mockInsertSingle
        }))
      }))

      mockSupabase.from = jest.fn(() => ({
        select: mockSelect,
        insert: mockInsert
      })) as any

      const params = {
        userId: 'user-123',
        menuId: 'menu-456',
        templateId: 'kraft-sports',
        referenceImage: '/ref.jpg',
        brandColors: ['#FF5733']
      }

      const result = await generator.queueGeneration(params)

      expect(result.id).toBe('job-456')
      expect(result.status).toBe('queued')
      expect(mockInsert).toHaveBeenCalled()
    })
  })
})
