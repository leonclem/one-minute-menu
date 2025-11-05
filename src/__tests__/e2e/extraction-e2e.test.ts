/**
 * End-to-End Tests for Menu Extraction
 * 
 * Simulates complete user flows from image upload to menu publication
 */

import { MenuExtractionService } from '@/lib/extraction/menu-extraction-service'
import { JobQueueManager } from '@/lib/extraction/job-queue'
import { SchemaValidator } from '@/lib/extraction/schema-validator'
import type { ExtractionResult, Category, MenuItem } from '@/lib/extraction/schema-stage1'

// Mock OpenAI
const mockCreate = jest.fn()
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  }
})

// Mock retry module
jest.mock('@/lib/retry', () => ({
  withRetry: jest.fn((fn) => fn()),
  HttpError: class HttpError extends Error {
    constructor(message: string, public status: number, public body?: any) {
      super(message)
      this.name = 'HttpError'
    }
  }
}))

describe('End-to-End Extraction Tests', () => {
  let service: MenuExtractionService
  let queueManager: JobQueueManager
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockCreate.mockReset()

    // Mock Supabase client with chaining and default resolvers
    const chain: any = {}
    chain.from = jest.fn().mockReturnValue(chain)
    chain.select = jest.fn().mockReturnValue(chain)
    chain.insert = jest.fn().mockReturnValue(chain)
    chain.update = jest.fn().mockReturnValue(chain)
    chain.eq = jest.fn().mockReturnValue(chain)
    chain.gte = jest.fn().mockReturnValue(chain)
    chain.order = jest.fn().mockReturnValue(chain)
    chain.limit = jest.fn().mockReturnValue(chain)
    chain.single = jest.fn().mockResolvedValue({ data: null, error: null })
    chain.rpc = jest.fn().mockResolvedValue({ data: null, error: null })

    mockSupabase = chain

    service = new MenuExtractionService('test-api-key', mockSupabase)
    queueManager = new JobQueueManager(mockSupabase)
  })

  describe('Complete User Flow: First-time Menu Creation', () => {
    it('should complete full flow from upload to review', async () => {
      const mockUserId = 'user-123'
      const mockImageUrl = 'https://example.com/restaurant-menu.jpg'

      // Step 1: User uploads image
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('restaurant-menu-image-data')
      }) as any

      // Step 2: Check quota (user has quota available)
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: mockUserId,
          plan: 'free',
          plan_limits: { extraction_jobs: 5 }
        },
        error: null
      })

      mockSupabase.gte.mockResolvedValueOnce({
        count: 2, // User has used 2 out of 5
        error: null
      })

      // Step 3: No existing job for this image
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null, error: null })
                  })
                })
              })
            })
          })
        })
      })

      // Step 4: Create extraction job
      const mockJob = {
        id: 'job-123',
        user_id: mockUserId,
        image_url: mockImageUrl,
        image_hash: 'abc123hash',
        status: 'queued',
        schema_version: 'stage1',
        prompt_version: 'v1.0',
        retry_count: 0,
        created_at: new Date().toISOString()
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: mockJob,
        error: null
      })

      // Step 5: Update status to processing
      mockSupabase.eq.mockReturnValue(mockSupabase)

      // Step 6: Vision-LLM extracts menu data
      const extractedMenu: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'APPETIZERS',
              items: [
                {
                  name: 'Spring Rolls',
                  price: 5.99,
                  description: 'Crispy vegetable rolls with sweet chili sauce',
                  confidence: 0.95
                },
                {
                  name: 'Garlic Bread',
                  price: 4.50,
                  description: 'Toasted bread with garlic butter',
                  confidence: 0.95
                }
              ],
              confidence: 0.95
            },
            {
              name: 'MAIN DISHES',
              items: [
                {
                  name: 'Grilled Chicken',
                  price: 12.99,
                  description: 'With seasonal vegetables and mashed potatoes',
                  confidence: 0.90
                },
                {
                  name: 'Beef Burger',
                  price: 10.99,
                  description: 'Angus beef patty with fries',
                  confidence: 0.92
                },
                {
                  name: 'Vegetarian Pasta',
                  price: 11.50,
                  description: 'Penne with mixed vegetables in tomato sauce',
                  confidence: 0.88
                }
              ],
              confidence: 0.90
            },
            {
              name: 'DESSERTS',
              items: [
                {
                  name: 'Chocolate Cake',
                  price: 6.50,
                  confidence: 0.93
                },
                {
                  name: 'Ice Cream',
                  price: 4.00,
                  description: 'Vanilla, chocolate, or strawberry',
                  confidence: 0.95
                }
              ],
              confidence: 0.94
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: [
          {
            text: 'All prices include tax',
            context: 'Footer note',
            confidence: 0.98
          }
        ]
      }

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(extractedMenu)
          }
        }],
        usage: {
          prompt_tokens: 1800,
          completion_tokens: 900,
          total_tokens: 2700
        }
      })

      // Step 7: Job completes successfully
      const completedJob = {
        ...mockJob,
        status: 'completed',
        result: extractedMenu,
        processing_time: 4200,
        token_usage: {
          inputTokens: 1800,
          outputTokens: 900,
          totalTokens: 2700,
          estimatedCost: 0.028
        },
        confidence: 0.92,
        uncertain_items: [],
        superfluous_text: extractedMenu.superfluousText,
        completed_at: new Date().toISOString()
      }

      mockSupabase.update.mockImplementation(() => {
        const updateChain: any = {}
        updateChain.eq = jest.fn().mockReturnValue(updateChain)
        updateChain.select = jest.fn().mockReturnValue(updateChain)
        updateChain.single = jest.fn().mockResolvedValue({
          data: completedJob,
          error: null
        })
        return updateChain
      })

      // Execute the flow
      const job = await service.submitExtractionJob(mockImageUrl, mockUserId)

      // Verify results
      expect(job.status).toBe('completed')
      expect(job.result).toBeDefined()
      expect(job.result?.menu.categories).toHaveLength(3)
      
      // Verify APPETIZERS category
      const appetizers = job.result?.menu.categories[0]
      expect(appetizers?.name).toBe('APPETIZERS')
      expect(appetizers?.items).toHaveLength(2)
      expect(appetizers?.items[0].name).toBe('Spring Rolls')
      expect(appetizers?.items[0].price).toBe(5.99)
      
      // Verify MAIN DISHES category
      const mains = job.result?.menu.categories[1]
      expect(mains?.name).toBe('MAIN DISHES')
      expect(mains?.items).toHaveLength(3)
      
      // Verify DESSERTS category
      const desserts = job.result?.menu.categories[2]
      expect(desserts?.name).toBe('DESSERTS')
      expect(desserts?.items).toHaveLength(2)
      
      // Verify metadata
      expect(job.result?.currency).toBe('USD')
      expect(job.result?.uncertainItems).toHaveLength(0)
      expect(job.result?.superfluousText).toHaveLength(1)
      
      // Verify cost tracking
      expect(job.tokenUsage?.estimatedCost).toBeLessThan(0.03) // Under budget
      expect(job.processingTime).toBeGreaterThan(0)
      expect(job.confidence).toBeGreaterThan(0.9)
    })
  })

  describe('Complete User Flow: Menu with Uncertainties', () => {
    it('should handle menu with unclear items requiring review', async () => {
      const mockUserId = 'user-456'
      const mockImageUrl = 'https://example.com/unclear-menu.jpg'

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('unclear-menu-image-data')
      }) as any

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null, error: null })
                  })
                })
              })
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'job-456',
                user_id: mockUserId,
                image_url: mockImageUrl,
                image_hash: 'def456hash',
                status: 'queued',
                schema_version: 'stage1',
                prompt_version: 'v1.0',
                created_at: new Date().toISOString()
              },
              error: null
            })
          })
        })
      })

      mockSupabase.eq.mockReturnValue(mockSupabase)

      const extractedMenu: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'SPECIALS',
              items: [
                {
                  name: 'Chef Special',
                  price: 18.00,
                  description: 'Ask server for details',
                  confidence: 0.75
                },
                {
                  name: 'Daily Soup',
                  price: 6.00,
                  confidence: 0.80
                }
              ],
              confidence: 0.77
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [
          {
            text: 'Seasonal Salad - Market Price',
            reason: 'Price not specified, marked as market price',
            confidence: 0.65,
            suggestedCategory: 'SPECIALS'
          },
          {
            text: 'Grilled [unclear text]',
            reason: 'Item name partially illegible',
            confidence: 0.40,
            suggestedCategory: 'SPECIALS',
            suggestedPrice: 15.00
          }
        ],
        superfluousText: [
          {
            text: 'Follow us @restaurant_name',
            context: 'Bottom of menu',
            confidence: 0.95
          },
          {
            text: 'WiFi: RestaurantGuest',
            context: 'Side note',
            confidence: 0.92
          }
        ]
      }

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(extractedMenu)
          }
        }],
        usage: {
          prompt_tokens: 1500,
          completion_tokens: 700,
          total_tokens: 2200
        }
      })

      mockSupabase.update.mockImplementation(() => {
        const updateChain: any = {}
        updateChain.eq = jest.fn().mockReturnValue(updateChain)
        updateChain.select = jest.fn().mockReturnValue(updateChain)
        updateChain.single = jest.fn().mockResolvedValue({
          data: {
            id: 'job-456',
            status: 'completed',
            result: extractedMenu,
            confidence: 0.72,
            uncertain_items: extractedMenu.uncertainItems,
            superfluous_text: extractedMenu.superfluousText
          },
          error: null
        })
        return updateChain
      })

      const job = await service.submitExtractionJob(mockImageUrl, mockUserId)

      // Verify uncertain items are flagged
      expect(job.result?.uncertainItems).toHaveLength(2)
      expect(job.result?.uncertainItems[0].reason).toContain('market price')
      expect(job.result?.uncertainItems[1].confidence).toBeLessThan(0.6)
      
      // Verify superfluous text is separated
      expect(job.result?.superfluousText).toHaveLength(2)
      expect(job.result?.superfluousText[0].text).toContain('@restaurant_name')
      
      // Verify overall confidence reflects uncertainties
      expect(job.confidence).toBeLessThan(0.8)
    })
  })

  describe('Complete User Flow: Hierarchical Menu', () => {
    it('should handle menu with nested categories', async () => {
      const mockUserId = 'user-789'
      const mockImageUrl = 'https://example.com/hierarchical-menu.jpg'

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('hierarchical-menu-image-data')
      }) as any

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null
      })

      // First query: findExistingJob returns no data
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null, error: null })
                  })
                })
              })
            })
          })
        })
      })

      // Second query: createJobRecord insert
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'job-789',
                user_id: mockUserId,
                image_url: mockImageUrl,
                image_hash: 'ghi789hash',
                status: 'queued',
                schema_version: 'stage1',
                prompt_version: 'v1.0',
                created_at: new Date().toISOString()
              },
              error: null
            })
          })
        })
      })

      mockSupabase.eq.mockReturnValue(mockSupabase)

      const extractedMenu: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'PREMIUM STEAKS',
              items: [],
              subcategories: [
                {
                  name: 'BIG CUTS',
                  items: [
                    {
                      name: 'Ribeye 500g',
                      price: 45.00,
                      description: 'Aged 21 days',
                      confidence: 0.92
                    },
                    {
                      name: 'T-Bone 600g',
                      price: 52.00,
                      description: 'Premium cut',
                      confidence: 0.90
                    }
                  ],
                  confidence: 0.91
                },
                {
                  name: 'PREMIUM CUTS',
                  items: [
                    {
                      name: 'Wagyu Sirloin 300g',
                      price: 68.00,
                      description: 'A5 grade',
                      confidence: 0.93
                    },
                    {
                      name: 'Tenderloin 250g',
                      price: 58.00,
                      confidence: 0.91
                    }
                  ],
                  confidence: 0.92
                }
              ],
              confidence: 0.91
            },
            {
              name: 'SIDES',
              items: [
                {
                  name: 'Mashed Potatoes',
                  price: 6.00,
                  confidence: 0.95
                },
                {
                  name: 'Grilled Vegetables',
                  price: 7.00,
                  confidence: 0.95
                }
              ],
              confidence: 0.95
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(extractedMenu)
          }
        }],
        usage: {
          prompt_tokens: 2000,
          completion_tokens: 1000,
          total_tokens: 3000
        }
      })

      mockSupabase.update.mockImplementation(() => {
        const updateChain: any = {}
        updateChain.eq = jest.fn().mockReturnValue(updateChain)
        updateChain.select = jest.fn().mockReturnValue(updateChain)
        updateChain.single = jest.fn().mockResolvedValue({
          data: {
            id: 'job-789',
            status: 'completed',
            result: extractedMenu,
            confidence: 0.92
          },
          error: null
        })
        return updateChain
      })

      const job = await service.submitExtractionJob(mockImageUrl, mockUserId)

      // Verify hierarchical structure
      expect(job.result?.menu.categories).toHaveLength(2)
      
      const premiumSteaks = job.result?.menu.categories[0]
      expect(premiumSteaks?.name).toBe('PREMIUM STEAKS')
      expect(premiumSteaks?.items).toHaveLength(0) // Parent category has no direct items
      expect(premiumSteaks?.subcategories).toHaveLength(2)
      
      // Verify subcategories
      const bigCuts = premiumSteaks?.subcategories?.[0]
      expect(bigCuts?.name).toBe('BIG CUTS')
      expect(bigCuts?.items).toHaveLength(2)
      expect(bigCuts?.items[0].name).toBe('Ribeye 500g')
      
      const premiumCuts = premiumSteaks?.subcategories?.[1]
      expect(premiumCuts?.name).toBe('PREMIUM CUTS')
      expect(premiumCuts?.items).toHaveLength(2)
      expect(premiumCuts?.items[0].name).toBe('Wagyu Sirloin 300g')
      
      // Verify currency detection
      expect(job.result?.currency).toBe('SGD')
    })
  })

  describe('User Flow: Editing and Corrections', () => {
    it('should support user corrections after extraction', async () => {
      // Simulate extraction result
      const originalResult: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'MAINS',
              items: [
                {
                  name: 'Chicken Burger',
                  price: 10.99,
                  confidence: 0.85
                }
              ],
              confidence: 0.85
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      // User makes corrections
      const correctedResult: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'MAIN DISHES', // Corrected category name
              items: [
                {
                  name: 'Grilled Chicken Burger', // Corrected item name
                  price: 11.99, // Corrected price
                  description: 'With lettuce and tomato', // Added description
                  confidence: 0.85
                }
              ],
              confidence: 0.85
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      // Validate corrected result
      const validator = new SchemaValidator()
      const validation = validator.validateExtractionResult(correctedResult)

      expect(validation.valid).toBe(true)
      expect(correctedResult.menu.categories[0].name).toBe('MAIN DISHES')
      expect(correctedResult.menu.categories[0].items[0].name).toBe('Grilled Chicken Burger')
      expect(correctedResult.menu.categories[0].items[0].price).toBe(11.99)
      expect(correctedResult.menu.categories[0].items[0].description).toBe('With lettuce and tomato')
    })
  })

  describe('User Flow: Quota Management', () => {
    it('should prevent extraction when quota exceeded', async () => {
      const mockUserId = 'user-quota-exceeded'

      // Mock user at quota limit
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: mockUserId,
          plan: 'free',
          plan_limits: { extraction_jobs: 5 }
        },
        error: null
      })

      mockSupabase.gte.mockResolvedValueOnce({
        count: 5, // Already used all 5
        error: null
      })

      const quotaCheck = await queueManager.checkQuota(mockUserId)

      expect(quotaCheck.allowed).toBe(false)
      expect(quotaCheck.reason).toContain('Monthly extraction limit reached')
      expect(quotaCheck.current).toBe(5)
      expect(quotaCheck.limit).toBe(5)
    })

    it('should allow extraction for premium user with higher quota', async () => {
      const mockUserId = 'user-premium'

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: mockUserId,
          plan: 'premium',
          plan_limits: { extraction_jobs: 50 }
        },
        error: null
      })

      mockSupabase.gte.mockResolvedValueOnce({
        count: 25, // Used 25 out of 50
        error: null
      })

      const quotaCheck = await queueManager.checkQuota(mockUserId)

      expect(quotaCheck.allowed).toBe(true)
      expect(quotaCheck.current).toBe(25)
      expect(quotaCheck.limit).toBe(50)
    })
  })
})
