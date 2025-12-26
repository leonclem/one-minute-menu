/**
 * Layout Lab Generate API Route
 * 
 * Generates layout JSON for the Layout Lab interface.
 * Requires admin authentication and environment flag.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-utils'
import { generateLayoutWithVersion } from '@/lib/templates/engine-selector'
import { transformMenuToV2, isEngineMenuV2 } from '@/lib/templates/v2/menu-transformer-v2'
import { toEngineMenu, isEngineMenu } from '@/lib/templates/menu-transformer'
import { TEMPLATE_REGISTRY } from '@/lib/templates/template-definitions'
import { menuOperations } from '@/lib/database'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { readFile } from 'fs/promises'
import path from 'path'
import { TemplateId } from '@/lib/templates/engine-types'

export const dynamic = 'force-dynamic'

interface GenerateRequest {
  fixtureId: string
  templateId: string
  paletteId?: string
  engineVersion: 'v1' | 'v2'
  options?: {
    fillersEnabled?: boolean
    textOnly?: boolean
    texturesEnabled?: boolean
    showMenuTitle?: boolean
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    try {
      await requireAdmin()
    } catch (e) {
      if (e && typeof e === 'object' && 'digest' in e && typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) {
        throw e
      }
      if (process.env.NODE_ENV === 'development') {
        console.warn('[LayoutLab API] Supabase auth failed, bypassing admin check in development mode.')
      } else {
        throw e
      }
    }
    
    const body: GenerateRequest = await request.json()
    const { fixtureId, templateId, engineVersion, options = {} } = body
    
    // Validate inputs
    if (!fixtureId || !templateId || !engineVersion) {
      return NextResponse.json(
        { error: 'Missing required fields: fixtureId, templateId, engineVersion' },
        { status: 400 }
      )
    }
    
    // Load menu data (fixture or real menu)
    let menuData
    
    if (fixtureId.startsWith('menu-')) {
      // Real menu - extract menu ID and load from database
      const menuId = fixtureId.replace('menu-', '')
      
      // Get current user for authorization
      const supabase = createServerSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized - cannot access real menu data' },
          { status: 401 }
        )
      }
      
      try {
        menuData = await menuOperations.getMenu(menuId, user.id)
        if (!menuData) {
          return NextResponse.json(
            { error: `Menu not found or access denied: ${menuId}` },
            { status: 404 }
          )
        }
      } catch (error) {
        return NextResponse.json(
          { error: `Failed to load menu: ${menuId}` },
          { status: 500 }
        )
      }
    } else {
      // Fixture data - load from file
      const fixturePath = path.join(
        process.cwd(),
        'src/lib/templates/v2/fixtures',
        `${fixtureId}.json`
      )
      
      try {
        const fixtureContent = await readFile(fixturePath, 'utf-8')
        menuData = JSON.parse(fixtureContent)
      } catch (error) {
        return NextResponse.json(
          { error: `Fixture not found: ${fixtureId}` },
          { status: 404 }
        )
      }
    }
    
    // Generate layout based on engine version
    let layoutDocument
    
    if (engineVersion === 'v2') {
      // Check if menu data is already in V2 format
      let menuV2
      if (isEngineMenuV2(menuData)) {
        // Data is already in V2 format, use directly
        menuV2 = menuData
      } else {
        // Transform database format to V2 format
        menuV2 = transformMenuToV2(menuData)
      }
      
      layoutDocument = await generateLayoutWithVersion({
        menu: menuV2,
        templateId,
        selection: {
          textOnly: options.textOnly || false,
          fillersEnabled: options.fillersEnabled,
          texturesEnabled: options.texturesEnabled,
          showMenuTitle: options.showMenuTitle
        },
        debug: true // Enable debug info for Layout Lab
      }, 'v2')
    } else {
      // V1 generation
      const template = TEMPLATE_REGISTRY[templateId]
      if (!template) {
        return NextResponse.json(
          { error: `Template not found in V1 registry: ${templateId}` },
          { status: 404 }
        )
      }

      let menuV1
      if (isEngineMenu(menuData)) {
        menuV1 = menuData
      } else {
        menuV1 = toEngineMenu(menuData)
      }

      layoutDocument = await generateLayoutWithVersion({
        menu: menuV1,
        template,
        selection: {
          id: 'lab-selection',
          menuId: menuV1.id,
          templateId: template.id,
          templateVersion: template.version,
          configuration: {
            textOnly: options.textOnly || false,
            useLogo: true
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }, 'v1')
    }
    
    return NextResponse.json(layoutDocument)
    
  } catch (error) {
    console.error('Layout generation error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? (error as any).violations || String(error) : undefined
      },
      { status: 500 }
    )
  }
}