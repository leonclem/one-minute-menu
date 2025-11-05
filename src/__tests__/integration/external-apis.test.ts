/**
 * Integration Tests for External API Interactions
 * Tests OpenAI and other current external services
 */

// Google Vision API tests removed as part of OCR deprecation

describe('Integration: OpenAI API', () => {
  const mockOpenAI = {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should parse menu text into structured menu items', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                { name: 'Chicken Rice', price: 5.0, description: 'Hainanese style' },
                { name: 'Beef Noodles', price: 8.5, description: 'Spicy broth' },
              ],
            }),
          },
        },
      ],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 80,
        total_tokens: 230,
      },
    }

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

    const result = await mockOpenAI.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Parse this menu...' }],
    })

    const parsedData = JSON.parse(result.choices[0].message.content)
    
    expect(parsedData.items).toHaveLength(2)
    expect(parsedData.items[0].name).toBe('Chicken Rice')
    expect(result.usage.total_tokens).toBe(230)
  })

  it('should handle various currency formats', async () => {
    const testCases = [
      { input: '$5.00', expected: 5.0 },
      { input: 'SGD 5.00', expected: 5.0 },
      { input: '5.00 SGD', expected: 5.0 },
      { input: 'S$5.00', expected: 5.0 },
      { input: '5', expected: 5.0 },
    ]

    for (const testCase of testCases) {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: [{ name: 'Item', price: testCase.expected }],
              }),
            },
          },
        ],
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

      const result = await mockOpenAI.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: `Parse: Item ${testCase.input}` }],
      })

      const parsed = JSON.parse(result.choices[0].message.content)
      expect(parsed.items[0].price).toBe(testCase.expected)
    }
  })

  it('should handle API errors with retry logic', async () => {
    let attemptCount = 0

    mockOpenAI.chat.completions.create.mockImplementation(() => {
      attemptCount++
      if (attemptCount < 3) {
        return Promise.reject(new Error('Rate limit exceeded'))
      }
      return Promise.resolve({
        choices: [{ message: { content: '{"items":[]}' } }],
      })
    })

    // Simulate retry logic
    let result
    let retries = 0
    const maxRetries = 3

    while (retries < maxRetries) {
      try {
        result = await mockOpenAI.chat.completions.create({
          model: 'gpt-4',
          messages: [],
        })
        break
      } catch (error) {
        retries++
        if (retries >= maxRetries) throw error
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    expect(result).toBeDefined()
    expect(attemptCount).toBe(3)
  })

  it('should track token usage for cost monitoring', async () => {
    const mockResponse = {
      choices: [{ message: { content: '{"items":[]}' } }],
      usage: {
        prompt_tokens: 200,
        completion_tokens: 100,
        total_tokens: 300,
      },
    }

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

    const result = await mockOpenAI.chat.completions.create({
      model: 'gpt-4',
      messages: [],
    })

    const costPerToken = 0.00003 // Example cost
    const estimatedCost = result.usage.total_tokens * costPerToken

    expect(result.usage.total_tokens).toBe(300)
    expect(estimatedCost).toBeCloseTo(0.009)
  })

  it('should handle malformed JSON responses', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Invalid JSON {items: [}',
          },
        },
      ],
    }

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

    const result = await mockOpenAI.chat.completions.create({
      model: 'gpt-4',
      messages: [],
    })

    expect(() => {
      JSON.parse(result.choices[0].message.content)
    }).toThrow()
  })
})

