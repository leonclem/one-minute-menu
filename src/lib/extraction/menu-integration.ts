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
  if (existing && jobId && existing.extractionMetadata?.jobId === jobId) {
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

  // Update the menu in database and return the updated menu
  const updated = await menuOperations.updateMenuFromExtraction(menuId, userId, {
    items: menuUpdates.items || [],
    categories: menuUpdates.categories,
    extractionMetadata: menuUpdates.extractionMetadata,
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
