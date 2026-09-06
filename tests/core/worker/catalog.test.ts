import { describe, expect, it } from 'vitest'
import { getCatalog } from '../../../src/editor/core/worker/works/catalog'
import { EditorMode } from '../../../src/editor/dataset/enum/Editor'
import { ControlComponent } from '../../../src/editor/dataset/enum/Control'
import { TitleLevel } from '../../../src/editor/dataset/enum/Title'

describe('Catalog Worker getCatalog', () => {
  const titleId1 = 'title-1'
  const titleId2 = 'title-2'

  const elementList = [
    // 标题1：包含控件 {长沙市雨花区怡养康年老年养护院}
    {
      value: '\u200B',
      titleId: titleId1,
      level: TitleLevel.FIRST
    },
    {
      value: '{',
      controlComponent: ControlComponent.PREFIX,
      titleId: titleId1,
      level: TitleLevel.FIRST
    },
    {
      value: '长沙市雨花区怡养康年老年养护院',
      controlComponent: ControlComponent.VALUE,
      titleId: titleId1,
      level: TitleLevel.FIRST
    },
    {
      value: '}',
      controlComponent: ControlComponent.POSTFIX,
      titleId: titleId1,
      level: TitleLevel.FIRST
    },
    {
      value: '\n'
    },
    // 标题2：普通文本标题
    {
      value: '食品安全第三方风险评估报告',
      titleId: titleId2,
      level: TitleLevel.FIRST
    }
  ]

  const positionList = elementList.map(() => ({
    pageNo: 0,
    coordinate: {
      leftTop: [0, 0] as [number, number],
      rightTop: [0, 0] as [number, number],
      leftBottom: [0, 0] as [number, number],
      rightBottom: [0, 0] as [number, number]
    }
  })) as any

  it('在无痕编辑模式 (PREVIEW_EDIT) 下，目录标题不应该出现花括号', () => {
    const catalog = getCatalog({
      elementList,
      positionList,
      mode: EditorMode.PREVIEW_EDIT
    })

    expect(catalog).toBeTruthy()
    expect(catalog!.length).toBe(2)
    // 标题1的花括号被剥除
    expect(catalog![0].name).toBe('长沙市雨花区怡养康年老年养护院')
    // 标题2保持原样
    expect(catalog![1].name).toBe('食品安全第三方风险评估报告')
  })

  it('在清洁模式 (CLEAN) 下，目录标题也不出现花括号', () => {
    const catalog = getCatalog({
      elementList,
      positionList,
      mode: EditorMode.CLEAN
    })

    expect(catalog).toBeTruthy()
    expect(catalog![0].name).toBe('长沙市雨花区怡养康年老年养护院')
  })

  it('在打印模式 (PRINT) 下，目录标题不应该出现花括号', () => {
    const catalog = getCatalog({
      elementList,
      positionList,
      mode: EditorMode.PRINT
    })

    expect(catalog).toBeTruthy()
    expect(catalog!.length).toBe(2)
    // 标题1的花括号在打印模式下被剥除
    expect(catalog![0].name).toBe('长沙市雨花区怡养康年老年养护院')
    // 标题2保持原样
    expect(catalog![1].name).toBe('食品安全第三方风险评估报告')
  })

  it('在设计编辑模式 (EDIT) 下，目录标题同样绝对不应该出现花括号', () => {
    const catalog = getCatalog({
      elementList,
      positionList,
      mode: EditorMode.EDIT
    })

    expect(catalog).toBeTruthy()
    expect(catalog![0].name).toBe('长沙市雨花区怡养康年老年养护院')
  })

  it('在只读模式 (READONLY) 和表单模式 (FORM) 下，目录标题也绝对不出现花括号', () => {
    const catalogReadonly = getCatalog({
      elementList,
      positionList,
      mode: EditorMode.READONLY
    })
    expect(catalogReadonly![0].name).toBe('长沙市雨花区怡养康年老年养护院')

    const catalogForm = getCatalog({
      elementList,
      positionList,
      mode: EditorMode.FORM
    })
    expect(catalogForm![0].name).toBe('长沙市雨花区怡养康年老年养护院')
  })

  it('控件未填写（仅有占位符）时，目录标题保留占位符文本，但同样绝对不出现花括号', () => {
    const placeholderTitleId = 'title-placeholder'
    const placeholderElements = [
      {
        value: '\u200B',
        titleId: placeholderTitleId,
        level: TitleLevel.FIRST
      },
      {
        value: '{',
        controlComponent: ControlComponent.PREFIX,
        titleId: placeholderTitleId,
        level: TitleLevel.FIRST
      },
      {
        value: '请输入章节标题',
        controlComponent: ControlComponent.PLACEHOLDER,
        isPlaceholder: true,
        titleId: placeholderTitleId,
        level: TitleLevel.FIRST
      },
      {
        value: '}',
        controlComponent: ControlComponent.POSTFIX,
        titleId: placeholderTitleId,
        level: TitleLevel.FIRST
      }
    ]
    const placeholderPositions = placeholderElements.map(() => ({
      pageNo: 0,
      coordinate: {
        leftTop: [0, 0] as [number, number],
        rightTop: [0, 0] as [number, number],
        leftBottom: [0, 0] as [number, number],
        rightBottom: [0, 0] as [number, number]
      }
    })) as any

    // 在所有常见模式下进行校验
    const modes = [
      EditorMode.EDIT,
      EditorMode.PRINT,
      EditorMode.CLEAN,
      EditorMode.PREVIEW_EDIT,
      EditorMode.READONLY
    ]

    for (const testMode of modes) {
      const catalog = getCatalog({
        elementList: placeholderElements,
        positionList: placeholderPositions,
        mode: testMode
      })
      expect(catalog).toBeTruthy()
      expect(catalog![0].name).toBe('请输入章节标题')
    }
  })
})
