/**
 * Template Loader
 * 
 * This module provides functionality to load and cache template descriptors
 * from JSON files. It handles file system access, validation, and caching
 * to ensure templates are loaded efficiently.
 */

import { validateDescriptor } from './validation';
import type { TemplateDescriptor } from './types';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

/**
 * Template loader class that handles loading and caching of template descriptors
 */
export class TemplateLoader {
  private templates: Map<string, TemplateDescriptor> = new Map();
  private templateDir: string;
  private isServer: boolean;

  /**
   * Creates a new TemplateLoader instance
   * 
   * @param templateDir - Directory path where template JSON files are stored
   */
  constructor(templateDir: string = '/templates') {
    this.templateDir = templateDir;
    // Check if we're in Node.js environment (server or Jest)
    this.isServer = typeof window === 'undefined' || (typeof process !== 'undefined' && !!process.versions?.node);
  }

  /**
   * Loads a single template by ID
   * 
   * @param id - Template identifier (e.g., 'kraft-sports')
   * @returns Promise resolving to validated template descriptor
   * @throws Error if template not found or validation fails
   */
  async loadTemplate(id: string): Promise<TemplateDescriptor> {
    // Check cache first
    const cached = this.templates.get(id);
    if (cached) {
      return cached;
    }

    try {
      let descriptor: unknown;

      if (this.isServer) {
        // Server-side: use fs to read from public directory
        const filePath = join(process.cwd(), 'public', this.templateDir, `${id}.json`);
        const fileContent = await readFile(filePath, 'utf-8');
        descriptor = JSON.parse(fileContent);
      } else {
        // Client-side: fetch from public URL
        const response = await fetch(`${this.templateDir}/${id}.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch template: ${response.statusText}`);
        }
        descriptor = await response.json();
      }

      // Validate the descriptor
      const validated = this.validateDescriptor(descriptor);

      // Cache the validated template
      this.templates.set(id, validated);

      return validated;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load template '${id}': ${error.message}`);
      }
      throw new Error(`Failed to load template '${id}': Unknown error`);
    }
  }

  /**
   * Loads all available templates from the template directory
   * 
   * @returns Promise resolving to array of validated template descriptors
   * @throws Error if any template fails to load or validate
   */
  async loadAllTemplates(): Promise<TemplateDescriptor[]> {
    try {
      let templateIds: string[];

      if (this.isServer) {
        // Server-side: read directory
        const dirPath = join(process.cwd(), 'public', this.templateDir);
        const files = await readdir(dirPath);
        templateIds = files
          .filter(file => file.endsWith('.json'))
          .map(file => file.replace('.json', ''));
      } else {
        // Client-side: use known template IDs
        // In a real implementation, you might want to fetch a manifest file
        templateIds = ['kraft-sports', 'minimal-bistro'];
      }

      // Load all templates in parallel
      const templates = await Promise.all(
        templateIds.map(id => this.loadTemplate(id))
      );

      return templates;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load templates: ${error.message}`);
      }
      throw new Error('Failed to load templates: Unknown error');
    }
  }

  /**
   * Validates a template descriptor object
   * 
   * @param descriptor - Raw descriptor object to validate
   * @returns Validated template descriptor
   * @throws Error if validation fails
   */
  validateDescriptor(descriptor: unknown): TemplateDescriptor {
    return validateDescriptor(descriptor);
  }

  /**
   * Gets a template from cache without loading
   * 
   * @param id - Template identifier
   * @returns Cached template descriptor or null if not in cache
   */
  getTemplate(id: string): TemplateDescriptor | null {
    return this.templates.get(id) || null;
  }

  /**
   * Clears the template cache
   * Useful for testing or when templates are updated
   */
  clearCache(): void {
    this.templates.clear();
  }

  /**
   * Checks if a template is cached
   * 
   * @param id - Template identifier
   * @returns True if template is in cache
   */
  isCached(id: string): boolean {
    return this.templates.has(id);
  }
}

