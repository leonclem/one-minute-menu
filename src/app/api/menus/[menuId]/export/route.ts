import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations } from '@/lib/database'
import { getTemplateRegistry } from '@/lib/templates/registry'
import { MenuRenderer, MenuExporter } from '@/lib/render'
import { ImageCompositor } from '@/lib/render/compositor'
import type { ExportFormat, PaperSize } from '@/lib/render'
import type { RenderMetadata } from '@/types'

/**
 * GET /api/menus/[menuId]/export
 * 
 * Export a menu to PDF, PNG, or WebP format with template rendering.
 * 
 * Query parameters:
 * - format: 'pdf' | 'png' | 'webp' (default: 'pdf')
 * - dpi: 300 | 600 (default: 300)
 * - size: 'A4' | 'A3' (default: 'A4')
 * - mode: 'preview' | 'export' (default: 'export')
 * - composite: 'true' | 'false' (default: 'true')
 * 
 * Mode differences:
 * - preview: Web-safe rendering, truncated descriptions, no AI credits, cached backgrounds
 * - export: Full pagination, spellcheck enforced, blocking errors if accessibility/contrast fail
 * 
 * Composite option:
 * - true: Composite text layer with background image
 * - false: Return text-only PDF for print houses
 * 
 * Requirements: 8.1, 8.2, 8.4, 8.6
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  console.log('📄 [Export] API called for menu:', params.menuId)

  try {
    const supabase = createServerSupabaseClient()
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('❌ [Export] Auth failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('✅ [Export] User authenticated:', user.id)
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const format = (searchParams.get('format') || 'pdf') as ExportFormat
    const dpi = parseInt(searchParams.get('dpi') || '300', 10)
    const size = (searchParams.get('size') || 'A4') as PaperSize
    const mode = searchParams.get('mode') || 'export'
    const composite = searchParams.get('composite') !== 'false'
    
    // Validate parameters
    if (!['pdf', 'png', 'webp'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be pdf, png, or webp' },
        { status: 400 }
      )
    }
    
    if (![300, 600].includes(dpi)) {
      return NextResponse.json(
        { error: 'Invalid DPI. Must be 300 or 600' },
        { status: 400 }
      )
    }
    
    if (!['A4', 'A3'].includes(size)) {
      return NextResponse.json(
        { error: 'Invalid size. Must be A4 or A3' },
        { status: 400 }
      )
    }
    
    if (!['preview', 'export'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be preview or export' },
        { status: 400 }
      )
    }
    
    console.log('📋 [Export] Parameters:', { format, dpi, size, mode, composite })
    
    // Get menu and verify ownership
    const menu = await menuOperations.getMenu(params.menuId, user.id)
    
    if (!menu) {
      console.error('❌ [Export] Menu not found')
      return NextResponse.json(
        { error: 'Menu not found or unauthorized' },
        { status: 404 }
      )
    }
    
    // Check if menu has a template applied
    if (!menu.templateId) {
      return NextResponse.json(
        { error: 'Menu must have a template applied before exporting' },
        { status: 400 }
      )
    }
    
    console.log('✅ [Export] Menu loaded with template:', menu.templateId)
    
    // Load template descriptor
    const registry = getTemplateRegistry()
    let templateDescriptor
    try {
      templateDescriptor = await registry.getTemplateDescriptor(menu.templateId)
    } catch (error) {
      console.error('❌ [Export] Template not found:', error)
      return NextResponse.json(
        { error: `Template '${menu.templateId}' not found` },
        { status: 404 }
      )
    }
    
    console.log('✅ [Export] Template loaded:', templateDescriptor.id)
    
    // Get render metadata for reproducible exports
    const existingMetadata = menu.templateConfig?.renderMetadata
    
    // Determine rendering options based on mode
    const renderFormat = mode === 'preview' ? 'web' : 'print'
    const applyFitEngine = mode === 'export' // Only apply fit engine in export mode
    
    // Get background URL if composite is enabled
    let backgroundUrl: string | undefined
    if (composite && menu.backgroundUrl) {
      backgroundUrl = menu.backgroundUrl
      console.log('🎨 [Export] Using background:', backgroundUrl)
    } else if (composite) {
      console.warn('⚠️ [Export] Composite requested but no background URL available')
    }
    
    // Render menu to HTML
    console.log('🎨 [Export] Rendering menu to HTML...')
    const renderer = new MenuRenderer({
      template: templateDescriptor,
      menu,
      backgroundUrl,
      format: renderFormat,
      locale: 'en-GB',
      applyFitEngine,
      existingMetadata: mode === 'export' ? existingMetadata : undefined,
    })
    
    const renderResult = await renderer.renderWithFitEngine()
    
    if (!renderResult.success && mode === 'export') {
      console.error('❌ [Export] Fit engine failed:', renderResult.metadata.warnings)
      return NextResponse.json(
        {
          error: 'Content does not fit within template constraints',
          warnings: renderResult.metadata.warnings,
          suggestions: [
            'Reduce content length',
            'Use shorter descriptions',
            'Remove some menu items',
            'Choose a different template',
          ],
        },
        { status: 400 }
      )
    }
    
    console.log('✅ [Export] HTML rendered successfully')
    
    // TODO: Task 33 - Implement spellcheck for export mode
    // In export mode, we should run en-GB spellcheck with allow-list
    // and block export if >N spelling issues detected
    
    // TODO: Task 27 - Implement contrast validation for export mode
    // Validate color contrast ratios and block export if WCAG AA not met
    
    // Check for accessibility violations in export mode
    if (mode === 'export' && renderResult.metadata.warnings) {
      const accessibilityWarnings = renderResult.metadata.warnings.filter(w =>
        w.includes('ACCESSIBILITY VIOLATION')
      )
      
      if (accessibilityWarnings.length > 0) {
        console.error('❌ [Export] Accessibility violations:', accessibilityWarnings)
        return NextResponse.json(
          {
            error: 'Accessibility requirements not met',
            warnings: accessibilityWarnings,
            suggestions: [
              'Reduce content to avoid font size shrinking below accessibility floor',
              'Use a template with larger font sizes',
              'Split content across multiple menus',
            ],
          },
          { status: 400 }
        )
      }
    }
    
    // Save render metadata for reproducible exports (export mode only)
    if (mode === 'export' && renderResult.metadata) {
      const updatedConfig = {
        ...menu.templateConfig,
        renderMetadata: renderResult.metadata,
      }
      
      await supabase
        .from('menus')
        .update({
          template_config: updatedConfig,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.menuId)
        .eq('user_id', user.id)
      
      console.log('✅ [Export] Render metadata saved')
    }
    
    // Export to requested format
    console.log('📦 [Export] Exporting to', format, '...')
    const exporter = new MenuExporter()
    const buffer = await exporter.export(renderResult.html, {
      format,
      dpi,
      size,
      validateGlyphs: mode === 'export',
    })
    
    console.log('✅ [Export] Export completed, buffer size:', buffer.length)
    
    // Determine content type
    const contentTypes: Record<ExportFormat, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      webp: 'image/webp',
    }
    
    const contentType = contentTypes[format]
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `${menu.slug || menu.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.${format}`
    
    // Return file as download
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': mode === 'preview' ? 'public, max-age=300' : 'private, no-cache',
      },
    })
    
  } catch (error) {
    console.error('❌ [Export] Error:', error)
    
    return NextResponse.json(
      {
        error: 'Export failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
