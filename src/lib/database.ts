import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { generateImageFilename } from '@/lib/image-utils'
import type { Menu, MenuItem, User, PlanLimits, MenuTheme } from '@/types'
import { PLAN_CONFIGS } from '@/types'
import { computeSha256FromUrl } from '@/lib/utils'
import { ensureBackwardCompatibility } from '@/lib/menu-data-migration'

// Re-export migration utilities for convenience
export * from '@/lib/menu-data-migration'

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
    
    // Map plan_limits (snake_case in DB) -> PlanLimits (camelCase in app)
    const mapPlanLimitsFromDb = (dbLimits: any, plan: User['plan']): PlanLimits => {
      const defaults = PLAN_CONFIGS[plan]
      return {
        menus: typeof dbLimits?.menus === 'number' ? dbLimits.menus : defaults.menus,
        menuItems: typeof dbLimits?.items === 'number' ? dbLimits.items : defaults.menuItems,
        monthlyUploads: typeof dbLimits?.monthly_uploads === 'number' ? dbLimits.monthly_uploads : defaults.monthlyUploads,
        aiImageGenerations: typeof dbLimits?.ai_image_generations === 'number' ? dbLimits.ai_image_generations : defaults.aiImageGenerations,
      }
    }

    return {
      id: data.id,
      email: data.email,
      plan: data.plan as 'free' | 'premium' | 'enterprise',
      limits: mapPlanLimitsFromDb(data.plan_limits, data.plan as 'free' | 'premium' | 'enterprise'),
      createdAt: new Date(data.created_at),
      location: data.location || undefined,
      role: data.role as 'user' | 'admin' || 'user',
    }
  },

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const supabase = createServerSupabaseClient()
    
    const updateData: any = {}
    if (updates.plan) updateData.plan = updates.plan
    if (updates.limits) {
      // Map PlanLimits (camelCase) -> DB shape (snake_case)
      updateData.plan_limits = {
        menus: updates.limits.menus,
        items: updates.limits.menuItems,
        monthly_uploads: updates.limits.monthlyUploads,
        ai_image_generations: updates.limits.aiImageGenerations,
      }
    }
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
    
    // Reuse the same mapper for returned row
    const mapPlanLimitsFromDb = (dbLimits: any, plan: User['plan']): PlanLimits => {
      const defaults = PLAN_CONFIGS[plan]
      return {
        menus: typeof dbLimits?.menus === 'number' ? dbLimits.menus : defaults.menus,
        menuItems: typeof dbLimits?.items === 'number' ? dbLimits.items : defaults.menuItems,
        monthlyUploads: typeof dbLimits?.monthly_uploads === 'number' ? dbLimits.monthly_uploads : defaults.monthlyUploads,
        aiImageGenerations: typeof dbLimits?.ai_image_generations === 'number' ? dbLimits.ai_image_generations : defaults.aiImageGenerations,
      }
    }

    return {
      id: data.id,
      email: data.email,
      plan: data.plan,
      limits: mapPlanLimitsFromDb(data.plan_limits, data.plan),
      createdAt: new Date(data.created_at),
      location: data.location || undefined,
      role: data.role as 'user' | 'admin' || 'user',
    }
  },

  async checkPlanLimits(userId: string, resource: keyof PlanLimits): Promise<{ allowed: boolean; current: number; limit: number }> {
    const profile = await this.getProfile(userId)
    if (!profile) throw new DatabaseError('User profile not found')
    
    // Admin users have unlimited access
    if (profile.role === 'admin') {
      return {
        allowed: true,
        current: 0,
        limit: -1
      }
    }
    
    let current = 0
    
    switch (resource) {
      case 'menus':
        const { count } = await createServerSupabaseClient()
          .from('menus')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
        current = count || 0
        break

      case 'monthlyUploads':
        const startMonth = new Date()
        startMonth.setDate(1)
        startMonth.setHours(0, 0, 0, 0)

        const { count: uploadCount } = await createServerSupabaseClient()
          .from('uploads')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', startMonth.toISOString())
        current = uploadCount || 0
        break

      case 'aiImageGenerations':
        const startOfCurrentMonth = new Date()
        startOfCurrentMonth.setDate(1)
        startOfCurrentMonth.setHours(0, 0, 0, 0)

        const { count: generationCount } = await createServerSupabaseClient()
          .from('image_generation_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'completed')
          .gte('created_at', startOfCurrentMonth.toISOString())
        current = generationCount || 0
        break
    }
    
    const limit = profile.limits[resource]
    return {
      allowed: typeof limit === 'number' && limit < 0 ? true : current < limit,
      current,
      limit
    }
  }
}

