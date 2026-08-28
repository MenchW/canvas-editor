import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../factories/editor'
import { ControlType } from '../../../src/editor/dataset/enum/Control'
import { ElementType } from '../../../src/editor/dataset/enum/Element'
import { ControlComponent } from '../../../src/editor/dataset/enum/Control'

describe('图片控件与侧边栏优化验证', () => {
  it('图片控件有图片值时 formatElementList 绝对不渲染 PLACEHOLDER 文本节点', () => {
    const { editor, destroy } = createTestEditor({
      data: {
        main: [
          {
            type: ElementType.CONTROL,
            value: '',
            controlId: 'img-ctrl-test-1',
            control: {
              type: ControlType.IMAGE,
              conceptId: 'avatar',
              placeholder: '患者头像',
              value: [
                {
                  type: ElementType.IMAGE,
                  value: 'https://example.com/avatar.png',
                  width: 120,
                  height: 120
                }
              ]
            }
          }
        ]
      }
    })

    const originalList = (editor.command as any).getOriginalElementList()
    const placeholderEl = originalList.find(
      (el: any) =>
        el.controlId === 'img-ctrl-test-1' &&
        el.controlComponent === ControlComponent.PLACEHOLDER
    )
    expect(placeholderEl).toBeUndefined()
    destroy()
  })

  it('按 Backspace/Delete 命中图片控件时，执行 removeControl 整体销毁控件', () => {
    const { editor, destroy } = createTestEditor({
      data: {
        main: [
          {
            type: ElementType.CONTROL,
            value: '',
            controlId: 'img-ctrl-test-2',
            control: {
              type: ControlType.IMAGE,
              conceptId: 'avatar',
              placeholder: '患者头像',
              value: null
            }
          }
        ]
      }
    })

    let originalList = (editor.command as any).getOriginalElementList()
    const imgControlIndex = originalList.findIndex(
      (el: any) => el.controlId === 'img-ctrl-test-2'
    )
    expect(imgControlIndex).toBeGreaterThan(-1)

    // 触发整块删除
    editor.command.executeRemoveControl({ id: 'img-ctrl-test-2' })
    originalList = (editor.command as any).getOriginalElementList()
    const deletedEl = originalList.find(
      (el: any) => el.controlId === 'img-ctrl-test-2'
    )
    expect(deletedEl).toBeUndefined()
    destroy()
  })
})
