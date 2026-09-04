import { describe, it, expect, afterEach } from 'vitest'
import { createTestEditor } from '../../../factories/editor'
import { ElementType } from '../../../../src/editor/dataset/enum/Element'
import { ControlType } from '../../../../src/editor/dataset/enum/Control'
import { EditorBridge } from '../../../../src/bridge/editorBridge'

describe('表格内图片控件 getControlList 测试', () => {
  let ctx: ReturnType<typeof createTestEditor>
  afterEach(() => ctx?.destroy())

  it('获取表格内图片控件信息（初始占位符）', () => {
    ctx = createTestEditor({
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
                        controlId: 'table-img-1',
                        control: {
                          type: ControlType.IMAGE,
                          conceptId: 'test_img',
                          placeholder: '图片占位',
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
      }
    })

    const controlList = ctx.editor.command.getControlList()
    console.log('SCENARIO 1 (Placeholder):', JSON.stringify(controlList, null, 2))
    expect(controlList.length).toBe(1)
  })

  it('获取表格内图片控件信息（初始带图片 value）', () => {
    ctx = createTestEditor({
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
                        controlId: 'table-img-2',
                        control: {
                          type: ControlType.IMAGE,
                          conceptId: 'test_img_with_val',
                          placeholder: '图片占位',
                          value: [
                            {
                              type: ElementType.IMAGE,
                              value: 'https://example.com/a.png',
                              width: 100,
                              height: 100
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
      }
    })

    const controlList = ctx.editor.command.getControlList()
    console.log('SCENARIO 2 (Initial with value):', JSON.stringify(controlList, null, 2))
    expect(controlList.length).toBe(1)
  })

  it('获取表格内图片控件信息（executeSetControlValue 填入图片后）', () => {
    ctx = createTestEditor({
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
                        controlId: 'table-img-3',
                        control: {
                          type: ControlType.IMAGE,
                          conceptId: 'avatar',
                          placeholder: '头像',
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
      }
    })

    ctx.editor.command.executeSetControlValue({
      conceptId: 'avatar',
      value: 'https://example.com/avatar.png'
    })

    const controlList = ctx.editor.command.getControlList()
    console.log('SCENARIO 3 (After executeSetControlValue):', JSON.stringify(controlList, null, 2))
    expect(controlList.length).toBe(1)
  })

  it('获取表格内图片控件信息（通过 EditorBridge 填充明细循环表格业务数据后）', () => {
    ctx = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })
    const bridge = new EditorBridge({
      instance: ctx.editor,
      updateComponents: () => {},
      setCustomConfig: () => {}
    })

    const template = {
      main: [
        {
          type: ElementType.TABLE,
          value: '',
          trList: [
            {
              height: 35,
              tdList: [
                { colspan: 1, rowspan: 1, value: [{ value: '检测项目' }] },
                { colspan: 1, rowspan: 1, value: [{ value: '结果' }] },
                { colspan: 1, rowspan: 1, value: [{ value: '单位' }] },
                { colspan: 1, rowspan: 1, value: [{ value: '示意图表' }] }
              ]
            },
            {
              height: 40,
              loopConfig: {
                isLoopRow: true,
                datasetId: 'records'
              },
              tdList: [
                {
                  colspan: 1,
                  rowspan: 1,
                  value: [
                    {
                      type: ElementType.CONTROL,
                      value: '',
                      control: {
                        conceptId: 'item_name',
                        type: ControlType.TEXT,
                        placeholder: '项目'
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
                        conceptId: 'item_value',
                        type: ControlType.TEXT,
                        placeholder: '数值'
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
                        conceptId: 'item_unit',
                        type: ControlType.TEXT,
                        placeholder: '单位'
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
                        conceptId: 'item_chart',
                        type: ControlType.IMAGE,
                        placeholder: '示意图表',
                        width: 160,
                        height: 90
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }

    const businessData = {
      records: [
        {
          item_name: '白细胞计数 (WBC)',
          item_value: '11.2',
          item_unit: '10^9/L',
          item_chart: 'https://example.com/chart1.png'
        },
        {
          item_name: '中性粒细胞比例 (NEUT%)',
          item_value: '82.5',
          item_unit: '%',
          item_chart: 'https://example.com/chart2.png'
        }
      ]
    }

    ;(bridge as any).executeRenderPayload(
      { template, businessData },
      { updateComponents: () => {}, setCustomConfig: () => {} }
    )
    bridge.setControlValueList(businessData)

    const tableEl = ctx.editor.command.getValue().data.main[0]
    expect(tableEl.type).toBe(ElementType.TABLE)
    expect(tableEl.trList!.length).toBe(3) // 1 表头 + 2 数据行

    // 检查第 1 行明细的图片
    const row1ChartTd = tableEl.trList![1].tdList[3]
    const row1Ctrl = row1ChartTd.value.find((v: any) => v.type === 'control' || v.control)
    const row1ImgNode = row1Ctrl?.control?.value?.find((v: any) => v.type === 'image') || row1ChartTd.value.find((v: any) => v.type === 'image')
    expect(row1ImgNode).toBeDefined()
    expect(row1ImgNode!.value).toBe('https://example.com/chart1.png')

    // 检查第 2 行明细的图片
    const row2ChartTd = tableEl.trList![2].tdList[3]
    const row2Ctrl = row2ChartTd.value.find((v: any) => v.type === 'control' || v.control)
    const row2ImgNode = row2Ctrl?.control?.value?.find((v: any) => v.type === 'image') || row2ChartTd.value.find((v: any) => v.type === 'image')
    expect(row2ImgNode).toBeDefined()
    expect(row2ImgNode!.value).toBe('https://example.com/chart2.png')
  })

  it('单元格多张图片数组填充 & 空数组保留占位符测试', () => {
    ctx = createTestEditor({
      data: { main: [{ value: '\n' }] }
    })
    const bridge = new EditorBridge({
      instance: ctx.editor,
      updateComponents: () => {},
      setCustomConfig: () => {}
    })

    const template = {
      main: [
        {
          type: ElementType.TABLE,
          conceptId: 'records',
          colgroup: [{ width: 200 }, { width: 400 }],
          trList: [
            {
              height: 35,
              isHeader: true,
              tdList: [
                { colspan: 1, rowspan: 1, value: [{ value: '姓名' }] },
                { colspan: 1, rowspan: 1, value: [{ value: '照片集' }] }
              ]
            },
            {
              height: 50,
              loopConfig: {
                isLoopRow: true,
                datasetId: 'records'
              },
              tdList: [
                {
                  colspan: 1,
                  rowspan: 1,
                  value: [
                    {
                      type: ElementType.CONTROL,
                      value: '',
                      control: {
                        conceptId: 'name',
                        type: ControlType.TEXT,
                        placeholder: '姓名'
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
                        conceptId: 'photos',
                        type: ControlType.IMAGE,
                        placeholder: '照片'
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }

    const businessData = {
      records: [
        {
          name: '张三',
          photos: [
            'https://example.com/pic1.png',
            'https://example.com/pic2.png'
          ]
        },
        {
          name: '李四',
          photos: []
        }
      ]
    }

    ;(bridge as any).executeRenderPayload(
      { template, businessData },
      { updateComponents: () => {}, setCustomConfig: () => {} }
    )
    bridge.setControlValueList(businessData)

    const tableEl = ctx.editor.command.getValue().data.main[0]
    expect(tableEl.type).toBe(ElementType.TABLE)
    expect(tableEl.trList?.length).toBe(3) // 1 表头 + 2 数据行

    // 检查第 1 行的多图
    const row1PhotosTd = tableEl.trList![1].tdList[1]
    const row1Ctrl = row1PhotosTd.value.find((v: any) => v.type === 'control' || v.control)
    const row1ImgNodes = row1Ctrl?.control?.value?.filter((v: any) => v.type === 'image') || row1PhotosTd.value.filter((v: any) => v.type === 'image')
    expect(row1ImgNodes.length).toBe(2)
    expect(row1ImgNodes[0].value).toBe('https://example.com/pic1.png')
    expect(row1ImgNodes[1].value).toBe('https://example.com/pic2.png')

    // 检查第 2 行空数组
    const row2PhotosTd = tableEl.trList![2].tdList[1]
    const row2Ctrl = row2PhotosTd.value.find((v: any) => v.type === 'control' || v.control)
    const row2ImgNodes = row2Ctrl?.control?.value?.filter((v: any) => v.type === 'image') || row2PhotosTd.value.filter((v: any) => v.type === 'image')
    expect(row2ImgNodes.length).toBe(0)
  })
})
