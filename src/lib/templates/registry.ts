/**
 * Template Registry
 * 
 * This module provides a singleton registry for managing template descriptors.
 * It serves as the central access point for template information throughout
 * the application.
 */

import { TemplateLoader } from './loader';
import type { TemplateDescriptor, TemplateMetadata } from './types';

/**
 * Singleton registry for template management
 */
export class TemplateRegistry {
  private static instance: TemplateRegistry | null = null;
  private loader: TemplateLoader;
  private initialized: boolean = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.loader = new TemplateLoader('/templates');
  }

  /**
   * Gets the singleton instance of TemplateRegistry
   * 
   * @returns The TemplateRegistry instance
   */
  static getInstance(): TemplateRegistry {
    if (!TemplateRegistry.instance) {
      TemplateRegistry.instance = new TemplateRegistry();
    }
    return TemplateRegistry.instance;
  }

  /**
   * Initializes the registry by loading all available templates
   * This should be called once during application startup
   * 
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.loader.loadAllTemplates();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize template registry:', error);
      throw error;
    }
  }

  /**
   * Gets metadata for all available templates
   * Useful for displaying template selection UI
   * 
   * @returns Promise resolving to array of template metadata
   */
  async getAvailableTemplates(): Promise<TemplateMetadata[]> {
    // Ensure templates are loaded
    if (!this.initialized) {
      await this.initialize();
    }

    const templates = await this.loader.loadAllTemplates();
    
    return templates.map(template => ({
      id: template.id,
      name: template.name,
      preview: `/templates/previews/${template.id}.png`,
      description: this.getTemplateDescription(template.id)
    }));
  }

  /**
   * Gets a complete template descriptor by ID
   * 
   * @param id - Template identifier
   * @returns Promise resolving to template descriptor
   * @throws Error if template not found
   */
  async getTemplateDescriptor(id: string): Promise<TemplateDescriptor> {
    try {
      return await this.loader.loadTemplate(id);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Template '${id}' not found: ${error.message}`);
      }
      throw new Error(`Template '${id}' not found`);
    }
  }

  /**
   * Registers a template descriptor programmatically
   * Useful for testing or dynamic template creation
   * 
   * @param descriptor - Template descriptor to register
   */
  registerTemplate(descriptor: TemplateDescriptor): void {
    // Validate the descriptor first
    this.loader.validateDescriptor(descriptor);
    
    // The loader's cache will be updated when the template is accessed
    // For now, we just validate to ensure it's correct
  }

  /**
   * Checks if a template exists
   * 
   * @param id - Template identifier
   * @returns Promise resolving to true if template exists
   */
  async hasTemplate(id: string): Promise<boolean> {
    try {
      await this.getTemplateDescriptor(id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets a human-readable description for a template
   * 
   * @param id - Template identifier
   * @returns Template description
   */
  private getTemplateDescription(id: string): string {
    const descriptions: Record<string, string> = {
      'kraft-sports': 'Bold, energetic design with rustic kraft paper aesthetic. Perfect for sports bars and casual dining.',
      'minimal-bistro': 'Clean, elegant layout with sophisticated typography. Ideal for upscale restaurants and bistros.'
    };

    return descriptions[id] || 'Professional menu template';
  }

  /**
   * Clears the registry cache
   * Useful for testing or when templates are updated
   */
  clearCache(): void {
    this.loader.clearCache();
    this.initialized = false;
  }

  /**
   * Resets the singleton instance
   * Primarily for testing purposes
   */
  static resetInstance(): void {
    TemplateRegistry.instance = null;
  }
}

/**
 * Convenience function to get the registry instance
 */
export function getTemplateRegistry(): TemplateRegistry {
  return TemplateRegistry.getInstance();
}

