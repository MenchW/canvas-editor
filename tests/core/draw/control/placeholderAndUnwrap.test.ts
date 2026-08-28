import { describe, expect, it } from 'vitest'
import { ZERO } from '../../../../src/editor/dataset/constant/Common'
import { ControlComponent, ControlType } from '../../../../src/editor/dataset/enum/Control'
import { EditorMode } from '../../../../src/editor/dataset/enum/Editor'
import { ElementType } from '../../../../src/editor/dataset/enum/Element'
import { createTestEditor } from '../../../factories/editor'

describe('控件占位符与无痕编辑单次退格穿透测试', () => {
  it('未回显/未勾选的 Checkbox 控件应仅渲染占位符，不展开选项数据', () => {
    const { editor, destroy } = createTestEditor()
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'informed.consent',
        type: ControlType.CHECKBOX,
        value: null,
        placeholder: '知情同意书勾选',
        valueSets: [
          { value: '1. 已知悉诊疗方案与风险', code: 'opt1' },
          { value: '2. 已完成术前传染病筛查', code: 'opt2' }
        ]
      }
    })

    const elementList = (editor.command as any).getOriginalElementList()
    // 验证：应渲染占位符组件，不应渲染各选项的 checkbox 方块
    const hasPlaceholder = elementList.some(
      (el: any) =>
        el.controlComponent === ControlComponent.PLACEHOLDER &&
        el.value === '知'
    )
    const hasCheckboxBox = elementList.some(
      (el: any) => el.controlComponent === ControlComponent.CHECKBOX
    )

    expect(hasPlaceholder).toBe(true)
    expect(hasCheckboxBox).toBe(false)
    destroy()
  })

  it('无痕编辑模式下光标在末端按 1 次 Backspace 即可删除文字，无需删除两次', () => {
    const { editor, destroy } = createTestEditor()
    // 插入带回显文本的控件
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'diagnosis',
        type: ControlType.TEXT,
        placeholder: '诊断',
        value: [{ value: '支气管炎' }]
      }
    })

    // 切换到无痕编辑模式
    editor.command.executeMode(EditorMode.PREVIEW_EDIT)

    const listBefore = (editor.command as any).getOriginalElementList()
    const lastIndex = listBefore.length - 1
    editor.command.executeSetRange(lastIndex, lastIndex)

    // 按 1 次退格键
    editor.command.executeBackspace()

    const listAfter = (editor.command as any).getOriginalElementList()
    const textValues = listAfter.map((el: any) => el.value).join('')
    // 验证：末尾汉字“炎”已被成功删除，剩余“支气管”
    expect(textValues).toContain('支气管')
    expect(textValues).not.toContain('支气管炎')
    destroy()
  })

  it('占位符态的 Checkbox 控件在通过 setControlValueList 下发回显数据后应自动展开并勾选', () => {
    const { editor, destroy } = createTestEditor()
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'informed.consent',
        type: ControlType.CHECKBOX,
        value: null,
        placeholder: '知情同意书勾选',
        valueSets: [
          { value: '1. 已知悉诊疗方案与风险', code: 'opt1' },
          { value: '2. 已完成术前传染病筛查', code: 'opt2' }
        ]
      }
    })

    // 下发回显数据（勾选 opt1）
    editor.command.executeSetControlValueList([
      { conceptId: 'informed.consent', value: 'opt1' }
    ])

    const elementList = (editor.command as any).getOriginalElementList()
    // 验证：此时已展开为 checkbox，且 opt1 为 true，opt2 为 false
    const checkboxes = elementList.filter(
      (el: any) => el.controlComponent === ControlComponent.CHECKBOX
    )
    expect(checkboxes.length).toBe(2)
    expect(checkboxes[0].checkbox.value).toBe(true)
    expect(checkboxes[1].checkbox.value).toBe(false)
    destroy()
  })

  it('Checkbox 在填充数据后的无痕模式下能够正常进行回车换行', () => {
    const { editor, destroy } = createTestEditor()
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'informed.consent',
        type: ControlType.CHECKBOX,
        value: null,
        placeholder: '知情同意书勾选',
        valueSets: [
          { value: '1. 已知悉诊疗方案与风险', code: 'opt1' },
          { value: '2. 已完成术前传染病筛查', code: 'opt2' }
        ]
      }
    })

    // 回显数据
    editor.command.executeSetControlValueList([
      { conceptId: 'informed.consent', value: 'opt1' }
    ])

    // 切换到无痕编辑模式
    editor.command.executeMode(EditorMode.PREVIEW_EDIT)

    // 定位光标在第一个选项末尾
    const listBefore = (editor.command as any).getOriginalElementList()
    const targetIndex = listBefore.findIndex((el: any) => el.value === '险')
    expect(targetIndex).toBeGreaterThan(0)
    editor.command.executeSetRange(targetIndex, targetIndex)

    // 触发回车换行（模拟 Enter 键）
    const agentDom = document.querySelector(
      '.ce-inputarea'
    ) as HTMLTextAreaElement
    const keydownEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    })
    agentDom.dispatchEvent(keydownEvent)

    const listAfter = (editor.command as any).getOriginalElementList()
    // 验证：成功在目标位置插入了换行符 ZERO
    const insertedWrap = listAfter[targetIndex + 1]
    expect(insertedWrap).toBeDefined()
    expect(insertedWrap.value).toBe(ZERO)
    destroy()
  })
})
