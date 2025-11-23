import { NextRequest, NextResponse } from 'next/server'
import { menuOperations } from '@/lib/database'
import { toEngineMenu } from '@/lib/templates/menu-transformer'
import { getMvpTemplates } from '@/lib/templates/template-definitions'
import { checkCompatibility } from '@/lib/templates/compatibility-checker'

/**
 * GET /api/templates/available?menuId={menuId}
 * 
 * Returns available MVP templates with compatibility status for a given menu.
 * Supports both real menus (from database) and demo menus (from request body).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const menuId = searchParams.get('menuId')
    
    if (!menuId) {
      return NextResponse.json(
        { error: 'menuId query parameter is required' },
        { status: 400 }
      )
    }
    
    // Check if this is a demo menu (starts with 'demo-')
    const isDemoMenu = menuId.startsWith('demo-')
    
    let menu
    
    if (isDemoMenu) {
      // For demo menus, we expect the menu data to be passed in the request
      // Since GET requests don't have bodies, demo menus should use POST
      // or the client should pass the menu data via a different mechanism
      // For now, return an error asking to use POST for demo menus
      return NextResponse.json(
        { error: 'Demo menus should use POST /api/templates/available with menu data in body' },
        { status: 400 }
      )
    } else {
      // Load real menu from database
      menu = await menuOperations.getMenu(menuId)
      
      if (!menu) {
        return NextResponse.json(
          { error: 'Menu not found' },
          { status: 404 }
        )
      }
    }
    
    // Transform to EngineMenu
    const engineMenu = toEngineMenu(menu)
    
    // Get MVP templates
    const templates = getMvpTemplates()
    
    // Check compatibility for each template
    const available = templates.map(template => {
      const compatibility = checkCompatibility(engineMenu, template)
      
      return {
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          thumbnailUrl: template.thumbnailUrl,
          capabilities: template.capabilities,
          aspectRatio: template.aspectRatio,
          orientation: template.orientation
        },
        compatibility: {
          status: compatibility.status,
          message: compatibility.message,
          warnings: compatibility.warnings
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      data: available
    })
    
  } catch (error) {
    console.error('Error fetching available templates:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/templates/available
 * 
 * Alternative endpoint for demo menus where menu data is passed in the request body.
 * This allows checking template compatibility for menus that aren't in the database yet.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { menu } = body
    
    if (!menu) {
      return NextResponse.json(
        { error: 'menu data is required in request body' },
        { status: 400 }
      )
    }
    
    // Transform to EngineMenu
    const engineMenu = toEngineMenu(menu)
    
    // Get MVP templates
    const templates = getMvpTemplates()
    
    // Check compatibility for each template
    const available = templates.map(template => {
      const compatibility = checkCompatibility(engineMenu, template)
      
      return {
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          thumbnailUrl: template.thumbnailUrl,
          capabilities: template.capabilities,
          aspectRatio: template.aspectRatio,
          orientation: template.orientation
        },
        compatibility: {
          status: compatibility.status,
          message: compatibility.message,
          warnings: compatibility.warnings
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      data: available
    })
    
  } catch (error) {
    console.error('Error fetching available templates:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
