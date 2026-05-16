/**
 * Placeholder menu item data used to populate menus for first-time users.
 * Matched to cuisine + establishment type from onboarding.
 *
 * Source: gridmenu-placeholder-menu-matrix-image-columns.xlsx
 */

export interface PlaceholderItem {
  slug: string
  name: string
  description: string
  price: number
  imagePrompt?: string
  imageArchetype?: string
  suggestedImageKey?: string
  imagePriority?: string
  sampleRank?: number
}

export interface PlaceholderCategory {
  name: string
  items: PlaceholderItem[]
}

export interface PlaceholderMenuSet {
  cuisineId: string
  establishmentTypeId: string
  categories: PlaceholderCategory[]
}

/** Image library entry for a reusable image asset. */
export interface PlaceholderImageEntry {
  suggested_image_key: string
  cuisine: string
  image_archetype: string
  representative_item: string
  image_priority: string
  generate_now: boolean
  mapped_items: string
  generation_prompt: string
}
