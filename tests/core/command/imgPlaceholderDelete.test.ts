import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../factories/editor'
import { ElementType } from '@/editor/dataset/enum/Element'
import { ControlType } from '@/editor/dataset/enum/Control'

describe('图片占位符删除行为', () => {
  it('删除图片占位符不应清空整个画布', () => {
    const { editor, destroy } = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })
    // 插入图片占位控件
    editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'avatar',
        type: ControlType.IMAGE,
        placeholder: '头像',
        value: null,
        width: 120,
        height: 120
      }
    })
    const before = editor.command.getValue()
    const beforeMain = before?.data?.main
    console.log(
      'BEFORE:',
      JSON.stringify(
        beforeMain?.map((el: any) => ({ type: el.type, value: el.value }))
      )
    )
    // 光标在占位符后,Backspace 删除占位符
    editor.command.executeBackspace()
    const after = editor.command.getValue()
    const afterMain = after?.data?.main
    console.log(
      'AFTER:',
      JSON.stringify(
        afterMain?.map((el: any) => ({ type: el.type, value: el.value }))
      )
    )
    // 全文不应被清空:至少保留首字符补偿元素
    expect(afterMain?.length).toBeGreaterThan(0)
    destroy()
  })
})
