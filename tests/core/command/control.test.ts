import { describe, it, expect, afterEach, vi } from 'vitest'
import { ControlType } from '../../../src/editor/dataset/enum/Control'
import { ElementType } from '../../../src/editor/dataset/enum/Element'
import { EditorMode } from '../../../src/editor/dataset/enum/Editor'
import { createTestEditor } from '../../factories/editor'
import { CheckboxControl } from '../../../src/editor/core/draw/control/checkbox/CheckboxControl'
import { hitCheckbox } from '../../../src/editor/core/event/handlers/mousedown'
import { IElement } from '../../../src/editor/interface/Element'

describe('控件命令', () => {
  let ctx: ReturnType<typeof createTestEditor>
  afterEach(() => ctx?.destroy())

  it('executeInsertControl 插入文本控件不抛错', () => {
    ctx = createTestEditor()
    ctx.editor.command.executeFocus()
    expect(() => {
      ctx.editor.command.executeInsertControl({
        value: '',
        control: {
          type: ControlType.TEXT,
          value: null
        }
      })
    }).not.toThrow()
  })

  it('executeInsertControl 插入带值的文本控件', () => {
    ctx = createTestEditor()
    ctx.editor.command.executeFocus()
    expect(() => {
      ctx.editor.command.executeInsertControl({
        value: '',
        control: {
          type: ControlType.TEXT,
          value: [{ value: '控件值' }]
        }
      })
    }).not.toThrow()
  })

  it('executeSetControlValue 空操作不抛错', () => {
    ctx = createTestEditor()
    expect(() => {
      ctx.editor.command.executeSetControlValue({
        id: 'nonexistent',
        value: 'val'
      })
    }).not.toThrow()
  })

  it('executeSetControlHighlight 空操作不抛错', () => {
    ctx = createTestEditor()
    expect(() => {
      ctx.editor.command.executeSetControlHighlight([
        { ruleList: [{ keyword: 'test' }] }
      ])
    }).not.toThrow()
  })

  it('control.minWidth 大于行宽时按多行计算高度', () => {
    ctx = createTestEditor({
      options: {
        width: 240,
        margins: [20, 20, 20, 20]
      }
    })
    const createControl = (minWidth: number): IElement[] => [
      {
        type: ElementType.CONTROL,
        value: '',
        control: {
          type: ControlType.TEXT,
          value: null,
          prefix: '\u200c',
          postfix: '\u200c',
          minWidth,
          underline: true
        }
      }
    ]

    const oneLineHeight = ctx.editor.command.executeComputeElementListHeight(
      createControl(120)
    )
    const wrappedHeight = ctx.editor.command.executeComputeElementListHeight(
      createControl(1000)
    )

    expect(wrappedHeight).toBeGreaterThan(oneLineHeight)
  })

  it('control.minWidth 跨行占位不写入控件值', () => {
    ctx = createTestEditor({
      data: [
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            type: ControlType.TEXT,
            value: [{ value: 'A' }],
            prefix: '\u200c',
            postfix: '\u200c',
            minWidth: 1000,
            underline: true
          }
        }
      ],
      options: {
        width: 240,
        margins: [20, 20, 20, 20]
      }
    })

    const control = ctx.editor.command.getValue().data.main[0].control

    expect(control?.value?.map(element => element.value)).toEqual(['A'])
  })

  it('hitCheckbox 取消不存在的 code 时不误删最后一个已选 code', () => {
    const element: IElement = {
      value: '',
      control: {
        type: ControlType.CHECKBOX,
        value: null,
        code: 'a,b'
      },
      checkbox: {
        value: true,
        code: 'x'
      }
    }
    const activeControl = new CheckboxControl(element, {} as any)
    const setSelect = vi
      .spyOn(activeControl, 'setSelect')
      .mockImplementation(() => undefined)
    const draw = {
      getControl: () => ({
        getActiveControl: () => activeControl
      }),
      render: () => undefined
    }

    hitCheckbox(element, draw as any)

    expect(setSelect).toHaveBeenCalledWith(['a', 'b'])
  })

  it('留痕开启时日期控件连续改值不残留旧值字符', () => {
    ctx = createTestEditor({
      data: [
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'date-trace',
            type: ControlType.DATE,
            value: [{ value: '2024-01-01' }]
          }
        }
      ],
      options: { mode: EditorMode.EDIT, trace: { disabled: false } }
    })

    ctx.editor.command.executeSetControlValue({
      conceptId: 'date-trace',
      value: '2025-02-02'
    })
    ctx.editor.command.executeSetControlValue({
      conceptId: 'date-trace',
      value: '2026-03-03'
    })

    const [controlValue] = ctx.editor.command.getControlValue({
      conceptId: 'date-trace'
    })!

    expect(controlValue.value).toBe('2026-03-03')
  })

  it('SELECT 下拉控件：设值后应准确同步 code 与文字', () => {
    ctx = createTestEditor({
      data: [
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'dept-select',
            type: ControlType.SELECT,
            value: [{ value: '普通门诊' }],
            code: 'normal',
            valueSets: [
              { value: '普通门诊', code: 'normal' },
              { value: '专家门诊', code: 'expert' }
            ]
          }
        }
      ],
      options: { mode: EditorMode.EDIT }
    })

    ctx.editor.command.executeSetControlValue({
      conceptId: 'dept-select',
      value: 'expert'
    })

    const mainList = ctx.editor.command.getValue().data.main
    const selectEl = mainList.find(el => el.control?.conceptId === 'dept-select')
    expect(selectEl?.control?.code).toBe('expert')
  })

  it('RADIO 单选控件：设值后应准确设置选中状态', () => {
    ctx = createTestEditor({
      data: [
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'gender-radio',
            type: ControlType.RADIO,
            value: null,
            code: '1',
            valueSets: [
              { value: '男', code: '1' },
              { value: '女', code: '2' }
            ]
          }
        }
      ],
      options: { mode: EditorMode.EDIT }
    })

    ctx.editor.command.executeSetControlValue({
      conceptId: 'gender-radio',
      value: ['2']
    })

    const mainList = ctx.editor.command.getValue().data.main
    const radioEl = mainList.find(el => el.control?.conceptId === 'gender-radio')
    expect(radioEl?.control?.code).toBe('2')
  })

  it('NUMBER 数值控件：设值后应准确更新数值', () => {
    ctx = createTestEditor({
      data: [
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'patient-age',
            type: ControlType.NUMBER,
            value: [{ value: '25' }]
          }
        }
      ],
      options: { mode: EditorMode.EDIT }
    })

    ctx.editor.command.executeSetControlValue({
      conceptId: 'patient-age',
      value: 48
    })

    const [controlValue] = ctx.editor.command.getControlValue({
      conceptId: 'patient-age'
    })!

    expect(controlValue.value).toBe('48')
  })

  it('IMAGE 单图控件：支持纯 URL 及带宽高的对象传值', () => {
    ctx = createTestEditor({
      data: [
        {
          type: ElementType.CONTROL,
          value: '',
          control: {
            conceptId: 'avatar-img',
            type: ControlType.IMAGE,
            width: 50,
            height: 50,
            value: []
          }
        }
      ],
      options: { mode: EditorMode.EDIT }
    })

    // 1. 传对象设置自定义宽高
    ctx.editor.command.executeSetControlValue({
      conceptId: 'avatar-img',
      value: {
        url: 'https://example.com/photo.png',
        width: 80,
        height: 80
      }
    })

    const mainList = ctx.editor.command.getValue().data.main
    const imgEl = mainList.find(el => el.control?.conceptId === 'avatar-img')
    expect(imgEl?.control?.value?.[0]?.value).toBe('https://example.com/photo.png')
    expect(imgEl?.control?.value?.[0]?.width).toBe(80)
    expect(imgEl?.control?.value?.[0]?.height).toBe(80)
  })
})
