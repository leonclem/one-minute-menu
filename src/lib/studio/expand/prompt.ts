import type { FlashAspectRatio } from './aspect'

const PRESERVE = [
  'Widen the field of view as if reducing zoom on a camera phone: same photograph, more of the existing table and backdrop visible, the dish smaller in the frame.',
  "Keep this image's aspect ratio. Do not crop or expand into a different shape (for example do not turn a portrait into landscape, or a square into 16:9).",
  'Do not move, tilt, orbit, or walk the camera. The camera stays where it is; only the zoom / field of view changes.',
  'The photograph is already placed on a larger canvas of that same shape. Fill the transparent pixels by continuing the existing scene.',
  "Continue objects that already touch the original photograph's edge (plate or bowl rim, tablecloth, napkin, surface) naturally into the new area. Match their shape, colour, and material. Do not invent new objects.",
  'Keep the dish itself identical: food, plating, vessel, garnishes, portion, colour, texture, and lighting. Do not re-cook, re-plate, or restyle it.',
  'Do not add food, props, extra plates, cutlery, glasses, flowers, candles, hands, people, text, logos, or watermarks.',
].join(' ')

const ALL_SIDES =
  'Add the extra scene on every side. Keep the dish in the same place in the frame, just smaller.'

export function buildExpandScenePrompt(aspectRatio?: FlashAspectRatio): string {
  const ratioLine = aspectRatio
    ? ` Emit the result as ${aspectRatio}, matching the source frame.`
    : ''
  return `${PRESERVE} ${ALL_SIDES}${ratioLine}`
}
