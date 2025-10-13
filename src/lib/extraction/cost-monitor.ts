/**
 * Cost Monitor
 * 
 * Monitors extraction costs and enforces spending caps:
 * - Daily and monthly spending limits
 * - Per-user quota enforcement
 * - Cost threshold alerts
 * - Automatic service disable on cap breach
 * 
 * Requirements: 8.3, 12.1, 12.4
 */

import type { MetricsCollector, UserSpending } from './metrics-collector'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SpendingCaps {
  dailyCapPerUser: number
  monthlyCapPerUser: number
  dailyCapGlobal: number
  monthlyCapGlobal: number
}

export interface CostAlert {
  type: 'user' | 'global'
  severity: 'warning' | 'critical'
  metric: 'daily' | 'monthly'
  current: number
  threshold: number
  cap: number
  message: string
  timestamp: Date
}

export interface CostCheckResult {
  allowed: boolean
  reason?: string
  currentSpending: number
  remainingBudget: number
  alerts: CostAlert[]
}

// ============================================================================
// Default Spending Caps
// ============================================================================

const DEFAULT_CAPS: SpendingCaps = {
  dailyCapPerUser: 0.50,      // $0.50 per user per day
  monthlyCapPerUser: 5.00,    // $5.00 per user per month
  dailyCapGlobal: 50.00,      // $50 global per day
  monthlyCapGlobal: 500.00    // $500 global per month
}

// Alert thresholds (percentage of cap)
const WARNING_THRESHOLD = 0.75  // 75% of cap
const CRITICAL_THRESHOLD = 0.90 // 90% of cap

// ============================================================================
// Cost Monitor Class
// ============================================================================

export class CostMonitor {
  private supabase: any
  private metricsCollector: MetricsCollector
  private caps: SpendingCaps

  constructor(
    supabaseClient: any,
    metricsCollector: MetricsCollector,
    customCaps?: Partial<SpendingCaps>
  ) {
    this.supabase = supabaseClient
    this.metricsCollector = metricsCollector
    this.caps = { ...DEFAULT_CAPS, ...customCaps }
  }

  /**
   * Check if user can perform extraction within budget
   */
  async checkUserBudget(
    userId: string,
    estimatedCost: number = 0.03
  ): Promise<CostCheckResult> {
    const spending = await this.metricsCollector.getUserSpending(userId)
    const alerts: CostAlert[] = []

    // Check daily cap
    const dailyRemaining = this.caps.dailyCapPerUser - spending.dailySpending
    if (spending.dailySpending + estimatedCost > this.caps.dailyCapPerUser) {
      return {
        allowed: false,
        reason: `Daily spending cap reached ($${this.caps.dailyCapPerUser.toFixed(2)})`,
        currentSpending: spending.dailySpending,
        remainingBudget: Math.max(0, dailyRemaining),
        alerts
      }
    }

    // Check monthly cap
    const monthlyRemaining = this.caps.monthlyCapPerUser - spending.monthlySpending
    if (spending.monthlySpending + estimatedCost > this.caps.monthlyCapPerUser) {
      return {
        allowed: false,
        reason: `Monthly spending cap reached ($${this.caps.monthlyCapPerUser.toFixed(2)})`,
        currentSpending: spending.monthlySpending,
        remainingBudget: Math.max(0, monthlyRemaining),
        alerts
      }
    }

    // Check for warnings
    const dailyUsagePercent = spending.dailySpending / this.caps.dailyCapPerUser
    if (dailyUsagePercent >= WARNING_THRESHOLD) {
      alerts.push({
        type: 'user',
        severity: dailyUsagePercent >= CRITICAL_THRESHOLD ? 'critical' : 'warning',
        metric: 'daily',
        current: spending.dailySpending,
        threshold: this.caps.dailyCapPerUser * WARNING_THRESHOLD,
        cap: this.caps.dailyCapPerUser,
        message: `Daily spending at ${Math.round(dailyUsagePercent * 100)}% of cap`,
        timestamp: new Date()
      })
    }

    const monthlyUsagePercent = spending.monthlySpending / this.caps.monthlyCapPerUser
    if (monthlyUsagePercent >= WARNING_THRESHOLD) {
      alerts.push({
        type: 'user',
        severity: monthlyUsagePercent >= CRITICAL_THRESHOLD ? 'critical' : 'warning',
        metric: 'monthly',
        current: spending.monthlySpending,
        threshold: this.caps.monthlyCapPerUser * WARNING_THRESHOLD,
        cap: this.caps.monthlyCapPerUser,
        message: `Monthly spending at ${Math.round(monthlyUsagePercent * 100)}% of cap`,
        timestamp: new Date()
      })
    }

    return {
      allowed: true,
      currentSpending: spending.dailySpending,
      remainingBudget: Math.min(dailyRemaining, monthlyRemaining),
      alerts
    }
  }

