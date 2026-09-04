import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../factories/editor'
import { ElementType } from '@/editor/dataset/enum/Element'

describe('跨页表格第二页末尾单元格点击光标定位测试', () => {
  it('当表格跨页时，点击第二页表格末尾空白区域应精准聚焦在第二页对应的单元格内，绝不跳回第一页', () => {
    // 构造一个行数多、高度大的跨页表格
    const trList: any[] = []
    for (let r = 0; r < 25; r++) {
      trList.push({
        height: 60,
        tdList: [
          {
            colspan: 1,
            rowspan: 1,
            value: [{ value: `Row-${r}-Col-0` }]
          },
          {
            colspan: 1,
            rowspan: 1,
            value: [{ value: `Row-${r}-Col-1` }]
          }
        ]
      })
    }

    const { editor, destroy } = createTestEditor({
      data: {
        main: [
          {
            type: ElementType.TABLE,
            value: '',
            trList
          }
        ]
      },
      options: {
        width: 600,
        height: 600
      }
    })

    const draw = editor.command.getDraw()
    const position = draw.getPosition()
    const pageCount = draw.getPageCount()

    // 验证表格确实产生了跨页
    expect(pageCount).toBeGreaterThan(1)

    // 在第 2 页 (pageNo = 1) 上模拟点击第二页末尾单元格 (比如最下面的一行)
    // 查找第 2 页上表格片段的位置信息
    const page1Positions = (position as any).tablePagingPositionMap.get(1) || []
    expect(page1Positions.length).toBeGreaterThan(0)

    const fragmentPos = page1Positions[0]
    const { rightTop, leftBottom } = fragmentPos.coordinate

    // 1. 点击在第二页表格片段内部右下角
    const clickX = rightTop[0] - 20
    const clickY = leftBottom[1] - 15

    const clickPosition = position.getPositionByXY({
      x: clickX,
      y: clickY,
      pageNo: 1
    })

    // 断言：点击必须成功命中表格内部（isTable 为 true），且命中在第二页上的后半部分行，绝不能返回 -1 或第一页
    expect(clickPosition.isTable).toBe(true)
    expect(clickPosition.trIndex).toBeGreaterThan(10) // 应处于表格后半部分行
    expect(clickPosition.tdIndex).toBe(1) // 应处于第 2 列单元格

    // 2. 点击在第二页表格下方空白区域（红框位置，y > leftBottom[1]）：应生成表格后的正文光标，以便换行输入，绝不能聚焦在表格单元格内
    const belowClickPosition = position.getPositionByXY({
      x: rightTop[0] - 20,
      y: leftBottom[1] + 30,
      pageNo: 1
    })
    expect(belowClickPosition.isTable).toBeFalsy()
    expect(belowClickPosition.index).toBeGreaterThanOrEqual(0)

    // 3. 点击在第二页表格右侧空白区域（x > rightTop[0]）
    const rightClickPosition = position.getPositionByXY({
      x: rightTop[0] + 30,
      y: leftBottom[1] - 15,
      pageNo: 1
    })
    expect(rightClickPosition.isTable).toBe(true)
    expect(rightClickPosition.trIndex).toBeGreaterThan(10)
    expect(rightClickPosition.tdIndex).toBe(1)

    destroy()
  })

  it('当跨页表格下方存在普通段落或文档结尾时，点击页面下方空白区域应精准聚焦在表格后正文段落', () => {
    const trList: any[] = []
    for (let r = 0; r < 25; r++) {
      trList.push({
        height: 60,
        tdList: [
          {
            colspan: 1,
            rowspan: 1,
            value: [{ value: `Row-${r}` }]
          }
        ]
      })
    }

    const { editor, destroy } = createTestEditor({
      data: {
        main: [
          {
            type: ElementType.TABLE,
            value: '',
            trList
          },
          { value: '表格后正文结尾' }
        ]
      },
      options: {
        width: 600,
        height: 600
      }
    })

    const draw = editor.command.getDraw()
    const position = draw.getPosition()

    const lastPageNo = draw.getPageCount() - 1
    const lastPagePositions =
      (position as any).tablePagingPositionMap.get(lastPageNo) || []
    expect(lastPagePositions.length).toBeGreaterThan(0)
    const { leftBottom } = lastPagePositions[0].coordinate

    // 点击在最后一页表格下方空白区域（y > leftBottom[1]）
    const belowClickPosition = position.getPositionByXY({
      x: 150,
      y: leftBottom[1] + 30,
      pageNo: lastPageNo
    })

    // 断言：由于最后一页表格下方有普通段落，点击应精准命中表格后正文段落（isTable 为 false/undefined），而不是被表格拦截
    expect(belowClickPosition.isTable).toBeFalsy()
    expect(belowClickPosition.index).toBeGreaterThanOrEqual(1) // 命中表格后的段落元素

    destroy()
  })

  it('在无痕模式 (PREVIEW_EDIT) 下点击包含无数据控件的空白单元格，应精准定位到该单元格并显示光标', () => {
    const { editor, destroy } = createTestEditor({
      data: {
        main: [
          {
            type: ElementType.TABLE,
            value: '',
            trList: [
              {
                height: 40,
                tdList: [
                  {
                    colspan: 1,
                    rowspan: 1,
                    value: [
                      {
                        type: ElementType.CONTROL,
                        value: '',
                        control: {
                          conceptId: 'field1',
                          type: 'text' as any,
                          placeholder: '占位符1',
                          value: null
                        }
                      }
                    ]
                  },
                  {
                    colspan: 1,
                    rowspan: 1,
                    value: [
                      {
                        type: ElementType.CONTROL,
                        value: '',
                        control: {
                          conceptId: 'field2',
                          type: 'text' as any,
                          placeholder: '占位符2',
                          value: null
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      options: {
        mode: 'preview_edit' as any,
        width: 600,
        height: 600
      }
    })

    const draw = editor.command.getDraw()
    const position = draw.getPosition()
    const tablePos = position.getOriginalPositionList()[0]
    expect(tablePos).toBeDefined()

    // 点击第二个单元格的区域内部 (比如 x 处于第 2 个 td 内部)
    const td1Left = tablePos.coordinate.leftTop[0] + 300 // 假设第2列在300左右
    const clickPos = position.adjustPositionContext({
      x: td1Left + 50,
      y: tablePos.coordinate.leftTop[1] + 20
    })

    expect(clickPos).not.toBeNull()
    expect(clickPos?.isTable).toBe(true)
    expect(clickPos?.tdIndex).toBe(1)

    // 设置光标并验证光标位置已就绪
    draw.setCursor(clickPos?.tdValueIndex)
    const cursorPosition = position.getCursorPosition()
    expect(cursorPosition).not.toBeNull()

    // 2. 测试点击第 1 个单元格的右侧空白与底部空白
    const clickTd0Right = position.adjustPositionContext({
      x: tablePos.coordinate.leftTop[0] + 120, // 单元格右侧空白（第0列在0~200）
      y: tablePos.coordinate.leftTop[1] + 35 // 单元格底部
    })
    expect(clickTd0Right).not.toBeNull()
    expect(clickTd0Right?.isTable).toBe(true)
    expect(clickTd0Right?.tdIndex).toBe(0)

    draw.setCursor(clickTd0Right?.tdValueIndex)
    expect(position.getCursorPosition()).not.toBeNull()

    destroy()
  })

  it('当单元格内有文本内容时，点击单元格右侧大片空白区，光标应常驻在文本末尾且 cursorDom 处于 block 状态', () => {
    const { editor, destroy } = createTestEditor({
      data: {
        main: [
          {
            type: ElementType.TABLE,
            value: '',
            trList: [
              {
                height: 50,
                tdList: [
                  {
                    colspan: 1,
                    rowspan: 1,
                    width: 100,
                    value: [{ value: '1' }]
                  },
                  {
                    colspan: 1,
                    rowspan: 1,
                    width: 300,
                    value: [{ value: '考核项目与要求' }]
                  }
                ]
              }
            ]
          }
        ]
      },
      options: {
        width: 600,
        height: 600
      }
    })

    const draw = editor.command.getDraw()
    const position = draw.getPosition()
    const originalElementList = draw.getOriginalElementList()
    const tableIndex = originalElementList.findIndex(e => e.type === ElementType.TABLE)
    const tableElement = originalElementList[tableIndex]
    const tablePos = position.getOriginalPositionList()[tableIndex]
    expect(tablePos).toBeDefined()

    const td0 = tableElement.trList![0].tdList[0]
    const td1 = tableElement.trList![0].tdList[1]
    console.log('td0 info:', td0.x, td0.y, td0.width, td0.height, td0.positionList?.length)
    console.log('td1 info:', td1.x, td1.y, td1.width, td1.height, td1.positionList?.length)

    // 模拟点击 td0 右侧空白
    const clickX = tablePos.coordinate.leftTop[0] + td0.x! + td0.width! - 10
    const clickY = tablePos.coordinate.leftTop[1] + td0.y! + 25

    const clickPosition = position.adjustPositionContext({
      x: clickX,
      y: clickY
    })
    console.log('adjustPositionContext result:', clickPosition)

    const pageCanvas = draw.getPageList()[0]
    const mousedownEvt = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: clickX,
      clientY: clickY
    })
    Object.defineProperty(mousedownEvt, 'offsetX', { value: clickX })
    Object.defineProperty(mousedownEvt, 'offsetY', { value: clickY })
    Object.defineProperty(mousedownEvt, 'target', { value: pageCanvas })
    pageCanvas.dispatchEvent(mousedownEvt)

    const cursorDom = draw.getCursor().getCursorDom()
    console.log('cursorDom after mousedown:', cursorDom.style.display, cursorDom.style.left, cursorDom.style.top)

    expect(draw.getPosition().getPositionContext().isTable).toBe(true)
    expect(draw.getPosition().getPositionContext().tdIndex).toBe(0)
    expect(cursorDom.style.display).toBe('block')

    // 2. 测试点击 td1（包含“考核项目与要求”的多行单元格）的右下角大片空白区
    const clickTd1BottomRightX = tablePos.coordinate.leftTop[0] + td1.x! + td1.width! - 5
    const clickTd1BottomRightY = tablePos.coordinate.leftTop[1] + td1.y! + td1.height! - 5
    const clickTd1Pos = position.adjustPositionContext({
      x: clickTd1BottomRightX,
      y: clickTd1BottomRightY
    })
    expect(clickTd1Pos?.isTable).toBe(true)
    expect(clickTd1Pos?.tdIndex).toBe(1)
    expect(clickTd1Pos?.tdValueIndex).toBe(td1.value.length - 1)

    draw.setCursor(clickTd1Pos?.tdValueIndex)
    expect(draw.getCursor().getCursorDom().style.display).toBe('block')

    destroy()
  })
})

