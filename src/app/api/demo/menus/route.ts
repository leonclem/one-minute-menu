import { NextRequest, NextResponse } from 'next/server'
import { generateSlugFromName } from '@/lib/validation'
import type { Menu, MenuItem } from '@/types'

// POST /api/demo/menus - Create demo menu for anonymous users
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, sampleData } = body
    
    if (!name || !sampleData?.extractedText) {
      return NextResponse.json(
        { error: 'Name and sample data are required' },
        { status: 400 }
      )
    }
    
    // Generate a unique demo menu ID and slug
    const demoMenuId = `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const slug = generateSlugFromName(name)
    
    // Create a demo menu object that matches the Menu interface
    const demoMenu: Menu = {
      id: demoMenuId,
      userId: 'demo-user', // Special demo user ID
      name: name,
      slug: `demo-${slug}`,
      items: [], // Will be populated during extraction
      theme: {
        id: 'modern',
        name: 'Modern',
        colors: {
          primary: '#F59E0B', // Yellow from UX color palette
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
      auditTrail: [{
        id: `audit-${Date.now()}`,
        action: 'created',
        changes: { name, isDemoMenu: true },
        version: 1,
        timestamp: new Date(),
        userId: 'demo-user'
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // Store demo menu in session storage (client-side) or temporary storage
    // For now, we'll return the menu and let the client handle storage
    
    return NextResponse.json({
      success: true,
      data: {
        ...demoMenu,
        sampleData: {
          extractedText: sampleData.extractedText,
          category: sampleData.category
        }
      }
    }, { status: 201 })
    
  } catch (error) {
    console.error('Error creating demo menu:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}