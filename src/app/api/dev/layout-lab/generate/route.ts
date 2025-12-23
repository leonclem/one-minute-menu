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
import { readFile } from 'fs/promises'
import path from 'path'
import { TemplateId } from '@/lib/templates/engine-types'

export const dynamic = 'force-dynamic'

interface GenerateRequest {
  fixtureId: string
  templateId: string
  engineVersion: 'v1' | 'v2'
  options?: {
    fillersEnabled?: boolean
    textOnly?: boolean
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check environment flag
    const isEnabled = process.env.NEXT_PUBLIC_LAYOUT_LAB_ENABLED === 'true'
    if (!isEnabled) {
      return NextResponse.json(
        { error: 'Layout Lab is not enabled' },
        { status: 403 }
      )
    }

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
    
    // Load fixture menu
    const fixturePath = path.join(
      process.cwd(),
      'src/lib/templates/v2/fixtures',
      `${fixtureId}.json`
    )
    
    let fixtureData
    try {
      const fixtureContent = await readFile(fixturePath, 'utf-8')
      fixtureData = JSON.parse(fixtureContent)
    } catch (error) {
      return NextResponse.json(
        { error: `Fixture not found: ${fixtureId}` },
        { status: 404 }
      )
    }
    
    // Generate layout based on engine version
    let layoutDocument
    
    if (engineVersion === 'v2') {
      // Check if fixture data is already in V2 format
      let menuV2
      if (isEngineMenuV2(fixtureData)) {
        // Fixture is already in V2 format, use directly
        menuV2 = fixtureData
      } else {
        // Transform database format to V2 format
        menuV2 = transformMenuToV2(fixtureData)
      }
      
      layoutDocument = await generateLayoutWithVersion({
        menu: menuV2,
        templateId,
        selection: {
          textOnly: options.textOnly || false,
          fillersEnabled: options.fillersEnabled
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
      if (isEngineMenu(fixtureData)) {
        menuV1 = fixtureData
      } else {
        menuV1 = toEngineMenu(fixtureData)
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