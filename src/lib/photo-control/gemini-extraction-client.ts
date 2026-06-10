/**
 * Photo Control — GeminiExtractionClient (Phase A Vision Extractor)
 *
 * Sends a food photograph to the Gemini model and returns raw extraction JSON
 * structured as `{ scene_setup, canvas, food_components }`.
 *
 * Design notes:
 *  - Uses `responseModalities: ['TEXT']` and `responseMimeType: 'application/json'`
 *    so the model returns structured JSON rather than an image. (Requirement 2.1)
 *  - Sets `thinkingLevel: 'MINIMAL'` for a latency-optimized profile that does
 *    not require deep spatial reasoning. (Requirement 2.3)
 *  - Reuses `fetchJsonWithRetry` and `NANO_BANANA_API_KEY` from the existing
 *    infrastructure, keeping the same model family and API key. (Requirement 2.1)
 *  - Throws an `UnparseableExtractionResponseError` when the model response body
 *    is not parseable as JSON. (Requirement 2.4)
 *  - Does NOT validate the extracted JSON against `MinimalSchemaZ`; that is the
 *    responsibility of `MinimalSchemaValidator` in the route layer. (Requirement 2.5)
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { fetchJsonWithRetry } from '../retry'

// ============================================================================
// Constants
// ============================================================================

const GEMINI_MODEL = 'gemini-3.1-flash-image-preview'
const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

/**
 * System prompt instructing the model to extract the photo's visual structure
 * into the Minimal_Schema shape. Kept concise to stay within the latency-
 * optimized profile. (Requirement 2.1)
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are a food photography analyst. Analyze the provided food photograph and extract its visual structure as JSON.

Return ONLY a valid JSON object with exactly these three top-level keys:

{
  "scene_setup": {
    "angle": "<one of: top-down, 45-degree, eye-level, macro-close-up>",
    "framing": "<one of: close-up, medium, wide>",
    "lighting": "<one of: low-key, bright-and-airy>"
  },
  "canvas": {
    "background": "<brief description of the background surface/setting>",
    "main_vessel": "<brief description of the primary plate, bowl, or container>"
  },
  "food_components": {
    "main_item": "<name of the primary food item>",
    "garnishes": ["<garnish 1>", "<garnish 2>"],
    "sides": ["<side dish 1>", "<side dish 2>"]
  }
}

Use only the allowed enum values listed above. Return empty arrays for garnishes and sides if none are present.`

// ============================================================================
// Types
// ============================================================================

/** Allowed MIME types for the source image. */
export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp'

/** Input to the extraction client. */
export interface ExtractionRequest {
  /** Base64-encoded image data (no data-URL prefix). */
  imageBase64: string
  /** MIME type of the image. */
  mimeType: ImageMimeType
}

/** Raw extraction result — the parsed JSON object from the model. */
export interface ExtractionResponse {
  /** Parsed JSON object from the model. Contains `scene_setup`, `canvas`, `food_components`. */
  raw: unknown
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Thrown when the Gemini response body cannot be parsed as a JSON object.
 * Carries a canonical `code` for programmatic handling. (Requirement 2.4)
 */
export class UnparseableExtractionResponseError extends Error {
  readonly code = 'UNPARSEABLE_EXTRACTION_RESPONSE' as const

  constructor(message: string) {
    super(message)
    this.name = 'UnparseableExtractionResponseError'
  }
}

// ============================================================================
// Pure parse helper
// ============================================================================

/**
 * Parses an extraction response body into a plain JavaScript object.
 *
 * Accepts three input shapes:
 *  1. A plain object (already parsed by the HTTP layer) — returned as-is.
 *  2. A JSON string whose root value is a plain object — parsed and returned.
 *  3. A markdown-fenced JSON string (```json ... ```) — fence stripped, then
 *     parsed as case 2.
 *
 * Throws `UnparseableExtractionResponseError` for every other input:
 *  - Non-string, non-object primitives (null, undefined, number, boolean, array)
 *  - Strings that are not valid JSON
 *  - JSON strings whose root value is not a plain object (null, boolean, number,
 *    string, array)
 *  - Empty or whitespace-only strings
 *
 * Exported as a pure helper so it can be tested independently (Property 2).
 * (Requirement 2.4)
 */
export function parseExtractionResponse(body: unknown): Record<string, unknown> {
  // ── Case 1: already a plain object ────────────────────────────────────────
  if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>
  }

