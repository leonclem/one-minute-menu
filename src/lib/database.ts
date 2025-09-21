import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import type { Menu, MenuItem, User, PlanLimits, MenuTheme, OCRJob } from '@/types'

// Database utility functions for menu management

export class DatabaseError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'DatabaseError'
  }
}

// User Profile Operations
export const userOperations = {
  async getProfile(userId: string): Promise<User | null> {
    const supabase = createServerSupabaseClient()
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new DatabaseError(`Failed to get user profile: ${error.message}`, error.code)
    }
    
    return {
      id: data.id,
      email: data.email,
      plan: data.plan as 'free' | 'premium' | 'enterprise',
      limits: data.plan_limits as PlanLimits,
      createdAt: new Date(data.created_at),
      location: data.location || undefined,
    }
  },

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const supabase = createServerSupabaseClient()
    
    const updateData: any = {}
    if (updates.plan) updateData.plan = updates.plan
    if (updates.limits) updateData.plan_limits = updates.limits
    if (updates.location !== undefined) updateData.location = updates.location
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single()
    
    if (error) {
      throw new DatabaseError(`Failed to update profile: ${error.message}`, error.code)
    }
    
    return {
      id: data.id,
      email: data.email,
      plan: data.plan,
      limits: data.plan_limits,
      createdAt: new Date(data.created_at),
      location: data.location || undefined,
    }
  },

  async checkPlanLimits(userId: string, resource: keyof PlanLimits): Promise<{ allowed: boolean; current: number; limit: number }> {
    const profile = await this.getProfile(userId)
    if (!profile) throw new DatabaseError('User profile not found')
    
    let current = 0
    
    switch (resource) {
      case 'menus':
        const { count } = await createServerSupabaseClient()
          .from('menus')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
        current = count || 0
        break
      
      case 'ocrJobs':
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        
        const { count: ocrCount } = await createServerSupabaseClient()
          .from('ocr_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', startOfMonth.toISOString())
        current = ocrCount || 0
        break
    }
    
    const limit = profile.limits[resource]
    return {
      allowed: current < limit,
      current,
      limit
    }
  }
}

// Menu Operations
export const menuOperations = {
  async createMenu(userId: string, menuData: { name: string; slug: string }): Promise<Menu> {
    // Check plan limits first
    const { allowed } = await userOperations.checkPlanLimits(userId, 'menus')
    if (!allowed) {
      throw new DatabaseError('Menu limit exceeded for your plan', 'PLAN_LIMIT_EXCEEDED')
    }
    
    // Check if slug is available for this user
    const slugExists = await this.isSlugTaken(userId, menuData.slug)
    if (slugExists) {
      throw new DatabaseError('Menu slug already exists', 'SLUG_TAKEN')
    }
    
    const supabase = createServerSupabaseClient()
    
    const newMenu = {
      user_id: userId,
      name: menuData.name,
      slug: menuData.slug,
      status: 'draft' as const,
      current_version: 1,
      menu_data: {
        items: [],
        theme: getDefaultTheme(),
        paymentInfo: null,
      }
    }
    
    const { data, error } = await supabase
      .from('menus')
      .insert(newMenu)
      .select()
      .single()
    
    if (error) {
      throw new DatabaseError(`Failed to create menu: ${error.message}`, error.code)
    }
    
    return transformMenuFromDB(data)
  },

  async getMenu(menuId: string, userId?: string): Promise<Menu | null> {
    const supabase = createServerSupabaseClient()
    
    let query = supabase
      .from('menus')
      .select('*')
      .eq('id', menuId)
    
    if (userId) {
      query = query.eq('user_id', userId)
    }
    
    const { data, error } = await query.single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new DatabaseError(`Failed to get menu: ${error.message}`, error.code)
    }
    
    return transformMenuFromDB(data)
  },

  async getUserMenus(userId: string): Promise<Menu[]> {
    const supabase = createServerSupabaseClient()
    
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw new DatabaseError(`Failed to get user menus: ${error.message}`, error.code)
    }
    
    return data.map(transformMenuFromDB)
  },

  async updateMenu(menuId: string, userId: string, updates: Partial<Menu>): Promise<Menu> {
    const supabase = createServerSupabaseClient()
    
    const updateData: any = {}
    if (updates.name) updateData.name = updates.name
    if (updates.status) updateData.status = updates.status
    if (updates.items || updates.theme || updates.paymentInfo) {
      // Get current menu data and merge updates
      const currentMenu = await this.getMenu(menuId, userId)
      if (!currentMenu) throw new DatabaseError('Menu not found')
      
      updateData.menu_data = {
        items: updates.items || currentMenu.items,
        theme: updates.theme || currentMenu.theme,
        paymentInfo: updates.paymentInfo !== undefined ? updates.paymentInfo : currentMenu.paymentInfo,
      }
    }
    
    const { data, error } = await supabase
      .from('menus')
      .update(updateData)
      .eq('id', menuId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new DatabaseError(`Failed to update menu: ${error.message}`, error.code)
    }
    
    return transformMenuFromDB(data)
  },

  async deleteMenu(menuId: string, userId: string): Promise<void> {
    const supabase = createServerSupabaseClient()
    
    const { error } = await supabase
      .from('menus')
      .delete()
      .eq('id', menuId)
      .eq('user_id', userId)
    
    if (error) {
      throw new DatabaseError(`Failed to delete menu: ${error.message}`, error.code)
    }
  },

  async isSlugTaken(userId: string, slug: string): Promise<boolean> {
    const supabase = createServerSupabaseClient()
    
    // Check reserved slugs
    const { data: reserved } = await supabase
      .from('reserved_slugs')
      .select('slug')
      .eq('slug', slug)
      .single()
    
    if (reserved) return true
    
    // Check user's existing slugs
    const { data: existing } = await supabase
      .from('menus')
      .select('slug')
      .eq('user_id', userId)
      .eq('slug', slug)
      .single()
    
    return !!existing
  },

  async generateUniqueSlug(userId: string, baseName: string): Promise<string> {
    const baseSlug = baseName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
    
    let slug = baseSlug
    let counter = 1
    
    while (await this.isSlugTaken(userId, slug)) {
      slug = `${baseSlug}-${counter}`
      counter++
    }
    
    return slug
  }
}

