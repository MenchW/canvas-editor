import { describe, expect, it, vi } from 'vitest'
import { createTestEditor } from '../../factories/editor'
import { EditorBridge } from '@/bridge/editorBridge'
import { ElementType } from '@/editor/dataset/enum/Element'
import { ControlComponent, ControlType } from '@/editor/dataset/enum/Control'

describe('EditorBridge 控件数据填充 (setControlValueList / fillData)', () => {
  function makeBridge(editor: any) {
    return new EditorBridge({
      instance: editor,
      updateComponents: vi.fn(),
      setCustomConfig: vi.fn()
    })
  }

  const template = {
    main: [
      { value: '姓名:' },
      {
        type: ElementType.CONTROL,
        value: '',
        controlId: 'txt-1',
        control: {
          type: ControlType.TEXT,
          conceptId: 'name',
          placeholder: '患者姓名',
          value: null
        }
      },
      { value: '\n头像:' },
      {
        type: ElementType.CONTROL,
        value: '',
        controlId: 'img-1',
        control: {
          type: ControlType.IMAGE,
          conceptId: 'avatar',
          placeholder: '患者头像',
          value: null,
          width: 120,
          height: 120
        }
      }
    ]
  }
  const businessData = { name: '张三', avatar: 'https://example.com/a.png' }

  it('render 传入 businessData 时自动回显数据，setControlValueList 可追加补充', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })
    const bridge = makeBridge(editor)
    const rpcOptions = {
      updateComponents: vi.fn(),
      setCustomConfig: vi.fn()
    }

    // 1. render 携带 businessData 时直接自动回显
    ;(bridge as any).executeRenderPayload(
      { template, businessData },
      rpcOptions
    )
    const original = (editor.command as any).getOriginalElementList()
    const imgEls = original.filter(
      (el: any) => el.type === ElementType.IMAGE
    )
    expect(imgEls.length).toBe(1)
    expect(imgEls[0].value).toBe('https://example.com/a.png')
    expect(imgEls[0].controlComponent).toBe(ControlComponent.VALUE)
    expect(editor.command.getText().main).toContain('张三')

    // 2. setControlValueList 可继续追加/覆盖数据
    bridge.setControlValueList({ name: '李四' })
    expect(editor.command.getText().main).toContain('李四')

    destroy()
  })

  it('未下发 businessData 时 setControlValueList 不崩溃', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })
    const bridge = makeBridge(editor)
    ;(bridge as any).executeRenderPayload(
      { template },
      { updateComponents: vi.fn(), setCustomConfig: vi.fn() }
    )
    expect(() => bridge.setControlValueList()).not.toThrow()
    destroy()
  })
})
