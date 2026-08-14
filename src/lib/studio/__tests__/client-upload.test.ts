/**
 * @jest-environment jsdom
 */

import { uploadStudioSourceFile, removeStudioStorageObject } from '../client-upload'

function pngFile(): File {
  return new File(['png-bytes'], 'dish.png', { type: 'image/png' })
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('uploadStudioSourceFile', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('rejects an unsupported file without calling the network', async () => {
    const fetchMock = jest.fn()
    global.fetch = fetchMock

    const result = await uploadStudioSourceFile(
      new File(['nope'], 'notes.txt', { type: 'text/plain' }),
    )

    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/png|jpeg|webp/i),
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('prepares a signed URL then PUTs the file to storage', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/studio/source/upload-url') && init?.method === 'POST') {
        return jsonResponse(200, {
          imageId: 'img-1',
          storagePath: 'user-1/studio/img-1.png',
          signedUrl: 'https://storage.example/upload?token=abc',
          publicUrl: 'https://cdn.example/user-1/studio/img-1.png',
        })
      }
      if (url.includes('https://storage.example/upload') && init?.method === 'PUT') {
        return jsonResponse(200, {})
      }
      return jsonResponse(500, { error: 'unexpected' })
    })
    global.fetch = fetchMock

    const result = await uploadStudioSourceFile(pngFile())

    expect(result).toEqual({
      ok: true,
      imageId: 'img-1',
      mimeType: 'image/png',
      bytes: 9,
      publicUrl: 'https://cdn.example/user-1/studio/img-1.png',
      storagePath: 'user-1/studio/img-1.png',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/studio/source/upload-url')
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST')
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://storage.example/upload?token=abc')
    expect(fetchMock.mock.calls[1][1]?.method).toBe('PUT')
  })

  it('returns a sign-in error when the prepare request is unauthorized', async () => {
    global.fetch = jest.fn(async () => jsonResponse(401, {}))

    const result = await uploadStudioSourceFile(pngFile())

    expect(result).toEqual({
      ok: false,
      error: 'You must be signed in to upload images.',
    })
  })

  it('cleans up the prepared object when the storage PUT fails', async () => {
    const fetchMock = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse(200, {
          imageId: 'img-1',
          storagePath: 'user-1/studio/img-1.png',
          signedUrl: 'https://storage.example/upload?token=abc',
          publicUrl: 'https://cdn.example/user-1/studio/img-1.png',
        })
      }
      if (init?.method === 'PUT') {
        return jsonResponse(500, {})
      }
      if (init?.method === 'DELETE') {
        return jsonResponse(200, { ok: true })
      }
      return jsonResponse(500, { error: 'unexpected' })
    })
    global.fetch = fetchMock

    const result = await uploadStudioSourceFile(pngFile())

    expect(result.ok).toBe(false)
    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE')
    expect(deleteCall).toBeDefined()
    expect(JSON.parse(String(deleteCall?.[1]?.body))).toEqual({
      storagePath: 'user-1/studio/img-1.png',
    })
  })
})

describe('removeStudioStorageObject', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('asks the signed-url route to delete the object', async () => {
    const fetchMock = jest.fn(async () => jsonResponse(200, { ok: true }))
    global.fetch = fetchMock

    await removeStudioStorageObject('user-1/studio/img-1.png')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/studio/source/upload-url',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
