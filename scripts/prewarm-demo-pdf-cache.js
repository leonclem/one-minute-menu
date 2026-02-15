#!/usr/bin/env node
/**
 * Pre-warm demo PDF cache
 *
 * Creates demo export jobs for common (menu × template) combinations.
 * Run with app + worker running: node scripts/prewarm-demo-pdf-cache.js
 *
 * Env: PREWARM_APP_URL (default http://localhost:3000)
 */

const BASE_URL = process.env.PREWARM_APP_URL || 'http://localhost:3000'

const DEMO_IMAGES = {
  breakfast: {
    'Breakfast Sandwich': '/sample-menus/generated/breakfast/breakfast-sandwich.webp',
    'Country Tartine': '/sample-menus/generated/breakfast/country-tartine.webp',
    'Eggs Benedict': '/sample-menus/generated/breakfast/eggs-benedict.webp',
    'French Toast': '/sample-menus/generated/breakfast/french-toast.webp',
    'Le Parfait': '/sample-menus/generated/breakfast/le-parfait.webp',
    'Morning Tartine': '/sample-menus/generated/breakfast/morning-tartine.webp',
    'Parisian Omelette': '/sample-menus/generated/breakfast/parisian-omelette.webp',
    "Provençal Eggs": '/sample-menus/generated/breakfast/provencal-eggs.webp',
    'Three Organic Eggs Your Way!': '/sample-menus/generated/breakfast/three-organic-eggs-your-way.webp',
    "Two Soft-Boiled Eggs & 'Mouillettes'": '/sample-menus/generated/breakfast/two-soft-boiled-eggs-mouillettes.webp'
  },
  fine_dining: {
    'Crispy Duck in Port Cherry Sauce': '/sample-menus/generated/fine-dining/crispy-duck-in-port-cherry-sauce.webp',
    'Grilled Faroe Island Salmon': '/sample-menus/generated/fine-dining/grilled-faroe-island-salmon.webp',
    'House Made Ice Cream': '/sample-menus/generated/fine-dining/house-made-ice-cream.webp',
    'Key Lime Pudding': '/sample-menus/generated/fine-dining/key-lime-pudding.webp',
    'Marinated Local Oyster Mushroom Salad': '/sample-menus/generated/fine-dining/marinated-local-oyster-mushroom-salad.webp',
    'Pan Roasted Duck Breast': '/sample-menus/generated/fine-dining/pan-roasted-duck-breast.webp',
    'Rutabaga and Toasted Hazelnut Soup': '/sample-menus/generated/fine-dining/rutabaga-and-toasted-hazelnut-soup.webp',
    'Tenderloin of Beef Wellington': '/sample-menus/generated/fine-dining/tenderloin-of-beef-wellington.webp',
    'Tres Leches Cake': '/sample-menus/generated/fine-dining/tres-leches-cake.webp'
  }
}

const SAMPLE_MENUS = [
  {
    id: 'prewarm-breakfast',
    name: 'Breakfast menu',
    items: [
      { name: 'Three Organic Eggs Your Way!', price: 10.6, description: 'With mixed greens & bread', category: 'BREAKFAST' },
      { name: 'Parisian Omelette', price: 11.6, description: 'Ham, swiss, mushroom & spinach with baby greens', category: 'BREAKFAST' },
      { name: "Two Soft-Boiled Eggs & 'Mouillettes'", price: 8.8, description: 'With bread fingers', category: 'BREAKFAST' },
      { name: 'Provençal Eggs', price: 10.5, description: '2 sunny side-up eggs, fried tomatoes & provence herbs', category: 'BREAKFAST' },
      { name: 'Eggs Benedict', price: 13.5, description: 'On brioche (Scottish, Classic, or Florentine)', category: 'BREAKFAST' },
      { name: 'Le Parfait', price: 7.95, description: 'Homemade granola & yogurt with fresh fruit', category: 'BREAKFAST' },
      { name: 'Morning Tartine', price: 5.8, description: 'With non-salted butter & jam/acacia honey', category: 'BREAKFAST' },
      { name: 'Country Tartine', price: 9.95, description: 'Ham & brie with cornichons & non-salted butter', category: 'BREAKFAST' },
      { name: 'Breakfast Sandwich', price: 10.5, description: 'Scrambled eggs & BLT', category: 'BREAKFAST' },
      { name: 'French Toast', price: 9.5, description: 'With maple syrup, homemade jam & whipped cream', category: 'BREAKFAST' }
    ],
    imageMap: DEMO_IMAGES.breakfast
  },
  {
    id: 'prewarm-fine-dining',
    name: 'Fine Dining',
    items: [
      { name: 'Rutabaga and Toasted Hazelnut Soup', price: 12, description: 'Soy roasted hazelnuts, horseradish cream', category: 'APPETIZERS' },
      { name: 'Marinated Local Oyster Mushroom Salad', price: 16, description: 'Pig ear terrine, pickled plum jelly', category: 'APPETIZERS' },
      { name: 'Grilled Faroe Island Salmon', price: 26, description: 'Quinoa, oyster mushrooms, brussels sprout leaves', category: 'MAIN ENTRÉES' },
      { name: 'Pan Roasted Duck Breast', price: 29, description: 'Herbed farro, orange-frisée salad', category: 'MAIN ENTRÉES' },
      { name: 'Crispy Duck in Port Cherry Sauce', price: 36, description: 'Roasted turnips, parsnips, rutabaga', category: 'MAIN ENTRÉES' },
      { name: 'Tenderloin of Beef Wellington', price: 48, description: 'Foie gras, spinach, duxelles', category: 'MAIN ENTRÉES' },
      { name: 'Tres Leches Cake', price: 9, description: 'Strawberry compote, strawberry balsamic', category: 'DESSERTS' },
      { name: 'Key Lime Pudding', price: 8, description: 'Chantilly cream & wafer cookies', category: 'DESSERTS' },
      { name: 'House Made Ice Cream', price: 9, description: 'Black raspberry', category: 'DESSERTS' }
    ],
    imageMap: DEMO_IMAGES.fine_dining
  }
]

