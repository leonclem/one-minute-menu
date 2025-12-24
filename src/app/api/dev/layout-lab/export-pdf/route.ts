/**
 * Layout Lab Export PDF API Route
 * 
 * Generates and exports PDF for the Layout Lab interface.
 * Requires admin authentication and environment flag.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-utils'
import { generateLayoutWithVersion } from '@/lib/templates/engine-selector'
import { transformMenuToV2, isEngineMenuV2 } from '@/lib/templates/v2/menu-transformer-v2'
import { renderToPdf } from '@/lib/templates/v2/renderer-pdf-v2'
import type { LayoutDocumentV2 } from '@/lib/templates/v2/engine-types-v2'
import { toEngineMenu, isEngineMenu } from '@/lib/templates/menu-transformer'
import { menuOperations } from '@/lib/database'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { readFile } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

interface ExportPdfRequest {
  fixtureId: string
  templateId: string
  paletteId: string
  engineVersion: 'v1' | 'v2'
  options?: {
    fillersEnabled?: boolean
    textOnly?: boolean
    showRegionBounds?: boolean
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
        console.warn('[LayoutLab Export API] Supabase auth failed, bypassing admin check in development mode.')
      } else {
        throw e
      }
    }
    
    const body: ExportPdfRequest = await request.json()
    const { fixtureId, templateId, paletteId, engineVersion, options = {} } = body
    
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
      
      const layoutDocument = await generateLayoutWithVersion({
        menu: menuV2,
        templateId,
        selection: {
          textOnly: options.textOnly || false,
          fillersEnabled: options.fillersEnabled
        },
        debug: false // No debug info needed for PDF
      }, 'v2') as LayoutDocumentV2
      
      // Render to PDF (only works with V2 for now)
      const pdfResult = await renderToPdf(layoutDocument, {
        title: `Layout Lab - ${fixtureId}`,
        paletteId,
        includePageNumbers: true,
        printBackground: true,
        showRegionBounds: options.showRegionBounds || false
      })
      
      // Extract buffer from result
      const pdfBuffer = Buffer.from(pdfResult.pdfBytes)
      
      // Return PDF as response
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="layout-${fixtureId}-${templateId}.pdf"`
        }
      })
    } else {
      // V1 generation - dynamic imports to avoid Next.js bundling issues with react-dom/server
      const { TEMPLATE_REGISTRY } = await import('@/lib/templates/template-definitions')
      const { exportToPDF } = await import('@/lib/templates/export/pdf-exporter')
      const { ServerLayoutRenderer } = await import('@/lib/templates/export/layout-renderer')
      const { renderToString } = await import('react-dom/server')
      const { createElement } = await import('react')

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

      const layout = await generateLayoutWithVersion({
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

      // Render layout to HTML
      const componentHTML = renderToString(
        createElement(ServerLayoutRenderer, {
          layout: layout as any,
          template,
          currency: menuV1.metadata.currency,
          className: 'pdf-export',
          skipInlineStyles: true
        })
      )

      // Generate template CSS
      const { generateTemplateCSS } = await import('@/lib/templates/server-style-generator')
      const templateCSS = await generateTemplateCSS(template, undefined, 'inline')

      // Build complete HTML document
      const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Layout Lab - ${fixtureId}</title>
  <style>
${templateCSS}

@page {
  size: ${template.orientation === 'A4_LANDSCAPE' ? 'A4 landscape' : 'A4 portrait'};
  margin: 0;
}
  </style>
</head>
<body>
${componentHTML}
</body>
</html>`.trim()

      // Export to PDF
      const result = await exportToPDF(htmlDocument, {
        metadata: {
          title: `Layout Lab - ${fixtureId}`,
          currency: menuV1.metadata.currency
        },
        sections: []
      } as any, {
        title: `Layout Lab - ${fixtureId}`,
        orientation: template.orientation === 'A4_LANDSCAPE' ? 'landscape' : 'portrait'
      })

      // Return PDF
      return new NextResponse(result.pdfBytes as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="layout-${fixtureId}-${templateId}.pdf"`
        }
      })
    }
    
  } catch (error) {
    console.error('PDF export error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? (error as any).violations || String(error) : undefined
      },
      { status: 500 }
    )
  }
}