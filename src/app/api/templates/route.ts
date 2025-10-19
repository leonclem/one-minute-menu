import { NextRequest, NextResponse } from 'next/server'
import { templateOperations, DatabaseError } from '@/lib/database'
import type { TemplateFilters } from '@/types/templates'

// GET /api/templates - List available templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Build filters from query parameters
    const filters: TemplateFilters = {}
    
    // Parse tags (comma-separated)
    const tagsParam = searchParams.get('tags')
    if (tagsParam) {
      filters.tags = tagsParam.split(',').map(tag => tag.trim())
    }
    
    // Parse page format
    const pageFormat = searchParams.get('pageFormat')
    if (pageFormat && ['A4', 'US_LETTER', 'TABLOID', 'DIGITAL'].includes(pageFormat)) {
      filters.pageFormat = pageFormat as TemplateFilters['pageFormat']
    }
    
    // Parse orientation
    const orientation = searchParams.get('orientation')
    if (orientation && ['portrait', 'landscape'].includes(orientation)) {
      filters.orientation = orientation as TemplateFilters['orientation']
    }
    
    // Parse isPremium
    const isPremium = searchParams.get('isPremium')
    if (isPremium !== null) {
      filters.isPremium = isPremium === 'true'
    }
    
    // Parse search query
    const searchQuery = searchParams.get('search')
    if (searchQuery) {
      filters.searchQuery = searchQuery
    }
    
    const templates = await templateOperations.listTemplates(filters)
    
    return NextResponse.json({
      success: true,
      data: templates,
      total: templates.length
    })
  } catch (error) {
    console.error('Error listing templates:', error)
    
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
