// Platform metrics tracking utilities
// Tracks high-level system usage for admin monitoring

import { analyticsOperations } from './analytics-server'

/**
 * Track platform metrics in the background
 * These calls should never fail or block user operations
 */
export const platformMetrics = {
  /**
   * Track user registration
   */
  async trackUserRegistration(): Promise<void> {
    try {
      await analyticsOperations.trackPlatformMetric('user_registrations', 1)
    } catch (error) {
      console.error('Failed to track user registration metric:', error)
    }
  },

  /**
   * Track menu publication
   */
  async trackMenuPublication(): Promise<void> {
    try {
      await analyticsOperations.trackPlatformMetric('menu_publications', 1)
    } catch (error) {
      console.error('Failed to track menu publication metric:', error)
    }
  },

  /**
   * Track OCR job completion
   */
  async trackOCRJobCompleted(): Promise<void> {
    try {
      await analyticsOperations.trackPlatformMetric('ocr_jobs_completed', 1)
    } catch (error) {
      console.error('Failed to track OCR job metric:', error)
    }
  },

  /**
   * Track daily active users (called when user performs any action)
   */
  async trackActiveUser(): Promise<void> {
    try {
      await analyticsOperations.trackPlatformMetric('daily_active_users', 1)
    } catch (error) {
      console.error('Failed to track active user metric:', error)
    }
  },

  /**
   * Track total menu views (aggregate from individual menu analytics)
   */
  async trackTotalMenuViews(viewCount: number = 1): Promise<void> {
    try {
      await analyticsOperations.trackPlatformMetric('total_menu_views', viewCount)
    } catch (error) {
      console.error('Failed to track total menu views metric:', error)
    }
  },
}