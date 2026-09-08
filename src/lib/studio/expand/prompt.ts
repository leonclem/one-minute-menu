import type { FlashAspectRatio } from './aspect'
import { DEFAULT_EXPAND_LAYOUT, type ExpandLayoutId } from './presets'

const PRESERVE = [
  'Widen the field of view as if reducing zoom on a camera phone: same photograph, more of the existing table and backdrop visible, the dish smaller in the frame.',
  "Keep this image's aspect ratio. Do not crop or expand into a different shape (for example do not turn a portrait into landscape, or a square into 16:9).",
  'Do not move, tilt, orbit, or walk the camera. The camera stays where it is; only the zoom / field of view changes.',
  'The photograph is already placed on a larger canvas of that same shape. Fill the transparent pixels by continuing the existing scene.',
  "Continue objects that already touch the original photograph's edge (plate or bowl rim, tablecloth, napkin, surface) naturally into the new area. Match their shape, colour, and material. Do not invent new objects.",
  'Keep the dish itself identical: food, plating, vessel, garnishes, portion, colour, texture, and lighting. Do not re-cook, re-plate, or restyle it.',
  'Do not add food, props, extra plates, cutlery, glasses, flowers, candles, hands, people, text, logos, or watermarks.',
].join(' ')

const DIRECTION: Record<ExpandLayoutId, string> = {
  all: 'Add the extra scene on every side. Keep the dish in the same place in the frame, just smaller.',
  left: 'Add extra scene mostly to the left of the dish. Continue a little matching table and backdrop above and below so the frame shape stays the same. Do not add extra scene to the right; the dish stays toward the right of the frame.',
  right: 'Add extra scene mostly to the right of the dish. Continue a little matching table and backdrop above and below so the frame shape stays the same. Do not add extra scene to the left; the dish stays toward the left of the frame.',
  top: 'Add extra scene mostly above the dish. Continue a little matching table and backdrop on the left and right so the frame shape stays the same. Do not add extra scene below; the dish stays toward the bottom of the frame.',
  bottom: 'Add extra scene mostly below the dish. Continue a little matching table and backdrop on the left and right so the frame shape stays the same. Do not add extra scene above; the dish stays toward the top of the frame.',
  top_left:
    'Add extra scene mostly above and to the left of the dish. Do not add extra scene below or to the right; the dish stays toward the bottom-right of the frame. Keep the frame shape the same.',
  top_right:
    'Add extra scene mostly above and to the right of the dish. Do not add extra scene below or to the left; the dish stays toward the bottom-left of the frame. Keep the frame shape the same.',
  bottom_left:
    'Add extra scene mostly below and to the left of the dish. Do not add extra scene above or to the right; the dish stays toward the top-right of the frame. Keep the frame shape the same.',
  bottom_right:
    'Add extra scene mostly below and to the right of the dish. Do not add extra scene above or to the left; the dish stays toward the top-left of the frame. Keep the frame shape the same.',
}

export function buildExpandScenePrompt(
  aspectRatio?: FlashAspectRatio,
  layout: ExpandLayoutId = DEFAULT_EXPAND_LAYOUT,
): string {
  const ratioLine = aspectRatio
    ? ` Emit the result as ${aspectRatio}, matching the source frame.`
    : ''
  return `${PRESERVE} ${DIRECTION[layout]}${ratioLine}`
}
