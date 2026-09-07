import { shotBadgeKind } from './studio-shot-meta'

describe('shotBadgeKind', () => {
  it('maps generation labels to GEN and extra uploads to UPLOAD', () => {
    expect(shotBadgeKind('GEN 1')).toBe('GEN')
    expect(shotBadgeKind('GEN 4')).toBe('GEN')
    expect(shotBadgeKind('UPLOAD 2')).toBe('UPLOAD')
    expect(shotBadgeKind('ORIGINAL')).toBe('ORIGINAL')
    expect(shotBadgeKind('LOSSLESS')).toBe('LOSSLESS')
  })
})
