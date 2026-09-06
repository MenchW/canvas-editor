import { describe, it, expect } from 'vitest'
import { Draw } from '@/editor/core/draw/Draw'
import { EventBus } from '@/editor/core/event/eventbus/EventBus'
import { Listener } from '@/editor/core/listener/Listener'
import { Override } from '@/editor/core/override/Override'
import { mergeOption } from '@/editor/utils/option'
import { formatElementList } from '@/editor/utils/element'
import { ElementType } from '@/editor/dataset/enum/Element'
import { EditorMode } from '@/editor/dataset/enum/Editor'
import { IElement } from '@/editor/interface/Element'

const PAGE_OPTION = {
  width: 794,
  height: 1123,
  margins: [100, 120, 100, 120] as [number, number, number, number],
  header: { disabled: true },
  footer: { disabled: true }
}

function createTableEditor(): Draw {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const options = mergeOption(PAGE_OPTION)
  const tableElement: IElement = {
    type: ElementType.TABLE,
    value: '',
    colgroup: [{ width: 100 }, { width: 400 }],
    trList: [
      {
        height: 200,
        tdList: [
          { colspan: 1, rowspan: 1, value: [{ value: '风险级别' }] },
          {
            colspan: 1,
            rowspan: 1,
            value: [
              {
                value: '',
                type: ElementType.CHECKBOX,
                width: 24,
                checkbox: { value: true }
              },
              {
                value: '',
                type: ElementType.CONTROL,
                control: {
                  type: 'text' as any,
                  value: [{ value: '重大风险：关键项不符合 ≥ 1项 或 得分 < 70分' }]
                }
              },
              { value: '\n' },
              {
                value: '',
                type: ElementType.CHECKBOX,
                width: 24,
                checkbox: { value: false }
              },
              {
                value: '',
                type: ElementType.CONTROL,
                control: {
                  type: 'text' as any,
                  value: [{ value: '一般风险：关键项不符合 < 1项 且 得分 ≥ 85分' }]
                }
              }
            ]
          }
        ]
      }
    ]
  }
  const main = [tableElement]
  formatElementList(main, {
    editorOptions: options,
    isForceCompensation: true
  })
  const draw = new Draw(
    container,
    options,
    { header: [{ value: '\n' }], main, footer: [{ value: '\n' }] },
    new Listener(),
    new EventBus(),
    new Override()
  )
  draw.setMode(EditorMode.EDIT)
  draw.render()
  return draw
}

describe('中文输入在表格单元格测试', () => {
  it('模拟中文输入法连续输入词汇时，确认按键绝不误触发换行，且主动回车正常换行', async () => {
    const draw = createTableEditor()
    draw.setMode(EditorMode.EDIT)
    const tableEl = draw.getMainElementList()[1]
    const td = tableEl.trList![0].tdList[1]
    const position = draw.getPosition()
    position.setPositionContext({
      isTable: true,
      index: 1,
      trIndex: 0,
      tdIndex: 1,
      tdId: td.id,
      trId: tableEl.trList![0].id,
      tableId: tableEl.id
    })
    const lastIdx = td.value!.length - 1
    draw.getRange().setRange(lastIdx, lastIdx)
    position.setCursorPosition({
      pageNo: 0,
      index: lastIdx,
      value: td.value![lastIdx].value,
      rowIndex: 0,
      rowNo: 0,
      ascent: 0,
      lineHeight: 16,
      left: 0,
      metrics: { width: 1, height: 16, boundingBoxAscent: 0, boundingBoxDescent: 0 },
      isFirstLetter: false,
      isLastLetter: true,
      coordinate: {
        leftTop: [0, 0],
        leftBottom: [0, 16],
        rightTop: [1, 0],
        rightBottom: [1, 16]
      }
    })
    
    const cursorAgent = (draw as any).cursor.cursorAgent
    
    // 1. 输入 "这"
    cursorAgent._compositionstart()
    cursorAgent._input(new InputEvent('input', { isComposing: true, data: 'zhe' }))
    cursorAgent._compositionend(new CompositionEvent('compositionend', { data: '这' }))
    cursorAgent._keyDown(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 }))
    
    // 2. 输入 "是一"
    cursorAgent._compositionstart()
    cursorAgent._input(new InputEvent('input', { isComposing: true, data: 'shiyi' }))
    cursorAgent._compositionend(new CompositionEvent('compositionend', { data: '是一' }))
    cursorAgent._keyDown(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 }))
    
    // 3. 输入 "段"
    cursorAgent._compositionstart()
    cursorAgent._input(new InputEvent('input', { isComposing: true, data: 'duan' }))
    cursorAgent._compositionend(new CompositionEvent('compositionend', { data: '段' }))
    cursorAgent._keyDown(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 }))
    
    // 检查新增的元素
    const newElements = td.value!.slice(lastIdx + 1)
    const newValues = newElements.map(e => e.value)
    console.log('新增文本元素值:', newValues)
    
    // 断言：新增元素纯净为 ['这', '是', '一', '段']，中间绝无任何 ZERO 换行符
    expect(newValues).toEqual(['这', '是', '一', '段'])
    expect(newElements.some(e => e.value === '\u200B')).toBe(false)
    
    // 4. 用户打完字后，主动按一次真正的回车键（非 IME 期间，且距离 composition 超过 150ms）
    await new Promise(r => setTimeout(r, 150))
    cursorAgent._keyDown(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 }))
    
    // 断言：主动回车后，成功插入了一个换行符
    const afterEnterElements = td.value!.slice(lastIdx + 1)
    console.log('主动按 Enter 后文本元素值:', afterEnterElements.map(e => e.value))
    expect(afterEnterElements.some(e => e.value === '\u200B')).toBe(true)
  })
})