  // ── Case 2 & 3: string input ───────────────────────────────────────────────
  if (typeof body === 'string') {
    const trimmed = body.trim()

    if (trimmed === '') {
      throw new UnparseableExtractionResponseError(
        'Unparseable extraction response: model returned an empty string',
      )
    }

    // Strip optional markdown code fences (```json ... ``` or ``` ... ```)
    const stripped = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(stripped)
    } catch {
      throw new UnparseableExtractionResponseError(
        `Unparseable extraction response: model response is not valid JSON. Received: ${stripped.slice(0, 200)}`,
      )
    }

    // The root value must be a plain object (not null, array, boolean, number, string)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new UnparseableExtractionResponseError(
        `Unparseable extraction response: JSON root is not an object. Got: ${JSON.stringify(parsed).slice(0, 100)}`,
      )
    }

    return parsed as Record<string, unknown>
  }

  // ── Everything else (null, undefined, number, boolean, array) ─────────────
  throw new UnparseableExtractionResponseError(
    `Unparseable extraction response: expected a JSON object or string, got ${
      body === null ? 'null' : Array.isArray(body) ? 'array' : typeof body
    }`,
  )
}

/**
 * Extracts the text content from a Gemini `generateContent` API response
 * envelope and delegates to `parseExtractionResponse`.
 *
 * The Gemini API wraps text responses in:
 *   `candidates[0].content.parts[0].text`
 *
 * @internal Used by `GeminiExtractionClient.extract`.
 */
function parseGeminiApiResponse(apiResponse: unknown): Record<string, unknown> {
  const text: unknown =
    (apiResponse as any)?.candidates?.[0]?.content?.parts?.[0]?.text

  if (typeof text === 'string') {
    // Delegate to the pure helper which handles string parsing
    return parseExtractionResponse(text)
  }

  // The HTTP layer may have already parsed the response body into an object
  // (e.g., when responseMimeType is 'application/json' and the model returns
  // the JSON directly in the part). Try the raw apiResponse as a fallback.
  if (apiResponse !== null && typeof apiResponse === 'object' && !Array.isArray(apiResponse)) {
    // Check if it looks like a Gemini envelope with no text part — surface a
    // clear error rather than returning the envelope itself.
    const candidates = (apiResponse as any)?.candidates
    if (Array.isArray(candidates)) {
      throw new UnparseableExtractionResponseError(
        'Unparseable extraction response: model returned no text content in candidates',
      )
    }
  }

  throw new UnparseableExtractionResponseError(
    'Unparseable extraction response: model returned no text content',
  )
}

// ============================================================================
// GeminiExtractionClient
// ============================================================================

/**
 * Calls the Gemini `generateContent` endpoint with a text/JSON response
 * modality and a latency-optimized thinking profile to extract the visual
 * structure of a food photograph.
 *
 * Reuses `fetchJsonWithRetry` and `NANO_BANANA_API_KEY`. (Requirements 2.1, 2.3)
 */
export class GeminiExtractionClient {
  private readonly apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.NANO_BANANA_API_KEY ?? ''
    if (!this.apiKey) {
      throw new Error('NANO_BANANA_API_KEY is required for GeminiExtractionClient')
    }
  }

  /**
   * Sends the image to Gemini and returns the raw parsed extraction object.
   *
   * @throws {UnparseableExtractionResponseError} when the model response is not valid JSON.
   * @throws {HttpError} on non-2xx HTTP responses (propagated from fetchJsonWithRetry).
   */
  async extract(req: ExtractionRequest): Promise<ExtractionResponse> {
    const url = new URL(GEMINI_BASE_URL)
    url.searchParams.set('key', this.apiKey)

    const requestBody = {
      systemInstruction: {
        parts: [{ text: EXTRACTION_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: req.mimeType,
                data: req.imageBase64,
              },
            },
            {
              text: 'Extract the visual structure of this food photograph as JSON.',
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT'],
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingBudget: 0, // MINIMAL — latency-optimized, no deep spatial reasoning (Req 2.3)
        },
      },
    }

    const apiResponse = await fetchJsonWithRetry<unknown>(
      url.toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OneMinuteMenu/1.0',
        },
        body: JSON.stringify(requestBody),
      },
      {
        retries: 2,
        baseDelayMs: 500,
        maxDelayMs: 5000,
        timeoutMs: 30000,
      },
    )

    const raw = parseGeminiApiResponse(apiResponse)
    return { raw }
  }
}