  /**
   * Check global spending limits
   */
  async checkGlobalBudget(estimatedCost: number = 0.03): Promise<CostCheckResult> {
    const today = new Date().toISOString().split('T')[0]
    const monthStart = new Date()
    monthStart.setDate(1)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    const alerts: CostAlert[] = []

    // Get daily global spending
    const { data: dailyJobs } = await this.supabase
      .from('menu_extraction_jobs')
      .select('token_usage')
      .eq('status', 'completed')
      .gte('created_at', today)

    const dailySpending = (dailyJobs || []).reduce(
      (sum: number, job: any) => sum + (job.token_usage?.estimatedCost || 0),
      0
    )

    // Check daily global cap
    const dailyRemaining = this.caps.dailyCapGlobal - dailySpending
    if (dailySpending + estimatedCost > this.caps.dailyCapGlobal) {
      return {
        allowed: false,
        reason: `Global daily spending cap reached ($${this.caps.dailyCapGlobal.toFixed(2)})`,
        currentSpending: dailySpending,
        remainingBudget: Math.max(0, dailyRemaining),
        alerts
      }
    }

    // Get monthly global spending
    const { data: monthlyJobs } = await this.supabase
      .from('menu_extraction_jobs')
      .select('token_usage')
      .eq('status', 'completed')
      .gte('created_at', monthStartStr)

    const monthlySpending = (monthlyJobs || []).reduce(
      (sum: number, job: any) => sum + (job.token_usage?.estimatedCost || 0),
      0
    )

    // Check monthly global cap
    const monthlyRemaining = this.caps.monthlyCapGlobal - monthlySpending
    if (monthlySpending + estimatedCost > this.caps.monthlyCapGlobal) {
      return {
        allowed: false,
        reason: `Global monthly spending cap reached ($${this.caps.monthlyCapGlobal.toFixed(2)})`,
        currentSpending: monthlySpending,
        remainingBudget: Math.max(0, monthlyRemaining),
        alerts
      }
    }

    // Check for warnings
    const dailyUsagePercent = dailySpending / this.caps.dailyCapGlobal
    if (dailyUsagePercent >= WARNING_THRESHOLD) {
      alerts.push({
        type: 'global',
        severity: dailyUsagePercent >= CRITICAL_THRESHOLD ? 'critical' : 'warning',
        metric: 'daily',
        current: dailySpending,
        threshold: this.caps.dailyCapGlobal * WARNING_THRESHOLD,
        cap: this.caps.dailyCapGlobal,
        message: `Global daily spending at ${Math.round(dailyUsagePercent * 100)}% of cap`,
        timestamp: new Date()
      })
    }

    const monthlyUsagePercent = monthlySpending / this.caps.monthlyCapGlobal
    if (monthlyUsagePercent >= WARNING_THRESHOLD) {
      alerts.push({
        type: 'global',
        severity: monthlyUsagePercent >= CRITICAL_THRESHOLD ? 'critical' : 'warning',
        metric: 'monthly',
        current: monthlySpending,
        threshold: this.caps.monthlyCapGlobal * WARNING_THRESHOLD,
        cap: this.caps.monthlyCapGlobal,
        message: `Global monthly spending at ${Math.round(monthlyUsagePercent * 100)}% of cap`,
        timestamp: new Date()
      })
    }

    return {
      allowed: true,
      currentSpending: dailySpending,
      remainingBudget: Math.min(dailyRemaining, monthlyRemaining),
      alerts
    }
  }

