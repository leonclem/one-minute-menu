import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

export type SpikeLayoutReport = {
  layout: string
  instructionPrompt: string
  loggedPrompt: string
  paddedWidth: number
  paddedHeight: number
  sourceRect: { left: number; top: number; width: number; height: number }
  restoreRect: { left: number; top: number; width: number; height: number }
  insetPx: number
  requestedAspectRatio: string
  files: Record<string, string>
  modelWidth?: number | null
  modelHeight?: number | null
  model?: string | null
  aspectRatioHonoured?: boolean | null
  live: boolean
}

export type SpikeReport = {
  sourceLabel: string
  live: boolean
  padRatio: number
  featherPx: number
  insetRatio: number
  createdAt: string
  layouts: SpikeLayoutReport[]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function imageBlock(filename: string | undefined, caption: string): string {
  if (!filename) {
    return `<figure class="missing"><figcaption>${escapeHtml(caption)} (not produced)</figcaption></figure>`
  }
  return (
    `<figure>` +
    `<img src="${escapeHtml(filename)}" alt="${escapeHtml(caption)}"/>` +
    `<figcaption>${escapeHtml(caption)}</figcaption>` +
    `</figure>`
  )
}

export function renderSpikeReportHtml(report: SpikeReport): string {
  const sections = report.layouts
    .map((layout) => {
      const files = layout.files
      return `
<section>
  <h2>Layout: ${escapeHtml(layout.layout)}</h2>
  <p class="meta">
    Padded canvas ${layout.paddedWidth} x ${layout.paddedHeight}.
    Source rect ${layout.sourceRect.width} x ${layout.sourceRect.height} at ${layout.sourceRect.left},${layout.sourceRect.top}.
    Inner restore ${layout.restoreRect.width} x ${layout.restoreRect.height} at ${layout.restoreRect.left},${layout.restoreRect.top} (inset ${layout.insetPx}px on padded sides).
    Requested Gemini aspect ${escapeHtml(layout.requestedAspectRatio)}.
    ${
      layout.live
        ? `Gemini returned ${layout.modelWidth ?? '?'} x ${layout.modelHeight ?? '?'} (ratio honoured: ${
            layout.aspectRatioHonoured == null ? '?' : layout.aspectRatioHonoured ? 'yes' : 'no'
          }).`
        : 'Dry run: Gemini was not called.'
    }
  </p>
  <h3>Instruction prompt</h3>
  <pre>${escapeHtml(layout.instructionPrompt)}</pre>
  <h3>Prompt actually sent (after Studio preamble)</h3>
  <pre>${escapeHtml(layout.loggedPrompt)}</pre>
  <div class="grid">
    ${imageBlock(files.source, '1. Source')}
    ${imageBlock(files.padded, '2. Padded canvas (sent to Gemini when live)')}
    ${imageBlock(files.overlay, '3. Bounds (red = original frame, teal = inner restore)')}
    ${imageBlock(files.gemini, '4. Gemini output (candidate to keep)')}
    ${imageBlock(files.restoredHard, '5. Full hard paste (diagnostic)')}
    ${imageBlock(files.restoredInner, '6. Inner restore, hard (diagnostic)')}
    ${imageBlock(files.restoredInnerFeather, '7. Inner restore, feathered (diagnostic)')}
  </div>
</section>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Reframe spike ${escapeHtml(report.sourceLabel)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 24px; color: #111; background: #f6f6f4; }
    h1 { font-size: 1.4rem; }
    h2 { font-size: 1.15rem; margin-top: 2rem; }
    h3 { font-size: 0.95rem; margin-bottom: 0.35rem; }
    .meta, figcaption { color: #555; font-size: 0.85rem; }
    pre { white-space: pre-wrap; background: #111; color: #f4f4f5; padding: 12px 14px; border-radius: 8px; font-size: 0.8rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    figure { margin: 0; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 8px; }
    img { width: 100%; height: auto; background:
      linear-gradient(45deg, #ddd 25%, transparent 25%),
      linear-gradient(-45deg, #ddd 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #ddd 75%),
      linear-gradient(-45deg, transparent 75%, #ddd 75%);
      background-size: 16px 16px; background-position: 0 0, 0 8px, 8px -8px, -8px 0; }
    .missing { padding: 24px; color: #777; }
  </style>
</head>
<body>
  <h1>Reframe spike report</h1>
  <p class="meta">
    Source: ${escapeHtml(report.sourceLabel)}.
    Mode: ${report.live ? 'live Gemini call' : 'dry run'}.
    Pad ratio ${report.padRatio}. Inset ratio ${report.insetRatio}. Feather ${report.featherPx}px.
    ${escapeHtml(report.createdAt)}.
  </p>
  ${sections}
</body>
</html>
`
}

export async function writeSpikeReport(outDir: string, report: SpikeReport): Promise<string> {
  await mkdir(outDir, { recursive: true })
  const htmlPath = join(outDir, 'index.html')
  await writeFile(htmlPath, renderSpikeReportHtml(report), 'utf8')
  await writeFile(join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return htmlPath
}
