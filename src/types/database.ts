/**
 * Database types for Supabase
 * 
 * This file defines the database schema types for type-safe database operations.
 * These types should be kept in sync with the actual database schema.
 */

import type { ExportJob, ExportJobMetadata } from './index'

/**
 * Database schema definition for Supabase
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          plan: string
          plan_limits: any
          location: string | null
          created_at: string
          updated_at: string
          role: string | null
          username: string | null
          is_approved: boolean
          approved_at: string | null
          admin_notified: boolean
          onboarding_completed: boolean
          restaurant_name: string | null
          establishment_type: string | null
          primary_cuisine: string | null
        }
        Insert: {
          id: string
          email: string
          plan?: string
          plan_limits?: any
          location?: string | null
          created_at?: string
          updated_at?: string
          role?: string | null
          username?: string | null
          is_approved?: boolean
          approved_at?: string | null
          admin_notified?: boolean
          onboarding_completed?: boolean
          restaurant_name?: string | null
          establishment_type?: string | null
          primary_cuisine?: string | null
        }
        Update: {
          id?: string
          email?: string
          plan?: string
          plan_limits?: any
          location?: string | null
          created_at?: string
          updated_at?: string
          role?: string | null
          username?: string | null
          is_approved?: boolean
          approved_at?: string | null
          admin_notified?: boolean
          onboarding_completed?: boolean
          restaurant_name?: string | null
          establishment_type?: string | null
          primary_cuisine?: string | null
        }
      }
      menus: {
        Row: {
          id: string
          user_id: string
          name: string
          slug: string
          status: string
          current_version: number
          menu_data: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          slug: string
          status?: string
          current_version?: number
          menu_data: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          slug?: string
          status?: string
          current_version?: number
          menu_data?: any
          created_at?: string
          updated_at?: string
        }
      }
      export_jobs: {
        Row: {
          id: string
          user_id: string
          menu_id: string
          export_type: 'pdf' | 'image'
          status: 'pending' | 'processing' | 'completed' | 'failed'
          priority: number
          retry_count: number
          error_message: string | null
          file_url: string | null
          storage_path: string | null
          available_at: string
          metadata: ExportJobMetadata
          worker_id: string | null
          created_at: string
          updated_at: string
          started_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          menu_id: string
          export_type: 'pdf' | 'image'
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          priority?: number
          retry_count?: number
          error_message?: string | null
          file_url?: string | null
          storage_path?: string | null
          available_at?: string
          metadata?: ExportJobMetadata
          worker_id?: string | null
          created_at?: string
          updated_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          menu_id?: string
          export_type?: 'pdf' | 'image'
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          priority?: number
          retry_count?: number
          error_message?: string | null
          file_url?: string | null
          storage_path?: string | null
          available_at?: string
          metadata?: ExportJobMetadata
          worker_id?: string | null
          created_at?: string
          updated_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
