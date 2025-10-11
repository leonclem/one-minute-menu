import { NextResponse } from 'next/server'
import { getTemplateRegistry } from '@/lib/templates/registry'

/**
 * GET /api/templates
 * 
 * Returns a list of available template metadata for display in the UI.
 * This endpoint is used by the TemplateSelector component to load templates.
 * 
 * Response:
 * - templates: Array of template metadata objects
 */
export async function GET() {
  try {
    const registry = getTemplateRegistry()
    const templates = await registry.getAvailableTemplates()
    
    return NextResponse.json({
      success: true,
      data: { templates }
    })
  } catch (error) {
    console.error('Error loading templates:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to load templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
