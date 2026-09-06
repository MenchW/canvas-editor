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

describe('表格单元格复选框+文本控件排版与输入测试', () => {
  it('检查一般风险后输入中文字符时的排版与换行情况', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const options = mergeOption(PAGE_OPTION)
    const tdValue: IElement[] = [
      {
        value: '',
        type: ElementType.CHECKBOX,
        font: '华文仿宋',
        rowMargin: 1.5,
        width: 24,
        checkbox: { value: false }
      },
      {
        value: '',
        type: ElementType.CONTROL,
        rowMargin: 1.5,
        control: {
          type: 'text' as any,
          listType: 'text',
          conceptId: 'riskLevelName',
          placeholder: 'rule.riskLevelName',
          prefix: '{',
          postfix: '}',
          value: [
            {
              value: '一般风险',
              type: 'text' as any,
              font: '华文仿宋',
              size: 21,
              color: '#000000',
              rowMargin: 1.5
            }
          ],
          font: '华文仿宋',
          size: 21
        }
      },
      {
        value: '：',
        font: '华文仿宋',
        size: 21,
        rowMargin: 1.5
      },
      {
        value: '',
        type: ElementType.CONTROL,
        rowMargin: 1.5,
        control: {
          type: 'text' as any,
          listType: 'text',
          conceptId: 'desc',
          placeholder: 'rule.desc',
          prefix: '{',
          postfix: '}',
          value: [
            {
              value: '关键项不符合 < 1项 且 得分 ≥ 85分',
              type: 'text' as any,
              font: '华文仿宋',
              size: 21,
              color: '#000000',
              rowMargin: 1.5
            }
          ],
          font: '华文仿宋',
          size: 21
        }
      }
    ]

    const tableElement: IElement = {
      type: ElementType.TABLE,
      value: '',
      colgroup: [{ width: 100 }, { width: 500 }],
      trList: [
        {
          height: 200,
          tdList: [
            { colspan: 1, rowspan: 1, value: [{ value: '风险级别' }] },
            {
              colspan: 1,
              rowspan: 1,
              value: tdValue
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

    const td = main[1].trList![0].tdList[1]
    console.log('初始格式化后的 td.value 元素个数:', td.value?.length)
    console.log(
      'td.value 概览:',
      td.value?.map((el, i) => ({
        i,
        val: el.value,
        type: el.type,
        width: el.width,
        controlComponent: el.controlComponent,
        controlId: el.controlId,
        rowFlex: el.rowFlex
      }))
    )

    // 找到 "分" 的位置
    const fenIdx = td.value!.findIndex(el => el.value === '分')
    console.log('分 的索引:', fenIdx)
    expect(fenIdx).toBeGreaterThan(0)

    // 找到结尾元素
    const lastIdx = td.value!.length - 1
    console.log('td.value 最后一个元素:', td.value![lastIdx])

    const position = draw.getPosition()
    position.setPositionContext({
      isTable: true,
      index: 1,
      trIndex: 0,
      tdIndex: 1,
      tdId: td.id,
      trId: tableElement.trList![0].id,
      tableId: tableElement.id
    })

    // 场景 1：光标在 "分" (index 31) 之后，即在控件内部输入 "这个文字不"
    draw.getRange().setRange(31, 31)
    draw.render({ curIndex: 31 })
    const cursorAgent = (draw as any).cursor.cursorAgent
    // 场景 2：在末尾主动按回车后输入
    // 重置上一次 IME 的时间，模拟主动回车
    ;(draw as any).canvasEvent.lastCompositionTime = 0
    ;(draw as any).canvasEvent.hasJustComposed = false

    const newLastIdx = td.value!.length - 1
    draw.getRange().setRange(newLastIdx, newLastIdx)
    cursorAgent._keyDown(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 }))

    ;(draw as any).canvasEvent.lastCompositionTime = 0
    ;(draw as any).canvasEvent.hasJustComposed = false

    for (const char of ['新', '起', '一', '行']) {
      cursorAgent._compositionstart()
      cursorAgent._input(new InputEvent('input', { isComposing: true, data: char }))
      cursorAgent._compositionend(new CompositionEvent('compositionend', { data: char }))
      ;(draw as any).canvasEvent.lastCompositionTime = 0
      ;(draw as any).canvasEvent.hasJustComposed = false
    }

    console.log('回车换行后 td.rowList 行数:', td.rowList?.length)
    td.rowList?.forEach((r, idx) => {
      console.log(`  Row ${idx}: width=${r.width}, elements="${r.elementList.map(e => e.value).join('')}"`)
    })

    // 验证场景 2 中 "新起一行" 必须全部排在同一行中，绝不出现一个字换一行
    const row1Text = td.rowList?.[1]?.elementList?.map(e => e.value).join('') || ''
    expect(row1Text).toContain('新起一行')
    expect(td.rowList?.length).toBe(2)
  })

  it('在包含 listType: "text" 的控件中通过中文输入法选词输入多字词组时，全词在同一行，绝不每个字换一行', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const options = mergeOption(PAGE_OPTION)
    const tdValue: IElement[] = [
      {
        value: '',
        type: ElementType.CONTROL,
        control: {
          type: 'text' as any,
          listType: 'text',
          conceptId: 'testListText',
          placeholder: '占位提示',
          prefix: '{',
          postfix: '}',
          value: [{ value: '初始' }]
        }
      }
    ]

    const tableElement: IElement = {
      type: ElementType.TABLE,
      value: '',
      colgroup: [{ width: 400 }],
      trList: [
        {
          height: 100,
          tdList: [{ colspan: 1, rowspan: 1, value: tdValue }]
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

    const td = main[1].trList![0].tdList[0]
    const position = draw.getPosition()
    position.setPositionContext({
      isTable: true,
      index: 1,
      trIndex: 0,
      tdIndex: 0,
      tdId: td.id,
      trId: tableElement.trList![0].id,
      tableId: tableElement.id
    })

    // 光标定位在 "始" 后面
    const shiIdx = td.value!.findIndex(el => el.value === '始')
    draw.getRange().setRange(shiIdx, shiIdx)
    draw.render({ curIndex: shiIdx })
    draw.getControl().initControl()

    const cursorAgent = (draw as any).cursor.cursorAgent

    // 中文输入法选词上屏 "你好"（两个汉字一次性输入）
    cursorAgent._compositionstart()
    cursorAgent._input(new InputEvent('input', { isComposing: true, data: 'nihao' }))
    cursorAgent._compositionend(new CompositionEvent('compositionend', { data: '你好' }))

    // 再次选词上屏 "世界"
    cursorAgent._compositionstart()
    cursorAgent._input(new InputEvent('input', { isComposing: true, data: 'shijie' }))
    cursorAgent._compositionend(new CompositionEvent('compositionend', { data: '世界' }))

    // 检查 td.rowList，所有文字必须连贯排在同一行，行数必须为 1
    expect(td.rowList?.length).toBe(1)
    const rowText = td.rowList?.[0]?.elementList.map(e => e.value).join('')
    expect(rowText).toContain('初始你好世界')
    expect(rowText).not.toContain('\n')
  })

  it('在仅有占位符的控件中打字时，占位符被完全清除，文字不会混在占位符里', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const options = mergeOption(PAGE_OPTION)
    const tdValue: IElement[] = [
      {
        value: '',
        type: ElementType.CONTROL,
        control: {
          type: 'text' as any,
          listType: 'text',
          conceptId: 'testPlaceholder',
          placeholder: '请在此输入内容',
          prefix: '{',
          postfix: '}',
          value: null
        }
      }
    ]

    const tableElement: IElement = {
      type: ElementType.TABLE,
      value: '',
      colgroup: [{ width: 400 }],
      trList: [
        {
          height: 100,
          tdList: [{ colspan: 1, rowspan: 1, value: tdValue }]
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

    const td = main[1].trList![0].tdList[0]
    const position = draw.getPosition()
    position.setPositionContext({
      isTable: true,
      index: 1,
      trIndex: 0,
      tdIndex: 0,
      tdId: td.id,
      trId: tableElement.trList![0].id,
      tableId: tableElement.id
    })

    // 光标点在占位符中间（如 "此" 字处）
    const ciIdx = td.value!.findIndex(el => el.value === '此')
    expect(ciIdx).toBeGreaterThan(0)
    draw.getRange().setRange(ciIdx, ciIdx)
    draw.render({ curIndex: ciIdx })
    draw.getControl().initControl()

    const cursorAgent = (draw as any).cursor.cursorAgent

    // 输入 "正式内容"
    cursorAgent._compositionstart()
    cursorAgent._input(new InputEvent('input', { isComposing: true, data: 'zhenshi' }))
    cursorAgent._compositionend(new CompositionEvent('compositionend', { data: '正式内容' }))

    console.log('测试3 td.value 元素列表:', td.value?.map(e => ({ val: e.value, comp: e.controlComponent, isP: e.isPlaceholder })))
    // 检查元素中是否还残留任何 PLACEHOLDER 元素
    const hasAnyPlaceholder = td.value!.some(
      el => el.controlComponent === 'placeholder' || el.isPlaceholder === true
    )
    expect(hasAnyPlaceholder).toBe(false)

    // 行内文字应只包含前缀、正式内容与后缀
    const allText = td.value!.map(e => e.value).join('')
    expect(allText).toContain('正式内容')
    expect(allText).not.toContain('请在此输入内容')
    expect(allText).not.toContain('请在')
  })

  it('打字上屏后按下单次 Enter 键应立即换行，无需按两下', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const options = mergeOption(PAGE_OPTION)
    const tdValue: IElement[] = [
      {
        value: '',
        type: ElementType.CONTROL,
        control: {
          type: 'text' as any,
          listType: 'text',
          conceptId: 'desc',
          placeholder: '请输入',
          prefix: '{',
          postfix: '}',
          value: [{ value: '旧文字', type: 'text' as any }]
        }
      }
    ]
    const tableElement: IElement = {
      type: ElementType.TABLE,
      value: '',
      colgroup: [{ width: 400 }],
      trList: [{ height: 100, tdList: [{ colspan: 1, rowspan: 1, value: tdValue }] }]
    }
    const main = [tableElement]
    formatElementList(main, { editorOptions: options, isForceCompensation: true })
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

    const td = main[1].trList![0].tdList[0]
    draw.getPosition().setPositionContext({
      isTable: true,
      index: 1,
      trIndex: 0,
      tdIndex: 0,
      tdId: td.id,
      trId: tableElement.trList![0].id,
      tableId: tableElement.id
    })
    const cursorAgent = (draw as any).cursor.cursorAgent

    // 光标定在旧文字末尾
    const lastCharIdx = td.value!.findIndex(el => el.value === '字')
    draw.getRange().setRange(lastCharIdx, lastCharIdx)
    draw.render({ curIndex: lastCharIdx })
    draw.getControl().initControl()

    // 模拟输入 "你好"
    cursorAgent._compositionstart()
    cursorAgent._compositionend(new CompositionEvent('compositionend', { data: '你好' }))

    // 此时 td.value 中包含 "旧文字你好"
    const textBeforeEnter = td.value!.map(e => e.value).join('')
    expect(textBeforeEnter).toContain('旧文字你好')

    // 模拟人类在打字完成后按 Enter 键换行（等待 45ms 模拟人类间隔）
    await new Promise(resolve => setTimeout(resolve, 45))
    const enterEvt = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, code: 'Enter' })
    enterEvt.preventDefault = () => {}

    const initialElementCount = td.value!.length
    cursorAgent._keyDown(enterEvt)

    // 验证：第一次按下 Enter 键后，应该成功触发换行（元素数量增加，包含换行 ZERO (\u200B) 符）
    expect(td.value!.length).toBeGreaterThan(initialElementCount)
    const hasZeroEnter = td.value!.some(el => el.value === '\u200B')
    expect(hasZeroEnter).toBe(true)
  })
})
