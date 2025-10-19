import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, templateOperations, DatabaseError } from '@/lib/database'
import { TemplateRegistry } from '@/lib/templates/registry'
import { BindingEngine } from '@/lib/templates/binding-engine'
import { RenderEngine } from '@/lib/render/engine'
import type { UserCustomization, RenderFormat, CategoryV2 } from '@/types/templates'
import type { MenuCategory } from '@/types'
import { z } from 'zod'

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

// Validation schema for render request
const renderRequestSchema = z.object({
  menuId: z.string().uuid(),
  templateId: z.string().uuid(),
  customization: z.object({
    colors: z.object({
      primary: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      secondary: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      accent: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    }).optional(),
    fonts: z.object({
      heading: z.string().optional(),
      body: z.string().optional(),
    }).optional(),
    priceDisplayMode: z.enum(['symbol', 'amount-only']).optional(),
  }).optional(),
  format: z.enum(['html', 'pdf', 'png']).default('html'),
})

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
      return NextResponse.json(
        { error: 'Menu not found' },
        { status: 404 }
      )
    }
    
    // Ensure menu has categories
    if (!menu.categories || menu.categories.length === 0) {
      return NextResponse.json(
        { 
          error: 'Menu has no categories',
          code: 'NO_CATEGORIES'
        },
        { status: 400 }
      )
    }
    
    // 2. Load template
    const registry = new TemplateRegistry()
    const templateConfig = await registry.loadTemplate(templateId)
    
    // 3. Parse template (get compiled artifact)
    // The template config already contains the parsed template structure
    const parsedTemplate = {
      structure: templateConfig.metadata as any, // Simplified for now
      bindings: templateConfig.bindings,
      styles: templateConfig.styling as any,
      assets: { images: [], fonts: [] },
    }
    
    // 4. Bind data
    const bindingEngine = new BindingEngine()
    const categories = (menu.categories || []).map(convertToCategoryV2)
    
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
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      )
    }
    
    if (error instanceof Error && error.name === 'TemplateRegistryError') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
