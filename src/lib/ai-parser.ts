import OpenAI from 'openai'
import type { MenuItemFormData } from '@/types'

export interface AIParseResult {
  items: MenuItemFormData[]
  usage?: {
    input: number
    output: number
    cost: number
  }
}

export function buildPrompt(ocrText: string, currency: string = 'SGD'): string {
  return [
    'You are parsing restaurant menu text extracted via OCR into structured JSON.',
    'Return ONLY a JSON object with the following shape:',
    '{ "items": [ { "name": string, "description": string | null, "price": number, "category": string | null } ] }',
    `Prices should be numbers in ${currency}. If a price like "$8.50" or "8.5" is found, output 8.5.`,
    'Infer short descriptions when present on the same or next line. Leave description null if not present.',
    'Group by rough categories if clearly indicated (e.g., "Mains", "Drinks"). Otherwise set category to null.',
    'Ignore non-menu noise like opening hours, addresses, social handles.',
    'Be conservative: only output items you are reasonably confident about.',
    'OCR text follows between <ocr> tags.',
    '<ocr>\n' + ocrText.trim() + '\n</ocr>'
  ].join('\n')
}

export function parseMenuFallback(ocrText: string): MenuItemFormData[] {
  const lines = ocrText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const items: MenuItemFormData[] = []
  const pricePattern = /(?:(?:S\$|\$|€|£)?\s*)(\d{1,3}(?:[.,]\d{2})?)\b/ // captures price number
  let currentCategory: string | undefined
  const headingKeywords = new Set([
    'menu','starters','mains','desserts','drinks','beverages','summer','lunch','dinner','breakfast','specials','sides','snacks'
  ])

  for (const raw of lines) {
    const line = raw.replace(/\s{2,}/g, ' ').trim()
    if (!line) continue

    // Category heuristic: solitary word(s) followed by a colon or uppercase headings
    if ((/^[A-Z][A-Z\s]{2,}$/.test(line) || /:$/g.test(line)) && line.length <= 40) {
      currentCategory = line.replace(/:$/, '').toLowerCase()
      continue
    }

    const priceMatch = line.match(pricePattern)
    if (priceMatch) {
      const priceNum = parseFloat(priceMatch[1].replace(',', '.'))
      const before = line.slice(0, priceMatch.index || 0).trim()
      const after = line.slice((priceMatch.index || 0) + priceMatch[0].length).trim()

      // Try to split name and optional description with a dash or comma
      let name = before
      let description = ''
      const sepMatch = before.match(/\s[-–—:]\s|,\s/)
      if (sepMatch) {
        const idx = before.search(/\s[-–—:]\s|,\s/)
        name = before.slice(0, idx).trim()
        description = before.slice(idx).replace(/^\s*[-–—:,]\s*/, '').trim()
      } else if (after) {
        // Sometimes description is after the price
        description = after
      }

      // Trim dangling separators at end of name when price follows after a dash, e.g. "Roasted Duck - 8.50"
      name = name.replace(/\s*[-–—:,]+\s*$/, '').trim()

      if (name) {
        items.push({
          name,
          description: description || '',
          price: isFinite(priceNum) ? priceNum : 0,
          category: currentCategory,
          available: true,
        })
      }
    } else {
      // No price on line: treat as possible name-only item if it looks like a dish line
      const simple = line.replace(/[•·•]\s*/g, '').trim()
      const lower = simple.toLowerCase()
      const isHeading = headingKeywords.has(lower.replace(/:$/, ''))
      const looksLikeItem = /[a-z]/.test(lower) && !isHeading && simple.length >= 3 && simple.length <= 80
      if (looksLikeItem) {
        // Try to split leading name and trailing description by comma or dash
        let name = simple
        let description = ''
        const idx = simple.search(/\s[-–—:]\s|,\s/)
        if (idx !== -1) {
          name = simple.slice(0, idx).trim()
          description = simple.slice(idx).replace(/^\s*[-–—:,]\s*/, '').trim()
        }
        name = name.replace(/\s*[-–—:,]+\s*$/, '').trim()
        if (name && !headingKeywords.has(name.toLowerCase())) {
          items.push({
            name,
            description,
            price: 0,
            category: currentCategory,
            available: true,
          })
        }
      }
    }
  }

  // Basic de-duplication by name+price
  const seen = new Set<string>()
  return items.filter(it => {
    const key = `${it.name.toLowerCase()}|${it.price}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function parseMenuWithAI(ocrText: string, opts?: { currency?: string; model?: string }): Promise<AIParseResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  const model = opts?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const currency = opts?.currency || 'SGD'

  const client = new OpenAI({ apiKey })
  const prompt = buildPrompt(ocrText, currency)

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' } as any,
    messages: [
      { role: 'system', content: 'You are a precise information extraction assistant.' },
      { role: 'user', content: prompt },
    ],
  })

  const content = completion.choices[0]?.message?.content || '{}'
  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch {
    parsed = { items: [] }
  }

  const items: MenuItemFormData[] = Array.isArray(parsed.items)
    ? parsed.items.map((it: any) => ({
        name: String(it.name || '').trim(),
        description: (it.description ? String(it.description) : '').trim(),
        price: typeof it.price === 'number' ? it.price : parseFloat(String(it.price || '0').replace(',', '.')) || 0,
        category: it.category ? String(it.category) : '',
        available: true,
      }))
      .filter((it: MenuItemFormData) => it.name && isFinite(it.price))
    : []

  const input = completion.usage?.prompt_tokens || 0
  const output = completion.usage?.completion_tokens || 0

  // Optional cost calculation via env to avoid hardcoding rates
  const inputRate = parseFloat(process.env.OPENAI_INPUT_TOKEN_RATE || '0') // $ per token
  const outputRate = parseFloat(process.env.OPENAI_OUTPUT_TOKEN_RATE || '0')
  const cost = input * inputRate + output * outputRate

  return { items, usage: { input, output, cost: isFinite(cost) ? cost : 0 } }
}


