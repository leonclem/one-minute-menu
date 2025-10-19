// Figma API Client
// This module provides a client for interacting with the Figma REST API
// Used at build-time only during template import/update

import type { FigmaNode, LayoutProperties, NodeStyles, TypographyStyle } from '@/types/templates'

// ============================================================================
// Figma API Response Types
// ============================================================================

interface FigmaFileResponse {
  document: FigmaDocumentNode
  components: Record<string, FigmaComponent>
  schemaVersion: number
  styles: Record<string, FigmaStyle>
  name: string
  lastModified: string
  thumbnailUrl: string
  version: string
}

interface FigmaDocumentNode {
  id: string
  name: string
  type: string
  children: FigmaDocumentNode[]
  backgroundColor?: FigmaColor
  prototypeStartNodeID?: string
  prototypeDevice?: string
}

interface FigmaComponent {
  key: string
  name: string
  description: string
}

interface FigmaStyle {
  key: string
  name: string
  styleType: string
  description: string
}

interface FigmaColor {
  r: number
  g: number
  b: number
  a: number
}

interface FigmaImageFillsResponse {
  images: Record<string, string | null>
}

// ============================================================================
// Error Types
// ============================================================================

export class FigmaAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message)
    this.name = 'FigmaAPIError'
  }
}

export class FigmaRateLimitError extends FigmaAPIError {
  constructor(
    public retryAfter?: number
  ) {
    super('Figma API rate limit exceeded', 429)
    this.name = 'FigmaRateLimitError'
  }
}

// ============================================================================
// Figma Client Configuration
// ============================================================================

interface FigmaClientConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
  retryAttempts?: number
}

// ============================================================================
// Figma Client Class
// ============================================================================

export class FigmaClient {
  private apiKey: string
  private baseUrl: string
  private timeout: number
  private retryAttempts: number

  constructor(config: FigmaClientConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.figma.com/v1'
    this.timeout = config.timeout || 30000
    this.retryAttempts = config.retryAttempts || 3
  }

  /**
   * Fetch a Figma file by its file key
   */
  async getFile(fileKey: string): Promise<FigmaFileResponse> {
    const url = `${this.baseUrl}/files/${fileKey}`
    return this.request<FigmaFileResponse>(url)
  }

  /**
   * Fetch specific nodes from a Figma file
   */
  async getFileNodes(fileKey: string, nodeIds: string[]): Promise<any> {
    const ids = nodeIds.join(',')
    const url = `${this.baseUrl}/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`
    return this.request(url)
  }

  /**
   * Fetch image URLs for image fills in a Figma file
   */
  async getImageFills(fileKey: string): Promise<FigmaImageFillsResponse> {
    const url = `${this.baseUrl}/files/${fileKey}/images`
    return this.request<FigmaImageFillsResponse>(url)
  }

  /**
   * Fetch image URLs for specific nodes
   */
  async getImages(
    fileKey: string,
    nodeIds: string[],
    options?: {
      scale?: number
      format?: 'jpg' | 'png' | 'svg' | 'pdf'
    }
  ): Promise<{ images: Record<string, string | null> }> {
    const ids = nodeIds.join(',')
    const scale = options?.scale || 1
    const format = options?.format || 'png'
    const url = `${this.baseUrl}/images/${fileKey}?ids=${encodeURIComponent(ids)}&scale=${scale}&format=${format}`
    return this.request(url)
  }

  /**
   * Extract all nodes from a Figma file recursively
   */
  extractNodes(document: FigmaDocumentNode): FigmaNode[] {
    const nodes: FigmaNode[] = []
    
    const traverse = (node: any) => {
      const figmaNode: FigmaNode = {
        id: node.id,
        name: node.name,
        type: node.type,
        styles: this.extractStyles(node),
        layout: this.extractLayout(node),
      }

      if (node.children && node.children.length > 0) {
        figmaNode.children = []
        for (const child of node.children) {
          traverse(child)
          figmaNode.children.push(this.convertToFigmaNode(child))
        }
      }

      nodes.push(figmaNode)
    }

    traverse(document)
    return nodes
  }

