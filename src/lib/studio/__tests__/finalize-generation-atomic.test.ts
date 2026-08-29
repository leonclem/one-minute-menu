/** @jest-environment node */

jest.mock('sharp', () => jest.fn(() => ({ metadata: jest.fn().mockResolvedValue({ width: 1600, height: 900 }) })))
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }))

import {
  AtomicStudioGenerationError,
  finalizeStudioGenerationAtomic,
} from '@/lib/studio/finalize-generation-atomic'

const userId = '11111111-1111-4111-8111-111111111111'
const dishId = '22222222-2222-4222-8222-222222222222'
const sourceImageId = '33333333-3333-4333-8333-333333333333'
const childImageId = '44444444-4444-4444-8444-444444444444'

const canonical = {
  scene_setup: { angle: '45-degree' as const, framing: 'close-up' as const, lighting: 'soft', spin: '0' as const },
  canvas: { background: 'white', background_style: '', surface_style: '', main_vessel: 'plate' },
  food_components: { main_item: 'burger', garnishes: [], sides: [] },
}

const objectEdit = {
  version: 1 as const,
  operation: 'remove' as const,
  directParentImageId: sourceImageId,
  selectedSourceImageId: sourceImageId,
  selection: {
    version: 1 as const,
    strokes: [{ kind: 'tap' as const, points: [{ x: 0.5, y: 0.5 }] }],
    boundingRegion: { left: 0.492, top: 0.492, right: 0.508, bottom: 0.508 },
  },
  annotationRendererVersion: 1 as const,
  contractDigest: 'a'.repeat(64),
}

function mockClient(overrides: { uploadError?: string; rpcError?: string; removeError?: string } = {}) {
  const upload = jest.fn().mockResolvedValue({ error: overrides.uploadError ? { message: overrides.uploadError } : null })
  const remove = jest.fn().mockResolvedValue({ error: overrides.removeError ? { message: overrides.removeError } : null })
  const rpc = jest.fn().mockResolvedValue(
    overrides.rpcError
      ? { data: null, error: { message: overrides.rpcError } }
      : {
          data: [{ image_id: childImageId, image_url: 'https://example.test/child.png', dish_id: dishId, model: 'nb2', balance_after: 8 }],
          error: null,
        },
  )
  return {
    storage: { from: jest.fn().mockReturnValue({ upload, remove, getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.test/child.png' } }) }) },
    rpc,
    upload,
    remove,
  }
}

function input() {
  return {
    userId,
    dishId,
    sourceImageId,
    imageBase64: 'aW1hZ2U=',
    mimeType: 'image/png',
    prompt: 'remove the selected garnish',
    requestedModel: 'nb2',
    creditCost: 2,
    canonical,
    objectEdit,
  }
}

describe('atomic Studio generation finalization', () => {
  it('uploads once and commits exact direct-parent/canonical/object-edit metadata through the RPC', async () => {
    const client = mockClient()
    const result = await finalizeStudioGenerationAtomic(input(), {
      createClient: () => client,
      createImageId: () => childImageId,
    })

    expect(client.rpc).toHaveBeenCalledWith('studio_commit_generated_image_v2', expect.objectContaining({
      p_source_image_id: sourceImageId,
      p_child_image_id: childImageId,
      p_width: 1600,
      p_height: 900,
      p_metadata: expect.objectContaining({
        editorStateVersion: 1,
        objectEdit,
      }),
    }))
    expect(result.success).toEqual({
      imageUrl: 'https://example.test/child.png', imageId: childImageId, dishId, model: 'nb2',
      credits: { cost: 2, balanceAfter: 8 },
    })
  })

  it('persists the container the provider actually returned, not the declared type', async () => {
    const client = mockClient()
    // Providers may answer a PNG request with JPEG bytes. Storing them under the
    // declared type makes the child undecodable against its own label on a
    // subsequent object edit.
    const jpegBase64 = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from('JFIF'),
    ]).toString('base64')

    await finalizeStudioGenerationAtomic(
      { ...input(), imageBase64: jpegBase64, mimeType: 'image/png' },
      { createClient: () => client, createImageId: () => childImageId },
    )

    expect(client.upload).toHaveBeenCalledWith(
      `${userId}/studio/${childImageId}.jpg`,
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/jpeg' }),
    )
    expect(client.rpc).toHaveBeenCalledWith(
      'studio_commit_generated_image_v2',
      expect.objectContaining({ p_mime_type: 'image/jpeg' }),
    )
  })

  it('keeps the declared type when the container cannot be identified', async () => {
    const client = mockClient()
    await finalizeStudioGenerationAtomic(input(), {
      createClient: () => client,
      createImageId: () => childImageId,
    })

    expect(client.upload).toHaveBeenCalledWith(
      `${userId}/studio/${childImageId}.png`,
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/png' }),
    )
    expect(client.rpc).toHaveBeenCalledWith(
      'studio_commit_generated_image_v2',
      expect.objectContaining({ p_mime_type: 'image/png' }),
    )
  })

  it('does not invoke the RPC when staging storage fails', async () => {
    const client = mockClient({ uploadError: 'storage unavailable' })
    await expect(finalizeStudioGenerationAtomic(input(), { createClient: () => client, createImageId: () => childImageId }))
      .rejects.toMatchObject({ stage: 'upload' })
    expect(client.rpc).not.toHaveBeenCalled()
    expect(client.remove).not.toHaveBeenCalled()
  })

  it.each([
    'child image row insert failed',
    'credit debit race after the affordability check',
    'dish current-image update failed',
  ])('compensates staged storage after an atomic RPC failure: %s', async (rpcError) => {
    const client = mockClient({ rpcError })
    await expect(finalizeStudioGenerationAtomic(input(), { createClient: () => client, createImageId: () => childImageId }))
      .rejects.toBeInstanceOf(AtomicStudioGenerationError)
    expect(client.remove).toHaveBeenCalledWith([`${userId}/studio/${childImageId}.png`])
  })

  it('reports failed compensation while still rejecting the child finalization', async () => {
    const client = mockClient({ rpcError: 'database failure', removeError: 'cleanup failure' })
    await expect(finalizeStudioGenerationAtomic(input(), { createClient: () => client, createImageId: () => childImageId }))
      .rejects.toMatchObject({ stage: 'commit', compensationFailed: true })
  })
})