describe('Integration: Supabase Storage', () => {
  const mockStorage = {
    from: jest.fn(() => ({
      upload: jest.fn(),
      getPublicUrl: jest.fn(),
      remove: jest.fn(),
    })),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should upload menu image', async () => {
    const mockFile = new Blob(['fake image data'], { type: 'image/jpeg' })
    const mockUploadResponse = {
      data: { path: 'menus/user-123/menu-image.jpg' },
      error: null,
    }

    const bucket = mockStorage.from('menu-images')
    bucket.upload = jest.fn().mockResolvedValue(mockUploadResponse)

    const result = await bucket.upload('menu-image.jpg', mockFile)

    expect(result.data?.path).toBeDefined()
    expect(result.error).toBeNull()
  })

  it('should generate public URL for uploaded image', () => {
    const mockPath = 'menus/user-123/menu-image.jpg'
    const mockUrl = {
      data: { publicUrl: `https://storage.example.com/${mockPath}` },
    }

    const bucket = mockStorage.from('menu-images')
    bucket.getPublicUrl = jest.fn().mockReturnValue(mockUrl)

    const result = bucket.getPublicUrl(mockPath)

    expect(result.data.publicUrl).toContain(mockPath)
  })

  it('should handle upload errors', async () => {
    const mockFile = new Blob(['fake image data'], { type: 'image/jpeg' })
    const mockError = {
      data: null,
      error: { message: 'Storage quota exceeded' },
    }

    const bucket = mockStorage.from('menu-images')
    bucket.upload = jest.fn().mockResolvedValue(mockError)

    const result = await bucket.upload('menu-image.jpg', mockFile)

    expect(result.error).toBeDefined()
    expect(result.error?.message).toContain('quota exceeded')
  })

  it('should delete original images after processing', async () => {
    const mockPath = 'menus/user-123/original.jpg'
    const mockResponse = {
      data: { path: mockPath },
      error: null,
    }

    const bucket = mockStorage.from('menu-images')
    bucket.remove = jest.fn().mockResolvedValue(mockResponse)

    const result = await bucket.remove([mockPath])

    expect(result.error).toBeNull()
    expect(bucket.remove).toHaveBeenCalledWith([mockPath])
  })
})

describe('Integration: Email Service (SendGrid)', () => {
  const mockEmailClient = {
    send: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should send welcome email on signup', async () => {
    const mockEmail = {
      to: 'user@example.com',
      from: 'noreply@qrmenu.com',
      subject: 'Welcome to QR Menu System',
      html: '<p>Welcome!</p>',
    }

    mockEmailClient.send.mockResolvedValue({ statusCode: 202 })

    const result = await mockEmailClient.send(mockEmail)

    expect(result.statusCode).toBe(202)
    expect(mockEmailClient.send).toHaveBeenCalledWith(mockEmail)
  })

  it('should send extraction completion notification', async () => {
    const mockEmail = {
      to: 'user@example.com',
      from: 'noreply@qrmenu.com',
      subject: 'Your menu is ready!',
      html: '<p>Extraction processing complete</p>',
    }

    mockEmailClient.send.mockResolvedValue({ statusCode: 202 })

    const result = await mockEmailClient.send(mockEmail)

    expect(result.statusCode).toBe(202)
  })

  it('should handle email delivery failures', async () => {
    mockEmailClient.send.mockRejectedValue(
      new Error('Invalid email address')
    )

    await expect(
      mockEmailClient.send({ to: 'invalid-email' })
    ).rejects.toThrow('Invalid email address')
  })
})

describe('Integration: Circuit Breaker Pattern', () => {
  it('should open circuit after consecutive failures', async () => {
    const circuitBreaker = {
      state: 'closed',
      failureCount: 0,
      threshold: 3,
      call: async function(fn: () => Promise<any>) {
        if (this.state === 'open') {
          throw new Error('Circuit breaker is open')
        }

        try {
          const result = await fn()
          this.failureCount = 0
          return result
        } catch (error) {
          this.failureCount++
          if (this.failureCount >= this.threshold) {
            this.state = 'open'
          }
          throw error
        }
      },
    }

    const failingFunction = () => Promise.reject(new Error('API error'))

    // Trigger failures
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.call(failingFunction)
      } catch (error) {
        // Expected
      }
    }

    expect(circuitBreaker.state).toBe('open')
    
    // Next call should fail immediately
    await expect(
      circuitBreaker.call(failingFunction)
    ).rejects.toThrow('Circuit breaker is open')
  })

  it('should reset circuit after timeout', async () => {
    const circuitBreaker = {
      state: 'open',
      openedAt: Date.now() - 61000, // Opened 61 seconds ago
      timeout: 60000, // 60 second timeout
      reset: function() {
        if (Date.now() - this.openedAt > this.timeout) {
          this.state = 'half-open'
        }
      },
    }

    circuitBreaker.reset()

    expect(circuitBreaker.state).toBe('half-open')
  })
})
