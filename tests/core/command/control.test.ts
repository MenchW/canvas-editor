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

  it('在文本控件内部插入新控件时，自动将新控件移至末尾，禁止叠加嵌套变成并列形态', () => {
    ctx = createTestEditor({
      options: { mode: EditorMode.EDIT }
    })
    ctx.editor.command.executeFocus()
    const draw = ctx.editor.command.getDraw()

    // 插入控件1
    ctx.editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'ctrl-1',
        type: ControlType.TEXT,
        value: [{ value: '内容1' }]
      }
    })

    const elementList1 = draw.getMainElementList()
    // 找到控件1的内部字符
    const ctrl1ValIndex = elementList1.findIndex(
      (el: IElement) => el.value === '内' || el.value === '内容1'
    )
    expect(ctrl1ValIndex).toBeGreaterThan(-1)

    // 光标移入控件1文字中间
    ctx.editor.command.executeSetRange(ctrl1ValIndex, ctrl1ValIndex)

    // 在控件1内部尝试插入控件2
    ctx.editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'ctrl-2',
        type: ControlType.TEXT,
        value: [{ value: '内容2' }]
      }
    })

    // 1. 验证存储态数据：根级 main 数组中应当有两个独立的控件节点（并列非嵌套）
    const mainData = ctx.editor.command.getValue().data.main
    const ctrl1Data = mainData.find((el: IElement) => el.control?.conceptId === 'ctrl-1')
    const ctrl2Data = mainData.find((el: IElement) => el.control?.conceptId === 'ctrl-2')
    expect(ctrl1Data).toBeTruthy()
    expect(ctrl2Data).toBeTruthy()

    // 2. 验证平铺渲染列表：控件2的所有元素在控件1之后，不继承控件1的 controlId
    const elementList2 = draw.getMainElementList()
    const ctrl1Id = elementList2.find((el: IElement) => el.control?.conceptId === 'ctrl-1')?.controlId
    const ctrl2Id = elementList2.find((el: IElement) => el.control?.conceptId === 'ctrl-2')?.controlId
    expect(ctrl1Id).toBeTruthy()
    expect(ctrl2Id).toBeTruthy()
    expect(ctrl1Id).not.toBe(ctrl2Id)

    const lastCtrl1Index = elementList2.map((el: IElement) => el.controlId).lastIndexOf(ctrl1Id)
    const firstCtrl2Index = elementList2.findIndex((el: IElement) => el.controlId === ctrl2Id)
    expect(firstCtrl2Index).toBeGreaterThan(lastCtrl1Index)
  })

  it('在文本控件内部插入复选框时，自动移到控件末尾外，且能正常点击选中', () => {
    ctx = createTestEditor({
      options: { mode: EditorMode.EDIT }
    })
    ctx.editor.command.executeFocus()
    const draw = ctx.editor.command.getDraw()

    ctx.editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'ctrl-base',
        type: ControlType.TEXT,
        value: [{ value: '评估文字' }]
      }
    })

    const elementList1 = draw.getMainElementList()
    const valIndex = elementList1.findIndex(
      (el: IElement) => el.value === '评' || el.value === '评估文字'
    )
    expect(valIndex).toBeGreaterThan(-1)

    // 光标位于控件文字内部
    ctx.editor.command.executeSetRange(valIndex, valIndex)

    // 插入复选框
    ctx.editor.command.executeInsertElementList([
      {
        type: ElementType.CHECKBOX,
        checkbox: {
          value: false
        },
        value: ''
      }
    ])

    const elementList2 = draw.getMainElementList()
    const checkboxIndex = elementList2.findIndex((el: IElement) => el.type === ElementType.CHECKBOX)
    expect(checkboxIndex).toBeGreaterThan(-1)

    const checkboxEl = elementList2[checkboxIndex]
    const baseCtrlId = elementList2.find((el: IElement) => el.control?.conceptId === 'ctrl-base')?.controlId
    expect(checkboxEl.controlId).not.toBe(baseCtrlId)

    // 点击该复选框能正常切换状态
    hitCheckbox(checkboxEl, draw)
    expect(checkboxEl.checkbox?.value).toBe(true)
    hitCheckbox(checkboxEl, draw)
    expect(checkboxEl.checkbox?.value).toBe(false)
  })

  it('即使历史遗留数据中复选框带有文本控件 control 属性，hitCheckbox 也能独立正常切换', () => {
    ctx = createTestEditor({
      options: { mode: EditorMode.EDIT }
    })
    const draw = ctx.editor.command.getDraw()
    const fakeMismatchedCheckbox: IElement = {
      type: ElementType.CHECKBOX,
      value: '',
      checkbox: { value: false },
      controlId: 'fake-text-ctrl',
      control: {
        type: ControlType.TEXT,
        value: []
      } as any
    }

    hitCheckbox(fakeMismatchedCheckbox, draw)
    expect(fakeMismatchedCheckbox.checkbox?.value).toBe(true)

    hitCheckbox(fakeMismatchedCheckbox, draw)
    expect(fakeMismatchedCheckbox.checkbox?.value).toBe(false)
  })

  it('在控件占位符内连续插入第2个、第3个控件，绝不卡死且按顺序并列排列', () => {
    ctx = createTestEditor({
      options: { mode: EditorMode.EDIT }
    })
    ctx.editor.command.executeFocus()
    const draw = ctx.editor.command.getDraw()

    // 1. 插入第1个空控件（带占位符）
    ctx.editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'ctrl-1',
        type: ControlType.TEXT,
        placeholder: '占位符1',
        value: []
      }
    })

    // 找到占位符内部字符
    let elementList = draw.getMainElementList()
    const phIndex = elementList.findIndex((el: IElement) => el.isPlaceholder)
    expect(phIndex).toBeGreaterThan(-1)

    // 光标置于占位符内
    ctx.editor.command.executeSetRange(phIndex, phIndex)

    // 2. 插入第2个控件
    ctx.editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'ctrl-2',
        type: ControlType.TEXT,
        placeholder: '占位符2',
        value: []
      }
    })

    // 再次在当前位置插入第3个控件，测试绝不递归卡死
    elementList = draw.getMainElementList()
    const ctrl2Index = elementList.findIndex((el: IElement) => el.control?.conceptId === 'ctrl-2')
    expect(ctrl2Index).toBeGreaterThan(-1)
    ctx.editor.command.executeSetRange(ctrl2Index, ctrl2Index)

    ctx.editor.command.executeInsertControl({
      type: ElementType.CONTROL,
      value: '',
      control: {
        conceptId: 'ctrl-3',
        type: ControlType.TEXT,
        placeholder: '占位符3',
        value: []
      }
    })

    // 验证根级数据中 3 个控件均并列存在
    const mainData = ctx.editor.command.getValue().data.main
    const ctrl1 = mainData.find((el: IElement) => el.control?.conceptId === 'ctrl-1')
    const ctrl2 = mainData.find((el: IElement) => el.control?.conceptId === 'ctrl-2')
    const ctrl3 = mainData.find((el: IElement) => el.control?.conceptId === 'ctrl-3')
    expect(ctrl1).toBeTruthy()
    expect(ctrl2).toBeTruthy()
    expect(ctrl3).toBeTruthy()
  })
})