  /**
   * Check if extraction is allowed (both user and global budgets)
   */
  async canPerformExtraction(
    userId: string,
    estimatedCost: number = 0.03
  ): Promise<CostCheckResult> {
    // Check user budget first
    const userCheck = await this.checkUserBudget(userId, estimatedCost)
    if (!userCheck.allowed) {
      return userCheck
    }

    // Check global budget
    const globalCheck = await this.checkGlobalBudget(estimatedCost)
    if (!globalCheck.allowed) {
      return globalCheck
    }

    // Combine alerts from both checks
    return {
      allowed: true,
      currentSpending: userCheck.currentSpending,
      remainingBudget: Math.min(userCheck.remainingBudget, globalCheck.remainingBudget),
      alerts: [...userCheck.alerts, ...globalCheck.alerts]
    }
  }

  /**
   * Process and send alerts
   */
  async processAlerts(alerts: CostAlert[]): Promise<void> {
    for (const alert of alerts) {
      // Log alert
      console.warn(`[COST ALERT] ${alert.severity.toUpperCase()}:`, alert.message, {
        type: alert.type,
        metric: alert.metric,
        current: alert.current,
        cap: alert.cap,
        percentage: Math.round((alert.current / alert.cap) * 100)
      })

      // In production, send alerts via:
      // - Email to admins
      // - Slack/Discord webhook
      // - SMS for critical alerts
      // - Store in alerts table for dashboard display

      // For critical alerts, consider automatic actions
      if (alert.severity === 'critical') {
        await this.handleCriticalAlert(alert)
      }
    }
  }

  /**
   * Handle critical cost alerts
   */
  private async handleCriticalAlert(alert: CostAlert): Promise<void> {
    // Log critical alert
    console.error('[CRITICAL COST ALERT]', alert.message)

    // In production:
    // 1. Send immediate notification to admins
    // 2. Consider rate limiting or temporary service pause
    // 3. Log to monitoring system (DataDog, Sentry, etc.)
    // 4. Create incident ticket

    // For now, just log
    console.error('Critical alert details:', {
      type: alert.type,
      metric: alert.metric,
      current: `$${alert.current.toFixed(4)}`,
      cap: `$${alert.cap.toFixed(2)}`,
      percentage: `${Math.round((alert.current / alert.cap) * 100)}%`
    })
  }

  /**
   * Get current spending caps
   */
  getSpendingCaps(): SpendingCaps {
    return { ...this.caps }
  }

  /**
   * Update spending caps (admin only)
   */
  updateSpendingCaps(newCaps: Partial<SpendingCaps>): void {
    this.caps = { ...this.caps, ...newCaps }
    console.log('Spending caps updated:', this.caps)
  }

  /**
   * Get spending summary for dashboard
   */
  async getSpendingSummary(): Promise<{
    daily: { current: number; cap: number; percentage: number }
    monthly: { current: number; cap: number; percentage: number }
    alerts: CostAlert[]
  }> {
    const globalCheck = await this.checkGlobalBudget(0)
    
    const today = new Date().toISOString().split('T')[0]
    const monthStart = new Date()
    monthStart.setDate(1)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    // Get daily spending
    const { data: dailyJobs } = await this.supabase
      .from('menu_extraction_jobs')
      .select('token_usage')
      .eq('status', 'completed')
      .gte('created_at', today)

    const dailySpending = (dailyJobs || []).reduce(
      (sum: number, job: any) => sum + (job.token_usage?.estimatedCost || 0),
      0
    )

    // Get monthly spending
    const { data: monthlyJobs } = await this.supabase
      .from('menu_extraction_jobs')
      .select('token_usage')
      .eq('status', 'completed')
      .gte('created_at', monthStartStr)

    const monthlySpending = (monthlyJobs || []).reduce(
      (sum: number, job: any) => sum + (job.token_usage?.estimatedCost || 0),
      0
    )

    return {
      daily: {
        current: dailySpending,
        cap: this.caps.dailyCapGlobal,
        percentage: Math.round((dailySpending / this.caps.dailyCapGlobal) * 100)
      },
      monthly: {
        current: monthlySpending,
        cap: this.caps.monthlyCapGlobal,
        percentage: Math.round((monthlySpending / this.caps.monthlyCapGlobal) * 100)
      },
      alerts: globalCheck.alerts
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCostMonitor(
  supabaseClient: any,
  metricsCollector: MetricsCollector,
  customCaps?: Partial<SpendingCaps>
): CostMonitor {
  return new CostMonitor(supabaseClient, metricsCollector, customCaps)
}
