import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, templateOperations, DatabaseError } from '@/lib/database'
import { TemplateRegistry } from '@/lib/templates/registry'
import { BindingEngine } from '@/lib/templates/binding-engine'
import { RenderEngine } from '@/lib/render/engine'
import type { UserCustomization, RenderFormat, CategoryV2 } from '@/types/templates'
import type { MenuCategory, Menu, MenuItem } from '@/types'
import { z } from 'zod'
import { renderRequestSchema } from '@/lib/templates/schemas'
import { TemplateError, mapErrorToHttp } from '@/lib/templates/errors'
import { CategoryV2Schema } from '@/lib/extraction/schema-stage2'

/**
 * Convert MenuCategory to CategoryV2 format
 * Ensures all confidence scores are present
 */
function convertToCategoryV2(category: MenuCategory): CategoryV2 {
  return {
    name: category.name,
    confidence: category.confidence ?? 1.0,
    items: category.items.map(item => ({
      name: item.name,
      description: item.description,
      price: item.price,
      confidence: item.confidence ?? 1.0,
      variants: item.variants,
      modifierGroups: item.modifierGroups,
      additional: item.additional,
      type: item.type,
      setMenu: item.setMenu,
    })),
    subcategories: category.subcategories?.map(convertToCategoryV2),
  }
}

// Build CategoryV2[] from a Menu which may store data in flat items or hierarchical categories
function buildCategoriesV2(menu: Menu): CategoryV2[] {
  const itemsLen = (menu.items || []).length
  const catItemsCount = countItemsInCategories(menu.categories as any as MenuCategory[] | undefined)

  // Prefer the richer source: if flat items length >= items represented in categories, build from items
  if (!menu.categories || menu.categories.length === 0 || itemsLen >= catItemsCount) {
    // Group flat items by category
    const map = new Map<string, MenuItem[]>()
    ;(menu.items || []).forEach((item: any) => {
      const cat = item.category || 'Menu'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    })

    const categories: CategoryV2[] = []
    for (const [name, items] of map.entries()) {
      categories.push({
        name,
        confidence: 1.0,
        items: items.map((i) => ({
          name: i.name,
          description: i.description,
          price: i.price,
          confidence: i.confidence ?? 1.0,
          variants: i.variants,
          modifierGroups: i.modifierGroups,
          additional: i.additional,
          type: i.type,
          setMenu: i.setMenu,
        })),
      })
    }

    return categories
  }

  // Otherwise, use categories from menu
  return (menu.categories as any as MenuCategory[]).map(convertToCategoryV2)
}

function countItemsInCategories(categories?: MenuCategory[]): number {
  if (!categories || categories.length === 0) return 0
  let count = 0
  const walk = (cats: MenuCategory[]) => {
    cats.forEach((c) => {
      count += (c.items || []).length
      if (c.subcategories) walk(c.subcategories as any)
    })
  }
  walk(categories)
  return count
}


// Validation schema imported from centralized schemas

// POST /api/templates/render - Render menu with template (synchronous)
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validation = renderRequestSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          errors: validation.error.errors 
        },
        { status: 400 }
      )
    }
    
    const { menuId, templateId, customization, format } = validation.data
    
    // 1. Load menu data
    const menu = await menuOperations.getMenu(menuId, user.id)
    
    if (!menu) {
      const { status, body } = mapErrorToHttp(new TemplateError('Menu not found', 'MENU_NOT_FOUND'))
      return NextResponse.json(body, { status })
    }
    
    // Build CategoryV2[] from the most complete source: categories if populated, otherwise group flat items
    const categoriesV2: CategoryV2[] = buildCategoriesV2(menu)
    if (categoriesV2.length === 0) {
      const { status, body } = mapErrorToHttp(new TemplateError('Menu has no categories', 'NO_CATEGORIES'))
      return NextResponse.json(body, { status })
    }

    // Validate categories structure at runtime to prevent rendering invalid data
    const catValidation = z.array(CategoryV2Schema).safeParse(categoriesV2)
    if (!catValidation.success) {
      const { status, body } = mapErrorToHttp(new TemplateError('Invalid menu data', 'VALIDATION_FAILED', { errors: catValidation.error.errors }))
      return NextResponse.json(body, { status })
    }
    
    // 2. Load template
    const registry = new TemplateRegistry()
    const templateConfig = await registry.loadTemplate(templateId)
    
    // 3. Parse template (get compiled artifact)
    // The template config already contains the parsed template structure
    const parsedTemplate = {
      structure: templateConfig.metadata as any, // Simplified for now
      bindings: templateConfig.bindings,
      // Prefer compiled styles when provided; otherwise map styling
      styles: (templateConfig.styles as any) || (templateConfig.styling as any),
      assets: { images: [], fonts: [] },
    }
    
    // 4. Bind data
    const bindingEngine = new BindingEngine()
    const categories = categoriesV2
    
    const boundData = bindingEngine.bind({
      menu: {
        restaurantName: menu.name,
        categories,
      },
      template: templateConfig,
      customization,
    })
    
    // 5. Render
    const renderEngine = new RenderEngine()
    const renderResult = await renderEngine.render(
      boundData,
      parsedTemplate,
      { format: format as RenderFormat }
    )
    
    // 6. Save render record
    const render = await templateOperations.createRender({
      userId: user.id,
      menuId,
      templateId,
      renderData: renderResult,
      customization,
      format: format as RenderFormat,
    })
    
    return NextResponse.json({
      success: true,
      data: {
        renderId: render.id,
        html: renderResult.html,
        css: renderResult.css,
        metadata: renderResult.metadata,
      }
    })
    
  } catch (error) {
    console.error('Error rendering template:', error)
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    const mapped = mapErrorToHttp(error)
    return NextResponse.json(mapped.body, { status: mapped.status })
  }
}
