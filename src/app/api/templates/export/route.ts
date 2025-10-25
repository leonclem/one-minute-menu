import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, templateOperations, DatabaseError } from '@/lib/database'
import { TemplateRegistry } from '@/lib/templates/registry'
import { BindingEngine } from '@/lib/templates/binding-engine'
import { RenderEngine } from '@/lib/render/engine'
import { ExportService } from '@/lib/render/export-service'
import type { UserCustomization, ExportFormat, PageSize, CategoryV2 } from '@/types/templates'
import type { MenuCategory, Menu, MenuItem } from '@/types'
import { z } from 'zod'
import { exportRequestSchema } from '@/lib/templates/schemas'
import { TemplateError, mapErrorToHttp } from '@/lib/templates/errors'
import { CategoryV2Schema } from '@/lib/extraction/schema-stage2'

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

function buildCategoriesV2(menu: Menu): CategoryV2[] {
  const itemsLen = (menu.items || []).length
  const catItemsCount = countItemsInCategories(menu.categories as any as MenuCategory[] | undefined)

  if (!menu.categories || menu.categories.length === 0 || itemsLen >= catItemsCount) {
    const map = new Map<string, MenuItem[]>()
    ;(menu.items || []).forEach((item: any) => {
      const cat = item.category || 'Menu'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    })

    const categories: CategoryV2[] = []
    for (const [name, items] of map.entries()) {
      categories.push({
        name,
        confidence: 1.0,
        items: items.map((i) => ({
          name: i.name,
          description: i.description,
          price: i.price,
          confidence: i.confidence ?? 1.0,
          variants: i.variants,
          modifierGroups: i.modifierGroups,
          additional: i.additional,
          type: i.type,
          setMenu: i.setMenu,
        })),
      })
    }

    return categories
  }

  return (menu.categories as any as MenuCategory[]).map(convertToCategoryV2)
}

function countItemsInCategories(categories?: MenuCategory[]): number {
  if (!categories || categories.length === 0) return 0
  let count = 0
  const walk = (cats: MenuCategory[]) => {
    cats.forEach((c) => {
      count += (c.items || []).length
      if (c.subcategories) walk(c.subcategories as any)
    })
  }
  walk(categories)
  return count
}

// Validation schema imported from centralized schemas

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
      const { status, body } = mapErrorToHttp(new TemplateError('Menu not found', 'MENU_NOT_FOUND'))
      return NextResponse.json(body, { status })
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
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    const mapped = mapErrorToHttp(error)
    return NextResponse.json(mapped.body, { status: mapped.status })
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
    
    // 2. Validate categories structure early to fail fast on bad data
    const categoriesPreview = buildCategoriesV2(menu)
    const catValidation = z.array(CategoryV2Schema).safeParse(categoriesPreview)
    if (!catValidation.success) {
      const { status, body } = mapErrorToHttp(new TemplateError('Invalid menu data', 'VALIDATION_FAILED', { errors: catValidation.error.errors }))
      return NextResponse.json(body, { status })
    }

    // 3. Load template
    const registry = new TemplateRegistry()
    const templateConfig = await registry.loadTemplate(options.templateId)
    
    // 4. Parse template
    const parsedTemplate = {
      structure: templateConfig.metadata as any,
      bindings: templateConfig.bindings,
      styles: templateConfig.styling as any,
      assets: { images: [], fonts: [] },
    }
    
    // 5. Bind data
    const bindingEngine = new BindingEngine()
    const categories = buildCategoriesV2(menu)
    
    const boundData = bindingEngine.bind({
      menu: {
        restaurantName: menu.name,
        categories,
      },
      template: templateConfig,
      customization: options.customization,
    })
    
    // 6. Render
    const renderEngine = new RenderEngine()
    const renderResult = await renderEngine.render(
      boundData,
      parsedTemplate,
      { format: 'html' } // Always render to HTML first
    )
    
    // 7. Export to requested format
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
    
    // 8. Upload to storage
    const supabase = createServerSupabaseClient()
    // Ensure filename has correct extension
    const ext = options.format === 'pdf' ? 'pdf' : options.format === 'png' ? 'png' : 'html'
    const finalFilename = options.filename?.toLowerCase().endsWith(`.${ext}`)
      ? options.filename
      : `${options.filename}.${ext}`
    const filePath = `${userId}/${renderId}/${finalFilename}`
    
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
    
    // 9. Generate signed URL (24 hour expiration) and force download with filename
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('rendered-menus')
      .createSignedUrl(filePath, 24 * 60 * 60, { download: finalFilename })
    
    if (signedUrlError) {
      throw new Error(`Failed to generate signed URL: ${signedUrlError.message}`)
    }
    
    // 10. Update render record with success
    await templateOperations.updateRender(renderId, userId, {
      status: 'completed',
      outputUrl: signedUrlData.signedUrl,
    })
    
  } catch (error) {
    console.error('Export processing failed:', error)
    throw error
  }
}
