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
import { readFile } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

interface ExportPdfRequest {
  fixtureId: string
  templateId: string
  engineVersion: 'v1' | 'v2'
  options?: {
    fillersEnabled?: boolean
    textOnly?: boolean
    showRegionBounds?: boolean
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
        console.warn('[LayoutLab Export API] Supabase auth failed, bypassing admin check in development mode.')
      } else {
        throw e
      }
    }
    
    const body: ExportPdfRequest = await request.json()
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
      if (isEngineMenu(fixtureData)) {
        menuV1 = fixtureData
      } else {
        menuV1 = toEngineMenu(fixtureData)
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