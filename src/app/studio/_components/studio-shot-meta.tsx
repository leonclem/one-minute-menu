import { EXPORT_PRESETS } from '@/lib/studio/export-presets'
import { isLosslessShot, shotLibraryBadge } from '@/lib/studio/lineage'
import type { StudioExportTile, StudioImageRecord } from '@/lib/studio/types'

export function shotBadgeKind(badge: string): string {
  if (badge.startsWith('GEN')) return 'GEN'
  if (badge.startsWith('UPLOAD')) return 'UPLOAD'
  return badge
}

export function StudioShotBadge({ badge }: { badge: string }) {
  return (
    <span className="studio-shot-badge" data-kind={shotBadgeKind(badge)}>
      {badge}
    </span>
  )
}

export function StudioShotBadges({
  image,
  images,
}: {
  image: StudioImageRecord
  images: readonly StudioImageRecord[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="studio-shot-badges">
      <StudioShotBadge badge={shotLibraryBadge(image, images)} />
      {isLosslessShot(image) ? <StudioShotBadge badge="LOSSLESS" /> : null}
    </div>
  )
}

export function StudioShotExportTicks({ tiles = [] }: { tiles?: StudioExportTile[] }) {
  return (
    <div className="flex gap-1" aria-label="Export formats ready">
      {EXPORT_PRESETS.map((preset) => {
        const ready = tiles.some(
          (tile) => tile.variantType === preset.key && tile.status === 'ready',
        )
        return (
          <span
            key={preset.key}
            className="studio-export-tick"
            data-ready={ready ? 'true' : 'false'}
            title={`${preset.label}${ready ? ' ready' : ''}`}
          />
        )
      })}
    </div>
  )
}