const TEMPLATES = ['classic-cards-v2', 'italian-v2', 'two-column-classic-v2']

const DEFAULT_CONFIG = {
  textOnly: false,
  fillersEnabled: false,
  texturesEnabled: true,
  showMenuTitle: false,
  palette: { id: 'clean-modern', name: 'Clean Modern' }
}

async function createDemoJob(menu, templateId) {
  const res = await fetch(`${BASE_URL}/api/export/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu,
      templateId,
      configuration: { ...DEFAULT_CONFIG, ...(menu.configOverrides || {}) },
      options: { orientation: 'portrait', includePageNumbers: true, title: menu.name }
    })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

async function pollJob(jobId) {
  const maxAttempts = 90
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const res = await fetch(`${BASE_URL}/api/export/jobs/${jobId}`)
    const data = await res.json().catch(() => ({}))
    if (data.status === 'completed') return { ok: true, data }
    if (data.status === 'failed') return { ok: false, error: data.error_message }
  }
  return { ok: false, error: 'Timeout' }
}

function buildMenu(sample) {
  const items = sample.items.map((item, i) => ({
    id: `item-${i}`,
    name: item.name,
    price: item.price,
    description: item.description,
    category: item.category,
    customImageUrl: sample.imageMap[item.name] || null,
    display_order: i
  }))
  return {
    id: sample.id,
    name: sample.name,
    logoUrl: '/logos/logo.svg',
    venueInfo: {
      address: '123 Gourmet Avenue, Food City, FC 12345',
      phone: '+1 (555) 123-4567',
      email: 'hello@gridmenu.ai'
    },
    items
  }
}

async function main() {
  console.log('[Prewarm] Starting demo PDF cache pre-warm')
  console.log('[Prewarm] Base URL:', BASE_URL)

  const combinations = []
  for (const sample of SAMPLE_MENUS) {
    const menu = buildMenu(sample)
    for (const templateId of TEMPLATES) {
      combinations.push({ menu, templateId })
    }
  }

  let ok = 0
  let cacheHit = 0
  let fail = 0

  for (const { menu, templateId } of combinations) {
    const label = `${menu.name} / ${templateId}`
    try {
      const create = await createDemoJob(menu, templateId)
      if (create.cache_hit && create.download_url) {
        cacheHit++
        console.log(`[Prewarm] ${label} - cache hit (skipped)`)
        continue
      }
      const jobId = create.job_id
      if (!jobId) {
        console.error(`[Prewarm] ${label} - no job_id`)
        fail++
        continue
      }
      console.log(`[Prewarm] ${label} - job ${jobId}...`)
      const result = await pollJob(jobId)
      if (result.ok) {
        ok++
        console.log(`[Prewarm] ${label} - done`)
      } else {
        fail++
        console.error(`[Prewarm] ${label} - failed:`, result.error)
      }
    } catch (err) {
      fail++
      console.error(`[Prewarm] ${label} - error:`, err.message)
    }
  }

  console.log(`[Prewarm] Done. Cache hits: ${cacheHit}, Generated: ${ok}, Failed: ${fail}`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[Prewarm] Fatal:', err)
  process.exit(1)
})