// Menu Version Operations
export const menuVersionOperations = {
  async createVersion(menuId: string, versionData: { menu_data: any; version: number }): Promise<void> {
    const supabase = createServerSupabaseClient()
    
    // Check if version already exists
    const { data: existingVersion } = await supabase
      .from('menu_versions')
      .select('id')
      .eq('menu_id', menuId)
      .eq('version', versionData.version)
      .single()
    
    if (existingVersion) {
      // Version already exists, skip creation
      return
    }
    
    const { error } = await supabase
      .from('menu_versions')
      .insert({
        menu_id: menuId,
        version: versionData.version,
        menu_data: versionData.menu_data,
        published_at: new Date().toISOString(),
      })
    
    if (error) {
      throw new DatabaseError(`Failed to create menu version: ${error.message}`, error.code)
    }
  },

  async getVersionHistory(menuId: string, userId: string): Promise<Array<{
    id: string
    version: number
    created_at: Date
    published_at: Date | null
    menu_data: any
  }>> {
    const supabase = createServerSupabaseClient()
    
    const { data, error } = await supabase
      .from('menu_versions')
      .select('*')
      .eq('menu_id', menuId)
      .order('version', { ascending: false })
    
    if (error) {
      throw new DatabaseError(`Failed to get version history: ${error.message}`, error.code)
    }
    
    return data.map(version => ({
      id: version.id,
      version: version.version,
      created_at: new Date(version.created_at),
      published_at: version.published_at ? new Date(version.published_at) : null,
      menu_data: version.menu_data,
    }))
  },

  async revertToVersion(menuId: string, userId: string, versionId: string): Promise<Menu> {
    const supabase = createServerSupabaseClient()
    
    // Get the version data
    const { data: versionData, error: versionError } = await supabase
      .from('menu_versions')
      .select('*')
      .eq('id', versionId)
      .eq('menu_id', menuId)
      .single()
    
    if (versionError) {
      throw new DatabaseError(`Failed to get version data: ${versionError.message}`, versionError.code)
    }
    
    // Get current menu to increment version
    const currentMenu = await menuOperations.getMenu(menuId, userId)
    if (!currentMenu) throw new DatabaseError('Menu not found')
    
    const newVersionNumber = currentMenu.version + 1
    
    // Create a new version with current data before reverting
    await this.createVersion(menuId, {
      menu_data: {
        items: currentMenu.items,
        theme: currentMenu.theme,
        paymentInfo: currentMenu.paymentInfo,
      },
      version: currentMenu.version,
    })
    
    // Update menu with version data
    const { data: updatedMenu, error: updateError } = await supabase
      .from('menus')
      .update({
        menu_data: versionData.menu_data,
        current_version: newVersionNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', menuId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (updateError) {
      throw new DatabaseError(`Failed to revert menu: ${updateError.message}`, updateError.code)
    }
    
    // Create version entry for the revert
    await this.createVersion(menuId, {
      menu_data: versionData.menu_data,
      version: newVersionNumber,
    })
    
    return await transformMenuFromDB(updatedMenu)
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
    
    return await transformMenuFromDB(data)
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
    
    return await transformMenuFromDB(data)
  },

  async getPublishedMenuByUserAndSlug(userId: string, slug: string): Promise<Menu | null> {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .eq('user_id', userId)
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    if (error) {
      if ((error as any).code === 'PGRST116') return null
      throw new DatabaseError(`Failed to get published menu: ${error.message}`, (error as any).code)
    }
    return await transformMenuFromDB(data)
  },

  async getLatestPublishedSnapshotByUserAndSlug(userId: string, slug: string): Promise<Menu | null> {
    const supabase = createServerSupabaseClient()
    // First find the menu id ensuring it's published
    const { data: menuRow, error: menuErr } = await supabase
      .from('menus')
      .select('id, user_id, name, slug, current_version, status, created_at, updated_at')
      .eq('user_id', userId)
      .eq('slug', slug)
      .eq('status', 'published')
      .single()
    if (menuErr) {
      if ((menuErr as any).code === 'PGRST116') return null
      throw new DatabaseError(`Failed to find published menu: ${menuErr.message}`, (menuErr as any).code)
    }

    // Fetch latest version snapshot (use current_version as authoritative)
    const { data: versionRow, error: verErr } = await supabase
      .from('menu_versions')
      .select('menu_data, version, published_at, created_at')
      .eq('menu_id', menuRow.id)
      .eq('version', menuRow.current_version)
      .single()
    if (verErr) {
      if ((verErr as any).code === 'PGRST116') return null
      throw new DatabaseError(`Failed to load published snapshot: ${verErr.message}`, (verErr as any).code)
    }

    return await transformMenuFromDB({
      ...menuRow,
      menu_data: versionRow.menu_data,
      published_at: versionRow.published_at,
    })
  },

  async getDraftByUserAndSlug(userId: string, slug: string): Promise<Menu | null> {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .eq('user_id', userId)
      .eq('slug', slug)
      .single()
    if (error) {
      if ((error as any).code === 'PGRST116') return null
      throw new DatabaseError(`Failed to get draft: ${error.message}`, (error as any).code)
    }
    return await transformMenuFromDB(data)
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
    
    return await Promise.all(data.map(transformMenuFromDB))
  },

  async updateMenu(menuId: string, userId: string, updates: Partial<Menu>): Promise<Menu> {
    const supabase = createServerSupabaseClient()
    
    const updateData: any = {}
    if (updates.name) updateData.name = updates.name
    if (updates.status) updateData.status = updates.status
    if (updates.items || updates.categories || updates.theme || updates.paymentInfo || updates.extractionMetadata) {
      // Get current menu data and merge updates
      const currentMenu = await this.getMenu(menuId, userId)
      if (!currentMenu) throw new DatabaseError('Menu not found')
      
      updateData.menu_data = {
        items: updates.items !== undefined ? updates.items : currentMenu.items,
        categories: updates.categories !== undefined ? updates.categories : currentMenu.categories,
        theme: updates.theme !== undefined ? updates.theme : currentMenu.theme,
        paymentInfo: updates.paymentInfo !== undefined ? updates.paymentInfo : currentMenu.paymentInfo,
        extractionMetadata: updates.extractionMetadata !== undefined ? updates.extractionMetadata : currentMenu.extractionMetadata,
      }

      // If items are explicitly set to empty and categories were not provided in updates,
      // clear categories too to keep data consistent and avoid rehydration via ensureBackwardCompatibility
      if (Array.isArray(updates.items) && updates.items.length === 0 && updates.categories === undefined) {
        updateData.menu_data.categories = []
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
    
    return await transformMenuFromDB(data)
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
  },

  async updateMenuFromExtraction(
    menuId: string,
    userId: string,
    extractionData: {
      items: MenuItem[]
      categories?: any[]
      extractionMetadata?: any
    }
  ): Promise<Menu> {
    const supabase = createServerSupabaseClient()
    
    // Get current menu
    const currentMenu = await this.getMenu(menuId, userId)
    if (!currentMenu) throw new DatabaseError('Menu not found')
    
    // Prepare updated menu data
    const updatedMenuData = {
      items: extractionData.items,
      categories: extractionData.categories,
      theme: currentMenu.theme,
      paymentInfo: currentMenu.paymentInfo,
      extractionMetadata: extractionData.extractionMetadata,
    }
    
    const { data, error } = await supabase
      .from('menus')
      .update({
        menu_data: updatedMenuData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', menuId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new DatabaseError(`Failed to update menu from extraction: ${error.message}`, error.code)
    }
    
    return await transformMenuFromDB(data)
  },

  async publishMenu(menuId: string, userId: string): Promise<Menu> {
    const supabase = createServerSupabaseClient()
    
    // Get current menu
    const currentMenu = await this.getMenu(menuId, userId)
    if (!currentMenu) throw new DatabaseError('Menu not found')

    // Validate payment info disclaimer if payment is configured
    if (currentMenu.paymentInfo) {
      const disclaimer = currentMenu.paymentInfo.disclaimer?.trim()
      const required = 'Payment handled by your bank app; platform does not process funds'
      if (!disclaimer || disclaimer !== required) {
        throw new DatabaseError('Payment disclaimer missing or invalid', 'PAYMENT_DISCLAIMER_REQUIRED')
      }
    }
    
    const newVersionNumber = currentMenu.version + 1
    
    // Update menu status and version first
    const { data, error } = await supabase
      .from('menus')
      .update({
        status: 'published',
        current_version: newVersionNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', menuId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new DatabaseError(`Failed to publish menu: ${error.message}`, error.code)
    }
    
    // Create version snapshot after successful menu update
    await menuVersionOperations.createVersion(menuId, {
      menu_data: {
        items: currentMenu.items,
        categories: currentMenu.categories,
        theme: currentMenu.theme,
        paymentInfo: currentMenu.paymentInfo,
        extractionMetadata: currentMenu.extractionMetadata,
      },
      version: newVersionNumber,
    })
    
    return await transformMenuFromDB(data)
  }
}

// Menu Item Operations
export const menuItemOperations = {
  async addItem(menuId: string, userId: string, item: Omit<MenuItem, 'id' | 'order'>): Promise<Menu> {
    const menu = await menuOperations.getMenu(menuId, userId)
    if (!menu) throw new DatabaseError('Menu not found')
    
    // Enforce plan limit for number of items per menu
    const profile = await userOperations.getProfile(userId)
    if (!profile) throw new DatabaseError('User profile not found')
    const itemLimit = profile.limits.menuItems
    if (typeof itemLimit === 'number' && itemLimit >= 0) {
      const nextCount = menu.items.length + 1
      if (nextCount > itemLimit) {
        throw new DatabaseError('Item limit exceeded for your plan', 'PLAN_LIMIT_EXCEEDED')
      }
    }

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
    
    // Update in flat items array
    const updatedItems = menu.items.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    )
    
    // Also update in categories to keep data in sync
    let updatedCategories = menu.categories
    if (updatedCategories && updatedCategories.length > 0) {
      const updateItemInCategories = (categories: any[]): any[] => {
        return categories.map(category => ({
          ...category,
          items: category.items.map((item: any) =>
            item.id === itemId ? { ...item, ...updates } : item
          ),
          subcategories: category.subcategories
            ? updateItemInCategories(category.subcategories)
            : undefined,
        }))
      }
      updatedCategories = updateItemInCategories(updatedCategories)
    }
    
    return menuOperations.updateMenu(menuId, userId, { items: updatedItems, categories: updatedCategories })
  },

  async deleteItem(menuId: string, userId: string, itemId: string): Promise<Menu> {
    const menu = await menuOperations.getMenu(menuId, userId)
    if (!menu) throw new DatabaseError('Menu not found')
    
    console.log('[DELETE ITEM] Attempting to delete item:', itemId)
    console.log('[DELETE ITEM] Current items:', menu.items.map(i => ({ id: i.id, name: i.name })))
    
    const updatedItems = menu.items
      .filter(item => item.id !== itemId)
      .map((item, index) => ({ ...item, order: index })) // Reorder
    
    console.log('[DELETE ITEM] Items after filter:', updatedItems.map(i => ({ id: i.id, name: i.name })))
    console.log('[DELETE ITEM] Deleted count:', menu.items.length - updatedItems.length)
    
    // Also delete from categories to keep data in sync
    let updatedCategories = menu.categories
    if (updatedCategories && updatedCategories.length > 0) {
      const deleteItemInCategories = (categories: any[]): any[] => {
        return categories.map(category => ({
          ...category,
          items: category.items.filter((item: any) => item.id !== itemId),
          subcategories: category.subcategories
            ? deleteItemInCategories(category.subcategories)
            : undefined,
        }))
      }
      updatedCategories = deleteItemInCategories(updatedCategories)
    }
    
    return menuOperations.updateMenu(menuId, userId, { items: updatedItems, categories: updatedCategories })
  },

  async deleteMultipleItems(menuId: string, userId: string, itemIds: string[]): Promise<Menu> {
    const menu = await menuOperations.getMenu(menuId, userId)
    if (!menu) throw new DatabaseError('Menu not found')
    
    console.log('[DELETE MULTIPLE] Attempting to delete items:', itemIds)
    console.log('[DELETE MULTIPLE] Current items:', menu.items.map(i => ({ id: i.id, name: i.name })))
    
    const itemIdsSet = new Set(itemIds)
    const updatedItems = menu.items
      .filter(item => !itemIdsSet.has(item.id))
      .map((item, index) => ({ ...item, order: index })) // Reorder
    
    console.log('[DELETE MULTIPLE] Items after filter:', updatedItems.map(i => ({ id: i.id, name: i.name })))
    console.log('[DELETE MULTIPLE] Deleted count:', menu.items.length - updatedItems.length)
    
    // Also delete from categories to keep data in sync
    let updatedCategories = menu.categories
    if (updatedCategories && updatedCategories.length > 0) {
      const deleteItemsInCategories = (categories: any[]): any[] => {
        return categories.map(category => ({
          ...category,
          items: category.items.filter((item: any) => !itemIdsSet.has(item.id)),
          subcategories: category.subcategories
            ? deleteItemsInCategories(category.subcategories)
            : undefined,
        }))
      }
      updatedCategories = deleteItemsInCategories(updatedCategories)
    }
    
    return menuOperations.updateMenu(menuId, userId, { items: updatedItems, categories: updatedCategories })
  },

  async clearItems(menuId: string, userId: string): Promise<Menu> {
    const menu = await menuOperations.getMenu(menuId, userId)
    if (!menu) throw new DatabaseError('Menu not found')
    console.log('[CLEAR ITEMS] Clearing all items from menu:', menuId)
    console.log('[CLEAR ITEMS] Current item count:', menu.items.length)
    // Clear both items and categories to avoid items being rehydrated from categories
    return menuOperations.updateMenu(menuId, userId, { items: [], categories: [] })
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
async function transformMenuFromDB(dbMenu: any): Promise<Menu> {
  const menuData = dbMenu.menu_data || {}
  
  const menu: Menu = {
    id: dbMenu.id,
    userId: dbMenu.user_id,
    name: dbMenu.name,
    slug: dbMenu.slug,
    items: menuData.items || [],
    categories: menuData.categories || undefined,
    theme: menuData.theme || getDefaultTheme(),
    version: dbMenu.current_version,
    status: dbMenu.status,
    publishedAt: dbMenu.published_at ? new Date(dbMenu.published_at) : undefined,
    imageUrl: dbMenu.image_url || undefined,
    logoUrl: dbMenu.logo_url || undefined,
    paymentInfo: menuData.paymentInfo || undefined,
    extractionMetadata: menuData.extractionMetadata ? {
      ...menuData.extractionMetadata,
      extractedAt: new Date(menuData.extractionMetadata.extractedAt)
    } : undefined,
    auditTrail: [], // Will be populated separately if needed
    createdAt: new Date(dbMenu.created_at),
    updatedAt: new Date(dbMenu.updated_at),
  }
  
  // Enrich menu items with AI image URLs
  await enrichMenuItemsWithImageUrls(menu)
  
  // Ensure backward compatibility between items and categories
  return ensureBackwardCompatibility(menu)
}

/**
 * Enriches menu items with AI-generated image URLs by fetching from ai_generated_images table
 */
async function enrichMenuItemsWithImageUrls(menu: Menu): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  // Collect all aiImageIds from items and categories
  const aiImageIds: string[] = []
  
  // From flat items array
  if (menu.items) {
    menu.items.forEach(item => {
      if (item.aiImageId && item.imageSource === 'ai') {
        aiImageIds.push(item.aiImageId)
      }
    })
  }
  
  // From categories
  if (menu.categories) {
    menu.categories.forEach(category => {
      category.items.forEach(item => {
        if (item.aiImageId && item.imageSource === 'ai') {
          aiImageIds.push(item.aiImageId)
        }
      })
    })
  }
  
  // If no AI images to fetch, return early
  if (aiImageIds.length === 0) {
    return
  }
  
  // Fetch all AI image URLs in one query
  const { data: aiImages, error } = await supabase
    .from('ai_generated_images')
    .select('id, desktop_url')
    .in('id', aiImageIds)
  
  if (error) {
    console.error('Error fetching AI image URLs:', error)
    return // Non-fatal: continue without images
  }
  
  // Create a lookup map
  const imageUrlMap = new Map<string, string>()
  aiImages?.forEach(img => {
    if (img.desktop_url) {
      imageUrlMap.set(img.id, img.desktop_url)
    }
  })
  
  // Update items with image URLs
  if (menu.items) {
    menu.items.forEach(item => {
      if (item.aiImageId && item.imageSource === 'ai') {
        const url = imageUrlMap.get(item.aiImageId)
        if (url) {
          item.customImageUrl = url
        }
      }
    })
  }
  
  // Update category items with image URLs
  if (menu.categories) {
    menu.categories.forEach(category => {
      category.items.forEach(item => {
        if (item.aiImageId && item.imageSource === 'ai') {
          const url = imageUrlMap.get(item.aiImageId)
          if (url) {
            item.customImageUrl = url
          }
        }
      })
    })
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
  // Generate a UUID v4 compatible with the menu_items table
  return crypto.randomUUID()
}

// Image Storage Operations
export const imageOperations = {
  async uploadMenuImage(userId: string, file: File): Promise<string> {
    const supabase = createServerSupabaseClient()
    
    // Generate unique filename
    const filename = generateImageFilename(userId, file.name)
    
    // Upload to storage
    const { data, error } = await supabase.storage
      .from('menu-images')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false
      })
    
    if (error) {
      throw new DatabaseError(`Failed to upload image: ${error.message}`, error.message)
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('menu-images')
      .getPublicUrl(filename)
    
    return urlData.publicUrl
  },

  async deleteMenuImage(imageUrl: string): Promise<void> {
    const supabase = createServerSupabaseClient()
    
    // Extract filename from URL
    const urlParts = imageUrl.split('/')
    const filename = urlParts.slice(-2).join('/') // userId/filename.ext
    
    const { error } = await supabase.storage
      .from('menu-images')
      .remove([filename])
    
    if (error) {
      console.error('Failed to delete image:', error)
      // Don't throw error for deletion failures to avoid blocking other operations
    }
  },

  async updateMenuImage(menuId: string, userId: string, imageUrl: string): Promise<Menu> {
    const supabase = createServerSupabaseClient()
    
    // Get current menu to check for existing image
    const currentMenu = await menuOperations.getMenu(menuId, userId)
    if (!currentMenu) throw new DatabaseError('Menu not found')
    
    // Delete old image if exists
    if (currentMenu.imageUrl) {
      await this.deleteMenuImage(currentMenu.imageUrl)
    }
    
    // Update menu with new image URL
    const { data, error } = await supabase
      .from('menus')
      .update({
        image_url: imageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', menuId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new DatabaseError(`Failed to update menu image: ${error.message}`, error.code)
    }
    
    return await transformMenuFromDB(data)
  },

  async updateMenuLogo(menuId: string, userId: string, logoUrl: string): Promise<Menu> {
    const supabase = createServerSupabaseClient()

    // Get current menu to check for existing logo
    const currentMenu = await menuOperations.getMenu(menuId, userId)
    if (!currentMenu) throw new DatabaseError('Menu not found')

    // Delete old logo if exists (stored in same bucket as menu images)
    if (currentMenu.logoUrl) {
      await this.deleteMenuImage(currentMenu.logoUrl)
    }

    // Update menu with new logo URL (empty string treated as null)
    const { data, error } = await supabase
      .from('menus')
      .update({
        logo_url: logoUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', menuId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      throw new DatabaseError(`Failed to update menu logo: ${error.message}`, error.code)
    }

    return await transformMenuFromDB(data)
  }
}

// ============================================================================
// OCR Operations Removed
// ============================================================================
// 
// The old OCR-based extraction has been completely removed.
// Use the extraction service instead: /api/extraction/*
// 
// ============================================================================