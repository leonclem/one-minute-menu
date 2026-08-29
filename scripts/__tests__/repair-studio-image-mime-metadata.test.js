/** @jest-environment node */

const {
  correctedStoragePath,
  detectMimeType,
  repairRow,
} = require('../repair-studio-image-mime-metadata')

const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('JFIF')])
const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('IHDR'),
])

function blobFor(buffer) {
  return { arrayBuffer: async () => buffer }
}

function row(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: 'user-1',
    storage_path: 'user-1/studio/child.png',
    public_url: 'https://cdn.example/child.png',
    mime_type: 'image/png',
    ...overrides,
  }
}

function updateQuery(result) {
  const query = {
    eq: jest.fn(() => query),
    select: jest.fn(() => query),
    maybeSingle: jest.fn().mockResolvedValue(result),
  }
  return query
}

describe('repair-studio-image-mime-metadata', () => {
  it('detects supported source containers and derives a matching path extension', () => {
    expect(detectMimeType(JPEG_BYTES)).toBe('image/jpeg')
    expect(detectMimeType(PNG_BYTES)).toBe('image/png')
    expect(detectMimeType(Buffer.from('not an image'))).toBeNull()
    expect(correctedStoragePath('user-1/studio/child.png', 'image/jpeg')).toBe('user-1/studio/child.jpg')
    expect(correctedStoragePath('user-1/studio/child.jpeg', 'image/webp')).toBe('user-1/studio/child.webp')
  })

  it('only reports the repair in dry-run mode', async () => {
    const storage = {
      download: jest.fn().mockResolvedValue({ data: blobFor(JPEG_BYTES), error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example/child.jpg' } }),
      upload: jest.fn(),
      update: jest.fn(),
    }
    const supabase = { from: jest.fn() }

    await expect(repairRow({ supabase, storage, row: row(), apply: false })).resolves.toMatchObject({
      status: 'would-repair',
      detectedMimeType: 'image/jpeg',
      targetPath: 'user-1/studio/child.jpg',
    })
    expect(storage.upload).not.toHaveBeenCalled()
    expect(storage.update).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('copies to the correct extension and atomically guards the row update', async () => {
    const query = updateQuery({ data: { id: row().id }, error: null })
    const storage = {
      download: jest.fn().mockResolvedValue({ data: blobFor(JPEG_BYTES), error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example/child.jpg' } }),
      upload: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn(),
    }
    const supabase = {
      from: jest.fn().mockReturnValue({ update: jest.fn().mockReturnValue(query) }),
    }

    await expect(repairRow({ supabase, storage, row: row(), apply: true })).resolves.toMatchObject({
      status: 'repaired',
      targetPath: 'user-1/studio/child.jpg',
      detectedMimeType: 'image/jpeg',
    })
    expect(storage.upload).toHaveBeenCalledWith(
      'user-1/studio/child.jpg',
      JPEG_BYTES,
      expect.objectContaining({ contentType: 'image/jpeg', upsert: false }),
    )
    expect(supabase.from).toHaveBeenCalledWith('studio_images')
    expect(query.eq).toHaveBeenCalledWith('id', row().id)
    expect(query.eq).toHaveBeenCalledWith('storage_path', 'user-1/studio/child.png')
    expect(query.eq).toHaveBeenCalledWith('mime_type', 'image/png')
  })

  it('refreshes metadata in place when the extension already matches', async () => {
    const query = updateQuery({ data: { id: row().id }, error: null })
    const matchingRow = row({ storage_path: 'user-1/studio/child.jpg' })
    const storage = {
      download: jest.fn().mockResolvedValue({ data: blobFor(JPEG_BYTES), error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example/child.jpg' } }),
      upload: jest.fn(),
      update: jest.fn().mockResolvedValue({ error: null }),
    }
    const supabase = {
      from: jest.fn().mockReturnValue({ update: jest.fn().mockReturnValue(query) }),
    }

    const result = await repairRow({ supabase, storage, row: matchingRow, apply: true })
    expect(result).toMatchObject({ status: 'repaired', refreshedInPlace: true })
    expect(storage.update).toHaveBeenCalledWith(
      'user-1/studio/child.jpg',
      JPEG_BYTES,
      expect.objectContaining({ contentType: 'image/jpeg', upsert: true }),
    )
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('skips an unrecognized byte container without changing storage or the row', async () => {
    const storage = {
      download: jest.fn().mockResolvedValue({ data: blobFor(Buffer.from('unknown')), error: null }),
      getPublicUrl: jest.fn(),
      upload: jest.fn(),
      update: jest.fn(),
    }
    const supabase = { from: jest.fn() }

    await expect(repairRow({ supabase, storage, row: row(), apply: true })).resolves.toMatchObject({
      status: 'skipped',
      reason: 'unsupported-container',
    })
    expect(storage.upload).not.toHaveBeenCalled()
    expect(storage.update).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
