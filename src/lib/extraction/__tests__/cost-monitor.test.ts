/**
 * Tests for Cost Monitor
 * 
 * Requirements: 8.3, 12.1, 12.4
 */

import { CostMonitor } from '../cost-monitor'
import { MetricsCollector } from '../metrics-collector'

describe('CostMonitor', () => {
  let mockSupabase: any
  let mockMetricsCollector: MetricsCollector
  let costMonitor: CostMonitor

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      from: jest.fn(() => mockSupabase),
      select: jest.fn(() => mockSupabase),
      eq: jest.fn(() => mockSupabase),
      gte: jest.fn(() => mockSupabase),
      order: jest.fn(() => mockSupabase),
      limit: jest.fn(() => mockSupabase),
      single: jest.fn(() => ({ data: null, error: null }))
    }

    mockMetricsCollector = new MetricsCollector(mockSupabase)
    
    // Use custom caps for testing
    costMonitor = new CostMonitor(mockSupabase, mockMetricsCollector, {
      dailyCapPerUser: 1.00,
      monthlyCapPerUser: 10.00,
      dailyCapGlobal: 100.00,
      monthlyCapGlobal: 1000.00
    })
  })

  describe('checkUserBudget', () => {
    it('should allow extraction when under budget', async () => {
      // Mock user spending
      jest.spyOn(mockMetricsCollector, 'getUserSpending').mockResolvedValueOnce({
        userId: 'user-1',
        dailySpending: 0.20,
        monthlySpending: 2.00,
        totalExtractions: 10,
        lastExtraction: new Date()
      })

      const result = await costMonitor.checkUserBudget('user-1', 0.03)

      expect(result.allowed).toBe(true)
      expect(result.remainingBudget).toBeGreaterThan(0)
      expect(result.alerts).toHaveLength(0)
    })

    it('should block extraction when daily cap exceeded', async () => {
      jest.spyOn(mockMetricsCollector, 'getUserSpending').mockResolvedValueOnce({
        userId: 'user-1',
        dailySpending: 0.98,
        monthlySpending: 5.00,
        totalExtractions: 50,
        lastExtraction: new Date()
      })

      const result = await costMonitor.checkUserBudget('user-1', 0.03)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Daily spending cap reached')
    })

    it('should block extraction when monthly cap exceeded', async () => {
      jest.spyOn(mockMetricsCollector, 'getUserSpending').mockResolvedValueOnce({
        userId: 'user-1',
        dailySpending: 0.20,
        monthlySpending: 9.98,
        totalExtractions: 300,
        lastExtraction: new Date()
      })

      const result = await costMonitor.checkUserBudget('user-1', 0.03)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Monthly spending cap reached')
    })

    it('should generate warning alert at 75% threshold', async () => {
      jest.spyOn(mockMetricsCollector, 'getUserSpending').mockResolvedValueOnce({
        userId: 'user-1',
        dailySpending: 0.76, // 76% of $1.00 cap
        monthlySpending: 5.00,
        totalExtractions: 50,
        lastExtraction: new Date()
      })

      const result = await costMonitor.checkUserBudget('user-1', 0.03)

      expect(result.allowed).toBe(true)
      expect(result.alerts.length).toBeGreaterThan(0)
      expect(result.alerts[0].severity).toBe('warning')
      expect(result.alerts[0].metric).toBe('daily')
    })

    it('should generate critical alert at 90% threshold', async () => {
      jest.spyOn(mockMetricsCollector, 'getUserSpending').mockResolvedValueOnce({
        userId: 'user-1',
        dailySpending: 0.91, // 91% of $1.00 cap
        monthlySpending: 5.00,
        totalExtractions: 50,
        lastExtraction: new Date()
      })

      const result = await costMonitor.checkUserBudget('user-1', 0.03)

      expect(result.allowed).toBe(true)
      expect(result.alerts.length).toBeGreaterThan(0)
      expect(result.alerts[0].severity).toBe('critical')
    })
  })

  describe('checkGlobalBudget', () => {
    it('should allow extraction when under global budget', async () => {
      const today = new Date().toISOString().split('T')[0]
      
      mockSupabase.select.mockReturnValueOnce(mockSupabase)
      mockSupabase.eq.mockReturnValueOnce(mockSupabase)
      mockSupabase.gte.mockResolvedValueOnce({
        data: [
          { token_usage: { estimatedCost: 10.00 } },
          { token_usage: { estimatedCost: 15.00 } }
        ],
        error: null
      })

      mockSupabase.select.mockReturnValueOnce(mockSupabase)
      mockSupabase.eq.mockReturnValueOnce(mockSupabase)
      mockSupabase.gte.mockResolvedValueOnce({
        data: [
          { token_usage: { estimatedCost: 100.00 } }
        ],
        error: null
      })

      const result = await costMonitor.checkGlobalBudget(0.03)

      expect(result.allowed).toBe(true)
      expect(result.remainingBudget).toBeGreaterThan(0)
    })

    it('should block extraction when global daily cap exceeded', async () => {
      mockSupabase.select.mockReturnValueOnce(mockSupabase)
      mockSupabase.eq.mockReturnValueOnce(mockSupabase)
      mockSupabase.gte.mockResolvedValueOnce({
        data: Array(3000).fill({ token_usage: { estimatedCost: 0.034 } }),
        error: null
      })

      const result = await costMonitor.checkGlobalBudget(0.03)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Global daily spending cap reached')
    })
  })

  describe('canPerformExtraction', () => {
    it('should check both user and global budgets', async () => {
      jest.spyOn(mockMetricsCollector, 'getUserSpending').mockResolvedValueOnce({
        userId: 'user-1',
        dailySpending: 0.20,
        monthlySpending: 2.00,
        totalExtractions: 10,
        lastExtraction: new Date()
      })

      mockSupabase.select.mockReturnValue(mockSupabase)
      mockSupabase.eq.mockReturnValue(mockSupabase)
      mockSupabase.gte.mockResolvedValue({
        data: [{ token_usage: { estimatedCost: 10.00 } }],
        error: null
      })

      const result = await costMonitor.canPerformExtraction('user-1', 0.03)

      expect(result.allowed).toBe(true)
    })

    it('should return user budget error if user budget exceeded', async () => {
      jest.spyOn(mockMetricsCollector, 'getUserSpending').mockResolvedValueOnce({
        userId: 'user-1',
        dailySpending: 0.98,
        monthlySpending: 5.00,
        totalExtractions: 50,
        lastExtraction: new Date()
      })

      const result = await costMonitor.canPerformExtraction('user-1', 0.03)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Daily spending cap reached')
    })
  })

  describe('getSpendingSummary', () => {
    it('should return spending summary with alerts', async () => {
      const today = new Date().toISOString().split('T')[0]
      
      mockSupabase.select.mockReturnValue(mockSupabase)
      mockSupabase.eq.mockReturnValue(mockSupabase)
      mockSupabase.gte.mockResolvedValue({
        data: [
          { token_usage: { estimatedCost: 80.00 } } // 80% of $100 daily cap
        ],
        error: null
      })

      const summary = await costMonitor.getSpendingSummary()

      expect(summary.daily.current).toBe(80.00)
      expect(summary.daily.cap).toBe(100.00)
      expect(summary.daily.percentage).toBe(80)
      expect(summary.alerts.length).toBeGreaterThan(0)
    })
  })

  describe('processAlerts', () => {
    it('should log warnings for alerts', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      const alerts = [
        {
          type: 'user' as const,
          severity: 'warning' as const,
          metric: 'daily' as const,
          current: 0.80,
          threshold: 0.75,
          cap: 1.00,
          message: 'Daily spending at 80% of cap',
          timestamp: new Date()
        }
      ]

      await costMonitor.processAlerts(alerts)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[COST ALERT] WARNING:',
        'Daily spending at 80% of cap',
        expect.any(Object)
      )

      consoleSpy.mockRestore()
    })

    it('should handle critical alerts', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const alerts = [
        {
          type: 'global' as const,
          severity: 'critical' as const,
          metric: 'monthly' as const,
          current: 950.00,
          threshold: 900.00,
          cap: 1000.00,
          message: 'Global monthly spending at 95% of cap',
          timestamp: new Date()
        }
      ]

      await costMonitor.processAlerts(alerts)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[CRITICAL COST ALERT]',
        'Global monthly spending at 95% of cap'
      )

      consoleSpy.mockRestore()
    })
  })

  describe('updateSpendingCaps', () => {
    it('should update spending caps', () => {
      costMonitor.updateSpendingCaps({
        dailyCapPerUser: 2.00,
        monthlyCapPerUser: 20.00
      })

      const caps = costMonitor.getSpendingCaps()

      expect(caps.dailyCapPerUser).toBe(2.00)
      expect(caps.monthlyCapPerUser).toBe(20.00)
      expect(caps.dailyCapGlobal).toBe(100.00) // Unchanged
    })
  })
})
