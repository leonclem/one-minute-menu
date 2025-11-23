import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { TEMPLATE_REGISTRY } from '@/lib/templates/template-definitions'

/**
 * POST /api/menus/{menuId}/template-selection
 * 
 * Saves a template selection for a menu.
 * Stores the templateId, templateVersion, and configuration options.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    // Allow demo menus (no auth required)
    const isDemoMenu = params.menuId.startsWith('demo-')
    
    if (!isDemoMenu && (authError || !user)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { templateId, configuration } = body
    
    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      )
    }
    
    // Validate template exists
    const template = TEMPLATE_REGISTRY[templateId]
    if (!template) {
      return NextResponse.json(
        { error: 'Invalid templateId' },
        { status: 400 }
      )
    }
    
    // For demo menus, store in sessionStorage (client-side)
    // Return the selection data for client to store
    if (isDemoMenu) {
      return NextResponse.json({
        success: true,
        data: {
          menuId: params.menuId,
          templateId,
          templateVersion: template.version,
          configuration: configuration || { textOnly: false, useLogo: false }
        }
      })
    }
    
    // For real menus, save to database
    // First, check if a selection already exists
    const { data: existing } = await supabase
      .from('menu_template_selections')
      .select('id')
      .eq('menu_id', params.menuId)
      .single()
    
    const selectionData = {
      menu_id: params.menuId,
      template_id: templateId,
      template_version: template.version,
      configuration: configuration || { textOnly: false, useLogo: false },
      updated_at: new Date().toISOString()
    }
    
    if (existing) {
      // Update existing selection
      const { data, error } = await supabase
        .from('menu_template_selections')
        .update(selectionData)
        .eq('id', existing.id)
        .select()
        .single()
      
      if (error) {
        console.error('Error updating template selection:', error)
        return NextResponse.json(
          { error: 'Failed to update template selection' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        data: {
          id: data.id,
          menuId: data.menu_id,
          templateId: data.template_id,
          templateVersion: data.template_version,
          configuration: data.configuration,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      })
    } else {
      // Create new selection
      const { data, error } = await supabase
        .from('menu_template_selections')
        .insert({
          ...selectionData,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) {
        console.error('Error creating template selection:', error)
        return NextResponse.json(
          { error: 'Failed to create template selection' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        data: {
          id: data.id,
          menuId: data.menu_id,
          templateId: data.template_id,
          templateVersion: data.template_version,
          configuration: data.configuration,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      }, { status: 201 })
    }
    
  } catch (error) {
    console.error('Error saving template selection:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/menus/{menuId}/template-selection
 * 
 * Retrieves the saved template selection for a menu.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    // Allow demo menus (no auth required)
    const isDemoMenu = params.menuId.startsWith('demo-')
    
    if (!isDemoMenu && (authError || !user)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // For demo menus, return empty (client should check sessionStorage)
    if (isDemoMenu) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Demo menu selections are stored in sessionStorage'
      })
    }
    
    // For real menus, fetch from database
    const { data, error } = await supabase
      .from('menu_template_selections')
      .select('*')
      .eq('menu_id', params.menuId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No selection found
        return NextResponse.json({
          success: true,
          data: null
        })
      }
      
      console.error('Error fetching template selection:', error)
      return NextResponse.json(
        { error: 'Failed to fetch template selection' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        menuId: data.menu_id,
        templateId: data.template_id,
        templateVersion: data.template_version,
        configuration: data.configuration,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    })
    
  } catch (error) {
    console.error('Error fetching template selection:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
