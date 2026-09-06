import { describe, expect, it } from 'vitest'
import Editor from '../../../src/editor'
import { Draw } from '../../../src/editor/core/draw/Draw'
import { Listener } from '../../../src/editor/core/listener/Listener'
import { EventBus } from '../../../src/editor/core/event/eventbus/EventBus'
import { Override } from '../../../src/editor/core/override/Override'
import { mergeOption } from '../../../src/editor/utils/option'
import { formatElementList } from '../../../src/editor/utils/element'
import { ElementType } from '../../../src/editor/dataset/enum/Element'
import { VerticalAlign } from '../../../src/editor/dataset/enum/VerticalAlign'
import { TdTextDirection } from '../../../src/editor/dataset/enum/table/Table'
import { EditorMode } from '../../../src/editor/dataset/enum/Editor'
import { ControlType } from '../../../src/editor/dataset/enum/Control'

describe('Table Cell Vertical Alignment', () => {
  it('should keep single line cell top aligned by default when row is stretched by adjacent cell', () => {
    const container = document.createElement('div')
    const options = mergeOption({})
    const mainList = [
      {
        type: ElementType.TABLE,
        value: '',
        colgroup: [
          { width: 100 },
          { width: 300 }
        ],
        trList: [
          {
            height: 40,
            tdList: [
              {
                colspan: 1,
                rowspan: 1,
                value: [{ value: '评估时间：' }]
              },
              {
                colspan: 1,
                rowspan: 1,
                value: [
                  {
                    value:
                      '第一行长文本\n第二行长文本\n第三行长文本\n第四行长文本\n第五行长文本'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
    formatElementList(mainList, { editorOptions: options, isForceCompensation: true })

    const draw = new Draw(
      container,
      options,
      { header: [{ value: '\n' }], main: mainList, footer: [{ value: '\n' }] },
      new Listener(),
      new EventBus(),
      new Override()
    )

    const table = draw.getOriginalMainElementList().find(el => el.type === ElementType.TABLE)!
    const tr = table.trList![0]
    const leftTd = tr.tdList[0]
    const rightTd = tr.tdList[1]

    // 验证右侧撑高了整行
    expect(rightTd.rowList!.length).toBeGreaterThan(1)
    expect(tr.height).toBeGreaterThan(40)

    // 验证左侧单行单元格：td.verticalAlign 未设置
    expect(leftTd.verticalAlign).toBeUndefined()
    expect(leftTd.rowList!.length).toBe(1)

    // 验证左侧单元格内的文本元素位置是在顶部（即 y 坐标接近单元格顶部，没有被偏移到中间）
    const leftPosList = leftTd.positionList!
    expect(leftPosList.length).toBeGreaterThan(0)
    const firstCharPos = leftPosList[0]

    // 默认 tdPadding[0] 为 0，未发生 MIDDLE 偏移时，文字 Y 坐标与 td 起始 Y 坐标相近
    const cellTopY = (leftTd as any)._posStartY || 0
    const charTopY = firstCharPos.coordinate.leftTop[1]
    const diffY = charTopY - cellTopY

    // 顶端对齐时，距离单元格顶部的距离仅为 padding 和第一行高度，远小于居中偏移
    expect(diffY).toBeLessThan(30)
  })

  it('should respect explicitly specified VerticalAlign.MIDDLE and VerticalAlign.BOTTOM', () => {
    const container = document.createElement('div')
    const options = mergeOption({})
    const mainList = [
      {
        type: ElementType.TABLE,
        value: '',
        colgroup: [
          { width: 100 },
          { width: 300 }
        ],
        trList: [
          {
            height: 120,
            minHeight: 120,
            tdList: [
              {
                colspan: 1,
                rowspan: 1,
                verticalAlign: VerticalAlign.MIDDLE,
                value: [{ value: '居中' }]
              },
              {
                colspan: 1,
                rowspan: 1,
                value: [
                  {
                    value: '第一行\n第二行\n第三行\n第四行\n第五行'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
    formatElementList(mainList, { editorOptions: options, isForceCompensation: true })

    const draw = new Draw(
      container,
      options,
      { header: [{ value: '\n' }], main: mainList, footer: [{ value: '\n' }] },
      new Listener(),
      new EventBus(),
      new Override()
    )

    const table = draw.getOriginalMainElementList().find(el => el.type === ElementType.TABLE)!
    const middleTd = table.trList![0].tdList[0]

    expect(middleTd.verticalAlign).toBe(VerticalAlign.MIDDLE)
    const posList = middleTd.positionList!
    const cellTopY = (middleTd as any)._posStartY || 0
    const charTopY = posList[0].coordinate.leftTop[1]
    const diffY = charTopY - cellTopY

    // 明确声明 MIDDLE 且单元格高度为 120 时，产生显著居中下移（超过 35px）
    expect(diffY).toBeGreaterThan(35)
  })

  it('should dynamically update vertical alignment when calling executeTableTdVerticalAlign command', () => {
    const container = document.createElement('div')
    const mainList = [
      {
        type: ElementType.TABLE,
        value: '',
        colgroup: [
          { width: 100 },
          { width: 300 }
        ],
        trList: [
          {
            height: 120,
            minHeight: 120,
            tdList: [
              {
                colspan: 1,
                rowspan: 1,
                value: [{ value: '测试文字' }]
              },
              {
                colspan: 1,
                rowspan: 1,
                value: [
                  {
                    value: '第一行\n第二行\n第三行\n第四行\n第五行'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]

    const editor = new Editor(container, { main: mainList }, { mode: EditorMode.EDIT })
    const draw = editor.command.getDraw()

    const tableIndex = draw.getOriginalMainElementList().findIndex(el => el.type === ElementType.TABLE)
    const table = draw.getOriginalMainElementList()[tableIndex]
    const targetTd = table.trList![0].tdList[0]

    // 模拟光标置于 targetTd 内部
    draw.getPosition().setPositionContext({
      isTable: true,
      index: tableIndex,
      trIndex: 0,
      tdIndex: 0,
      tdId: targetTd.id,
      trId: table.trList![0].id,
      tableId: table.id
    })

    const initialY = targetTd.positionList![0].coordinate.leftTop[1]

    // 1. 设置为 MIDDLE 垂直居中对齐
    editor.command.executeTableTdVerticalAlign(VerticalAlign.MIDDLE)
    expect(targetTd.verticalAlign).toBe(VerticalAlign.MIDDLE)
    const middleY = targetTd.positionList![0].coordinate.leftTop[1]
    expect(middleY).toBeGreaterThan(initialY + 20)

    // 2. 设置为 BOTTOM 垂直底部对齐
    editor.command.executeTableTdVerticalAlign(VerticalAlign.BOTTOM)
    expect(targetTd.verticalAlign).toBe(VerticalAlign.BOTTOM)
    const bottomY = targetTd.positionList![0].coordinate.leftTop[1]
    expect(bottomY).toBeGreaterThan(middleY + 10)

    // 3. 再次设置回 TOP 顶端对齐
    editor.command.executeTableTdVerticalAlign(VerticalAlign.TOP)
    expect(targetTd.verticalAlign).toBe(VerticalAlign.TOP)
    const topY = targetTd.positionList![0].coordinate.leftTop[1]
    expect(topY).toBe(initialY)
  })

  it('should correctly execute table row and column manipulations and cell merging under decoupled subsystem', () => {
    const container = document.createElement('div')
    const mainList = [
      {
        type: ElementType.TABLE,
        value: '',
        colgroup: [
          { width: 100 },
          { width: 100 }
        ],
        trList: [
          {
            height: 40,
            tdList: [
              { colspan: 1, rowspan: 1, value: [{ value: 'R0C0' }] },
              { colspan: 1, rowspan: 1, value: [{ value: 'R0C1' }] }
            ]
          },
          {
            height: 40,
            tdList: [
              { colspan: 1, rowspan: 1, value: [{ value: 'R1C0' }] },
              { colspan: 1, rowspan: 1, value: [{ value: 'R1C1' }] }
            ]
          }
        ]
      }
    ]

    const editor = new Editor(container, { main: mainList }, { mode: EditorMode.EDIT })
    const draw = editor.command.getDraw()
    const tableIndex = draw.getOriginalMainElementList().findIndex(el => el.type === ElementType.TABLE)
    let table = draw.getOriginalMainElementList()[tableIndex]

    // 1. 初始为 2行2列
    expect(table.trList!.length).toBe(2)
    expect(table.colgroup!.length).toBe(2)

    // 选中 R0C0
    draw.getPosition().setPositionContext({
      isTable: true,
      index: tableIndex,
      trIndex: 0,
      tdIndex: 0,
      tdId: table.trList![0].tdList[0].id,
      trId: table.trList![0].id,
      tableId: table.id
    })

    // 2. 在下方插入一行
    editor.command.executeInsertTableBottomRow()
    table = draw.getOriginalMainElementList()[tableIndex]
    expect(table.trList!.length).toBe(3)

    // 3. 在右侧插入一列
    editor.command.executeInsertTableRightCol()
    table = draw.getOriginalMainElementList()[tableIndex]
    expect(table.colgroup!.length).toBe(3)

    // 4. 删除一行
    editor.command.executeDeleteTableRow()
    table = draw.getOriginalMainElementList()[tableIndex]
    expect(table.trList!.length).toBe(2)

    // 重新聚焦到剩余单元格
    draw.getPosition().setPositionContext({
      isTable: true,
      index: tableIndex,
      trIndex: 0,
      tdIndex: 0,
      tdId: table.trList![0].tdList[0].id,
      trId: table.trList![0].id,
      tableId: table.id
    })

    // 5. 删除一列
    editor.command.executeDeleteTableCol()
    table = draw.getOriginalMainElementList()[tableIndex]
    expect(table.colgroup!.length).toBe(2)
  })

  it('should automatically dispose tableTool when table cell loses focus (blur)', () => {
    const container = document.createElement('div')
    const mainList = [
      {
        type: ElementType.TABLE,
        value: '',
        colgroup: [
          { width: 100 },
          { width: 100 }
        ],
        trList: [
          {
            height: 40,
            tdList: [
              { colspan: 1, rowspan: 1, value: [{ value: 'Cell 1' }] }
            ]
          }
        ]
      }
    ]

    const editor = new Editor(container, { main: mainList }, { mode: EditorMode.EDIT })
    const draw = editor.command.getDraw()
    const tableIndex = draw.getOriginalMainElementList().findIndex(el => el.type === ElementType.TABLE)
    const table = draw.getOriginalMainElementList()[tableIndex]

    // 1. 模拟光标聚焦在单元格内部并渲染 TableTool
    draw.getPosition().setPositionContext({
      isTable: true,
      index: tableIndex,
      trIndex: 0,
      tdIndex: 0,
      tdId: table.trList![0].tdList[0].id,
      trId: table.trList![0].id,
      tableId: table.id
    })
    draw.getTableTool().render()
    expect((draw.getTableTool() as any).toolRowContainer).not.toBeNull()

    // 2. 调用 blur 失焦命令
    editor.command.executeBlur()

    // 3. 验证 TableTool 状态已被彻底移除清空
    expect((draw.getTableTool() as any).toolRowContainer).toBeNull()
    expect((draw.getTableTool() as any).toolColContainer).toBeNull()
  })

  it('should align to bottom when row is split across pages into fragments but cell content is fully on the first page', () => {
    const container = document.createElement('div')
    // 构造一个单页可用高度约 400px 的环境
    const options = mergeOption({
      height: 600,
      margins: [100, 100, 100, 100] // 可用内容高 400px
    })
    const mainList = [
      {
        type: ElementType.TABLE,
        value: '',
        colgroup: [
          { width: 150 },
          { width: 350 }
        ],
        trList: [
          {
            height: 40,
            tdList: [
              {
                colspan: 1,
                rowspan: 1,
                verticalAlign: VerticalAlign.BOTTOM,
                value: [{ value: '短文本居底' }]
              },
              {
                colspan: 1,
                rowspan: 1,
                value: [
                  {
                    // 构造约 500px 高的多行文本，超出单页 400px 可用高度，使该行发生跨页拆分
                    value: Array(25).fill('长内容行').join('\n')
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
    formatElementList(mainList, { editorOptions: options, isForceCompensation: true })

    const draw = new Draw(
      container,
      options,
      { header: [{ value: '\n' }], main: mainList, footer: [{ value: '\n' }] },
      new Listener(),
      new EventBus(),
      new Override()
    )

    // 验证发生了跨页拆分
    expect(draw.getPageRowList().length).toBeGreaterThan(1)

    const table = draw.getOriginalMainElementList().find(el => el.type === ElementType.TABLE)!
    const tr = table.trList![0]
    const leftTd = tr.tdList[0]

    expect(leftTd.verticalAlign).toBe(VerticalAlign.BOTTOM)
    const leftPosList = leftTd.positionList!
    expect(leftPosList.length).toBeGreaterThan(0)

    const cellTopY = (leftTd as any)._posStartY || 0
    const charTopY = leftPosList[0].coordinate.leftTop[1]
    const diffY = charTopY - cellTopY

    // 验证左侧短文本没有停留在顶部，而是向下偏移居底（在约 400px 高的片段中偏移远大于 250px）
    expect(diffY).toBeGreaterThan(250)
  })

  it('should dynamically switch text direction when calling executeTableTdTextDirection command', () => {
    const container = document.createElement('div')
    const mainList = [
      {
        type: ElementType.TABLE,
        value: '',
        colgroup: [
          { width: 200 },
          { width: 200 }
        ],
        trList: [
          {
            height: 60,
            tdList: [
              {
                colspan: 1,
                rowspan: 1,
                value: [
                  {
                    value: '加工制作环节'
                  }
                ]
              },
              {
                colspan: 1,
                rowspan: 1,
                value: [
                  {
                    value: '右侧内容'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]

    const editor = new Editor(container, { main: mainList }, { mode: EditorMode.EDIT })
    const draw = editor.command.getDraw()
    const tableIndex = draw.getOriginalMainElementList().findIndex(el => el.type === ElementType.TABLE)
    const table = draw.getOriginalMainElementList()[tableIndex]
    const targetTd = table.trList![0].tdList[0]

    // 初始状态下横排：单行排版，行数为 1
    expect(targetTd.textDirection).toBeUndefined()
    expect(targetTd.rowList!.length).toBe(1)

    // 选中该单元格
    draw.getPosition().setPositionContext({
      isTable: true,
      index: tableIndex,
      trIndex: 0,
      tdIndex: 0,
      tdId: targetTd.id,
      trId: table.trList![0].id,
      tableId: table.id
    })

    // 动态执行设置文字方向为 VERTICAL (直排/竖排)
    editor.command.executeTableTdTextDirection(TdTextDirection.VERTICAL)

    // 验证文字方向已更新
    expect(targetTd.textDirection).toBe(TdTextDirection.VERTICAL)
    // 验证排版已重新执行并拆分为竖排多行（每个字符独立成行，共6行）
    expect(targetTd.rowList!.length).toBe(6)

    // 验证每个字符垂直坐标单调递增（首元素为 ZERO，之后 6 个字符自上向下垂直排列）
    const posList = targetTd.positionList!
    expect(posList.length).toBe(7)
    for (let i = 2; i < posList.length; i++) {
      expect(posList[i].coordinate.leftTop[1]).toBeGreaterThan(posList[i - 1].coordinate.leftTop[1])
    }

    // 再次切回 HORIZONTAL (横排)
    editor.command.executeTableTdTextDirection(TdTextDirection.HORIZONTAL)
    expect(targetTd.textDirection).toBe(TdTextDirection.HORIZONTAL)
    expect(targetTd.rowList!.length).toBe(1)
  })

  it('should format vertical text inside a control in PREVIEW_EDIT mode without phantom rows', () => {
    const container = document.createElement('div')
    const mainList = [
      {
        type: ElementType.TABLE,
        value: '',
        colgroup: [{ width: 200 }],
        trList: [
          {
            height: 60,
            tdList: [
              {
                colspan: 1,
                rowspan: 1,
                value: [
                  {
                    value: '',
                    type: ElementType.CONTROL,
                    control: {
                      type: ControlType.TEXT,
                      prefix: '{',
                      postfix: '}',
                      value: [
                        {
                          value: '加工制作环节',
                          type: ElementType.TEXT
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]

    const editor = new Editor(container, { main: mainList }, { mode: EditorMode.PREVIEW_EDIT })
    const draw = editor.command.getDraw()
    const tableIndex = draw.getOriginalMainElementList().findIndex(el => el.type === ElementType.TABLE)
    const table = draw.getOriginalMainElementList()[tableIndex]
    const targetTd = table.trList![0].tdList[0]

    draw.getPosition().setPositionContext({
      isTable: true,
      index: tableIndex,
      trIndex: 0,
      tdIndex: 0,
      tdId: targetTd.id,
      trId: table.trList![0].id,
      tableId: table.id
    })

    editor.command.executeTableTdTextDirection(TdTextDirection.VERTICAL)

    expect(targetTd.textDirection).toBe(TdTextDirection.VERTICAL)
    expect(targetTd.rowList!.length).toBe(6)
  })

  it('should update bottom aligned cell position correctly when sibling cell height decreases (no text overlap)', () => {
    const container = document.createElement('div')
    const options = mergeOption({})
    const mainList = [
      {
        type: ElementType.TABLE,
        value: '',
        colgroup: [
          { width: 150 },
          { width: 250 }
        ],
        trList: [
          {
            height: 40,
            tdList: [
              {
                colspan: 1,
                rowspan: 1,
                verticalAlign: VerticalAlign.BOTTOM,
                value: [{ value: '许可证损毁未及时补办\n许可证过期' }]
              },
              {
                colspan: 1,
                rowspan: 1,
                value: [
                  {
                    value:
                      '食品分类密封\n存放，生熟分\n区，避免交叉\n污染；\n冷冻食材标注\n存放日期，'
                  }
                ]
              }
            ]
          },
          {
            height: 40,
            tdList: [
              {
                colspan: 1,
                rowspan: 1,
                value: [{ value: '许可证造假' }]
              },
              {
                colspan: 1,
                rowspan: 1,
                value: [{ value: '暂无' }]
              }
            ]
          }
        ]
      }
    ]
    formatElementList(mainList, { editorOptions: options, isForceCompensation: true })

    const draw = new Draw(
      container,
      options,
      { header: [{ value: '\n' }], main: mainList, footer: [{ value: '\n' }] },
      new Listener(),
      new EventBus(),
      new Override()
    )

    const table = draw.getOriginalMainElementList().find(el => el.type === ElementType.TABLE)!
    const tr0 = table.trList![0]
    const leftTd0 = tr0.tdList[0]
    const rightTd0 = tr0.tdList[1]
    const tr1 = table.trList![1]
    const leftTd1 = tr1.tdList[0]

    // 初始状态：右侧单元格撑高了整行
    const initialTr0Height = tr0.height!
    expect(initialTr0Height).toBeGreaterThan(60)

    // 左侧单元格为底部对齐，其文字坐标向下偏移到了 initialTr0Height 附近
    const initialLeftPosList = leftTd0.positionList!
    const lastCharInitialBottomY = initialLeftPosList[initialLeftPosList.length - 1].coordinate.leftBottom[1]

    // 现在删除右侧单元格的大部分内容，使得整行行高大幅缩减
    rightTd0.value = [{ value: '短文本' }]
    draw.render({ isSubmitHistory: false })

    // 验证第一行行高已经减小
    const updatedTr0Height = tr0.height!
    expect(updatedTr0Height).toBeLessThan(initialTr0Height)

    // 获取缩小后左单元格的最新坐标与第一行、第二行单元格边界
    const updatedLeftPosList = leftTd0.positionList!
    const lastCharUpdatedBottomY = updatedLeftPosList[updatedLeftPosList.length - 1].coordinate.leftBottom[1]

    // 获取第二行左单元格文字的起始顶部 Y 坐标
    const secondRowFirstCharTopY = leftTd1.positionList![0].coordinate.leftTop[1]

    // 核心断言：
    // 1. 第一行左单元格的文字在行高减小后，其 Y 坐标必须相应往上提，不能复用旧的超大偏移量
    expect(lastCharUpdatedBottomY).toBeLessThan(lastCharInitialBottomY)

    // 2. 第一行左侧单元格的最底端文字，绝对不可覆盖侵入第二行文字的顶部（必须严格小于第二行起始 Y）
    expect(lastCharUpdatedBottomY).toBeLessThanOrEqual(secondRowFirstCharTopY)
  })
})