  /**
   * Convert Figma document node to our FigmaNode type
   */
  private convertToFigmaNode(node: any): FigmaNode {
    const figmaNode: FigmaNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      styles: this.extractStyles(node),
      layout: this.extractLayout(node),
    }

    if (node.children && node.children.length > 0) {
      figmaNode.children = node.children.map((child: any) => 
        this.convertToFigmaNode(child)
      )
    }

    return figmaNode
  }

  /**
   * Extract style information from a Figma node
   */
  private extractStyles(node: any): NodeStyles {
    const styles: NodeStyles = {
      fills: [],
      strokes: [],
      effects: [],
    }

    // Extract fills
    if (node.fills && Array.isArray(node.fills)) {
      styles.fills = node.fills.map((fill: any) => ({
        type: fill.type,
        color: fill.color,
        opacity: fill.opacity,
      }))
    }

    // Extract strokes
    if (node.strokes && Array.isArray(node.strokes)) {
      styles.strokes = node.strokes.map((stroke: any) => ({
        type: stroke.type,
        color: stroke.color,
        weight: node.strokeWeight || 1,
      }))
    }

    // Extract effects
    if (node.effects && Array.isArray(node.effects)) {
      styles.effects = node.effects.map((effect: any) => ({
        type: effect.type,
        radius: effect.radius,
        offset: effect.offset,
        color: effect.color,
      }))
    }

    // Extract typography
    if (node.style) {
      styles.typography = this.extractTypography(node)
    }

    return styles
  }

  /**
   * Extract typography information from a Figma text node
   */
  private extractTypography(node: any): TypographyStyle | undefined {
    if (!node.style) return undefined

    return {
      fontFamily: node.style.fontFamily || 'Inter',
      fontSize: node.style.fontSize || 16,
      fontWeight: node.style.fontWeight || 400,
      lineHeight: node.style.lineHeightPx || node.style.fontSize * 1.2,
      letterSpacing: node.style.letterSpacing,
      textAlign: node.style.textAlignHorizontal,
      textDecoration: node.style.textDecoration,
    }
  }

  /**
   * Extract layout properties from a Figma node
   */
  private extractLayout(node: any): LayoutProperties {
    return {
      layoutMode: node.layoutMode || 'NONE',
      primaryAxisSizingMode: node.primaryAxisSizingMode || 'AUTO',
      counterAxisSizingMode: node.counterAxisSizingMode || 'AUTO',
      paddingLeft: node.paddingLeft || 0,
      paddingRight: node.paddingRight || 0,
      paddingTop: node.paddingTop || 0,
      paddingBottom: node.paddingBottom || 0,
      itemSpacing: node.itemSpacing || 0,
      counterAxisAlignItems: node.counterAxisAlignItems || 'MIN',
      primaryAxisAlignItems: node.primaryAxisAlignItems || 'MIN',
    }
  }

  /**
   * Make an HTTP request to the Figma API with retry logic
   */
  private async request<T>(url: string, attempt = 1): Promise<T> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        headers: {
          'X-Figma-Token': this.apiKey,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
        throw new FigmaRateLimitError(retryAfter)
      }

      // Handle other errors
      if (!response.ok) {
        const errorBody = await response.text()
        throw new FigmaAPIError(
          `Figma API request failed: ${response.statusText}`,
          response.status,
          errorBody
        )
      }

      return await response.json()
    } catch (error) {
      // Retry on network errors or rate limits
      if (
        attempt < this.retryAttempts &&
        (error instanceof FigmaRateLimitError || 
         (error as any).name === 'AbortError' ||
         (error as any).name === 'TypeError')
      ) {
        const delay = error instanceof FigmaRateLimitError 
          ? error.retryAfter! * 1000 
          : Math.pow(2, attempt) * 1000

        console.warn(`Figma API request failed, retrying in ${delay}ms (attempt ${attempt}/${this.retryAttempts})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.request<T>(url, attempt + 1)
      }

      throw error
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Figma client instance
 */
export function createFigmaClient(apiKey?: string): FigmaClient {
  const key = apiKey || process.env.FIGMA_API_KEY

  if (!key) {
    throw new Error('Figma API key is required. Set FIGMA_API_KEY environment variable.')
  }

  return new FigmaClient({ apiKey: key })
}
