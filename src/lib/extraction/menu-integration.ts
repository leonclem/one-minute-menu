/**
 * Integration utilities for connecting extraction results to menu storage
 * 
 * This module bridges the extraction service with the menu database operations
 */

import { menuOperations } from '@/lib/database'
import { extractionResultToMenu } from '@/lib/menu-data-migration'
import type { ExtractionResultV2Type } from './schema-stage2'
import type { ExtractionResultType } from './schema-stage1'
import type { Menu } from '@/types'

/**
 * Applies extraction results to an existing menu and returns the updated menu.
 * Handles both Stage 1 and Stage 2 extraction results.
 * If the menu has already been updated for the given jobId, the existing menu
 * is returned without re-applying the extraction.
 */
export async function applyExtractionToMenu(
  menuId: string,
  userId: string,
  extractionResult: ExtractionResultType | ExtractionResultV2Type,
  schemaVersion: 'stage1' | 'stage2',
  promptVersion: string,
  jobId?: string
): Promise<Menu> {
  // If we already applied this job's extraction to the menu, return existing menu
  const existing = await menuOperations.getMenu(menuId, userId)
  console.log('[Apply Extraction] Checking if already applied:', {
    menuId,
    jobId,
    existingJobId: existing?.extractionMetadata?.jobId,
    existingItemsCount: existing?.items?.length || 0,
    willSkip: !!(existing && jobId && existing.extractionMetadata?.jobId === jobId)
  })
  
  if (existing && jobId && existing.extractionMetadata?.jobId === jobId) {
    console.log('[Apply Extraction] Skipping - already applied this job to menu')
    return existing
  }

  // Convert extraction result to menu structure
  const menuUpdates = extractionResultToMenu(
    extractionResult,
    menuId,
    userId,
    '', // name not needed for update
    '', // slug not needed for update
    schemaVersion,
    promptVersion,
    jobId
  )

  console.log('[Menu Integration] Converted extraction to menu updates:', {
    itemsCount: menuUpdates.items?.length || 0,
    categoriesCount: menuUpdates.categories?.length || 0,
    hasExtractionMetadata: !!menuUpdates.extractionMetadata,
    firstItem: menuUpdates.items?.[0]?.name,
    firstCategory: menuUpdates.categories?.[0]?.name
  })

  // Update the menu in database and return the updated menu
  const updated = await menuOperations.updateMenuFromExtraction(menuId, userId, {
    items: menuUpdates.items || [],
    categories: menuUpdates.categories,
    extractionMetadata: menuUpdates.extractionMetadata,
  })

  console.log('[Menu Integration] Updated menu in database:', {
    menuId: updated.id,
    itemsCount: updated.items?.length || 0,
    categoriesCount: updated.categories?.length || 0
  })

  return updated
}

/**
 * Creates a new menu from extraction results
 */
export async function createMenuFromExtraction(
  userId: string,
  menuName: string,
  slug: string,
  extractionResult: ExtractionResultType | ExtractionResultV2Type,
  schemaVersion: 'stage1' | 'stage2',
  promptVersion: string,
  jobId?: string
): Promise<string> {
  // Create the menu first
  const menu = await menuOperations.createMenu(userId, {
    name: menuName,
    slug,
  })

  // Apply extraction results
  await applyExtractionToMenu(
    menu.id,
    userId,
    extractionResult,
    schemaVersion,
    promptVersion,
    jobId
  )

  return menu.id
}

/**
 * Example usage:
 * 
 * // After extraction job completes
 * const extractionResult = await extractionService.getJobResult(jobId)
 * 
 * // Apply to existing menu
 * await applyExtractionToMenu(
 *   menuId,
 *   userId,
 *   extractionResult,
 *   'stage2',
 *   'v2.0',
 *   jobId
 * )
 * 
 * // Or create new menu from extraction
 * const newMenuId = await createMenuFromExtraction(
 *   userId,
 *   'My Restaurant Menu',
 *   'my-restaurant-menu',
 *   extractionResult,
 *   'stage2',
 *   'v2.0',
 *   jobId
 * )
 */
