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

  it('在设计编辑模式 (EDIT) 下，保留控件前后缀用于设计态提示', () => {
    const catalog = getCatalog({
      elementList,
      positionList,
      mode: EditorMode.EDIT
    })

    expect(catalog).toBeTruthy()
    expect(catalog![0].name).toBe('{长沙市雨花区怡养康年老年养护院}')
  })
})
