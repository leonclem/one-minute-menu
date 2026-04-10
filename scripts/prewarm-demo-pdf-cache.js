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
    'Breakfast Sandwich': '/sample-menus/generated/breakfast/standard/breakfast-sandwich.webp',
    'Country Tartine': '/sample-menus/generated/breakfast/standard/country-tartine.webp',
    'Eggs Benedict': '/sample-menus/generated/breakfast/standard/eggs-benedict.webp',
    'French Toast': '/sample-menus/generated/breakfast/standard/french-toast.webp',
    'Le Parfait': '/sample-menus/generated/breakfast/standard/le-parfait.webp',
    'Morning Tartine': '/sample-menus/generated/breakfast/standard/morning-tartine.webp',
    'Parisian Omelette': '/sample-menus/generated/breakfast/standard/parisian-omelette.webp',
    "Provençal Eggs": '/sample-menus/generated/breakfast/standard/provencal-eggs.webp',
    'Three Organic Eggs Your Way!': '/sample-menus/generated/breakfast/standard/three-eggs-your-way.webp',
    "Two Soft-Boiled Eggs & 'Mouillettes'": '/sample-menus/generated/breakfast/standard/two-soft-boiled-eggs-and-mouilettes.webp'
  },
  fine_dining: {
    'Crispy Duck in Port Cherry Sauce': '/sample-menus/generated/fine-dining/standard/crispy-duck-in-port-cherry-sauce.webp',
    'Grilled Faroe Island Salmon': '/sample-menus/generated/fine-dining/standard/grilled-faroe-island-salmon.webp',
    'House Made Ice Cream': '/sample-menus/generated/fine-dining/standard/house-made-ice-cream.jpg',
    'Key Lime Pudding': '/sample-menus/generated/fine-dining/standard/key-lime-pudding.jpg',
    'Marinated Local Oyster Mushroom Salad': '/sample-menus/generated/fine-dining/standard/marinated-local-oyster-mushroom-salad.webp',
    'Pan Roasted Duck Breast': '/sample-menus/generated/fine-dining/standard/pan-roasted-duck-breast.webp',
    'Rutabaga and Toasted Hazelnut Soup': '/sample-menus/generated/fine-dining/standard/rutabaga-and-toasted-hazelnut-soup.webp',
    'Tenderloin of Beef Wellington': '/sample-menus/generated/fine-dining/standard/tenderloin-of-beef-wellington.webp',
    'Tres Leches Cake': '/sample-menus/generated/fine-dining/standard/tres-leches-cake.webp'
  }
}

const DEMO_CUTOUT_IMAGES = {
  breakfast: {
    'Breakfast Sandwich': '/sample-menus/generated/breakfast/cutout/breakfast-sandwich.png',
    'Country Tartine': '/sample-menus/generated/breakfast/cutout/country-tartine.png',
    'Eggs Benedict': '/sample-menus/generated/breakfast/cutout/eggs-benedict.png',
    'French Toast': '/sample-menus/generated/breakfast/cutout/french-toast.png',
    'Le Parfait': '/sample-menus/generated/breakfast/cutout/le-parfait.png',
    'Morning Tartine': '/sample-menus/generated/breakfast/cutout/morning-tartine.png',
    'Parisian Omelette': '/sample-menus/generated/breakfast/cutout/parisian-omelette.png',
    "Provençal Eggs": '/sample-menus/generated/breakfast/cutout/provencal-eggs.png',
    'Three Organic Eggs Your Way!': '/sample-menus/generated/breakfast/cutout/three-eggs-your-way.png',
    "Two Soft-Boiled Eggs & 'Mouillettes'": '/sample-menus/generated/breakfast/cutout/two-soft-boiled-eggs-and-mouilettes.png'
  },
  fine_dining: {
    'Crispy Duck in Port Cherry Sauce': '/sample-menus/generated/fine-dining/cutout/crispy-duck-in-port-cherry-sauce---cutout.png',
    'Grilled Faroe Island Salmon': '/sample-menus/generated/fine-dining/cutout/grilled-faroe-island-salmon---cutout.png',
    'House Made Ice Cream': '/sample-menus/generated/fine-dining/cutout/house-made-ice-cream---cutout.png',
    'Key Lime Pudding': '/sample-menus/generated/fine-dining/cutout/key-lime-pudding---cutout.png',
    'Marinated Local Oyster Mushroom Salad': '/sample-menus/generated/fine-dining/cutout/marinated-local-oyster-mushroom-salad---cutout.png',
    'Pan Roasted Duck Breast': '/sample-menus/generated/fine-dining/cutout/pan-roasted-duck-breast---cutout.png',
    'Rutabaga and Toasted Hazelnut Soup': '/sample-menus/generated/fine-dining/cutout/rutabaga-and-toasted-hazelnut-soup---cutout.png',
    'Tenderloin of Beef Wellington': '/sample-menus/generated/fine-dining/cutout/tenderloin-of-beef-wellington---cutout.png',
    'Tres Leches Cake': '/sample-menus/generated/fine-dining/cutout/tres-leches-cake---cutout.png',
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
    imageMap: DEMO_IMAGES.breakfast,
    cutoutMap: DEMO_CUTOUT_IMAGES.breakfast,
    configOverrides: { bannerImageStyle: 'cutout', flagshipItemId: 'item-7' }
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
    imageMap: DEMO_IMAGES.fine_dining,
    cutoutMap: DEMO_CUTOUT_IMAGES.fine_dining,
    configOverrides: { bannerImageStyle: 'stretch-fit', flagshipItemId: 'item-5' }
  }
]

const TEMPLATES = ['classic-cards-v2', 'italian-v2', 'two-column-classic-v2']

const DEFAULT_CONFIG = {
  textOnly: false,
  fillersEnabled: false,
  texturesEnabled: true,
  showMenuTitle: false,
  palette: { id: 'midnight-gold', name: 'Midnight Gold' }
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
  const FLAGSHIP_NAMES = {
    breakfast: 'Country Tartine',
    fine_dining: 'Tenderloin of Beef Wellington',
  }
  const isBreakfast = sample.id.includes('breakfast')
  const flagshipName = isBreakfast ? FLAGSHIP_NAMES.breakfast : FLAGSHIP_NAMES.fine_dining
  const logoUrl = isBreakfast
    ? "/sample-menus/Hannah's Cafe---Transparent.png"
    : '/sample-menus/fill.png'

  const items = sample.items.map((item, i) => {
    const cutoutUrl = sample.cutoutMap?.[item.name] || null
    return {
      id: `item-${i}`,
      name: item.name,
      price: item.price,
      description: item.description,
      category: item.category,
      customImageUrl: sample.imageMap[item.name] || null,
      cutoutUrl,
      imageSource: 'ai',
      ...(item.name === flagshipName ? { isFlagship: true } : {}),
      ...(cutoutUrl ? { cutoutStatus: 'succeeded' } : {}),
      ...(cutoutUrl ? { imageTransform: { cutout: { scale: 0.85, offsetX: 0, offsetY: 15 } } } : {}),
      display_order: i
    }
  })
  return {
    id: sample.id,
    name: sample.name,
    logoUrl,
    venueInfo: {
      address: '123 Gourmet Avenue, Food City, FC 12345',
      phone: '+1 (555) 123-4567',
      email: 'hello@gridmenu.ai',
      socialMedia: {
        instagram: '@gridmenu',
        facebook: '@gridmenu',
        x: '@gridmenu',
        website: 'https://gridmenu.ai'
      }
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
