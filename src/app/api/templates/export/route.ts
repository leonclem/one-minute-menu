import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, templateOperations, DatabaseError } from '@/lib/database'
import { TemplateRegistry } from '@/lib/templates/registry'
import { BindingEngine } from '@/lib/templates/binding-engine'
import { RenderEngine } from '@/lib/render/engine'
import { ExportService } from '@/lib/render/export-service'
import type { UserCustomization, ExportFormat, PageSize, CategoryV2 } from '@/types/templates'
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

// Validation schema for export request
const exportRequestSchema = z.object({
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
  format: z.enum(['pdf', 'png', 'html']),
  filename: z.string().min(1).max(255),
  pageSize: z.enum(['A4', 'US_LETTER', 'TABLOID']).optional(),
  dpi: z.number().min(72).max(600).optional(),
  includeBleed: z.boolean().optional(),
})

// POST /api/templates/export - Enqueue export job (asynchronous)
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validation = exportRequestSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          errors: validation.error.errors 
        },
        { status: 400 }
      )
    }
    
    const { menuId, templateId, customization, format, filename, pageSize, dpi, includeBleed } = validation.data
    
    // Verify menu exists and belongs to user
    const menu = await menuOperations.getMenu(menuId, user.id)
    
    if (!menu) {
      return NextResponse.json(
        { error: 'Menu not found' },
        { status: 404 }
      )
    }
    
    // Create a render record with pending status for the export
    const render = await templateOperations.createRender({
      userId: user.id,
      menuId,
      templateId,
      renderData: {
        html: '',
        css: '',
        assets: [],
        metadata: {
          templateId,
          templateVersion: '1.0',
          renderedAt: new Date(),
          itemCount: 0,
          categoryCount: 0,
          estimatedPrintSize: '',
        },
      },
      customization,
      format: format as any,
    })
    
    // Update status to processing
    await templateOperations.updateRender(render.id, user.id, {
      status: 'processing',
    })
    
    // Start async export process (fire and forget)
    // In production, this should use a proper job queue
    processExportJob(render.id, user.id, {
      menuId,
      templateId,
      customization,
      format: format as ExportFormat,
      filename,
      pageSize: pageSize as PageSize,
      dpi,
      includeBleed,
    }).catch(error => {
      console.error('Export job failed:', error)
      // Update render status to failed
      templateOperations.updateRender(render.id, user.id, {
        status: 'failed',
        errorMessage: error.message,
      }).catch(console.error)
    })
    
    return NextResponse.json({
      success: true,
      data: {
        jobId: render.id,
        status: 'processing',
        message: 'Export job started. Poll /api/templates/export/[id] for status.',
      }
    }, { status: 202 }) // 202 Accepted
    
  } catch (error) {
    console.error('Error starting export:', error)
    
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
 * Process export job asynchronously
 * In production, this should be moved to a proper background job queue
 */
async function processExportJob(
  renderId: string,
  userId: string,
  options: {
    menuId: string
    templateId: string
    customization?: UserCustomization
    format: ExportFormat
    filename: string
    pageSize?: PageSize
    dpi?: number
    includeBleed?: boolean
  }
) {
  try {
    // 1. Load menu data
    const menu = await menuOperations.getMenu(options.menuId, userId)
    if (!menu) throw new Error('Menu not found')
    
    // 2. Load template
    const registry = new TemplateRegistry()
    const templateConfig = await registry.loadTemplate(options.templateId)
    
    // 3. Parse template
    const parsedTemplate = {
      structure: templateConfig.metadata as any,
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
      customization: options.customization,
    })
    
    // 5. Render
    const renderEngine = new RenderEngine()
    const renderResult = await renderEngine.render(
      boundData,
      parsedTemplate,
      { format: 'html' } // Always render to HTML first
    )
    
    // 6. Export to requested format
    const exportService = new ExportService()
    let exportBuffer: Buffer
    
    if (options.format === 'pdf') {
      exportBuffer = await exportService.exportToPDF(renderResult, {
        format: options.format,
        filename: options.filename,
        pageSize: options.pageSize,
        dpi: options.dpi,
        includeBleed: options.includeBleed,
      })
    } else if (options.format === 'png') {
      exportBuffer = await exportService.exportToPNG(renderResult, {
        format: options.format,
        filename: options.filename,
        pageSize: options.pageSize,
        dpi: options.dpi,
        includeBleed: options.includeBleed,
      })
    } else {
      // HTML export
      exportBuffer = await exportService.exportToHTML(renderResult, {
        format: options.format,
        filename: options.filename,
      })
    }
    
    // 7. Upload to storage
    const supabase = createServerSupabaseClient()
    const filePath = `${userId}/${renderId}/${options.filename}`
    
    const { error: uploadError } = await supabase.storage
      .from('rendered-menus')
      .upload(filePath, exportBuffer, {
        contentType: options.format === 'pdf' ? 'application/pdf' : 
                     options.format === 'png' ? 'image/png' : 'text/html',
        upsert: true,
      })
    
    if (uploadError) {
      throw new Error(`Failed to upload export: ${uploadError.message}`)
    }
    
    // 8. Generate signed URL (24 hour expiration)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('rendered-menus')
      .createSignedUrl(filePath, 24 * 60 * 60) // 24 hours
    
    if (signedUrlError) {
      throw new Error(`Failed to generate signed URL: ${signedUrlError.message}`)
    }
    
    // 9. Update render record with success
    await templateOperations.updateRender(renderId, userId, {
      status: 'completed',
      outputUrl: signedUrlData.signedUrl,
    })
    
  } catch (error) {
    console.error('Export processing failed:', error)
    throw error
  }
}
