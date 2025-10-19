// Template Configurations
// Export all available template configurations

export { theViewTemplate } from './the-view'
export { 
  registerTheViewTemplate, 
  isTheViewTemplateRegistered,
  updateTheViewTemplate 
} from './register-the-view'

// Export all templates as a collection
import { theViewTemplate } from './the-view'
import type { TemplateConfig } from '@/types/templates'

export const ALL_TEMPLATES: TemplateConfig[] = [
  theViewTemplate,
]

/**
 * Get a template configuration by ID
 */
export function getTemplateConfigById(templateId: string): TemplateConfig | undefined {
  return ALL_TEMPLATES.find(t => t.metadata.id === templateId)
}

/**
 * Get all template IDs
 */
export function getAllTemplateIds(): string[] {
  return ALL_TEMPLATES.map(t => t.metadata.id)
}

