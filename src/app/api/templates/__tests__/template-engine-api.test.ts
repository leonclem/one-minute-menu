/**
 * Integration Tests for Template Engine API Endpoints
 * 
 * Tests the new template engine API endpoints:
 * - GET /api/templates/available - Browse available templates with compatibility
 * - POST /api/menus/{menuId}/template-selection - Save template selection
 * - GET /api/menus/{menuId}/layout - Generate layout instance
 * 
 * These tests verify the happy path for the core template engine workflow.
 */

import { describe, it, expect } from '@jest/globals'
import type { Menu } from '@/types'
import { toEngineMenu } from '@/lib/templates/menu-transformer'
import { getMvpTemplates } from '@/lib/templates/template-definitions'
import { checkCompatibility } from '@/lib/templates/compatibility-checker'
import { generateLayout } from '@/lib/templates/layout-engine'

// ============================================================================
// Test Data Fixtures
// ============================================================================

/**
 * Create a test menu with specified characteristics
 */
function createTestMenu(options: {
  sections: number
  itemsPerSection: number
  withImages?: boolean
}): Menu {
  const categories = []
  
  for (let s = 0; s < options.sections; s++) {
    const items = []
    
    for (let i = 0; i < options.itemsPerSection; i++) {
      items.push({
        id: `item-${s}-${i}`,
        name: `Item ${s * options.itemsPerSection + i + 1}`,
        description: `Description for item ${s * options.itemsPerSection + i + 1}`,
        price: 10 + Math.random() * 20,
        available: true,
        category: `Category ${s + 1}`,
        order: i,
        imageSource: (options.withImages ? 'custom' : 'none') as 'custom' | 'none' | 'ai',
        customImageUrl: options.withImages ? `https://example.com/image-${s}-${i}.jpg` : undefined,
        variants: [],
        modifierGroups: []
      })
    }
    
    categories.push({
      id: `category-${s}`,
      name: `Category ${s + 1}`,
      order: s,
      items
    })
  }
  
  return {
    id: 'test-menu-1',
    userId: 'test-user',
    name: 'Test Restaurant Menu',
    slug: 'test-restaurant-menu',
    items: categories.flatMap(c => c.items),
    categories,
    theme: {
      id: 'modern',
      name: 'Modern',
      colors: {
        primary: '#F59E0B',
        secondary: '#6B7280',
        accent: '#EF4444',
        background: '#FFFFFF',
        text: '#111827',
        extractionConfidence: 1.0
      },
      fonts: {
        primary: 'Inter',
        secondary: 'Inter',
        sizes: {
          heading: '1.5rem',
          body: '1rem',
          price: '1.125rem'
        }
      },
      layout: {
        style: 'modern',
        spacing: 'comfortable',
        itemLayout: 'list'

      },
      wcagCompliant: true,
      mobileOptimized: true
    },
    version: 1,
    status: 'draft',
    auditTrail: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Template Engine API Integration', () => {
  describe('Template Availability', () => {
    it('should return MVP templates with compatibility status', () => {
      // Create a test menu with 2 sections and 9 items
      const menu = createTestMenu({ sections: 2, itemsPerSection: 9, withImages: true })
      const engineMenu = toEngineMenu(menu)
      
      // Get MVP templates
      const templates = getMvpTemplates()
      
      // Should have at least 3 MVP templates
      expect(templates.length).toBeGreaterThanOrEqual(3)
      
      // Check compatibility for each template
      const available = templates.map(template => {
        const compatibility = checkCompatibility(engineMenu, template)
        
        return {
          template: {
            id: template.id,
            name: template.name,
            description: template.description,
            thumbnailUrl: template.thumbnailUrl,
            capabilities: template.capabilities
          },
          compatibility: {
            status: compatibility.status,
            message: compatibility.message,
            warnings: compatibility.warnings
          }
        }
      })
      
      // All templates should be OK or WARNING for this menu
      available.forEach(item => {
        expect(['OK', 'WARNING']).toContain(item.compatibility.status)
      })
      
      // At least one template should be OK (the tank template)
      const okTemplates = available.filter(item => item.compatibility.status === 'OK')
      expect(okTemplates.length).toBeGreaterThan(0)
    })
    
    it('should mark templates as INCOMPATIBLE when menu exceeds constraints', () => {
      // Create a menu with too many items for some templates
      const menu = createTestMenu({ sections: 1, itemsPerSection: 200 })
      const engineMenu = toEngineMenu(menu)
      
      // Get MVP templates
      const templates = getMvpTemplates()
      
      // Check compatibility
      const available = templates.map(template => {
        const compatibility = checkCompatibility(engineMenu, template)
        return {
          templateId: template.id,
          status: compatibility.status,
          message: compatibility.message
        }
      })
      
      // All templates should be INCOMPATIBLE (exceeds hardMaxItems of 150)
      available.forEach(item => {
        expect(item.status).toBe('INCOMPATIBLE')
        expect(item.message).toContain('150')
      })
    })
    
    it('should warn when template requires images but menu lacks them', () => {
      // Create a menu without images
      const menu = createTestMenu({ sections: 1, itemsPerSection: 12, withImages: false })
      const engineMenu = toEngineMenu(menu)
      
      // Get templates that require images
      const templates = getMvpTemplates()
      const imageTemplates = templates.filter(t => t.constraints.requiresImages)
      
      if (imageTemplates.length > 0) {
        imageTemplates.forEach(template => {
          const compatibility = checkCompatibility(engineMenu, template)
          
          // Should have a warning about missing images
          expect(compatibility.warnings.length).toBeGreaterThan(0)
          expect(compatibility.warnings.some(w => w.includes('image'))).toBe(true)
        })
      }
    })
  })
  
  describe('Layout Generation', () => {
    it('should generate layout for simple menu', () => {
      // Create a simple menu
      const menu = createTestMenu({ sections: 1, itemsPerSection: 9, withImages: true })
      const engineMenu = toEngineMenu(menu)
      
      // Get a template
      const templates = getMvpTemplates()
      const template = templates[0]
      
      // Generate layout
      const layout = generateLayout({
        menu: engineMenu,
        template
      })
      
      // Verify layout structure
      expect(layout).toBeDefined()
      expect(layout.templateId).toBe(template.id)
      expect(layout.templateVersion).toBe(template.version)
      expect(layout.orientation).toBe(template.orientation)
      expect(layout.pages).toBeDefined()
      expect(layout.pages.length).toBeGreaterThan(0)
      
      // Verify first page has tiles
      expect(layout.pages[0].tiles).toBeDefined()
      expect(layout.pages[0].tiles.length).toBeGreaterThan(0)
    })
    
    it('should generate deterministic layouts', () => {
      // Create a menu
      const menu = createTestMenu({ sections: 2, itemsPerSection: 15, withImages: true })
      const engineMenu = toEngineMenu(menu)
      
      // Get a template
      const templates = getMvpTemplates()
      const template = templates.find(t => t.id === 'two-column-text')!
      
      // Generate layout twice
      const layout1 = generateLayout({
        menu: engineMenu,
        template
      })
      
      const layout2 = generateLayout({
        menu: engineMenu,
        template
      })
      
      // Layouts should be identical
      expect(layout1).toEqual(layout2)
    })
    
    it('should handle large menus with tank template', () => {
      // Create a large menu (150 items)
      const menu = createTestMenu({ sections: 5, itemsPerSection: 30, withImages: false })
      const engineMenu = toEngineMenu(menu)
      
      // Get the tank template (two-column-text)
      const templates = getMvpTemplates()
      const tankTemplate = templates.find(t => t.id === 'two-column-text')!
      
      // Check compatibility
      const compatibility = checkCompatibility(engineMenu, tankTemplate)
      // Tank template should handle 150 items (may be OK or WARNING, but not INCOMPATIBLE)
      expect(['OK', 'WARNING']).toContain(compatibility.status)
      
      // Generate layout
      const layout = generateLayout({
        menu: engineMenu,
        template: tankTemplate
      })
      
      // Verify layout was generated
      expect(layout).toBeDefined()
      expect(layout.pages).toBeDefined()
      expect(layout.pages.length).toBeGreaterThan(0)
      
      // Count total item tiles
      const totalItemTiles = layout.pages.reduce((sum, page) => {
        return sum + page.tiles.filter(t => 
          t.type === 'ITEM' || t.type === 'ITEM_TEXT_ONLY'
        ).length
      }, 0)
      
      // Should have placed items (at least the base capacity)
      // Note: Full repeat pattern implementation may place all 150 items
      expect(totalItemTiles).toBeGreaterThan(0)
      expect(totalItemTiles).toBeLessThanOrEqual(150)
    })
    
    it('should respect text-only configuration', () => {
      // Create a menu with images
      const menu = createTestMenu({ sections: 1, itemsPerSection: 6, withImages: true })
      const engineMenu = toEngineMenu(menu)
      
      // Get a template that supports text-only mode
      const templates = getMvpTemplates()
      const template = templates.find(t => t.capabilities.supportsTextOnlyMode)!
      
      // Generate layout with text-only configuration
      const layout = generateLayout({
        menu: engineMenu,
        template,
        selection: {
          id: 'test-selection',
          menuId: 'test-menu-1',
          templateId: template.id,
          templateVersion: template.version,
          configuration: {
            textOnly: true,
            useLogo: false
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      
      // Verify layout was generated
      expect(layout).toBeDefined()
      
      // All item tiles should be ITEM_TEXT_ONLY (not ITEM)
      layout.pages.forEach(page => {
        const itemTiles = page.tiles.filter(t => 
          t.type === 'ITEM' || t.type === 'ITEM_TEXT_ONLY'
        )
        
        itemTiles.forEach(tile => {
          expect(tile.type).toBe('ITEM_TEXT_ONLY')
        })
      })
    })
  })
  
  describe('Full Workflow', () => {
    it('should complete full flow: browse → select → preview', () => {
      // Step 1: Create a menu
      const menu = createTestMenu({ sections: 2, itemsPerSection: 12, withImages: true })
      const engineMenu = toEngineMenu(menu)
      
      // Step 2: Browse templates
      const templates = getMvpTemplates()
      expect(templates.length).toBeGreaterThan(0)
      
      // Step 3: Check compatibility for each template
      const available = templates.map(template => ({
        template,
        compatibility: checkCompatibility(engineMenu, template)
      }))
      
      // Step 4: Select a compatible template
      const compatibleTemplate = available.find(
        item => item.compatibility.status === 'OK'
      )
      expect(compatibleTemplate).toBeDefined()
      
      // Step 5: Generate layout (preview)
      const layout = generateLayout({
        menu: engineMenu,
        template: compatibleTemplate!.template
      })
      
      // Verify layout
      expect(layout).toBeDefined()
      expect(layout.pages.length).toBeGreaterThan(0)
      expect(layout.templateId).toBe(compatibleTemplate!.template.id)
    })
  })
})
