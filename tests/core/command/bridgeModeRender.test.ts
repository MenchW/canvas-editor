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

  it('render 加载模板,setControlValueList 填充数据且不覆盖画布改动', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })
    const bridge = makeBridge(editor)
    const rpcOptions = {
      updateComponents: vi.fn(),
      setCustomConfig: vi.fn()
    }

    // 1. render:仅加载模板
    ;(bridge as any).executeRenderPayload(
      { template, businessData },
      rpcOptions
    )
    let original = (editor.command as any).getOriginalElementList()
    expect(
      original.find(
        (el: any) => el.control?.conceptId === 'avatar'
      )
    ).toBeDefined()
    expect(editor.command.getText().main).not.toContain('张三')

    // 2. setControlValueList: 填充占位符
    bridge.setControlValueList()
    original = (editor.command as any).getOriginalElementList()
    const imgEls = original.filter(
      (el: any) => el.type === ElementType.IMAGE
    )
    expect(imgEls.length).toBe(1)
    expect(imgEls[0].value).toBe('https://example.com/a.png')
    expect(imgEls[0].controlComponent).toBe(ControlComponent.VALUE)
    expect(editor.command.getText().main).toContain('张三')

    // 3. 重复调用 setControlValueList 仍正常工作
    bridge.setControlValueList()
    original = (editor.command as any).getOriginalElementList()
    expect(
      original.filter((el: any) => el.type === ElementType.IMAGE).length
    ).toBe(1)

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
