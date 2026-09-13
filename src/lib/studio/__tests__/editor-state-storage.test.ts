/**
 * @jest-environment node
 */

import { CENTER } from '@/lib/photo-control/minimal-schema'
import { editorStateToMetadata, readEditorStateFromMetadata } from '../editor-state-storage'

describe('editor-state-storage', () => {
  it('treats a persisted 90° yaw as already applied on the working shot', () => {
    const stored = editorStateToMetadata({
      schema: {
        scene_setup: {
          angle: '45-degree',
          framing: 'close-up',
          lighting: 'soft-natural',
          spin: 'left-90',
        },
        canvas: {
          background: '',
          background_style: '',
          surface_style: '',
          main_vessel: 'plate',
        },
        food_components: { main_item: 'churros', garnishes: [], sides: [] },
      },
      position: { ...CENTER },
    })

    const restored = readEditorStateFromMetadata({ editorState: stored })
    expect(restored?.schema.scene_setup.spin).toBe('0')
    expect(restored?.schema.scene_setup.angle).toBe('45-degree')
  })

  it('treats persisted 45° spin as already applied on the working shot', () => {
    const restored = readEditorStateFromMetadata({
      editorState: {
        schema: {
          scene_setup: {
            angle: '45-degree',
            framing: 'close-up',
            lighting: 'soft-natural',
            spin: 'left-45',
          },
          canvas: {
            background: '',
            background_style: '',
            surface_style: '',
            main_vessel: 'plate',
          },
          food_components: { main_item: 'churros', garnishes: [], sides: [] },
        },
        position: { ...CENTER },
      },
    })
    expect(restored?.schema.scene_setup.spin).toBe('0')
  })
})
