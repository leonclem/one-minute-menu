/**
 * Load a vessel-swap PNG for attachment to a Studio Gemini request.
 * Server-only: reads public/studio/vessels.
 */

import fs from 'fs'
import path from 'path'

import { getStudioVessel, vesselReferenceComment } from '@/lib/studio/vessels'

export interface VesselReferenceImage {
  data: string
  mimeType: 'image/png'
  role: 'other'
  comment: string
}

export function loadStudioVesselReference(key: string): VesselReferenceImage | null {
  const option = getStudioVessel(key)
  if (!option) return null

  const filePath = path.join(process.cwd(), 'public', 'studio', 'vessels', option.filename)
  if (!fs.existsSync(filePath)) return null

  return {
    data: fs.readFileSync(filePath).toString('base64'),
    mimeType: 'image/png',
    role: 'other',
    comment: vesselReferenceComment(option.promptName),
  }
}
