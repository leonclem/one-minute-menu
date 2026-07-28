import { buildGeminiRequest } from '../nano-banana'
import type { NanoBananaParams } from '@/types'

const TEST_OPTIONS = {
  apiKey: 'request-test-key',
  baseUrl: 'https://api.test.nanobanana.com/v1/generateContent',
}

function expectByteIdenticalBody(
  params: NanoBananaParams,
  expectedBody: object,
  expectedUrl: string
) {
  const request = buildGeminiRequest(params, TEST_OPTIONS)

  expect(JSON.stringify(request.requestBody)).toBe(JSON.stringify(expectedBody))
  expect(request.url).toBe(expectedUrl)
  expect(request.loggedPrompt).toBe(
    ((request.requestBody.contents as Array<{ parts: Array<{ text: string }> }>)[0].parts[0].text)
  )
}

describe('buildGeminiRequest', () => {
  it('reproduces the current Studio request body byte-for-byte', () => {
    const params: NanoBananaParams = {
      prompt: 'Keep the plated dish unchanged while updating the scene.',
      negative_prompt: 'people, text',
      aspect_ratio: '1:1',
      number_of_images: 2,
      safety_filter_level: 'block_some',
      person_generation: 'dont_allow',
      reference_mode: 'composite',
      reference_images: [
        { mimeType: 'image/jpeg', data: 'c3ViamVjdA==', role: 'dish', comment: 'Preserve this dish.' },
        { mimeType: 'image/png', data: 'c2NlbmU=', role: 'scene' },
        { mimeType: 'image/png', data: 'c3R5bGU=', role: 'style' },
      ],
    }

    const prompt =
      'Generate an image of: Compose a new image using the provided reference inputs:\n' +
      'Use Image A for the primary subject/dish. Instruction: Preserve this dish..\n' +
      'Use Image B for the background environment and context.\n' +
      'Use Image C for the art style, lighting, and color palette. \n' +
      'Integrate the subject naturally into the environment while maintaining the requested style and layout.\n\n' +
      'Keep the plated dish unchanged while updating the scene.\n' +
      'Exclude: people, text\nAspect ratio: 1:1\nNo people in the image.\nContent safety: block_some'

    expectByteIdenticalBody(params, {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: 'c3ViamVjdA==' } },
              { inlineData: { mimeType: 'image/png', data: 'c2NlbmU=' } },
              { inlineData: { mimeType: 'image/png', data: 'c3R5bGU=' } },
            ],
          },
        ],
        generationConfig: {
          candidateCount: 2,
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '1:1', imageSize: '1k' },
        },
      },
      'https://api.test.nanobanana.com/v1/generateContent?key=request-test-key'
    )
  })

  it('reproduces the current legacy menu request body byte-for-byte', () => {
    const params: NanoBananaParams = {
      prompt: 'A menu tile for grilled salmon',
      negative_prompt: 'cutlery',
      aspect_ratio: '16:9',
      number_of_images: 4,
      safety_filter_level: 'block_most',
      person_generation: 'allow',
    }

    expectByteIdenticalBody(
      params,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Generate an image of: A menu tile for grilled salmon\nExclude: cutlery\nAspect ratio: 16:9\nContent safety: block_most' }],
          },
        ],
        generationConfig: {
          candidateCount: 4,
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '16:9', imageSize: '1k' },
        },
      },
      'https://api.test.nanobanana.com/v1/generateContent?key=request-test-key'
    )
  })

  it('reproduces the current Pro request body byte-for-byte', () => {
    const params: NanoBananaParams = {
      prompt: 'A high-end menu photograph',
      aspect_ratio: '4:3',
      image_size: '2K',
      number_of_images: 1,
      person_generation: 'dont_allow',
      model: 'gemini-3-pro-image',
      thinking_level: 'high',
      reference_images: [
        { mimeType: 'image/webp', data: 'bGF5b3V0', role: 'layout' },
      ],
    }

    const prompt =
      'Generate an image of: Compose a new image using the provided reference inputs:\n' +
      'Use Image A for the plating structure and composition layout. \n' +
      'Integrate the subject naturally into the environment while maintaining the requested style and layout.\n\n' +
      'A high-end menu photograph\nAspect ratio: 4:3\nNo people in the image.'

    expectByteIdenticalBody(
      params,
      {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/webp', data: 'bGF5b3V0' } },
            ],
          },
        ],
        generationConfig: {
          candidateCount: 1,
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '4:3', imageSize: '2K' },
        },
      },
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent?key=request-test-key'
    )
  })
})