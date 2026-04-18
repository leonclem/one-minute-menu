# Menu Item Image Data & Synchronization Guide

This document outlines the architecture for menu item images in Kiro, detailing the authoritative sources of truth, the denormalized projections used for performance, and the synchronization mechanisms that keep them aligned.

## 1. Data Architecture

### A. Authoritative Source of Truth (Relational)
The `menu_items` table is the single source of truth for which image is currently "active" for a given item.

| Column | Description |
| :--- | :--- |
| `image_source` | Enum: `'ai'`, `'custom'`, or `'none'`. Determines which pointer below is active. |
| `ai_image_id` | UUID. Points to a record in `ai_generated_images`. |
| `custom_image_url` | Text. Stores the URL for the most recently uploaded/selected custom photo. |

**Note on Persistence:** Per migration `062`, `custom_image_url` is *not* cleared when `image_source` switches to `'ai'`. It remains as a persistent asset reference. It is only cleared when the user explicitly deletes the uploaded photo.

### B. Image Asset Tables
*   **`ai_generated_images`**: Stores metadata and URLs (original, desktop, mobile) for AI-generated variations.
*   **`uploaded_item_images`**: Stores metadata and URLs for user-uploaded photos.

### C. Denormalized Projection (JSONB)
The `menus` table contains a `menu_data` JSONB column. This is a snapshot of the entire menu used for high-performance client-side rendering and exports.

| JSON Path | Description |
| :--- | :--- |
| `menu_data.items[].imageSource` | Matches `menu_items.image_source`. |
| `menu_data.items[].customImageUrl` | The URL used for rendering. If `imageSource` is `'ai'`, this is derived from the AI image's `desktop_url`. |
| `menu_data.items[].aiImageId` | Matches `menu_items.ai_image_id`. |

---

## 2. Where Images are Surfaced

| Surface | Data Source | Logic / Component |
| :--- | :--- | :--- |
| **Extraction Page Thumbnails** | `menu_data` (JSONB) | `extracted-client.tsx` renders `customImageUrl`. If `imageSource === 'none'`, it renders an `ImageOff` icon. |
| **Template Preview** | `menu_data` (JSONB) | The template engine uses the flattened `items` array in the JSONB. |
| **PDF Export** | `menu_data` (JSONB) | `export/pdf/route.ts` uses `item.customImageUrl` or constructs `/api/images/${item.aiImageId}`. |
| **Manage Photos Modal** | `variations` API | Fetches from `ai_generated_images` and `uploaded_item_images`. The `selectedId` is derived from the authoritative `menu_items` record. |

---

## 3. Synchronization Mechanism

To prevent stale images (e.g., a thumbnail showing a deleted photo), any change to the authoritative state must be pushed to the JSONB projection.

### The Sync Helper: `syncMenuItemImageToJsonb`
Located in `src/lib/menu-item-image-sync.ts`, this function:
1.  Reads the latest state from `menu_items`.
2.  Resolves the correct URL (fetching from `ai_generated_images` if necessary).
3.  Updates both the flat `items` array and the nested `categories[].items` arrays in `menus.menu_data`.

### When to Call Sync
You **MUST** call this helper in the following scenarios:
*   **Selection Change**: When a user selects a different AI or uploaded image (`select-image` API).
*   **Deselection**: When a user clicks "Set no photo" (`select-image` API).
*   **Deletion**: When an image record is deleted (`images/[id]` or `uploaded-images/[id]` APIs).
*   **Generation**: When a new AI image is generated and auto-selected.

---

## 4. Common Pitfalls & "Heads Up"
*   **Partial Sync**: Avoid manually updating JSONB in API routes. Always use the `syncMenuItemImageToJsonb` helper to ensure consistency across both the flat and nested structures.
*   **The "None" State**: Always check `imageSource === 'none'` in the UI. A non-null `customImageUrl` might exist in the JSONB as a "legacy" reference even if the item is set to "No photo".
*   **Polling**: The `PhotoGalleryModal` polls for variations. Ensure local state updates (like a fresh selection) are protected from being overwritten by a poll that hasn't seen the server-side change yet.
