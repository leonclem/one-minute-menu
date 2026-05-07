/**
 * @jest-environment node
 */

import {
  getImageGenerationQueuePriority,
  parseReferenceImagesForEnqueue,
} from '../enqueue-helpers'

describe('enqueue-helpers', () => {
  describe('parseReferenceImagesForEnqueue', () => {
    it('returns undefined for empty input', () => {
      expect(parseReferenceImagesForEnqueue(undefined)).toBeUndefined()
      expect(parseReferenceImagesForEnqueue([])).toBeUndefined()
    })

    it('parses valid data URLs up to three entries', () => {
      const refs = [
        { dataUrl: 'data:image/png;base64,AAA', role: 'scene' as const },
        { dataUrl: 'data:image/jpeg;base64,BBB' },
      ]
      const out = parseReferenceImagesForEnqueue(refs)
      expect(out).toHaveLength(2)
      expect(out![0].mimeType).toBe('image/png')
      expect(out![0].data).toBe('AAA')
      expect(out![1].mimeType).toBe('image/jpeg')
      expect(out![1].data).toBe('BBB')
    })
  })

  describe('getImageGenerationQueuePriority', () => {
    it('returns higher priority for subscriber plans', () => {
      expect(getImageGenerationQueuePriority('grid_plus')).toBeGreaterThan(
        getImageGenerationQueuePriority('free')
      )
    })
  })
})