// Menu Item Operations
export const menuItemOperations = {
  async addItem(menuId: string, userId: string, item: Omit<MenuItem, 'id' | 'order'>): Promise<Menu> {
    const menu = await menuOperations.getMenu(menuId, userId)
    if (!menu) throw new DatabaseError('Menu not found')
    
    const newItem: MenuItem = {
      ...item,
      id: generateId(),
      order: menu.items.length,
    }
    
    const updatedItems = [...menu.items, newItem]
    
    return menuOperations.updateMenu(menuId, userId, { items: updatedItems })
  },

  async updateItem(menuId: string, userId: string, itemId: string, updates: Partial<MenuItem>): Promise<Menu> {
    const menu = await menuOperations.getMenu(menuId, userId)
    if (!menu) throw new DatabaseError('Menu not found')
    
    const updatedItems = menu.items.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    )
    
    return menuOperations.updateMenu(menuId, userId, { items: updatedItems })
  },

  async deleteItem(menuId: string, userId: string, itemId: string): Promise<Menu> {
    const menu = await menuOperations.getMenu(menuId, userId)
    if (!menu) throw new DatabaseError('Menu not found')
    
    const updatedItems = menu.items
      .filter(item => item.id !== itemId)
      .map((item, index) => ({ ...item, order: index })) // Reorder
    
    return menuOperations.updateMenu(menuId, userId, { items: updatedItems })
  },

  async reorderItems(menuId: string, userId: string, itemIds: string[]): Promise<Menu> {
    const menu = await menuOperations.getMenu(menuId, userId)
    if (!menu) throw new DatabaseError('Menu not found')
    
    const itemMap = new Map(menu.items.map(item => [item.id, item]))
    const reorderedItems = itemIds
      .map(id => itemMap.get(id))
      .filter(Boolean)
      .map((item, index) => ({ ...item!, order: index }))
    
    return menuOperations.updateMenu(menuId, userId, { items: reorderedItems })
  }
}

// Helper functions
function transformMenuFromDB(dbMenu: any): Menu {
  return {
    id: dbMenu.id,
    userId: dbMenu.user_id,
    name: dbMenu.name,
    slug: dbMenu.slug,
    items: dbMenu.menu_data?.items || [],
    theme: dbMenu.menu_data?.theme || getDefaultTheme(),
    version: dbMenu.current_version,
    status: dbMenu.status,
    publishedAt: dbMenu.published_at ? new Date(dbMenu.published_at) : undefined,
    paymentInfo: dbMenu.menu_data?.paymentInfo || undefined,
    auditTrail: [], // Will be populated separately if needed
    createdAt: new Date(dbMenu.created_at),
    updatedAt: new Date(dbMenu.updated_at),
  }
}

function getDefaultTheme(): MenuTheme {
  return {
    id: 'default',
    name: 'Default Theme',
    colors: {
      primary: '#3B82F6',
      secondary: '#6B7280',
      accent: '#10B981',
      background: '#FFFFFF',
      text: '#111827',
      extractionConfidence: 1.0,
    },
    fonts: {
      primary: 'Inter',
      secondary: 'Inter',
      sizes: {
        heading: '1.5rem',
        body: '1rem',
        price: '1.125rem',
      },
    },
    layout: {
      style: 'modern',
      spacing: 'comfortable',
      itemLayout: 'list',
    },
    wcagCompliant: true,
    mobileOptimized: true,
  }
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}