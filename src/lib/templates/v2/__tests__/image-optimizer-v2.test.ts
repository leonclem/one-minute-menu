import { optimizeLayoutDocumentImages } from '../image-optimizer-v2'

// Mock image fetching/conversion so tests are fast and deterministic
jest.mock('../../export/texture-utils', () => ({
  fetchImageAsDataURL: jest.fn(async (url: string) => `data:image/jpeg;base64,${Buffer.from(url).toString('base64')}`)
}))

const { fetchImageAsDataURL } = require('../../export/texture-utils')

function makeDocWithItemImages(count: number) {
  return {
    templateId: '4-column-portrait',
    templateVersion: '2.0',
    pageSpec: { width: 595, height: 842, margins: { top: 36, right: 36, bottom: 36, left: 36 } },
    pages: [
      {
        id: 'page-1',
        pageNumber: 1,
        regions: [],
        tiles: Array.from({ length: count }, (_, i) => ({
          id: `tile-${i}`,
          type: 'ITEM_CARD',
          regionId: 'body',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          layer: 'content',
          content: {
            name: `Item ${i}`,
            price: 10,
            showImage: true,
            imageUrl: `https://example.com/image-${i}.jpg`
          }
        }))
      }
    ]
  } as any
}

describe('Image Optimizer V2', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('processes all images by default', async () => {
    const doc = makeDocWithItemImages(60)
    await optimizeLayoutDocumentImages(doc)

    expect(fetchImageAsDataURL).toHaveBeenCalledTimes(60)
  })

  it('limits optimized images when maxImages is provided', async () => {
    const doc = makeDocWithItemImages(60)
    await optimizeLayoutDocumentImages(doc, { maxImages: 50 })

    expect(fetchImageAsDataURL).toHaveBeenCalledTimes(50)
  })
})

