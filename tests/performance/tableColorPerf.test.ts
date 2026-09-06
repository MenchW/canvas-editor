import { describe, test, expect } from 'vitest'
import { Editor } from '../../src/editor'
import { ElementType } from '../../src/editor/dataset/enum/Element'
import { EditorMode } from '../../src/editor/dataset/enum/Editor'
import { IElement } from '../../src/editor/interface/Element'

describe('Table Color Performance Benchmark', () => {
  test('large table color benchmark', async () => {
    // 构造一个具有 200 行 x 6 列 = 1200 个单元格的长表格
    const trList = []
    for (let r = 0; r < 200; r++) {
      const tdList = []
      for (let c = 0; c < 6; c++) {
        tdList.push({
          rowspan: 1,
          colspan: 1,
          value: [
            {
              value: `R${r}C${c} 内容测试文本`,
              size: 16
            }
          ]
        })
      }
      trList.push({
        height: 40,
        tdList
      })
    }

    const data: IElement[] = [
      {
        value: '标题：长表格测试\n',
        size: 20
      },
      {
        id: 'test-table-1',
        type: ElementType.TABLE,
        value: '',
        colgroup: [
          { width: 80 },
          { width: 100 },
          { width: 100 },
          { width: 100 },
          { width: 100 },
          { width: 80 }
        ],
        trList
      },
      {
        value: '\n结束文本'
      }
    ]

    const container = document.createElement('div')
    document.body.appendChild(container)
    const editor = new Editor(container, data, {
      mode: EditorMode.EDIT
    })

    let contentChangeCount = 0
    editor.listener.contentChange = async () => {
      contentChangeCount++
    }

    // 选中单元格内部文字
    const draw = editor.command.getDraw()
    const tableIndex = draw.getOriginalElementList().findIndex(el => el.type === ElementType.TABLE)
    const tableElement = draw.getOriginalElementList()[tableIndex]

    draw.getPosition().setPositionContext({
      isTable: true,
      index: tableIndex,
      trIndex: 5,
      tdIndex: 1
    })
    draw.getRange().replaceRange({
      startIndex: 0,
      endIndex: 1,
      isCrossRowCol: true,
      startTrIndex: 5,
      endTrIndex: 7,
      startTdIndex: 1,
      endTdIndex: 3,
      tableId: tableElement.id
    })

    const sel = draw.getRange().getSelectionElementList()!
    expect(sel.length).toBeGreaterThan(0)

    // 设置颜色
    editor.command.executeColor('#00ff00')
    expect(sel[0].color).toBe('#00ff00')

    await new Promise(r => setTimeout(r, 50))
    // 纯变色不触发 contentChange
    expect(contentChangeCount).toBe(0)

    // 撤销颜色
    editor.command.executeUndo()
    const currentTable = draw.getOriginalElementList()[tableIndex]
    const cellValue = currentTable.trList![5].tdList[1].value
    expect(cellValue[0].color).toBeUndefined()

    editor.destroy()
    container.remove()
  })
})
