import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, DatabaseError } from '@/lib/database'
import { getTemplateRegistry } from '@/lib/templates/registry'
import type { TemplateConfiguration } from '@/types'

/**
 * POST /api/menus/[menuId]/apply-template
 * 
 * Applies a template to a menu and computes a render plan.
 * This endpoint does not generate backgrounds - that's handled separately.
 * 
 * Request body:
 * - templateId: string (required) - ID of the template to apply
 * - brandColors: string[] (optional) - Brand colors extracted from uploaded image
 * - idempotencyKey: string (optional) - For idempotent requests
 * 
 * Response:
 * - menu: Updated menu object with template configuration
 * - renderPlan: Predicted fit policies and rendering information
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Parse request body
    const body = await request.json().catch(() => ({})) as {
      templateId?: string
      brandColors?: string[]
      idempotencyKey?: string
    }
    
    const { templateId, brandColors } = body
    
    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      )
    }
    
    // Verify menu ownership
    const menu = await menuOperations.getMenu(params.menuId, user.id)
    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }
    
    // Load and validate template descriptor
    const registry = getTemplateRegistry()
    let templateDescriptor
    try {
      templateDescriptor = await registry.getTemplateDescriptor(templateId)
    } catch (error) {
      return NextResponse.json(
        { error: `Template '${templateId}' not found` },
        { status: 404 }
      )
    }
    
    // Compute render plan (predicted fit policies based on current content)
    const renderPlan = computeRenderPlan(menu, templateDescriptor)
    
    // Create template configuration
    const templateConfig: TemplateConfiguration = {
      customColors: brandColors,
      generatedAt: new Date()
    }
    
    // Update menu with template configuration
    const { data: updatedMenu, error: updateError } = await supabase
      .from('menus')
      .update({
        template_id: templateId,
        template_version: templateDescriptor.version,
        template_config: templateConfig,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.menuId)
      .eq('user_id', user.id)
      .select()
      .single()
    
    if (updateError) {
      throw new DatabaseError(
        `Failed to apply template: ${updateError.message}`,
        updateError.code
      )
    }
    
    return NextResponse.json({
      success: true,
      data: {
        menu: transformMenuFromDB(updatedMenu),
        renderPlan
      }
    })
  } catch (error) {
    console.error('Error applying template:', error)
    
    if (error instanceof DatabaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Computes a render plan based on menu content and template descriptor
 * This predicts which fit policies will likely be applied
 */
function computeRenderPlan(menu: any, template: any) {
  const itemCount = menu.items?.length || 0
  const avgNameLength = menu.items?.reduce((sum: number, item: any) => 
    sum + (item.name?.length || 0), 0) / Math.max(itemCount, 1)
  const avgDescLength = menu.items?.reduce((sum: number, item: any) => 
    sum + (item.description?.length || 0), 0) / Math.max(itemCount, 1)
  
  // Simple heuristic for predicting fit policies
  const predictedPolicies: string[] = []
  
  // If content is long, we'll likely need wrapping
  if (avgDescLength > 100) {
    predictedPolicies.push('wrap')
  }
  
  // If there are many items, we might need compacting or pagination
  if (itemCount > 20) {
    predictedPolicies.push('compact')
  }
  
  if (itemCount > 40) {
    predictedPolicies.push('paginate')
  }
  
  return {
    itemCount,
    avgNameLength: Math.round(avgNameLength),
    avgDescLength: Math.round(avgDescLength),
    predictedPolicies,
    templateId: template.id,
    templateVersion: template.version,
    estimatedPages: Math.ceil(itemCount / 30) // Rough estimate
  }
}

/**
 * Transform database menu row to Menu type
 * This is a temporary helper until we update the main database.ts file
 */
function transformMenuFromDB(dbMenu: any): any {
  return {
    id: dbMenu.id,
    userId: dbMenu.user_id,
    name: dbMenu.name,
    slug: dbMenu.slug,
    items: dbMenu.menu_data?.items || [],
    theme: dbMenu.menu_data?.theme || {},
    version: dbMenu.current_version,
    status: dbMenu.status,
    publishedAt: dbMenu.published_at ? new Date(dbMenu.published_at) : undefined,
    imageUrl: dbMenu.image_url || undefined,
    paymentInfo: dbMenu.menu_data?.paymentInfo || undefined,
    auditTrail: [],
    createdAt: new Date(dbMenu.created_at),
    updatedAt: new Date(dbMenu.updated_at),
    // Template fields
    templateId: dbMenu.template_id || undefined,
    templateVersion: dbMenu.template_version || undefined,
    backgroundUrl: dbMenu.background_url || undefined,
    templateConfig: dbMenu.template_config || undefined
  }
}
